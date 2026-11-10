import prisma from '../../utils/prisma';
import {
  CreditNoteStatus,
  LedgerEntryType,
  OrderStatus,
  Role,
  TransactionType,
} from '@prisma/client';
import { roundToTwoDecimals, toDecimal } from '../../core/money';
import { computeRunningBalances } from '../../engines/account-ledger.engine';
import { mapLedgerEntryToViewItem } from '../ledger/account-ledger.service';

export class PersonaLedgerSubService {
  /**
   * Obtiene el Libro Mayor Físico (AccountLedger) de cuenta corriente de una persona con Decimal.js.
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

    const rawEntries = await prisma.accountLedger.findMany({
      where: { personaId: persona.id },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });

    const { items } = computeRunningBalances(
      rawEntries.map((entry) => ({
        raw: entry,
        entryType: entry.entryType,
        amount: entry.amount.toString(),
      })),
    );

    const seenUiIds = new Set<string>();
    const ledger = items.map((calc) => {
      const view = mapLedgerEntryToViewItem(calc.entry.raw, seenUiIds);
      return {
        ...view,
        amount: calc.normalizedAmount,
        balance: calc.runningBalance,
      };
    });

    return { persona, ledger };
  }

  /**
   * Auditoría masiva de saldos en 2 consultas SQL (sin N+1):
   * Compara `Persona.outstandingBalance` contra `SUM(DEBIT) - SUM(CREDIT)` físico en `AccountLedger`.
   */
  async checkAllBalances() {
    const [personas, grouped] = await Promise.all([
      prisma.persona.findMany({ where: { isActive: true } }),
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
      const theoretical = roundToTwoDecimals(netByPersona.get(p.id) || 0).toNumber();
      const actual = roundToTwoDecimals(p.outstandingBalance || 0).toNumber();
      const diff = roundToTwoDecimals(toDecimal(actual).minus(theoretical)).toNumber();

      if (Math.abs(diff) >= 0.01) {
        mismatches.push({
          id: p.id,
          name: p.name,
          isClient: p.isClient,
          isProvider: p.isProvider,
          actual,
          theoretical,
          diff,
        });
      }
    }

    return mismatches;
  }

  /**
   * Alinea `Persona.outstandingBalance` exactamente con el saldo auditable de `AccountLedger`.
   */
  async reconcileBalance(personaId: number) {
    const persona = await prisma.persona.findUnique({ where: { id: personaId } });
    if (!persona) throw new Error('Persona no encontrada.');

    const grouped = await prisma.accountLedger.groupBy({
      by: ['entryType'],
      where: { personaId: persona.id },
      _sum: { amount: true },
    });

    let netDec = toDecimal(0);
    for (const row of grouped) {
      const sumAmt = toDecimal(row._sum.amount?.toString() || 0);
      netDec = row.entryType === LedgerEntryType.DEBIT ? netDec.plus(sumAmt) : netDec.minus(sumAmt);
    }

    const exactTheoretical = roundToTwoDecimals(netDec).toNumber();
    const updated = await prisma.persona.update({
      where: { id: persona.id },
      data: { outstandingBalance: exactTheoretical },
    });

    return { persona: updated, theoretical: exactTheoretical };
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
   * Obtiene las facturas pendientes de cobro de un cliente (considerando solo Notas de Crédito APPROVED).
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
        creditNotes: { where: { status: CreditNoteStatus.APPROVED } },
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
