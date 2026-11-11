import {
  BillingType,
  InvoiceType,
  MovementType,
  OrderStatus,
  PrismaClient,
  SalesChannel,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import {
  mapWebOrderStatusToErp,
  translateWebOrderItemsToErpLines,
  type WebIncomingOrderItem,
} from '../../engines/web-order-sync.engine';

export interface RawWebOrderRow {
  id: string;
  customer_phone: string | null;
  customer_name: string;
  delivery_address: string | null;
  delivery_method: string | null;
  notes: string | null;
  total_amount: number | string;
  status: string | null;
  source: string | null;
  created_at: Date | string | null;
  items_json: WebIncomingOrderItem[] | string | null;
}

export interface SyncWebOrdersOptions {
  dryRun?: boolean;
  productionDbUrl?: string;
  onlyOrderIds?: string[];
  skipOrderIds?: string[];
  sinceCreatedAt?: Date;
  includeHistoricalTests?: boolean;
}

export interface WebOrderPreviewEntry {
  webOrderId: string;
  source: string;
  webStatus: string;
  customerName: string;
  customerPhone: string;
  matchedPersonaId: number | null;
  matchedPersonaName: string | null;
  willCreateNewClient: boolean;
  webTotalAmount: number;
  erpCalculatedTotal: number;
  linesCount: number;
  unmappedNotes: string[];
  stockWarnings: string[];
  action:
    | 'IMPORT'
    | 'ALREADY_IMPORTED'
    | 'SKIPPED_CANCELLED'
    | 'SKIPPED_EMPTY'
    | 'CANCELLED_IN_ERP';
  importedErpOrderId?: number;
}

export interface WebOrderSyncReport {
  dryRun: boolean;
  scannedWebOrders: number;
  importedCount: number;
  alreadyImportedCount: number;
  skippedCancelledCount: number;
  cancelledInErpCount: number;
  newClientsCreatedCount: number;
  ignoredTestOrdersCount: number;
  previews: WebOrderPreviewEntry[];
}

export async function commitSingleWebOrderAtomically(params: {
  wo: RawWebOrderRow;
  webOrderId: string;
  source: string;
  webStatus: string;
  phoneRaw: string;
  phone10: string;
  matchedClient: { id: number; name: string } | null;
  translated: ReturnType<typeof translateWebOrderItemsToErpLines>;
  sellerId: number;
}) {
  const {
    wo,
    webOrderId,
    source,
    webStatus,
    phoneRaw,
    phone10,
    matchedClient,
    translated,
    sellerId,
  } = params;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      `dv_web_order_${webOrderId}`,
    );

    const dupCheck = await tx.order.findFirst({
      where: {
        salesChannel: SalesChannel.TIENDA_WEB,
        bultosDetails: { path: ['webOrderId'], equals: webOrderId },
      },
      select: { id: true, personaId: true, persona: { select: { name: true } } },
    });

    if (dupCheck) {
      return {
        alreadyExisted: true,
        orderId: dupCheck.id,
        personaId: dupCheck.personaId,
        personaName: dupCheck.persona.name,
        createdNewClient: false,
      };
    }

    let personaId = matchedClient?.id || 0;
    let personaName = matchedClient?.name || wo.customer_name.trim();
    let createdNewClient = false;

    if (!personaId) {
      const newPersona = await tx.persona.create({
        data: {
          name: wo.customer_name.trim() || `Cliente Web ${phone10 || webOrderId}`,
          phone: phoneRaw || null,
          address: wo.delivery_address?.trim() || null,
          isClient: true,
          isActive: true,
          priceList: 'A',
        },
      });
      personaId = newPersona.id;
      personaName = newPersona.name;
      createdNewClient = true;
    }

    const channelLabel = source === 'whatsapp_bot' ? 'Chatbot WhatsApp' : 'Tienda Web';
    const methodLabel =
      wo.delivery_method === 'retiro' || wo.delivery_method === 'retiro_local'
        ? 'Retiro en Local'
        : 'Reparto';
    const noteParts = [
      `[${channelLabel} #${webOrderId} | ${methodLabel}${wo.delivery_address ? `: ${wo.delivery_address.trim()}` : ''}]`,
    ];
    if (wo.notes?.trim()) noteParts.push(wo.notes.trim());
    if (translated.unmappedNotes.length > 0) {
      noteParts.push(`A revisar: ${translated.unmappedNotes.join(' | ')}`);
    }

    const mappedStatus = mapWebOrderStatusToErp(webStatus);
    const initialStatus =
      mappedStatus === OrderStatus.DELIVERED ? OrderStatus.PENDING : mappedStatus;

    const newOrder = await tx.order.create({
      data: {
        personaId,
        sellerId,
        billingType: BillingType.INTERNAL,
        invoiceType: InvoiceType.PRESUPUESTO,
        salesChannel: SalesChannel.TIENDA_WEB,
        status: initialStatus,
        netAmount: translated.netAmount,
        taxAmount: translated.taxAmount,
        totalAmount: translated.totalAmount,
        notes: noteParts.join(' — '),
        bultosCount: translated.bultosCount,
        bultosDetails: {
          isWebOrder: true,
          webOrderId,
          webSource: source,
          channel: channelLabel,
          deliveryMethod: wo.delivery_method || 'reparto',
          deliveryAddress: wo.delivery_address || '',
          customerPhone: phoneRaw,
          clientName: wo.customer_name,
          stockWarnings: translated.stockWarnings,
          importedAt: new Date().toISOString(),
        },
        items: {
          create: translated.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            weight: l.weight,
            unitPrice: l.unitPrice,
            subtotal: l.subtotal,
            unitCostSnapshot: l.unitCostSnapshot,
            listPriceSnapshot: l.listPriceSnapshot,
            discountPctSnapshot: l.discountPctSnapshot,
          })),
        },
      },
    });

    for (const l of translated.lines) {
      await tx.product.update({
        where: { id: l.productId },
        data: { stock: { decrement: l.quantity } },
      });
    }

    await tx.stockMovement.createMany({
      data: translated.lines.map((l) => ({
        productId: l.productId,
        quantity: -l.quantity,
        type: MovementType.OUT,
        orderId: newOrder.id,
        referenceId: `WEB-ORDER-${webOrderId}`,
        userId: sellerId,
        reason: `Ingreso ${channelLabel} #${webOrderId} -> Pedido ERP #${newOrder.id}`,
      })),
    });

    return {
      alreadyExisted: false,
      orderId: newOrder.id,
      personaId,
      personaName,
      createdNewClient,
    };
  });
}

export interface WebOrderHeaderRow {
  id: string;
  status: string | null;
  created_at: Date | string | null;
}

export async function fetchProductionOrderHeaders(prodDb: PrismaClient): Promise<WebOrderHeaderRow[]> {
  return await prodDb.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL transaction_read_only = on');
    return await tx.$queryRawUnsafe<WebOrderHeaderRow[]>(
      `SELECT id, status, created_at FROM public.orders ORDER BY created_at ASC, id ASC`,
    );
  });
}

export async function fetchProductionOrdersBatch(
  prodDb: PrismaClient,
  upperOrderIds: string[],
): Promise<{ webOrders: RawWebOrderRow[]; rawCatalogState: string | null }> {
  return await prodDb.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL transaction_read_only = on');
    const rows = await tx.$queryRawUnsafe<RawWebOrderRow[]>(
      `SELECT o.id, o.customer_phone, o.customer_name, o.delivery_address, o.delivery_method,
              o.notes, o.total_amount, o.status, o.source, o.created_at,
              COALESCE((SELECT json_agg(oi ORDER BY oi.id ASC) FROM public.order_items oi WHERE oi.order_id = o.id), '[]'::json) AS items_json
       FROM public.orders o
       WHERE UPPER(o.id) = ANY($1::text[])
       ORDER BY o.created_at ASC, o.id ASC`,
      upperOrderIds,
    );
    const metaRows = await tx.$queryRawUnsafe<Array<{ value: string | null }>>(
      `SELECT value FROM public.metadata WHERE key = 'catalog_active_state' LIMIT 1`,
    );
    return { webOrders: rows, rawCatalogState: metaRows[0]?.value || null };
  });
}
