import { FieldReceiptStatus, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import { roundToIntegerPeso, toDecimal } from '../../core/money';

export type SensitiveEventKind =
  | 'VOID_OFFICE_RECEIPT'
  | 'VOID_FIELD_RECEIPT'
  | 'CASH_DISCREPANCY';

export interface SensitiveEventItem {
  id: string;
  kind: SensitiveEventKind;
  occurredAt: string;
  actor: string;
  reference: string;
  subject: string;
  amount: number;
  reason: string;
}

export interface SensitiveEventsResponse {
  days: number;
  seenAt: string | null;
  summary: {
    totalCount: number;
    voidedReceiptsCount: number;
    voidedReceiptsAmount: number;
    cashDiscrepanciesCount: number;
    cashDiscrepanciesNet: number;
  };
  events: SensitiveEventItem[];
}

const ARGENTINA_OFFSET_MS = 3 * 60 * 60 * 1000;

function resolveSinceDate(days: number, now = new Date()): Date {
  const safeDays = Math.min(Math.max(Math.floor(days) || 7, 1), 30);
  if (safeDays === 1) {
    // Inicio del día calendario actual en Argentina (UTC-3)
    const arNow = new Date(now.getTime() - ARGENTINA_OFFSET_MS);
    arNow.setUTCHours(0, 0, 0, 0);
    return new Date(arNow.getTime() + ARGENTINA_OFFSET_MS);
  }
  return new Date(now.getTime() - safeDays * 24 * 60 * 60 * 1000);
}

export const adminSensitiveEventsService = {
  async getSensitiveEvents(
    rawDays?: number,
    userId?: number,
    now = new Date(),
  ): Promise<SensitiveEventsResponse> {
    const days = Math.min(Math.max(Math.floor(Number(rawDays) || 7), 1), 30);
    const windowSince = resolveSinceDate(days, now);

    let seenAt: Date | null = null;
    if (typeof userId === 'number' && Number.isInteger(userId) && userId > 0) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { sensitiveEventsSeenAt: true },
      });
      seenAt = user?.sensitiveEventsSeenAt ?? null;
    }

    const useSeenCutoff = seenAt !== null && seenAt.getTime() >= windowSince.getTime();
    const dateFilter = useSeenCutoff ? { gt: seenAt as Date } : { gte: windowSince };

    const [voidedOffice, voidedField, closedDrawers] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          type: TransactionType.INCOME,
          voidedAt: dateFilter,
        },
        select: {
          id: true,
          receiptNumber: true,
          amount: true,
          voidedAt: true,
          voidReason: true,
          persona: { select: { name: true } },
          voidedBy: { select: { username: true } },
        },
        orderBy: { voidedAt: 'desc' },
        take: 40,
      }),
      prisma.fieldReceipt.findMany({
        where: {
          status: FieldReceiptStatus.VOIDED,
          voidedAt: dateFilter,
        },
        select: {
          id: true,
          receiptNumber: true,
          provisionalCode: true,
          totalAmount: true,
          voidedAt: true,
          voidReason: true,
          persona: { select: { name: true } },
          voidedBy: { select: { username: true } },
        },
        orderBy: { voidedAt: 'desc' },
        take: 40,
      }),
      prisma.cashDrawer.findMany({
        where: {
          status: 'CLOSED',
          closedAt: dateFilter,
          realBalance: { not: null },
          closingBalance: { not: null },
        },
        select: {
          id: true,
          branch: true,
          drawerType: true,
          closingBalance: true,
          realBalance: true,
          closedAt: true,
          notes: true,
          user: { select: { username: true } },
        },
        orderBy: { closedAt: 'desc' },
        take: 40,
      }),
    ]);

    const events: SensitiveEventItem[] = [];
    let voidedReceiptsCount = 0;
    let voidedReceiptsAmountDec = toDecimal(0);
    let cashDiscrepanciesCount = 0;
    let cashDiscrepanciesNetDec = toDecimal(0);

    for (const tx of voidedOffice) {
      if (!tx.voidedAt) continue;
      const amtDec = roundToIntegerPeso(tx.amount?.toString() ?? 0);
      voidedReceiptsCount += 1;
      voidedReceiptsAmountDec = voidedReceiptsAmountDec.plus(amtDec);
      events.push({
        id: `void-office-${tx.id}`,
        kind: 'VOID_OFFICE_RECEIPT',
        occurredAt: tx.voidedAt.toISOString(),
        actor: tx.voidedBy?.username || 'Admin',
        reference: tx.receiptNumber || `REC-${String(tx.id).padStart(5, '0')}`,
        subject: tx.persona?.name || 'Cliente',
        amount: amtDec.toNumber(),
        reason: tx.voidReason || 'Sin motivo',
      });
    }

    for (const fr of voidedField) {
      if (!fr.voidedAt) continue;
      const amtDec = roundToIntegerPeso(fr.totalAmount?.toString() ?? 0);
      voidedReceiptsCount += 1;
      voidedReceiptsAmountDec = voidedReceiptsAmountDec.plus(amtDec);
      events.push({
        id: `void-field-${fr.id}`,
        kind: 'VOID_FIELD_RECEIPT',
        occurredAt: fr.voidedAt.toISOString(),
        actor: fr.voidedBy?.username || 'Admin',
        reference: fr.receiptNumber || fr.provisionalCode,
        subject: fr.persona?.name || 'Cliente',
        amount: amtDec.toNumber(),
        reason: fr.voidReason || 'Sin motivo',
      });
    }

    for (const d of closedDrawers) {
      if (!d.closedAt || d.realBalance === null || d.closingBalance === null) continue;
      const diffDec = roundToIntegerPeso(
        toDecimal(d.realBalance.toString()).minus(toDecimal(d.closingBalance.toString())),
      );
      if (diffDec.abs().lt(1)) continue;
      cashDiscrepanciesCount += 1;
      cashDiscrepanciesNetDec = cashDiscrepanciesNetDec.plus(diffDec);
      events.push({
        id: `cash-diff-${d.id}`,
        kind: 'CASH_DISCREPANCY',
        occurredAt: d.closedAt.toISOString(),
        actor: d.user?.username || 'Usuario',
        reference: `Caja #${d.id}`,
        subject: d.branch || d.drawerType || 'Caja',
        amount: diffDec.toNumber(),
        reason: d.notes?.trim() || (diffDec.lt(0) ? 'Faltante en arqueo' : 'Sobrante en arqueo'),
      });
    }

    events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    return {
      days,
      seenAt: seenAt ? seenAt.toISOString() : null,
      summary: {
        totalCount: events.length,
        voidedReceiptsCount,
        voidedReceiptsAmount: roundToIntegerPeso(voidedReceiptsAmountDec).toNumber(),
        cashDiscrepanciesCount,
        cashDiscrepanciesNet: roundToIntegerPeso(cashDiscrepanciesNetDec).toNumber(),
      },
      events: events.slice(0, 50),
    };
  },

  async markSensitiveEventsSeen(
    userId: number,
    upToIso?: string,
    now = new Date(),
  ): Promise<{ seenAt: string }> {
    let targetDate = now;
    if (typeof upToIso === 'string' && upToIso.trim()) {
      const parsed = new Date(upToIso);
      if (!Number.isNaN(parsed.getTime()) && parsed.getTime() <= now.getTime() + 5000) {
        targetDate = parsed;
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { sensitiveEventsSeenAt: targetDate },
      select: { sensitiveEventsSeenAt: true },
    });

    return {
      seenAt: (updated.sensitiveEventsSeenAt ?? targetDate).toISOString(),
    };
  },
};
