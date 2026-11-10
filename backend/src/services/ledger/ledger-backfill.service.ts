import {
  BillingType,
  CreditNoteStatus,
  LedgerEntryType,
  LedgerSourceType,
  OrderStatus,
  Prisma,
  TransactionType,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import { roundToTwoDecimals, toDecimal } from '../../core/money';
import {
  computeReconciliationAdjustment,
  computeRunningBalances,
} from '../../engines/account-ledger.engine';

interface CandidateSeedEntry {
  entryType: LedgerEntryType;
  sourceType: LedgerSourceType;
  billingType: BillingType;
  amount: number;
  reference: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
  orderId?: number | null;
  transactionId?: number | null;
  creditNoteId?: number | null;
  supplierInvoiceId?: number | null;
  purchaseOrderId?: number | null;
  taxWithholdingId?: number | null;
  userId?: number | null;
  occurredAt: Date;
}

export const ledgerBackfillService = {
  /**
   * Pobla de manera idempotente la tabla física `AccountLedger` a partir de los documentos históricos
   * de cada `Persona` y preserva el `outstandingBalance` actual exacto mediante `OPENING_BALANCE` si
   * existían saldos iniciales importados previos al historial documental.
   */
  async backfillAllPersonas() {
    const personas = await prisma.persona.findMany({ orderBy: { id: 'asc' } });
    let backfilledPersonas = 0;
    let entriesCreated = 0;
    let openingAdjustmentsCount = 0;

    for (const persona of personas) {
      const existingCount = await prisma.accountLedger.count({ where: { personaId: persona.id } });
      if (existingCount > 0) continue;

      const [orders, transactions, supplierInvoices, creditNotes, withholdings] = await Promise.all([
        prisma.order.findMany({
          where: { personaId: persona.id, status: OrderStatus.DELIVERED },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.transaction.findMany({
          where: {
            personaId: persona.id,
            vehicleMaintenances: { none: {} },
            fuelLogs: { none: {} },
            expense: null,
            salaryAdvance: null,
            payroll: null,
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.supplierInvoice.findMany({
          where: { personaId: persona.id },
          orderBy: { issueDate: 'asc' },
        }),
        prisma.creditNote.findMany({
          where: { personaId: persona.id, status: CreditNoteStatus.APPROVED },
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

      const candidates: CandidateSeedEntry[] = [];

      for (const o of orders) {
        const amt = roundToTwoDecimals(o.totalAmount.toString()).toNumber();
        if (amt <= 0) continue;
        candidates.push({
          entryType: LedgerEntryType.DEBIT,
          sourceType: LedgerSourceType.ORDER_INVOICE,
          billingType: o.billingType,
          amount: amt,
          reference: `Pedido #${o.id}`,
          description: `Factura ${o.invoiceNumber || 'INT-' + o.id.toString().padStart(5, '0')}`,
          orderId: o.id,
          userId: o.sellerId,
          occurredAt: o.createdAt,
        });
      }

      for (const t of transactions) {
        const amt = roundToTwoDecimals(t.amount.toString()).toNumber();
        if (amt <= 0) continue;
        const isIncome = t.type === TransactionType.INCOME;
        candidates.push({
          entryType: isIncome ? LedgerEntryType.CREDIT : LedgerEntryType.DEBIT,
          sourceType: isIncome
            ? LedgerSourceType.COLLECTION_RECEIPT
            : LedgerSourceType.SUPPLIER_PAYMENT,
          billingType: t.billingType,
          amount: amt,
          reference: `${isIncome ? 'Recibo' : 'Pago'} #${t.id}`,
          description:
            t.type === TransactionType.INCOME
              ? `Recibo N° ${t.receiptNumber || 'INT-' + t.id.toString().padStart(5, '0')}`
              : `Pago N° ${t.receiptNumber || 'INT-' + t.id.toString().padStart(5, '0')}`,
          transactionId: t.id,
          orderId: t.orderId,
          supplierInvoiceId: t.supplierInvoiceId,
          userId: t.userId,
          occurredAt: t.createdAt,
        });
      }

      for (const si of supplierInvoices) {
        const amt = roundToTwoDecimals(si.totalAmount.toString()).toNumber();
        if (amt <= 0) continue;
        candidates.push({
          entryType: LedgerEntryType.CREDIT,
          sourceType: LedgerSourceType.SUPPLIER_INVOICE,
          billingType: si.billingType,
          amount: amt,
          reference: `Factura Nro ${si.invoiceNumber}`,
          description: `Compra - Factura ${si.invoiceType.replace('_', ' ')}`,
          supplierInvoiceId: si.id,
          occurredAt: si.issueDate,
        });
      }

      for (const cn of creditNotes) {
        const amt = roundToTwoDecimals(cn.totalAmount.toString()).toNumber();
        if (amt <= 0) continue;
        candidates.push({
          entryType: LedgerEntryType.CREDIT,
          sourceType: LedgerSourceType.CREDIT_NOTE,
          billingType: cn.billingType,
          amount: amt,
          reference: `Nota de Crédito #${cn.id}`,
          description: `${cn.creditNoteType.replace(/_/g, ' ')} ${cn.creditNoteNumber || 'INT-' + cn.id.toString().padStart(5, '0')} (${cn.reason})`,
          creditNoteId: cn.id,
          orderId: cn.orderId,
          userId: cn.userId,
          occurredAt: cn.createdAt,
        });
      }

      for (const w of withholdings) {
        const amt = roundToTwoDecimals(w.amount.toString()).toNumber();
        if (amt <= 0) continue;
        const isPracticada = w.type === 'RETENCION_PRACTICADA';
        candidates.push({
          entryType: isPracticada ? LedgerEntryType.DEBIT : LedgerEntryType.CREDIT,
          sourceType: LedgerSourceType.TAX_WITHHOLDING,
          billingType: BillingType.OFFICIAL,
          amount: amt,
          reference: `${isPracticada ? 'Retención Practicada' : 'Retención Sufrida'} Cert. Nro ${w.number}`,
          description: `${isPracticada ? 'Retención Emitida' : 'Retención Recibida'} - ${w.taxType === 'IIBB' ? 'IIBB' : 'Ganancias'}`,
          taxWithholdingId: w.id,
          occurredAt: w.date,
          metadata: {
            taxType: w.taxType,
            number: w.number,
            amount: amt,
            date: w.date.toISOString(),
            jurisdiction: w.jurisdiction,
          },
        });
      }

      candidates.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

      const { finalBalance } = computeRunningBalances(candidates);
      const targetBalance = roundToTwoDecimals(persona.outstandingBalance.toString()).toNumber();
      const adjustment = computeReconciliationAdjustment(finalBalance, targetBalance);

      if (adjustment.needed) {
        const earliestMs =
          candidates.length > 0
            ? Math.min(candidates[0].occurredAt.getTime() - 1000, persona.createdAt.getTime())
            : persona.createdAt.getTime();

        candidates.unshift({
          entryType: adjustment.entryType,
          sourceType: LedgerSourceType.OPENING_BALANCE,
          billingType: BillingType.INTERNAL,
          amount: adjustment.amount,
          reference: 'Saldo Inicial / Apertura',
          description: 'Saldo histórico inicial previo a apertura de Libro Mayor Físico',
          occurredAt: new Date(earliestMs),
        });
        openingAdjustmentsCount++;
      }

      if (candidates.length === 0) continue;

      const withBalances = computeRunningBalances(candidates).items;

      await prisma.$transaction(async (tx) => {
        await tx.accountLedger.createMany({
          data: withBalances.map((row) => ({
            personaId: persona.id,
            entryType: row.entry.entryType,
            sourceType: row.entry.sourceType,
            billingType: row.entry.billingType,
            amount: row.normalizedAmount,
            balanceAfter: row.runningBalance,
            reference: row.entry.reference,
            description: row.entry.description,
            metadata: row.entry.metadata ?? undefined,
            orderId: row.entry.orderId ?? null,
            transactionId: row.entry.transactionId ?? null,
            creditNoteId: row.entry.creditNoteId ?? null,
            supplierInvoiceId: row.entry.supplierInvoiceId ?? null,
            purchaseOrderId: row.entry.purchaseOrderId ?? null,
            taxWithholdingId: row.entry.taxWithholdingId ?? null,
            userId: row.entry.userId ?? null,
            occurredAt: row.entry.occurredAt,
          })),
        });
      });

      backfilledPersonas++;
      entriesCreated += withBalances.length;
    }

    const mismatches = await this.verifyGlobalParity();

    return {
      totalPersonas: personas.length,
      backfilledPersonas,
      entriesCreated,
      openingAdjustmentsCount,
      mismatches,
    };
  },

  /**
   * Verifica el invariante contable 100%:
   * Para TODA Persona en PostgreSQL (activa o inactiva), `SUM(DEBIT) - SUM(CREDIT) === outstandingBalance`.
   */
  async verifyGlobalParity() {
    const [personas, grouped] = await Promise.all([
      prisma.persona.findMany({ orderBy: { id: 'asc' } }),
      prisma.accountLedger.groupBy({
        by: ['personaId', 'entryType'],
        _sum: { amount: true },
      }),
    ]);

    const netByPersona = new Map<number, ReturnType<typeof toDecimal>>();
    for (const row of grouped) {
      const prev = netByPersona.get(row.personaId) || toDecimal(0);
      const sumAmt = toDecimal(row._sum.amount?.toString() || 0);
      const next =
        row.entryType === LedgerEntryType.DEBIT ? prev.plus(sumAmt) : prev.minus(sumAmt);
      netByPersona.set(row.personaId, next);
    }

    const mismatches = [];
    for (const p of personas) {
      const ledgerBalance = roundToTwoDecimals(netByPersona.get(p.id) || 0).toNumber();
      const dbBalance = roundToTwoDecimals(p.outstandingBalance.toString()).toNumber();
      const diff = roundToTwoDecimals(toDecimal(dbBalance).minus(ledgerBalance)).toNumber();
      if (Math.abs(diff) >= 0.01) {
        mismatches.push({ id: p.id, name: p.name, dbBalance, ledgerBalance, diff });
      }
    }

    return mismatches;
  },
};
