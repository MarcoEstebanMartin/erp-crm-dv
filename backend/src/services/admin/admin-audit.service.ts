import prisma from '../../utils/prisma';
import { AuditLogFilters, buildAuditLogWhere } from './admin-audit-filter.helper';

export type { AuditLogFilters };

export interface AuditResolvedContext {
  entityLabel?: string;
  productsById?: Record<number, { name: string; sku: string }>;
  personasById?: Record<number, { name: string }>;
  rubrosById?: Record<number, { name: string }>;
  lotsById?: Record<
    number,
    {
      lotNumber: string;
      location: string;
      productId: number;
      productName?: string;
      productSku?: string;
    }
  >;
}

const MAX_BATCH_IDS_PER_LOG = 100;

const ENTITY_BUCKET_KEYS = [
  'Order',
  'User',
  'Employee',
  'SupplierInvoice',
  'PurchaseOrder',
  'CreditNote',
  'Transaction',
  'CashDrawer',
  'BankAccount',
  'DeliveryRoute',
  'SaleRoute',
  'SaleRouteVisit',
  'WeeklyPromo',
  'PerceptionType',
  'WarehouseCell',
] as const;

function toPositiveInt(value: unknown): number | null {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

async function fetchBatchMap(
  modelName: keyof typeof prisma,
  ids: Set<number>,
  select: Record<string, any>,
): Promise<Map<number, any>> {
  const result = new Map<number, any>();
  if (ids.size === 0) return result;

  const delegate = (prisma as any)?.[modelName];
  if (!delegate || typeof delegate.findMany !== 'function') return result;

  try {
    const rows = await delegate.findMany({ where: { id: { in: Array.from(ids) } }, select });
    for (const row of rows as any[]) {
      if (row && typeof row.id === 'number') result.set(row.id, row);
    }
  } catch {
    // Tolerante ante mocks parciales de tests o registros opcionales
  }
  return result;
}

function pickSubMap<T, R>(ids: number[], source: Map<number, T>, mapItem: (row: T) => R): Record<number, R> | undefined {
  const out: Record<number, R> = {};
  for (const id of ids) {
    const row = source.get(id);
    if (row) out[id] = mapItem(row);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function extractLogIds(log: any) {
  const oldV = log?.oldValues && typeof log.oldValues === 'object' ? log.oldValues : {};
  const newV = log?.newValues && typeof log.newValues === 'object' ? log.newValues : {};
  const entityType = String(log?.entityType || '');
  const action = String(log?.action || '');
  const entityId = toPositiveInt(log?.entityId);

  const collect = (list: unknown[]) =>
    Array.from(new Set(list.map(toPositiveInt).filter((v): v is number => v !== null)));

  const adjProductIds = Array.isArray(newV.adjustments)
    ? newV.adjustments.slice(0, MAX_BATCH_IDS_PER_LOG).map((adj: any) => adj?.productId)
    : [];

  return {
    entityType,
    action,
    entityId,
    productIds: collect([
      entityType === 'Product' || action === 'CLEAR_WMS_LOCATION' ? entityId : null,
      oldV.productId,
      newV.productId,
      ...adjProductIds,
    ]),
    personaIds: collect([entityType === 'Persona' ? entityId : null, oldV.personaId, newV.personaId, newV.providerId]),
    rubroIds: collect([entityType === 'Rubro' ? entityId : null, oldV.rubroId, newV.rubroId]),
    lotIds: collect([
      entityType === 'ProductLot' && action !== 'CLEAR_WMS_LOCATION' ? entityId : null,
      oldV.fromLotId,
      newV.toLotId,
      newV.productLotId,
    ]),
    vehicleId: entityType === 'Vehicle' ? entityId : toPositiveInt(newV.vehicleId) ?? toPositiveInt(oldV.vehicleId),
  };
}

function buildLabelResolvers(maps: Record<string, Map<number, any>>): Record<string, (id: number) => string | undefined> {
  return {
    Product: (id) => {
      const p = maps.Product.get(id);
      return p ? `${p.name} (SKU ${p.sku})` : undefined;
    },
    Persona: (id) => maps.Persona.get(id)?.name,
    Rubro: (id) => maps.Rubro.get(id)?.name,
    ProductLot: (id) => {
      const lot = maps.ProductLot.get(id);
      if (!lot) return undefined;
      const cleanLot = String(lot.lotNumber || 'S/L').split('@')[0].trim() || 'S/L';
      return lot.product?.name ? `${lot.product.name} — Lote ${cleanLot} (${lot.location})` : `Lote ${cleanLot} (${lot.location})`;
    },
    Order: (id) => {
      const o = maps.Order.get(id);
      if (!o) return undefined;
      return `Pedido #${o.id}${o.invoiceNumber ? ` (${o.invoiceNumber})` : ''}${o.persona?.name ? ` — ${o.persona.name}` : ''}`;
    },
    User: (id) => maps.User.get(id)?.username,
    Employee: (id) => {
      const e = maps.Employee.get(id);
      if (!e) return undefined;
      const full = `${e.firstName} ${e.lastName}`.trim();
      return e.user?.username ? `${full} (${e.user.username})` : full;
    },
    SupplierInvoice: (id) => {
      const inv = maps.SupplierInvoice.get(id);
      return inv ? `Factura ${inv.invoiceNumber}${inv.persona?.name ? ` — ${inv.persona.name}` : ''}` : undefined;
    },
    PurchaseOrder: (id) => {
      const po = maps.PurchaseOrder.get(id);
      return po ? `Orden de Compra #${po.id}${po.persona?.name ? ` — ${po.persona.name}` : ''}` : undefined;
    },
    CreditNote: (id) => {
      const cn = maps.CreditNote.get(id);
      return cn ? `${cn.creditNoteNumber || `NC #${cn.id}`}${cn.persona?.name ? ` — ${cn.persona.name}` : ''}` : undefined;
    },
    Transaction: (id) => {
      const tx = maps.Transaction.get(id);
      return tx ? `${tx.receiptNumber || `Mov. #${tx.id}`}${tx.persona?.name ? ` — ${tx.persona.name}` : ''}` : undefined;
    },
    CashDrawer: (id) => {
      const d = maps.CashDrawer.get(id);
      return d ? `Caja ${d.drawerType} Suc. ${d.branch}${d.routeNote ? ` (${d.routeNote})` : ''}` : undefined;
    },
    BankAccount: (id) => maps.BankAccount.get(id)?.name,
    DeliveryRoute: (id) => {
      const r = maps.DeliveryRoute.get(id);
      return r ? `Hoja #${r.id} (${r.driverName} · ${r.vehiclePlate})` : undefined;
    },
    SaleRoute: (id) => maps.SaleRoute.get(id)?.name,
    SaleRouteVisit: (id) => {
      const v = maps.SaleRouteVisit.get(id);
      return v?.persona?.name ? `Visita a ${v.persona.name}` : undefined;
    },
    Vehicle: (id) => {
      const v = maps.Vehicle.get(id);
      return v ? `${v.brand} ${v.model} (${v.plate})` : undefined;
    },
    WeeklyPromo: (id) => maps.WeeklyPromo.get(id)?.name,
    PerceptionType: (id) => {
      const pt = maps.PerceptionType.get(id);
      return pt ? `${pt.name} (${pt.code})` : undefined;
    },
    WarehouseCell: (id) => {
      const c = maps.WarehouseCell.get(id);
      return c ? `Posición ${c.code}` : undefined;
    },
  };
}

export class AdminAuditSubService {
  /** Obtener logs de auditoría paginados con filtros opcionales y contexto legible en bloque. */
  async getAuditLogs(page = 1, limit = 50, filters?: AuditLogFilters) {
    const safePage = Math.max(1, Math.trunc(Number(page) || 1));
    const safeLimit = Math.min(Math.max(1, Math.trunc(Number(limit) || 50)), 200);
    const skip = (safePage - 1) * safeLimit;
    const where = await buildAuditLogWhere(filters);

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        ...(where ? { where } : {}),
        skip,
        take: safeLimit,
        include: { user: { select: { id: true, username: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count(where ? { where } : undefined),
    ]);

    return {
      logs: await this.enrichAuditLogs(logs),
      pagination: { total, page: safePage, limit: safeLimit, totalPages: Math.max(1, Math.ceil(total / safeLimit)) },
    };
  }

  /** Obtener logs de auditoría para un documento o entidad específica. */
  async getDocumentAuditLogs(entityType: string, entityId: number) {
    const logs = await prisma.auditLog.findMany({
      where: { entityType, entityId: Number(entityId) },
      include: { user: { select: { id: true, username: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return this.enrichAuditLogs(logs);
  }

  /** Enriquece logs en 1 sola tanda paralela por tipo de entidad (cero consultas N+1). */
  async enrichAuditLogs<T extends Record<string, any>>(
    logs: T[],
  ): Promise<Array<T & { resolvedContext?: AuditResolvedContext }>> {
    if (!Array.isArray(logs) || logs.length === 0) return [];

    const buckets: Record<string, Set<number>> = {
      Product: new Set(),
      Persona: new Set(),
      Rubro: new Set(),
      ProductLot: new Set(),
      Vehicle: new Set(),
    };
    for (const key of ENTITY_BUCKET_KEYS) buckets[key] = new Set();

    const parsedLogs = logs.map((log) => {
      const refs = extractLogIds(log);
      refs.productIds.forEach((id) => buckets.Product.add(id));
      refs.personaIds.forEach((id) => buckets.Persona.add(id));
      refs.rubroIds.forEach((id) => buckets.Rubro.add(id));
      refs.lotIds.forEach((id) => buckets.ProductLot.add(id));
      if (refs.vehicleId) buckets.Vehicle.add(refs.vehicleId);
      if (refs.entityId && buckets[refs.entityType]) buckets[refs.entityType].add(refs.entityId);
      return { log, refs };
    });

    const [
      Product, Persona, Rubro, ProductLot, Order, User, Employee, SupplierInvoice,
      PurchaseOrder, CreditNote, Transaction, CashDrawer, BankAccount, DeliveryRoute,
      SaleRoute, SaleRouteVisit, Vehicle, WeeklyPromo, PerceptionType, WarehouseCell,
    ] = await Promise.all([
      fetchBatchMap('product', buckets.Product, { id: true, name: true, sku: true }),
      fetchBatchMap('persona', buckets.Persona, { id: true, name: true }),
      fetchBatchMap('rubro', buckets.Rubro, { id: true, name: true }),
      fetchBatchMap('productLot', buckets.ProductLot, {
        id: true, lotNumber: true, location: true, productId: true, product: { select: { name: true, sku: true } },
      }),
      fetchBatchMap('order', buckets.Order, { id: true, invoiceNumber: true, persona: { select: { name: true } } }),
      fetchBatchMap('user', buckets.User, { id: true, username: true }),
      fetchBatchMap('employee', buckets.Employee, {
        id: true, firstName: true, lastName: true, user: { select: { username: true } },
      }),
      fetchBatchMap('supplierInvoice', buckets.SupplierInvoice, { id: true, invoiceNumber: true, persona: { select: { name: true } } }),
      fetchBatchMap('purchaseOrder', buckets.PurchaseOrder, { id: true, persona: { select: { name: true } } }),
      fetchBatchMap('creditNote', buckets.CreditNote, { id: true, creditNoteNumber: true, persona: { select: { name: true } } }),
      fetchBatchMap('transaction', buckets.Transaction, { id: true, receiptNumber: true, persona: { select: { name: true } } }),
      fetchBatchMap('cashDrawer', buckets.CashDrawer, { id: true, drawerType: true, branch: true, routeNote: true }),
      fetchBatchMap('bankAccount', buckets.BankAccount, { id: true, name: true }),
      fetchBatchMap('deliveryRoute', buckets.DeliveryRoute, { id: true, driverName: true, vehiclePlate: true }),
      fetchBatchMap('saleRoute', buckets.SaleRoute, { id: true, name: true }),
      fetchBatchMap('saleRouteVisit', buckets.SaleRouteVisit, { id: true, persona: { select: { name: true } } }),
      fetchBatchMap('vehicle', buckets.Vehicle, { id: true, plate: true, brand: true, model: true }),
      fetchBatchMap('weeklyPromo', buckets.WeeklyPromo, { id: true, name: true }),
      fetchBatchMap('perceptionType', buckets.PerceptionType, { id: true, code: true, name: true }),
      fetchBatchMap('warehouseCell', buckets.WarehouseCell, { id: true, code: true }),
    ]);

    const resolvers = buildLabelResolvers({
      Product, Persona, Rubro, ProductLot, Order, User, Employee, SupplierInvoice,
      PurchaseOrder, CreditNote, Transaction, CashDrawer, BankAccount, DeliveryRoute,
      SaleRoute, SaleRouteVisit, Vehicle, WeeklyPromo, PerceptionType, WarehouseCell,
    });

    return parsedLogs.map(({ log, refs }) => {
      const ctx: AuditResolvedContext = {};

      if (refs.action === 'CLEAR_WMS_LOCATION' && refs.entityId) {
        ctx.entityLabel = resolvers.Product(refs.entityId);
      } else if (refs.entityId && resolvers[refs.entityType]) {
        ctx.entityLabel = resolvers[refs.entityType](refs.entityId);
      }
      if (!ctx.entityLabel && refs.vehicleId) {
        ctx.entityLabel = resolvers.Vehicle(refs.vehicleId);
      }
      if (!ctx.entityLabel) delete ctx.entityLabel;

      const productsById = pickSubMap(refs.productIds, Product, (p) => ({ name: p.name, sku: p.sku }));
      const personasById = pickSubMap(refs.personaIds, Persona, (p) => ({ name: p.name }));
      const rubrosById = pickSubMap(refs.rubroIds, Rubro, (r) => ({ name: r.name }));
      const lotsById = pickSubMap(refs.lotIds, ProductLot, (lot) => ({
        lotNumber: lot.lotNumber,
        location: lot.location,
        productId: lot.productId,
        productName: lot.product?.name,
        productSku: lot.product?.sku,
      }));

      if (productsById) ctx.productsById = productsById;
      if (personasById) ctx.personasById = personasById;
      if (rubrosById) ctx.rubrosById = rubrosById;
      if (lotsById) ctx.lotsById = lotsById;

      return Object.keys(ctx).length > 0 ? { ...log, resolvedContext: ctx } : log;
    });
  }
}

export const adminAuditSubService = new AdminAuditSubService();
