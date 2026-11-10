import prisma from '../../utils/prisma';
import { Role, TransactionType, OrderStatus } from '@prisma/client';
import {
  roundToIntegerPeso,
  roundToTwoDecimals,
  toDecimal,
} from '../../core/money';

export class PersonaLedgerSubService {
  /**
   * Obtiene el Libro Mayor (AccountLedger) de cuenta corriente de una persona con Decimal.js.
   */
  async getPersonaLedger(id: number, userId: number, userRole: string) {
    const persona = await prisma.persona.findUnique({
      where: { id },
      include: { seller: { select: { id: true, username: true } } },
    });
    if (!persona) throw new Error('Persona no encontrada.');

    if (userRole === Role.VENDEDOR && persona.isClient && persona.sellerId !== userId) {
      throw new Error('Acceso denegado.');
    }

    const [orders, transactions, supplierInvoices, creditNotes, withholdings] = await Promise.all([
      prisma.order.findMany({
        where: { personaId: persona.id, status: 'DELIVERED' },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.transaction.findMany({
        where: {
          personaId: persona.id,
          OR: [{ type: TransactionType.OUTCOME }, { type: TransactionType.INCOME, verified: true }],
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.supplierInvoice.findMany({
        where: { personaId: persona.id },
        orderBy: { issueDate: 'asc' },
      }),
      prisma.creditNote.findMany({
        where: { personaId: persona.id },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.taxWithholding.findMany({
        where: {
          personaId: persona.id,
          type: { in: ['RETENCION_SUFRIDA', 'RETENCION_PRACTICADA'] },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    const ledgerItems: any[] = [];

    orders.forEach((o) => {
      ledgerItems.push({
        id: `order-${o.id}`,
        movementId: o.movementId,
        date: o.createdAt,
        type: 'DEBIT',
        reference: `Pedido #${o.id}`,
        description: `Factura ${o.invoiceNumber || 'INT-' + o.id.toString().padStart(5, '0')}`,
        amount: roundToTwoDecimals(o.totalAmount).toNumber(),
      });
    });

    transactions.forEach((t) => {
      const ledgerType = t.type === TransactionType.INCOME ? 'CREDIT' : 'DEBIT';
      ledgerItems.push({
        id: `transaction-${t.id}`,
        movementId: t.movementId,
        date: t.createdAt,
        type: ledgerType,
        reference: `Recibo #${t.id}`,
        description:
          t.type === TransactionType.INCOME
            ? `Recibo N° ${t.receiptNumber || 'INT-' + t.id.toString().padStart(5, '0')}`
            : `Pago N° ${t.receiptNumber || 'INT-' + t.id.toString().padStart(5, '0')}`,
        amount: roundToTwoDecimals(t.amount).toNumber(),
      });
    });

    supplierInvoices.forEach((si) => {
      ledgerItems.push({
        id: `supplier-invoice-${si.id}`,
        movementId: si.movementId,
        date: si.issueDate,
        type: 'CREDIT',
        reference: `Factura Nro ${si.invoiceNumber}`,
        description: `Compra - Factura ${si.invoiceType.replace('_', ' ')}`,
        amount: roundToTwoDecimals(si.totalAmount).toNumber(),
      });
    });

    creditNotes.forEach((cn) => {
      ledgerItems.push({
        id: `credit-note-${cn.id}`,
        movementId: cn.movementId,
        date: cn.createdAt,
        type: 'CREDIT',
        reference: `Nota de Crédito #${cn.id}`,
        description: `${cn.creditNoteType.replace(/_/g, ' ')} ${cn.creditNoteNumber || 'INT-' + cn.id.toString().padStart(5, '0')} (${cn.reason})`,
        amount: roundToTwoDecimals(cn.totalAmount).toNumber(),
      });
    });

    withholdings.forEach((w) => {
      const type = w.type === 'RETENCION_PRACTICADA' ? 'DEBIT' : 'CREDIT';
      const amt = roundToTwoDecimals(w.amount).toNumber();
      ledgerItems.push({
        id: `withholding-${w.id}`,
        movementId: w.movementId,
        date: w.date,
        type,
        reference: `${w.type === 'RETENCION_PRACTICADA' ? 'Retención Practicada' : 'Retención Sufrida'} Cert. Nro ${w.number}`,
        description: `${w.type === 'RETENCION_PRACTICADA' ? 'Retención Emitida' : 'Retención Recibida'} - ${w.taxType === 'IIBB' ? 'IIBB' : 'Ganancias'}`,
        amount: amt,
        metadata: {
          taxType: w.taxType,
          number: w.number,
          amount: amt,
          date: w.date,
          jurisdiction: w.jurisdiction,
        },
      });
    });

    ledgerItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalanceDec = toDecimal(0);
    const ledger = ledgerItems.map((item) => {
      if (item.type === 'DEBIT') {
        runningBalanceDec = runningBalanceDec.plus(toDecimal(item.amount));
      } else {
        runningBalanceDec = runningBalanceDec.minus(toDecimal(item.amount));
      }
      return { ...item, balance: roundToTwoDecimals(runningBalanceDec).toNumber() };
    });

    return { persona, ledger };
  }

  /**
   * Auditoría de saldos: compara outstandingBalance con el resultado del Ledger para todas las personas activas.
   */
  async checkAllBalances() {
    const personas = await prisma.persona.findMany({ where: { isActive: true } });
    const mismatches = [];

    for (const p of personas) {
      const ledgerData = await this.getPersonaLedger(p.id, 0, 'ADMIN');
      const theoretical =
        ledgerData.ledger.length > 0
          ? ledgerData.ledger[ledgerData.ledger.length - 1].balance
          : 0;

      const actual = roundToTwoDecimals(p.outstandingBalance || 0).toNumber();
      const diff = roundToTwoDecimals(toDecimal(actual).minus(theoretical)).toNumber();

      if (Math.abs(diff) > 0.05) {
        mismatches.push({
          id: p.id,
          name: p.name,
          isClient: p.isClient,
          isProvider: p.isProvider,
          actual,
          theoretical: roundToTwoDecimals(theoretical).toNumber(),
          diff,
        });
      }
    }

    return mismatches;
  }

  /**
   * Concilia el saldo de una persona específica basándose en su Ledger.
   */
  async reconcileBalance(personaId: number) {
    const persona = await prisma.persona.findUnique({ where: { id: personaId } });
    if (!persona) throw new Error('Persona no encontrada.');

    const ledgerData = await this.getPersonaLedger(persona.id, 0, 'ADMIN');
    const theoretical =
      ledgerData.ledger.length > 0
        ? ledgerData.ledger[ledgerData.ledger.length - 1].balance
        : 0;

    const roundedTheoretical = roundToIntegerPeso(theoretical).toNumber();

    const updated = await prisma.persona.update({
      where: { id: persona.id },
      data: { outstandingBalance: roundedTheoretical },
    });

    return { persona: updated, theoretical: roundedTheoretical };
  }

  async reconcileAllBalances() {
    const mismatches = await this.checkAllBalances();
    const results = [];

    for (const m of mismatches) {
      const res = await this.reconcileBalance(m.id);
      results.push(res.persona);
    }

    return results;
  }

  /**
   * Obtiene las facturas pendientes de cobro de un cliente.
   */
  async getPersonaPendingInvoices(id: number, userId: number, userRole: string) {
    const persona = await prisma.persona.findUnique({ where: { id } });
    if (!persona) throw new Error('Persona no encontrada.');

    if (userRole === Role.VENDEDOR && persona.isClient && persona.sellerId !== userId) {
      throw new Error('Acceso denegado.');
    }

    const orders = await prisma.order.findMany({
      where: { personaId: persona.id, status: OrderStatus.DELIVERED },
      include: {
        transactions: { where: { type: TransactionType.INCOME } },
        creditNotes: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return orders
      .map((order) => {
        const paidDec = order.transactions.reduce(
          (acc, tx) => acc.plus(toDecimal(tx.amount)),
          toDecimal(0),
        );
        const cnDec = order.creditNotes.reduce(
          (acc, cn) => acc.plus(toDecimal(cn.totalAmount)),
          toDecimal(0),
        );
        const pendingDec = toDecimal(order.totalAmount).minus(paidDec).minus(cnDec);

        return {
          id: order.id,
          invoiceNumber: order.invoiceNumber || `INT-${order.id.toString().padStart(5, '0')}`,
          billingType: order.billingType,
          invoiceType: order.invoiceType,
          totalAmount: roundToTwoDecimals(order.totalAmount).toNumber(),
          paidAmount: roundToTwoDecimals(paidDec).toNumber(),
          creditNotesAmount: roundToTwoDecimals(cnDec).toNumber(),
          pendingAmount: roundToTwoDecimals(pendingDec).toNumber(),
          createdAt: order.createdAt,
        };
      })
      .filter((inv) => inv.pendingAmount > 0);
  }
}

export const personaLedgerSubService = new PersonaLedgerSubService();
