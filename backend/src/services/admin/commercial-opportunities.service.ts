import { OrderStatus } from '@prisma/client';
import prisma from '../../utils/prisma';
import {
  buildCommercialOpportunitiesReport,
  CommercialOpportunitiesReport,
  OpportunityLotInput,
  OpportunityOrderInput,
  OpportunityProductInput,
} from '../../engines/commercial-opportunities.engine';
import {
  REPORT_OPPORTUNITIES_TTL_SECONDS,
  withReportCache,
} from './admin-report-cache.helper';
import { buildOperatingOrderWhere } from './admin-report.helpers';

const STAGNANT_LOOKBACK_DAYS = 180;
const CLIENT_BEHAVIOR_LOOKBACK_DAYS = 90;

export interface CommercialOpportunitiesQuery {
  stagnantDays?: number;
  expiringDays?: number;
}

interface ProductLastSoldRow {
  productId: number;
  lastSoldAt: Date;
}

export async function getCommercialOpportunitiesReport(
  query: CommercialOpportunitiesQuery = {},
): Promise<CommercialOpportunitiesReport> {
  const stagnantDays = query.stagnantDays ?? 30;
  const expiringDays = query.expiringDays ?? 30;

  return withReportCache(
    'opportunities',
    { stagnantDays, expiringDays },
    REPORT_OPPORTUNITIES_TTL_SECONDS,
    async () => {
      const referenceDate = new Date();
      const stagnantHistoryStart = new Date(
        referenceDate.getTime() - STAGNANT_LOOKBACK_DAYS * 86_400_000,
      );
      const clientBehaviorStart = new Date(
        referenceDate.getTime() - CLIENT_BEHAVIOR_LOOKBACK_DAYS * 86_400_000,
      );
      const expiringCutoff = new Date(referenceDate.getTime() + expiringDays * 86_400_000);

      const [lastSoldRows, rawOrders, rawProducts, rawLots] = await Promise.all([
        typeof (prisma as any).$queryRaw === 'function'
            ? prisma.$queryRaw<ProductLastSoldRow[]>`
              SELECT oi."productId" AS "productId", MAX(o."createdAt") AS "lastSoldAt"
              FROM "OrderItem" oi
              INNER JOIN "Order" o ON o."id" = oi."orderId"
              WHERE o."status" <> 'CANCELLED'
                AND o."createdAt" >= ${stagnantHistoryStart}
                AND COALESCE(o."invoiceNumber", '') NOT LIKE '00006-%'
                AND COALESCE(o."invoiceNumber", '') NOT LIKE '0006-%'
              GROUP BY oi."productId"
            `
          : Promise.resolve([] as ProductLastSoldRow[]),
        prisma.order.findMany({
          where: {
            status: { not: OrderStatus.CANCELLED },
            createdAt: { gte: clientBehaviorStart },
            persona: { isClient: true, isActive: true },
            AND: [buildOperatingOrderWhere()],
          },
          select: {
            id: true,
            personaId: true,
            createdAt: true,
            totalAmount: true,
            persona: { select: { name: true } },
            seller: { select: { username: true } },
            items: {
              select: {
                productId: true,
                quantity: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.product.findMany({
          where: { isActive: true },
          select: {
            id: true,
            sku: true,
            name: true,
            stock: true,
            costPrice: true,
            listPrice: true,
            rubro: { select: { name: true } },
          },
        }),
        prisma.productLot.findMany({
          where: {
            stock: { gt: 0 },
            expirationDate: { lte: expiringCutoff },
            product: { isActive: true },
          },
          select: {
            id: true,
            productId: true,
            lotNumber: true,
            expirationDate: true,
            stock: true,
            product: {
              select: {
                sku: true,
                name: true,
                costPrice: true,
              },
            },
          },
          orderBy: { expirationDate: 'asc' },
        }),
      ]);

      const lastSoldByProduct = new Map<number, Date>();
      for (const row of lastSoldRows) {
        if (row.lastSoldAt) {
          lastSoldByProduct.set(Number(row.productId), new Date(row.lastSoldAt));
        }
      }

      const orders: OpportunityOrderInput[] = rawOrders.map((o) => {
        for (const item of o.items) {
          const prev = lastSoldByProduct.get(item.productId);
          if (!prev || o.createdAt > prev) {
            lastSoldByProduct.set(item.productId, o.createdAt);
          }
        }
        return {
          id: o.id,
          clientId: o.personaId,
          clientName: o.persona.name,
          sellerName: o.seller?.username ?? null,
          createdAt: o.createdAt,
          totalAmount: o.totalAmount.toString(),
          items: o.items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
          })),
        };
      });

      const products: OpportunityProductInput[] = rawProducts.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        rubroName: p.rubro?.name ?? null,
        stock: p.stock,
        costPrice: p.costPrice.toString(),
        listPrice: p.listPrice.toString(),
        lastSoldAt: lastSoldByProduct.get(p.id) ?? null,
      }));

      const lots: OpportunityLotInput[] = rawLots.map((l) => ({
        id: l.id,
        productId: l.productId,
        sku: l.product.sku,
        productName: l.product.name,
        lotNumber: l.lotNumber,
        expirationDate: l.expirationDate,
        stock: l.stock,
        costPrice: l.product.costPrice.toString(),
      }));

      return buildCommercialOpportunitiesReport({
        orders,
        products,
        lots,
        referenceDate,
        stagnantDays,
        expiringDays,
      });
    },
  );
}
