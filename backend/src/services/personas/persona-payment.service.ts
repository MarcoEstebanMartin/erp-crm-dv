import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';
import { Role, PaymentMethod, TransactionType, BillingType } from '@prisma/client';
import {
  roundToIntegerPeso,
  roundToTwoDecimals,
  toDecimal,
} from '../../core/money';

export class PersonaPaymentSubService {
  /**
   * Registra pago o cobro en la cuenta corriente de una persona con Decimal.js (cero centavos fantasma),
   * impactando Caja/Banco, retenciones sufridas y el Libro Mayor de Cuenta Corriente.
   */
  async recordPersonaPayment(id: number, data: any, userId: number, userRole: string) {
    const {
      description,
      branch,
      type,
      supplierInvoiceId,
      orderId,
      bankAccountId: reqBankAccountId,
    } = data;
    const selectedBranch = branch || 'X';

    const persona = await prisma.persona.findUnique({ where: { id } });
    if (!persona) throw new Error('Persona no encontrada.');

    if (userRole === Role.VENDEDOR && persona.isClient && persona.sellerId !== userId) {
      throw new Error('Acceso denegado.');
    }

    const isSupplier = persona.isProvider && !persona.isClient;
    const resolvedType =
      type === 'OUTCOME' || type === 'INCOME'
        ? (type as TransactionType)
        : isSupplier
          ? TransactionType.OUTCOME
          : TransactionType.INCOME;

    const rawPayments =
      Array.isArray(data.payments) && data.payments.length > 0
        ? data.payments
        : [
            {
              amount: data.amount,
              paymentMethod: data.paymentMethod,
              bankAccountId: reqBankAccountId,
              description: data.description,
            },
          ];

    const paymentItems = rawPayments.map((p: any) => ({
      amount: roundToTwoDecimals(p.amount || 0).toNumber(),
      paymentMethod: p.paymentMethod as PaymentMethod,
      bankAccountId: p.bankAccountId
        ? Number(p.bankAccountId)
        : reqBankAccountId
          ? Number(reqBankAccountId)
          : null,
      description: p.description || description,
    }));

    const totalPaymentDec = paymentItems.reduce(
      (acc: any, p: any) => acc.plus(toDecimal(p.amount)),
      toDecimal(0),
    );
    const totalPaymentAmount = roundToTwoDecimals(totalPaymentDec).toNumber();

    if (totalPaymentAmount <= 0) {
      throw new Error('El monto total a pagar debe ser mayor a 0.');
    }

    // Control de duplicados (Idempotencia) para cobro individual de clientes (15s)
    if (resolvedType === TransactionType.INCOME && paymentItems.length === 1) {
      const fifteenSecondsAgo = new Date(Date.now() - 15000);
      const duplicateTx = await prisma.transaction.findFirst({
        where: {
          personaId: persona.id,
          amount: paymentItems[0].amount,
          paymentMethod: paymentItems[0].paymentMethod,
          type: TransactionType.INCOME,
          createdAt: { gte: fifteenSecondsAgo },
        },
      });
      if (duplicateTx) {
        throw new Error(
          'Ya se registró un cobro idéntico para este cliente hace instantes. Por favor, verifica el historial.',
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let invoiceNumberToLog = '';
      if (supplierInvoiceId) {
        const supplierInvoice = await tx.supplierInvoice.findUnique({
          where: { id: Number(supplierInvoiceId) },
        });
        if (!supplierInvoice) throw new Error('Factura de proveedor no encontrada.');
        if (supplierInvoice.personaId !== persona.id) {
          throw new Error('El comprobante no pertenece a este proveedor.');
        }

        const newPaidDec = roundToTwoDecimals(
          toDecimal(supplierInvoice.paidAmount || 0).plus(totalPaymentAmount),
        );
        const newStatus = newPaidDec.greaterThanOrEqualTo(toDecimal(supplierInvoice.totalAmount))
          ? 'PAID'
          : 'PARTIALLY_PAID';

        await tx.supplierInvoice.update({
          where: { id: supplierInvoice.id },
          data: { paidAmount: newPaidDec.toNumber(), status: newStatus },
        });
        invoiceNumberToLog = supplierInvoice.invoiceNumber;
      }

      let orderNumberDesc = '';
      if (orderId) {
        const targetOrder = await tx.order.findUnique({ where: { id: Number(orderId) } });
        if (targetOrder) {
          orderNumberDesc =
            targetOrder.invoiceNumber || `INT-${targetOrder.id.toString().padStart(5, '0')}`;
        }
      }

      const createdTransactions = [];

      for (const item of paymentItems) {
        let cashDrawerId: number | null = null;
        if (item.paymentMethod === PaymentMethod.CASH) {
          const activeDrawer =
            (await tx.cashDrawer.findFirst({ where: { userId, status: 'OPEN' } })) ||
            (await tx.cashDrawer.findFirst({ where: { status: 'OPEN' } }));

          if (!activeDrawer) {
            const user = await tx.user.findUnique({ where: { id: userId } });
            if (user && (user.role === Role.ADMIN || user.role === Role.FACTURACION)) {
              cashDrawerId = null;
            } else {
              throw new Error(
                'Debés tener una Caja Abierta antes de registrar cobros/pagos en efectivo.',
              );
            }
          } else {
            cashDrawerId = activeDrawer.id;
          }
        }

        let bankAccountId: number | null = null;
        if (
          item.paymentMethod === PaymentMethod.BANK_TRANSFER ||
          item.paymentMethod === PaymentMethod.CHECK
        ) {
          const selectedBankId = item.bankAccountId
            ? Number(item.bankAccountId)
            : (await tx.bankAccount.findFirst())?.id;
          if (!selectedBankId) {
            throw new Error('No hay ninguna cuenta bancaria registrada en el sistema.');
          }
          bankAccountId = Number(selectedBankId);

          await tx.bankAccount.update({
            where: { id: bankAccountId },
            data: {
              balance: {
                increment:
                  resolvedType === TransactionType.INCOME ? item.amount : -item.amount,
              },
            },
          });
        }

        const transaction = await tx.transaction.create({
          data: {
            personaId: persona.id,
            userId,
            billingType: selectedBranch === 'A' ? BillingType.OFFICIAL : BillingType.INTERNAL,
            type: resolvedType,
            paymentMethod: item.paymentMethod,
            amount: item.amount,
            description:
              item.description ||
              (supplierInvoiceId
                ? `Pago de Factura Nro ${invoiceNumberToLog}`
                : orderId
                  ? `Cobro de Factura ${orderNumberDesc}`
                  : `${resolvedType === TransactionType.OUTCOME ? 'Pago' : 'Cobro'} en cuenta corriente de ${persona.name}`),
            cashDrawerId,
            bankAccountId,
            supplierInvoiceId: supplierInvoiceId ? Number(supplierInvoiceId) : null,
            orderId: orderId ? Number(orderId) : null,
            verified: true,
          },
        });
        createdTransactions.push(transaction);
      }

      let retencionesDec = toDecimal(0);
      if (data.retenciones && Array.isArray(data.retenciones)) {
        for (const ret of data.retenciones) {
          const retAmt = roundToTwoDecimals(ret.amount || 0);
          retencionesDec = retencionesDec.plus(retAmt);
          await tx.taxWithholding.create({
            data: {
              type: 'RETENCION_SUFRIDA',
              taxType: ret.taxType,
              personaId: persona.id,
              number: ret.number,
              date: new Date(),
              amount: retAmt.toNumber(),
              jurisdiction: ret.taxType === 'IIBB' ? 'AR-B' : null,
            },
          });
        }
      }

      const totalCredit = roundToIntegerPeso(totalPaymentDec.plus(retencionesDec)).toNumber();

      const updatedPersona = await tx.persona.update({
        where: { id: persona.id },
        data: {
          outstandingBalance: {
            decrement: resolvedType === TransactionType.INCOME ? totalCredit : -totalCredit,
          },
        },
      });

      return {
        transaction: createdTransactions[0],
        transactions: createdTransactions,
        updatedPersona,
      };
    });

    await logAudit({
      userId,
      action: 'RECORD_PERSONA_PAYMENT',
      entityType: 'Persona',
      entityId: persona.id,
      newValues: {
        transactionCount: result.transactions.length,
        totalAmount: totalPaymentAmount,
        type: resolvedType,
        newOutstandingBalance: result.updatedPersona.outstandingBalance.toString(),
      },
    });

    return result;
  }
}

export const personaPaymentSubService = new PersonaPaymentSubService();
