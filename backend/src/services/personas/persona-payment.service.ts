import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';
import {
  Role,
  PaymentMethod,
  TransactionType,
  BillingType,
  LedgerEntryType,
  LedgerSourceType,
} from '@prisma/client';
import {
  roundToTwoDecimals,
  toDecimal,
} from '../../core/money';
import { recordLedgerMovement } from '../ledger/account-ledger.service';
import { assertCollectionAllowed } from '../collections/collection-guard.service';

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
              checkNumber: data.checkNumber,
              checkBank: data.checkBank,
              checkDueDate: data.checkDueDate,
              isEcheq: data.isEcheq,
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
      checkNumber: typeof p.checkNumber === 'string' ? p.checkNumber.trim() : '',
      checkBank: typeof p.checkBank === 'string' ? p.checkBank.trim() : '',
      checkDueDate: typeof p.checkDueDate === 'string' ? p.checkDueDate.trim() : '',
      isEcheq: Boolean(p.isEcheq),
    }));

    const totalPaymentDec = paymentItems.reduce((acc: any, p: any) => acc.plus(toDecimal(p.amount)), toDecimal(0));
    const totalPaymentAmount = roundToTwoDecimals(totalPaymentDec).toNumber();
    if (totalPaymentAmount <= 0) throw new Error('El monto total a pagar debe ser mayor a 0.');

    const retencionesSumDec = Array.isArray(data.retenciones)
      ? data.retenciones.reduce((acc: any, r: any) => acc.plus(roundToTwoDecimals(r?.amount || 0)), toDecimal(0))
      : toDecimal(0);
    const effectiveAppliedDec = roundToTwoDecimals(toDecimal(totalPaymentAmount).plus(retencionesSumDec));

    const result = await prisma.$transaction(async (tx) => {
      if (resolvedType === TransactionType.INCOME) {
        await assertCollectionAllowed(tx, {
          personaId: persona.id,
          amount: effectiveAppliedDec,
          allowCreditOnAccount: Boolean(data.isCreditOnAccount || data.allowCreditOnAccount),
          orderId: orderId ? Number(orderId) : null,
        });
      }

      let invoiceNumberToLog = '';
      if (supplierInvoiceId) {
        const supplierInvoice = await tx.supplierInvoice.findUnique({
          where: { id: Number(supplierInvoiceId) },
        });
        if (!supplierInvoice) throw new Error('Factura de proveedor no encontrada.');
        if (supplierInvoice.personaId !== persona.id) {
          throw new Error('El comprobante no pertenece a este proveedor.');
        }
        if (supplierInvoice.status === 'PAID') {
          throw new Error('Esta factura ya se encuentra saldada.');
        }

        const pendingInvoiceDec = roundToTwoDecimals(
          toDecimal(supplierInvoice.totalAmount).minus(supplierInvoice.paidAmount || 0),
        );
        if (effectiveAppliedDec.gt(pendingInvoiceDec.plus('0.01'))) {
          throw new Error(
            `El importe a imputar ($${effectiveAppliedDec.toFixed(2)}) supera el saldo pendiente de la factura ($${pendingInvoiceDec.toFixed(2)}).`,
          );
        }

        const newPaidDec = roundToTwoDecimals(
          toDecimal(supplierInvoice.paidAmount || 0).plus(effectiveAppliedDec),
        );
        const newStatus = newPaidDec.greaterThanOrEqualTo(
          toDecimal(supplierInvoice.totalAmount).minus('0.01'),
        )
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
      let latestPersona: any = null;

      for (const item of paymentItems) {
        let cashDrawerId: number | null = null;
        if (item.paymentMethod === PaymentMethod.CASH) {
          const activeDrawer =
            (await tx.cashDrawer.findFirst({
              where: {
                status: 'OPEN',
                OR: [{ branch: 'DEPOSITO' }, { drawerType: 'DEPOSITO' }],
              },
              orderBy: { openedAt: 'desc' },
            })) ||
            (await tx.cashDrawer.findFirst({
              where: { userId, status: 'OPEN', drawerType: { not: 'CENTRAL' } },
              orderBy: { openedAt: 'desc' },
            })) ||
            (await tx.cashDrawer.findFirst({
              where: { status: 'OPEN', drawerType: { not: 'CENTRAL' } },
              orderBy: { openedAt: 'desc' },
            }));

          if (!activeDrawer) {
            throw new Error(
              'No hay una Caja Oficina abierta. Abrí la Caja Oficina antes de registrar cobros o pagos en efectivo.',
            );
          }
          cashDrawerId = activeDrawer.id;
        }

        const checkDetailParts: string[] = [];
        if (item.paymentMethod === PaymentMethod.CHECK) {
          if (item.checkNumber) {
            checkDetailParts.push(
              item.isEcheq ? `Cheque N° ${item.checkNumber} (Echeq)` : `Cheque N° ${item.checkNumber}`,
            );
          } else if (item.isEcheq) {
            checkDetailParts.push('Echeq');
          }
          if (item.checkBank) checkDetailParts.push(`Banco: ${item.checkBank}`);
          if (item.checkDueDate) checkDetailParts.push(`Vto: ${item.checkDueDate}`);
        }
        const checkDetailSuffix = checkDetailParts.length > 0 ? checkDetailParts.join(' · ') : '';

        const baseDescription =
          item.description ||
          (supplierInvoiceId
            ? `Pago de Factura Nro ${invoiceNumberToLog}`
            : orderId
              ? `Cobro de Factura ${orderNumberDesc}`
              : `${resolvedType === TransactionType.OUTCOME ? 'Pago' : 'Cobro'} en cuenta corriente de ${persona.name}`);
        const txDescription = checkDetailSuffix
          ? `${baseDescription} - ${checkDetailSuffix}`
          : baseDescription;

        let bankAccountId: number | null = null;
        const isEcheqCheck =
          item.paymentMethod === PaymentMethod.CHECK &&
          (item.isEcheq || /\(echeq\)|e-?cheq/i.test(txDescription));
        const isPendingBankReconciliationIncome =
          resolvedType === TransactionType.INCOME &&
          (item.paymentMethod === PaymentMethod.BANK_TRANSFER || isEcheqCheck);

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

          if (!isPendingBankReconciliationIncome) {
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
        }

        const txBillingType =
          selectedBranch === 'A' ? BillingType.OFFICIAL : BillingType.INTERNAL;

        const transaction = await tx.transaction.create({
          data: {
            personaId: persona.id,
            userId,
            billingType: txBillingType,
            type: resolvedType,
            paymentMethod: item.paymentMethod,
            amount: item.amount,
            description: txDescription,
            cashDrawerId,
            bankAccountId,
            supplierInvoiceId: supplierInvoiceId ? Number(supplierInvoiceId) : null,
            orderId: orderId ? Number(orderId) : null,
            verified: !isPendingBankReconciliationIncome,
          },
        });
        createdTransactions.push(transaction);

        const isIncome = resolvedType === TransactionType.INCOME;
        const ledgerRes = await recordLedgerMovement(tx, {
          personaId: persona.id,
          entryType: isIncome ? LedgerEntryType.CREDIT : LedgerEntryType.DEBIT,
          sourceType: isIncome
            ? LedgerSourceType.COLLECTION_RECEIPT
            : LedgerSourceType.SUPPLIER_PAYMENT,
          billingType: txBillingType,
          amount: item.amount,
          orderId: orderId ? Number(orderId) : null,
          supplierInvoiceId: supplierInvoiceId ? Number(supplierInvoiceId) : null,
          transactionId: transaction.id,
          userId,
          reference: `${isIncome ? 'Recibo' : 'Pago'} #${transaction.id}`,
          description: txDescription,
        });
        if (ledgerRes?.updatedPersona) {
          latestPersona = ledgerRes.updatedPersona;
        }
      }

      if (data.retenciones && Array.isArray(data.retenciones)) {
        const isSupplierOutcome = resolvedType === TransactionType.OUTCOME;
        for (const ret of data.retenciones) {
          const retAmt = roundToTwoDecimals(ret.amount || 0);
          if (retAmt.lte(0)) continue;
          const createdRet = await tx.taxWithholding.create({
            data: {
              type: isSupplierOutcome ? 'RETENCION_PRACTICADA' : 'RETENCION_SUFRIDA',
              taxType: ret.taxType,
              personaId: persona.id,
              number: ret.number,
              date: new Date(),
              amount: retAmt.toNumber(),
              jurisdiction: ret.taxType === 'IIBB' ? 'AR-B' : null,
            },
          });

          const retLedgerRes = await recordLedgerMovement(tx, {
            personaId: persona.id,
            entryType: isSupplierOutcome ? LedgerEntryType.DEBIT : LedgerEntryType.CREDIT,
            sourceType: LedgerSourceType.TAX_WITHHOLDING,
            billingType: BillingType.OFFICIAL,
            amount: retAmt.toNumber(),
            taxWithholdingId: createdRet.id,
            userId,
            occurredAt: createdRet.date,
            reference: `${isSupplierOutcome ? 'Retención Practicada' : 'Retención Sufrida'} Cert. Nro ${ret.number}`,
            description: `${isSupplierOutcome ? 'Retención Practicada' : 'Retención Recibida'} - ${ret.taxType === 'IIBB' ? 'IIBB' : 'Ganancias'}`,
            metadata: {
              taxType: ret.taxType,
              number: ret.number,
              amount: retAmt.toNumber(),
              date: createdRet.date.toISOString(),
              jurisdiction: createdRet.jurisdiction,
            },
          });
          if (retLedgerRes?.updatedPersona) {
            latestPersona = retLedgerRes.updatedPersona;
          }
        }
      }

      const updatedPersona =
        latestPersona || (await tx.persona.findUniqueOrThrow({ where: { id: persona.id } }));

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
