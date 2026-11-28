import { CreditNoteStatus, OrderStatus, ProviderType } from '@prisma/client';
import prisma from '../../utils/prisma';
import { roundToIntegerPeso } from '../../core/money';
import {
  addDaysIso,
  buildNormalizedSaleRow,
  computeWeeklyPulseChain,
  DEFAULT_WEEKLY_RESULT_BUFFER,
  getWorkWeekBounds,
  type WeeklyPulsePurchaseItem,
  type WeeklyPulseSaleRow,
  type WeeklyPulseSummary,
} from '../../engines/weekly-pulse.engine';
import { parseArgentinaTimestampRange } from '../billing/billing-date-range.helper';
import {
  buildOperatingCreditNoteWhere,
  buildOperatingOrderWhere,
  getArgentinaTodayParts,
} from './admin-report.helpers';
import {
  accumulateCitySaleBucket,
  formatIsoAr,
  listWeekStartsBetween,
  parsePurchasesMeta,
  parseSalesMeta,
  type CityBucket,
  type StoredPurchasesMeta,
  type StoredSalesMeta,
} from './admin-weekly-pulse.helper';
import type { SaveWeeklyPulseBody } from '../../validators/weekly-pulse.validator';

export interface WeeklyPulseHistoryItem {
  weekStart: string;
  weekEnd: string;
  salesTotal: number;
  weekPurchasesTotal: number;
  resultBuffer: number;
  closingCredit: number;
  status: WeeklyPulseSummary['status'];
}

export interface WeeklyPulseResponse {
  weekStart: string;
  weekEnd: string;
  isManualOpeningCredit: boolean;
  manualOpeningCredit: number | null;
  summary: WeeklyPulseSummary;
  purchases: WeeklyPulsePurchaseItem[];
  sales: WeeklyPulseSaleRow[];
  excludedSourceKeys: string[];
  history: WeeklyPulseHistoryItem[];
}

export class AdminWeeklyPulseService {
  async getWeeklyPulse(requestedDateIso?: string): Promise<WeeklyPulseResponse> {
    const baseIso = requestedDateIso || getArgentinaTodayParts().isoDate;
    const { weekStart: targetWeekStart, weekEnd: targetWeekEnd } = getWorkWeekBounds(baseIso);

    const savedReports = await prisma.weeklyReport.findMany({
      where: { weekStart: { lte: targetWeekStart } },
      orderBy: { weekStart: 'asc' },
    });

    const savedByWeek = new Map(
      savedReports.map((rep) => [
        rep.weekStart,
        {
          buffer: roundToIntegerPeso(rep.buffer.toString()).toNumber(),
          purchasesMeta: parsePurchasesMeta(rep.purchases),
          salesMeta: parseSalesMeta(rep.sales),
        },
      ]),
    );

    let anchorWeekStart: string | null = null;
    for (const rep of savedReports) {
      if (parsePurchasesMeta(rep.purchases).manualOpeningCredit !== null) {
        anchorWeekStart = rep.weekStart;
      }
    }

    // Si hay ancla manual, encadenar desde esa semana; si no hay ancla, arrancar desde la semana actual
    // (o la primera semana guardada) para no acumular $20M fantasmas en semanas históricas vacías.
    const firstSavedWeek = savedReports.length > 0 ? savedReports[0].weekStart : null;
    const chainStart = anchorWeekStart ?? firstSavedWeek ?? targetWeekStart;

    const weekStarts = listWeekStartsBetween(chainStart, targetWeekStart);
    const fullRange = parseArgentinaTimestampRange(weekStarts[0], targetWeekEnd);

    const [deliveredOrders, approvedCreditNotes, receivedInvoices, standalonePOs] =
      await Promise.all([
        prisma.order.findMany({
          where: {
            status: OrderStatus.DELIVERED,
            ...(fullRange ? { createdAt: fullRange } : {}),
            AND: [buildOperatingOrderWhere()],
          },
          select: {
            id: true,
            billingType: true,
            totalAmount: true,
            createdAt: true,
            persona: { select: { city: true } },
          },
        }),
        prisma.creditNote.findMany({
          where: {
            status: CreditNoteStatus.APPROVED,
            ...(fullRange ? { createdAt: fullRange } : {}),
            AND: [buildOperatingCreditNoteWhere()],
          },
          select: {
            id: true,
            billingType: true,
            totalAmount: true,
            createdAt: true,
            persona: { select: { city: true } },
            order: { select: { persona: { select: { city: true } } } },
          },
        }),
        prisma.supplierInvoice.findMany({
          where: {
            receptionStatus: 'RECEIVED',
            receivedAt: fullRange ?? { not: null },
            persona: { providerType: ProviderType.MERCADERIA },
          },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceType: true,
            issueDate: true,
            receivedAt: true,
            totalAmount: true,
            persona: { select: { name: true } },
          },
          orderBy: { receivedAt: 'asc' },
        }),
        prisma.purchaseOrder.findMany({
          where: {
            status: 'RECEIVED',
            supplierInvoiceId: null,
            receivedAt: fullRange ?? { not: null },
            persona: { providerType: ProviderType.MERCADERIA },
          },
          select: {
            id: true,
            receivedAt: true,
            totalAmount: true,
            persona: { select: { name: true } },
          },
          orderBy: { receivedAt: 'asc' },
        }),
      ]);

    const autoPurchasesByWeek = new Map<string, WeeklyPulsePurchaseItem[]>();
    for (const inv of receivedInvoices) {
      if (!inv.receivedAt) continue;
      const recIso = formatIsoAr(inv.receivedAt);
      const { weekStart } = getWorkWeekBounds(recIso);
      const isCreditNote = String(inv.invoiceType || '').toUpperCase().startsWith('NOTA_CREDITO');
      const rawAmount = roundToIntegerPeso(inv.totalAmount.toString()).toNumber();
      const list = autoPurchasesByWeek.get(weekStart) ?? [];
      list.push({
        id: `inv:${inv.id}`,
        source: 'AUTO_INVOICE',
        sourceId: inv.id,
        company: inv.persona.name,
        date: recIso,
        invoiceDate: formatIsoAr(inv.issueDate),
        invoiceNumber: inv.invoiceNumber,
        amount: isCreditNote ? -Math.abs(rawAmount) : rawAmount,
      });
      autoPurchasesByWeek.set(weekStart, list);
    }

    for (const po of standalonePOs) {
      if (!po.receivedAt) continue;
      const recIso = formatIsoAr(po.receivedAt);
      const { weekStart } = getWorkWeekBounds(recIso);
      const list = autoPurchasesByWeek.get(weekStart) ?? [];
      list.push({
        id: `po:${po.id}`,
        source: 'AUTO_PO',
        sourceId: po.id,
        company: `${po.persona.name} (Remito)`,
        date: recIso,
        amount: roundToIntegerPeso(po.totalAmount.toString()).toNumber(),
      });
      autoPurchasesByWeek.set(weekStart, list);
    }

    const autoSalesByWeek = new Map<string, Map<string, CityBucket>>();
    for (const order of deliveredOrders) {
      accumulateCitySaleBucket(
        autoSalesByWeek,
        order.createdAt,
        order.persona?.city,
        order.billingType,
        roundToIntegerPeso(order.totalAmount.toString()),
        true,
      );
    }
    for (const cn of approvedCreditNotes) {
      accumulateCitySaleBucket(
        autoSalesByWeek,
        cn.createdAt,
        cn.persona?.city ?? cn.order?.persona?.city,
        cn.billingType,
        roundToIntegerPeso(cn.totalAmount.toString()).negated(),
        false,
      );
    }

    const perWeekDetails = new Map<
      string,
      {
        purchases: WeeklyPulsePurchaseItem[];
        sales: WeeklyPulseSaleRow[];
        excludedSourceKeys: string[];
        manualOpeningCredit: number | null;
      }
    >();

    const chainInputs = weekStarts.map((wk) => {
      const saved = savedByWeek.get(wk);
      const excludedSet = new Set(saved?.purchasesMeta.excludedSourceKeys ?? []);

      const autoPurchases = (autoPurchasesByWeek.get(wk) ?? []).map((item) => ({
        ...item,
        excluded: excludedSet.has(item.id),
      }));
      const manualPurchases: WeeklyPulsePurchaseItem[] = (
        saved?.purchasesMeta.manualItems ?? []
      ).map((m) => ({
        id: m.id,
        source: 'MANUAL',
        company: m.company,
        date: m.date,
        amount: m.amount,
      }));
      const purchases = [...autoPurchases, ...manualPurchases];

      const cityMap = autoSalesByWeek.get(wk);
      const autoSales: WeeklyPulseSaleRow[] = cityMap
        ? Array.from(cityMap.values())
            .map((b) =>
              buildNormalizedSaleRow({
                id: `city:${b.locality}`,
                source: 'AUTO',
                locality: b.locality,
                date: b.lastDate,
                amountA: b.amountA.toNumber(),
                amountX: b.amountX.toNumber(),
                ordersCount: b.ordersCount,
              }),
            )
            .sort((a, b) => b.total - a.total)
        : [];

      const manualSales: WeeklyPulseSaleRow[] = (saved?.salesMeta.manualItems ?? []).map((m) =>
        buildNormalizedSaleRow({
          id: m.id,
          source: 'MANUAL',
          locality: m.locality,
          date: m.date,
          amountA: m.amountA,
          amountX: m.amountX,
        }),
      );
      const sales = [...autoSales, ...manualSales];

      const manualOpeningCredit = saved?.purchasesMeta.manualOpeningCredit ?? null;
      perWeekDetails.set(wk, {
        purchases,
        sales,
        excludedSourceKeys: Array.from(excludedSet),
        manualOpeningCredit,
      });

      return {
        weekStart: wk,
        manualOpeningCredit,
        resultBuffer: saved?.buffer ?? DEFAULT_WEEKLY_RESULT_BUFFER,
        purchases,
        sales,
      };
    });

    const chainResults = computeWeeklyPulseChain(chainInputs);
    const targetResult = chainResults[chainResults.length - 1];
    const targetDetails = perWeekDetails.get(targetWeekStart)!;

    const history: WeeklyPulseHistoryItem[] = chainResults
      .slice(-8)
      .reverse()
      .map((item) => ({
        weekStart: item.weekStart,
        weekEnd: addDaysIso(item.weekStart, 5),
        salesTotal: item.summary.salesTotal,
        weekPurchasesTotal: item.summary.weekPurchasesTotal,
        resultBuffer: item.summary.resultBuffer,
        closingCredit: item.summary.closingCredit,
        status: item.summary.status,
      }));

    return {
      weekStart: targetWeekStart,
      weekEnd: targetWeekEnd,
      isManualOpeningCredit: targetResult.isManualOpeningCredit,
      manualOpeningCredit: targetDetails.manualOpeningCredit,
      summary: targetResult.summary,
      purchases: targetDetails.purchases,
      sales: targetDetails.sales,
      excludedSourceKeys: targetDetails.excludedSourceKeys,
      history,
    };
  }

  async saveWeeklyPulse(payload: SaveWeeklyPulseBody): Promise<WeeklyPulseResponse> {
    const { weekStart } = getWorkWeekBounds(payload.weekStart);
    const resultBuffer = roundToIntegerPeso(payload.resultBuffer).toNumber();
    const manualOpeningCredit =
      typeof payload.manualOpeningCredit === 'number' && Number.isFinite(payload.manualOpeningCredit)
        ? roundToIntegerPeso(payload.manualOpeningCredit).toNumber()
        : null;

    const purchasesMeta: StoredPurchasesMeta = {
      manualItems: payload.manualPurchases.map((item) => ({
        id: item.id,
        company: item.company.trim(),
        date: item.date,
        amount: roundToIntegerPeso(item.amount).toNumber(),
      })),
      excludedSourceKeys: Array.from(new Set(payload.excludedSourceKeys)),
      manualOpeningCredit,
    };

    const salesMeta: StoredSalesMeta = {
      manualItems: payload.manualSales.map((item) => ({
        id: item.id,
        locality: item.locality.trim(),
        date: item.date,
        amountA: roundToIntegerPeso(item.amountA).toNumber(),
        amountX: roundToIntegerPeso(item.amountX).toNumber(),
      })),
    };

    await prisma.weeklyReport.upsert({
      where: { weekStart },
      create: {
        weekStart,
        buffer: resultBuffer,
        credit: manualOpeningCredit ?? 0,
        purchases: purchasesMeta as any,
        sales: salesMeta as any,
      },
      update: {
        buffer: resultBuffer,
        credit: manualOpeningCredit ?? 0,
        purchases: purchasesMeta as any,
        sales: salesMeta as any,
      },
    });

    return this.getWeeklyPulse(weekStart);
  }
}

export const adminWeeklyPulseService = new AdminWeeklyPulseService();
