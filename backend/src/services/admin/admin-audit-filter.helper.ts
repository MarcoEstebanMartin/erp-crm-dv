import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { AuditModuleKey, AuditStatusKey } from '../../validators/admin.validator';

export interface AuditLogFilters {
  search?: string;
  userId?: number;
  module?: AuditModuleKey;
  status?: AuditStatusKey;
  startDate?: string;
  endDate?: string;
}

const MODULE_WHERE_MAP: Record<AuditModuleKey, Prisma.AuditLogWhereInput> = {
  ACCESS: { action: { in: ['LOGIN', 'LOGIN_FAILED', 'CHANGE_OWN_PASSWORD'] } },
  STAFF: {
    OR: [
      { action: { in: ['CREATE_USER', 'UPDATE_USER', 'TOGGLE_USER_STATUS', 'DELETE_USER', 'CREATE_EMPLOYEE', 'UPDATE_EMPLOYEE'] } },
      { entityType: 'Employee' },
    ],
  },
  STOCK_WMS: {
    OR: [
      {
        action: {
          in: [
            'ASSIGN_WMS_LOCATION', 'CLEAR_WMS_LOCATION', 'UPSERT_WAREHOUSE_CELL', 'RESET_WAREHOUSE_CELL',
            'ADJUST_STOCK', 'ADJUST_STOCK_BATCH', 'RECONCILE_STOCK_DRIFT', 'RECONCILE_STOCK',
            'UPDATE_LOT', 'DELETE_LOT', 'TRANSFER_LOT_STOCK',
          ],
        },
      },
      { entityType: { in: ['ProductLot', 'WarehouseCell'] } },
    ],
  },
  CATALOG: {
    OR: [
      {
        action: {
          in: [
            'CREATE_PRODUCT', 'UPDATE_PRODUCT', 'UPDATE_PRODUCT_IMAGE', 'IMPORT_PRODUCT_IMAGE_ZIP',
            'IMPORT_PRODUCTS_CSV', 'BULK_UPDATE_PRICES', 'REVERT_PRICES_UNDO', 'SYNC_FROM_PRODUCTION_CATALOG',
            'EXCEL_IMPORT', 'CREATE_RUBRO', 'UPDATE_RUBRO', 'DELETE_RUBRO',
            'CREATE_WEEKLY_PROMO', 'TOGGLE_WEEKLY_PROMO', 'DELETE_WEEKLY_PROMO',
          ],
        },
      },
      { entityType: { in: ['Rubro', 'WeeklyPromo', 'PRODUCTS', 'PRICES'] } },
    ],
  },
  CLIENTS: {
    OR: [
      { action: { in: ['CREATE_PERSONA', 'UPDATE_PERSONA', 'DELETE_PERSONA', 'CLIENT_VISIT_FAIL'] } },
      { entityType: { in: ['CLIENTS', 'PROVIDERS'] } },
    ],
  },
  SALES: {
    OR: [
      {
        action: {
          in: [
            'CREATE_ORDER', 'CREATE_ORDER_FAILED', 'UPDATE_ORDER', 'UPDATE_ORDER_ITEMS',
            'UPDATE_ORDER_WEIGHTS', 'CONFIRM_ARMADO', 'UPDATE_ORDER_STATUS', 'INVOICE_ORDER',
            'EMIT_AFIP_INVOICE', 'CREATE_DIRECT_INVOICE', 'CANCEL_ORDER',
            'CREATE_CREDIT_NOTE', 'APPROVE_CREDIT_NOTE', 'REJECT_CREDIT_NOTE',
          ],
        },
      },
      { entityType: { in: ['Order', 'CreditNote'] } },
    ],
  },
  PURCHASES: {
    OR: [
      {
        action: {
          in: [
            'CREATE_PURCHASE_ORDER', 'RECEIVE_PURCHASE_ORDER', 'CREATE_SUPPLIER_INVOICE',
            'DELETE_SUPPLIER_INVOICE', 'CREATE_TAX_WITHHOLDING', 'UPDATE_PERCEPTION_TYPE',
          ],
        },
      },
      { entityType: { in: ['PurchaseOrder', 'SupplierInvoice', 'TaxWithholding', 'PerceptionType'] } },
    ],
  },
  FINANCE: {
    OR: [
      {
        action: {
          in: [
            'RECORD_PERSONA_PAYMENT', 'REGISTER_PAYMENT', 'CREATE_COLLECTION', 'DELETE_COLLECTION_RECEIPT',
            'CANCEL_TRANSACTION', 'CLOSE_OPERATIVE_DRAWER_RENDICION', 'OPEN_CASH_DRAWER',
            'CLOSE_CASH_DRAWER', 'CLOSE_CENTRAL_DRAWER', 'CREATE_BANK_ACCOUNT', 'UPDATE_BANK_ACCOUNT',
            'DEPOSIT_CASH_TO_BANK', 'VERIFY_BANK_TRANSFER', 'CREATE_EXPENSE', 'BULK_CREATE_EXPENSES',
            'IMPORT_EXPENSES_EXCEL', 'DELETE_EXPENSE',
          ],
        },
      },
      { entityType: { in: ['Transaction', 'CashDrawer', 'BankAccount', 'Expense'] } },
    ],
  },
  LOGISTICS: {
    OR: [
      {
        action: {
          in: [
            'CREATE_DELIVERY_ROUTE', 'UPDATE_DELIVERY_ROUTE_STATUS', 'DELETE_DELIVERY_ROUTE',
            'TRANSFER_ROUTE_CUSTODY', 'SETTLE_DELIVERY_ROUTE', 'CREATE_SALE_ROUTE', 'UPDATE_SALE_ROUTE',
            'DELETE_SALE_ROUTE', 'UPDATE_SALE_ROUTE_SEQUENCE', 'ADD_CLIENT_TO_ROUTE', 'RECORD_ROUTE_VISIT',
            'CREATE_VEHICLE', 'UPDATE_VEHICLE', 'DELETE_VEHICLE', 'CREATE_VEHICLE_MAINTENANCE',
            'DELETE_VEHICLE_MAINTENANCE', 'CREATE_VEHICLE_EXPIRY', 'UPDATE_VEHICLE_EXPIRY',
            'DELETE_VEHICLE_EXPIRY', 'CREATE_FUEL_LOG', 'DELETE_FUEL_LOG',
          ],
        },
      },
      {
        entityType: {
          in: ['DeliveryRoute', 'SaleRoute', 'SaleRouteVisit', 'Vehicle', 'VehicleMaintenance', 'VehicleExpiry', 'FuelLog'],
        },
      },
    ],
  },
  SYSTEM: {
    OR: [
      { action: { in: ['UPDATE_CONFIG', 'ENCRYPTED_DATABASE_BACKUP', 'SYNC_BALANCES'] } },
      { entityType: { in: ['SystemSetting', 'DATABASE'] } },
    ],
  },
};

const ACTION_SPANISH_INDEX: Array<[string, string]> = [
  ['LOGIN', 'inicio sesion ingreso sistema'],
  ['LOGIN_FAILED', 'ingreso fallido rechazo clave'],
  ['CHANGE_OWN_PASSWORD', 'cambio clave propia contrasena'],
  ['CREATE_USER', 'creacion empleado alta usuario'],
  ['UPDATE_USER', 'edicion empleado rol usuario'],
  ['TOGGLE_USER_STATUS', 'cambio estado empleado activo desactivo acceso'],
  ['DELETE_USER', 'eliminacion empleado usuario'],
  ['CREATE_EMPLOYEE', 'alta legajo rrhh empleado'],
  ['UPDATE_EMPLOYEE', 'edicion legajo rrhh empleado'],
  ['ASSIGN_WMS_LOCATION', 'ubicacion deposito posicion wms ubico mercaderia'],
  ['CLEAR_WMS_LOCATION', 'liberacion posicion deposito wms'],
  ['UPSERT_WAREHOUSE_CELL', 'configuracion posicion plano wms'],
  ['RESET_WAREHOUSE_CELL', 'restauracion posicion plano wms'],
  ['ADJUST_STOCK', 'ajuste stock fisico'],
  ['ADJUST_STOCK_BATCH', 'ajuste stock fisico masivo lote'],
  ['RECONCILE_STOCK_DRIFT', 'conciliacion desvios stock'],
  ['RECONCILE_STOCK', 'conciliacion control stock'],
  ['UPDATE_LOT', 'edicion lote vencimiento ubicacion'],
  ['DELETE_LOT', 'eliminacion lote'],
  ['TRANSFER_LOT_STOCK', 'traslado transferencia entre lotes'],
  ['CREATE_PRODUCT', 'alta producto catalogo'],
  ['UPDATE_PRODUCT', 'edicion modificacion producto precio lista costo'],
  ['UPDATE_PRODUCT_IMAGE', 'foto imagen producto'],
  ['IMPORT_PRODUCT_IMAGE_ZIP', 'importacion fotos zip'],
  ['IMPORT_PRODUCTS_CSV', 'importacion precios csv'],
  ['BULK_UPDATE_PRICES', 'actualizacion masiva precios listas'],
  ['REVERT_PRICES_UNDO', 'reversion deshacer precios'],
  ['SYNC_FROM_PRODUCTION_CATALOG', 'sincronizacion catalogo tienda online'],
  ['EXCEL_IMPORT', 'importacion excel planilla'],
  ['CREATE_WEEKLY_PROMO', 'nueva oferta semanal promocion'],
  ['TOGGLE_WEEKLY_PROMO', 'estado oferta semanal promocion'],
  ['DELETE_WEEKLY_PROMO', 'baja eliminacion oferta semanal'],
  ['CREATE_PERSONA', 'alta cliente proveedor ficha'],
  ['UPDATE_PERSONA', 'edicion cliente proveedor'],
  ['DELETE_PERSONA', 'baja eliminacion cliente proveedor'],
  ['CLIENT_VISIT_FAIL', 'visita sin compra preventa'],
  ['CREATE_ORDER', 'nuevo pedido preventa'],
  ['UPDATE_ORDER_ITEMS', 'edicion items articulos pedido'],
  ['UPDATE_ORDER_WEIGHTS', 'pesaje balanza pesos pedido'],
  ['CONFIRM_ARMADO', 'armado deposito pedido'],
  ['UPDATE_ORDER_STATUS', 'estado pedido pendiente armado entregado'],
  ['INVOICE_ORDER', 'facturacion pedido'],
  ['EMIT_AFIP_INVOICE', 'emision factura afip arca cae'],
  ['CREATE_DIRECT_INVOICE', 'facturacion directa mostrador'],
  ['CANCEL_ORDER', 'anulacion pedido'],
  ['CREATE_CREDIT_NOTE', 'nota de credito devolucion'],
  ['APPROVE_CREDIT_NOTE', 'aprobacion nota de credito'],
  ['REJECT_CREDIT_NOTE', 'rechazo nota de credito'],
  ['RECORD_PERSONA_PAYMENT', 'cobro pago cuenta corriente recibo'],
  ['DELETE_COLLECTION_RECEIPT', 'anulacion recibo cobranza'],
  ['CLOSE_OPERATIVE_DRAWER_RENDICION', 'rendicion caja cobranza'],
  ['OPEN_CASH_DRAWER', 'apertura caja operativa'],
  ['CLOSE_CASH_DRAWER', 'cierre caja operativa'],
  ['CLOSE_CENTRAL_DRAWER', 'cierre caja central'],
  ['DEPOSIT_CASH_TO_BANK', 'deposito bancario efectivo caja'],
  ['VERIFY_BANK_TRANSFER', 'conciliacion verificacion transferencia bancaria'],
  ['CREATE_EXPENSE', 'registro gasto operativo'],
  ['SETTLE_DELIVERY_ROUTE', 'liquidacion reparto hoja'],
  ['UPDATE_CONFIG', 'configuracion general sistema'],
  ['ENCRYPTED_DATABASE_BACKUP', 'respaldo backup encriptado base'],
];

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function parseArgentinaDayRange(startDate?: string, endDate?: string): { gte?: Date; lte?: Date } {
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  const gte = startDate && isoRegex.test(startDate) ? new Date(`${startDate}T00:00:00.000-03:00`) : undefined;
  const lte = endDate && isoRegex.test(endDate) ? new Date(`${endDate}T23:59:59.999-03:00`) : undefined;
  return {
    gte: gte && !Number.isNaN(gte.getTime()) ? gte : undefined,
    lte: lte && !Number.isNaN(lte.getTime()) ? lte : undefined,
  };
}

async function safeFindIds(modelName: keyof typeof prisma, where: any, take = 100): Promise<number[]> {
  const delegate = (prisma as any)?.[modelName];
  if (!delegate || typeof delegate.findMany !== 'function') return [];
  try {
    const rows = await delegate.findMany({ where, select: { id: true }, take });
    return (rows as any[]).map((r) => Number(r?.id)).filter((id) => Number.isInteger(id) && id > 0);
  } catch {
    return [];
  }
}

async function findJsonMatchingAuditIds(q: string, productIds: number[]): Promise<number[]> {
  const rawFn = (prisma as any)?.$queryRaw;
  if (typeof rawFn !== 'function') return [];

  const pattern = `%${q.replace(/[!%_]/g, '!$&')}%`;
  try {
    const query =
      productIds.length > 0
        ? Prisma.sql`
            SELECT id FROM "AuditLog"
            WHERE "newValues"::text ILIKE ${pattern} ESCAPE '!'
               OR "oldValues"::text ILIKE ${pattern} ESCAPE '!'
               OR ("action" = 'ADJUST_STOCK_BATCH' AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements(
                      CASE WHEN jsonb_typeof("newValues"->'adjustments') = 'array'
                           THEN "newValues"->'adjustments' ELSE '[]'::jsonb END
                    ) elem
                    WHERE (elem->>'productId') ~ '^\\d+$'
                      AND (elem->>'productId')::int IN (${Prisma.join(productIds)})
                  ))
            ORDER BY "createdAt" DESC
            LIMIT 400
          `
        : Prisma.sql`
            SELECT id FROM "AuditLog"
            WHERE "newValues"::text ILIKE ${pattern} ESCAPE '!'
               OR "oldValues"::text ILIKE ${pattern} ESCAPE '!'
            ORDER BY "createdAt" DESC
            LIMIT 400
          `;
    const rows = await (prisma.$queryRaw<Array<{ id: number }>>(query));
    return Array.isArray(rows)
      ? rows.map((r) => Number(r?.id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];
  } catch {
    return [];
  }
}

async function buildSearchOrConditions(rawSearch: string): Promise<Prisma.AuditLogWhereInput[]> {
  const q = rawSearch.trim();
  const conditions: Prisma.AuditLogWhereInput[] = [
    { action: { contains: q, mode: 'insensitive' } },
    { entityType: { contains: q, mode: 'insensitive' } },
    { errorMessage: { contains: q, mode: 'insensitive' } },
    { ipAddress: { contains: q, mode: 'insensitive' } },
    { user: { username: { contains: q, mode: 'insensitive' } } },
  ];

  const cleanNumeric = q.replace(/^#/, '').trim();
  if (/^\d+$/.test(cleanNumeric)) {
    const numId = Number(cleanNumeric);
    if (Number.isSafeInteger(numId) && numId > 0) {
      conditions.push({ id: numId }, { entityId: numId });
    }
  }

  const tokens = normalizeText(q).split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length > 0) {
    const matchedActions = ACTION_SPANISH_INDEX.filter(([, words]) =>
      tokens.every((token) => words.includes(token)),
    ).map(([code]) => code);
    if (matchedActions.length > 0) {
      conditions.push({ action: { in: matchedActions } });
    }
  }

  const [productIds, personaIds, directOrderIds, userIds, employeeIds] = await Promise.all([
    safeFindIds('product', { OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }] }, 100),
    safeFindIds('persona', { OR: [{ name: { contains: q, mode: 'insensitive' } }, { cuit: { contains: q, mode: 'insensitive' } }] }, 100),
    safeFindIds('order', { invoiceNumber: { contains: q, mode: 'insensitive' } }, 150),
    safeFindIds('user', { username: { contains: q, mode: 'insensitive' } }, 50),
    safeFindIds('employee', { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }] }, 50),
  ]);

  const lotOr: any[] = [{ lotNumber: { contains: q, mode: 'insensitive' } }, { location: { contains: q, mode: 'insensitive' } }];
  if (productIds.length > 0) lotOr.push({ productId: { in: productIds } });

  const [lotIds, ordersByPersona, jsonIds] = await Promise.all([
    safeFindIds('productLot', { OR: lotOr }, 100),
    personaIds.length > 0 ? safeFindIds('order', { personaId: { in: personaIds } }, 150) : Promise.resolve([]),
    findJsonMatchingAuditIds(q, productIds),
  ]);

  if (productIds.length > 0) {
    conditions.push(
      { entityType: 'Product', entityId: { in: productIds } },
      { action: 'CLEAR_WMS_LOCATION', entityId: { in: productIds } },
    );
  }
  if (lotIds.length > 0) conditions.push({ entityType: 'ProductLot', entityId: { in: lotIds } });
  if (personaIds.length > 0) conditions.push({ entityType: 'Persona', entityId: { in: personaIds } });

  const orderIds = Array.from(new Set([...directOrderIds, ...ordersByPersona]));
  if (orderIds.length > 0) conditions.push({ entityType: 'Order', entityId: { in: orderIds } });
  if (userIds.length > 0) conditions.push({ entityType: 'User', entityId: { in: userIds } });
  if (employeeIds.length > 0) conditions.push({ entityType: 'Employee', entityId: { in: employeeIds } });
  if (jsonIds.length > 0) conditions.push({ id: { in: jsonIds } });

  return conditions;
}

/** Construye la cláusula Prisma where para GET /api/admin/audit-logs (undefined si no hay filtros). */
export async function buildAuditLogWhere(filters?: AuditLogFilters): Promise<Prisma.AuditLogWhereInput | undefined> {
  if (!filters) return undefined;
  const andConditions: Prisma.AuditLogWhereInput[] = [];

  if (filters.userId && Number.isInteger(filters.userId) && filters.userId > 0) {
    andConditions.push({ userId: filters.userId });
  }
  if (filters.status) {
    andConditions.push({ status: filters.status });
  }
  if (filters.module && MODULE_WHERE_MAP[filters.module]) {
    andConditions.push(MODULE_WHERE_MAP[filters.module]);
  }

  const { gte, lte } = parseArgentinaDayRange(filters.startDate, filters.endDate);
  if (gte || lte) {
    andConditions.push({ createdAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } });
  }

  const search = typeof filters.search === 'string' ? filters.search.trim() : '';
  if (search) {
    andConditions.push({ OR: await buildSearchOrConditions(search) });
  }

  if (andConditions.length === 0) return undefined;
  return andConditions.length === 1 ? andConditions[0] : { AND: andConditions };
}
