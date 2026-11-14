import { extractCleanLotNumber, formatCleanExpirationDate } from '../../stock/lotLabel';
import {
  resolveAuditModuleLabel,
  translateEntityType,
  translateOrderStatus,
  translatePaymentMethod,
  translateRole,
} from './auditLogDictionary';
import { formatAuditIp, formatAuditPesos } from './auditLogFormatter';

export interface AuditMetaItem {
  label: string;
  value: string;
}

export interface AuditChangeRow {
  key: string;
  label: string;
  before?: string;
  after?: string;
}

export interface AuditBatchItemRow {
  productId: number;
  productLabel: string;
  before: string;
  after: string;
  delta: string;
  tone: 'positive' | 'negative' | 'neutral';
}

export interface AuditLogInspection {
  metadata: AuditMetaItem[];
  errorBanner?: string;
  changes: AuditChangeRow[];
  hasBeforeColumn: boolean;
  batchItems?: AuditBatchItemRow[];
}

const IGNORED_KEYS = new Set([
  'id',
  'password',
  'passwordHash',
  'pwdVer',
  'createdAt',
  'updatedAt',
  'adjustments',
  'resolvedContext',
]);

const MONEY_KEYS = new Set([
  'listPrice',
  'listPriceB',
  'listPriceC',
  'costPrice',
  'total',
  'totalAmount',
  'amount',
  'realCash',
  'realBalanceDeclared',
  'netAmount',
  'taxAmount',
  'discount',
  'creditLimit',
  'cost',
  'price',
  'unitPrice',
]);

const FIELD_LABELS_ES: Record<string, string> = {
  name: 'Nombre',
  sku: 'Código SKU',
  barcode: 'Código de barras',
  listPrice: 'Precio Lista A',
  listPriceB: 'Precio Lista B',
  listPriceC: 'Precio Lista C',
  costPrice: 'Precio de costo',
  taxRate: 'Alícuota IVA (%)',
  unitType: 'Unidad de medida',
  unitsPerPack: 'Unidades por bulto',
  unitsPerBox: 'Unidades por bulto',
  minStock: 'Stock mínimo',
  isActive: 'Estado activo',
  isPublishedOnline: 'Publicado en Tienda Online',
  isOfferOnline: 'Destacado en Oferta Online',
  rubroId: 'Rubro',
  personaId: 'Cliente / Proveedor',
  providerId: 'Proveedor',
  productId: 'Producto',
  fromLotId: 'Lote origen',
  toLotId: 'Lote destino',
  productLotId: 'Lote',
  locationCode: 'Posición WMS',
  location: 'Ubicación',
  mode: 'Modalidad',
  quantity: 'Cantidad',
  movedUnitsToUnassigned: 'Unidades enviadas a Sin Ubicar',
  writtenOffUnits: 'Unidades dadas de baja',
  physicalUnits: 'Stock físico',
  previousPhysical: 'Stock físico anterior',
  newPhysical: 'Stock físico nuevo',
  stock: 'Stock',
  appliedDelta: 'Diferencia aplicada',
  lotNumber: 'Lote',
  expirationDate: 'Vencimiento',
  status: 'Estado',
  invoiceNumber: 'Comprobante N.º',
  creditNoteNumber: 'Nota de Crédito N.º',
  receiptNumber: 'Recibo N.º',
  total: 'Total',
  totalAmount: 'Importe total',
  amount: 'Importe',
  realCash: 'Efectivo rendido',
  realBalanceDeclared: 'Saldo real declarado',
  paymentMethod: 'Medio de pago',
  verified: 'Verificación bancaria',
  bankAccountName: 'Cuenta bancaria',
  itemsCount: 'Cantidad de ítems',
  username: 'Usuario',
  role: 'Rol',
  passwordChanged: 'Cambio de contraseña',
  ignoreStock: 'Facturar sin validar stock',
  priceList: 'Lista afectada',
  type: 'Tipo',
  value: 'Valor aplicado',
  updatedCount: 'Registros actualizados',
  createdCount: 'Registros creados',
  revertedCount: 'Productos revertidos',
  transactionsCount: 'Movimientos incluidos',
  count: 'Cantidad afectada',
  reason: 'Motivo',
  description: 'Descripción',
  plate: 'Patente',
  driverName: 'Chofer',
  vehiclePlate: 'Patente del vehículo',
  isBlocked: 'Posición bloqueada',
  code: 'Código',
  fileName: 'Archivo',
  domain: 'Módulo importado',
  createdProductsCount: 'Productos nuevos',
  updatedProductsCount: 'Productos actualizados',
};

const PRICE_LIST_LABELS: Record<string, string> = {
  all: 'Todas las listas',
  listPrice: 'Lista A',
  listPriceB: 'Lista B',
  listPriceC: 'Lista C',
};

const WMS_MODE_LABELS: Record<string, string> = {
  RELOCATE: 'Reubicación en depósito',
  STOCK_IN: 'Ingreso de mercadería',
  UNASSIGN: 'Envío a Sin Ubicar',
  WRITE_OFF: 'Baja por ajuste',
};

const STATUS_RESULT_LABELS: Record<string, string> = {
  SUCCESS: 'Exitoso',
  WARNING: 'Advertencia',
  ERROR: 'Con error',
};

function asObj(val: unknown): Record<string, any> {
  return val && typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, any>) : {};
}

function hasValue(val: unknown): boolean {
  return val !== undefined && val !== null && val !== '';
}

function formatFieldLabel(key: string): string {
  if (FIELD_LABELS_ES[key]) return FIELD_LABELS_ES[key];
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatFieldValue(key: string, val: unknown, log: any, objContext: Record<string, any>): string {
  if (val === undefined || val === null || val === '') return '—';

  if (key === 'isActive') return val ? 'Activo' : 'Inactivo';
  if (key === 'verified') return val ? 'Verificada' : 'Pendiente';
  if (typeof val === 'boolean') return val ? 'Sí' : 'No';

  if (MONEY_KEYS.has(key)) return formatAuditPesos(val);
  if (key === 'value' && (objContext.type === 'fixed' || objContext.type === 'FIXED')) return formatAuditPesos(val);
  if (key === 'value' && objContext.type) return `${val}%`;
  if (key === 'appliedDelta') {
    const num = Number(val);
    return Number.isFinite(num) ? `${num > 0 ? `+${num}` : num} u.` : String(val);
  }

  if (key === 'status') return translateOrderStatus(String(val));
  if (key === 'role') return translateRole(String(val));
  if (key === 'paymentMethod') return translatePaymentMethod(String(val));
  if (key === 'priceList') return PRICE_LIST_LABELS[String(val)] || String(val);
  if (key === 'mode') return WMS_MODE_LABELS[String(val).toUpperCase()] || String(val);
  if (key === 'lotNumber') return extractCleanLotNumber(String(val));
  if (key === 'expirationDate') return formatCleanExpirationDate(String(val));
  if (key === 'domain') return translateEntityType(String(val));
  if (key === 'type') {
    const typeMap: Record<string, string> = {
      INCOME: 'Cobro (Ingreso)',
      OUTCOME: 'Pago (Egreso)',
      fixed: 'Monto fijo ($)',
      percent: 'Porcentaje (%)',
      percentage: 'Porcentaje (%)',
    };
    return typeMap[String(val)] || String(val);
  }

  const numId = Number(val);
  if (key === 'productId' && log?.resolvedContext?.productsById?.[numId]) {
    const p = log.resolvedContext.productsById[numId];
    return `${p.name} (SKU ${p.sku})`;
  }
  if ((key === 'personaId' || key === 'providerId') && log?.resolvedContext?.personasById?.[numId]) {
    return log.resolvedContext.personasById[numId].name;
  }
  if (key === 'rubroId' && log?.resolvedContext?.rubrosById?.[numId]) {
    return log.resolvedContext.rubrosById[numId].name;
  }
  if ((key === 'fromLotId' || key === 'toLotId' || key === 'productLotId') && log?.resolvedContext?.lotsById?.[numId]) {
    const lot = log.resolvedContext.lotsById[numId];
    return `${extractCleanLotNumber(lot.lotNumber)} (${lot.location})`;
  }

  if (Array.isArray(val)) return val.length === 0 ? 'Ninguno' : `${val.length} elementos`;
  if (typeof val === 'object') return Object.entries(val).map(([k, v]) => `${formatFieldLabel(k)}: ${String(v)}`).join(' · ');
  return String(val);
}

function buildMetadata(log: any): AuditMetaItem[] {
  const meta: AuditMetaItem[] = [];
  if (log?.id) meta.push({ label: 'Registro', value: `#${log.id}` });
  meta.push({ label: 'Módulo', value: resolveAuditModuleLabel(log?.action, log?.entityType) });

  const entityText =
    log?.resolvedContext?.entityLabel ||
    `${translateEntityType(log?.entityType)}${Number(log?.entityId) > 0 ? ` (#${log.entityId})` : ''}`;
  meta.push({ label: 'Afecta a', value: entityText });

  const roleText = log?.user?.role ? translateRole(log.user.role) : '';
  if (roleText) meta.push({ label: 'Rol en sesión', value: roleText });

  const ipText = formatAuditIp(log?.ipAddress);
  if (ipText) meta.push({ label: 'Origen IP', value: ipText });

  const statusKey = String(log?.status || 'SUCCESS').toUpperCase();
  meta.push({ label: 'Resultado', value: STATUS_RESULT_LABELS[statusKey] || statusKey });
  return meta;
}

function buildBatchItems(log: any, newV: Record<string, any>): AuditBatchItemRow[] | undefined {
  if (String(log?.action || '').toUpperCase() !== 'ADJUST_STOCK_BATCH' || !Array.isArray(newV.adjustments)) {
    return undefined;
  }

  return newV.adjustments.map((adj: any) => {
    const productId = Number(adj?.productId) || 0;
    const resolved = log?.resolvedContext?.productsById?.[productId];
    const productLabel = resolved ? `${resolved.name} (SKU ${resolved.sku})` : `Producto #${productId}`;
    const prev = adj?.previousPhysical ?? adj?.previousStock;
    const next = adj?.newPhysical ?? adj?.newStock;
    const rawDelta =
      adj?.appliedDelta !== undefined && adj?.appliedDelta !== null
        ? Number(adj.appliedDelta)
        : prev !== undefined && next !== undefined
          ? Number(next) - Number(prev)
          : 0;
    const deltaNum = Number.isFinite(rawDelta) ? rawDelta : 0;
    const tone: AuditBatchItemRow['tone'] =
      deltaNum > 0 ? 'positive' : deltaNum < 0 ? 'negative' : 'neutral';

    return {
      productId,
      productLabel,
      before: prev !== undefined ? `${prev} u.` : '—',
      after: next !== undefined ? `${next} u.` : '—',
      delta: `${deltaNum > 0 ? '+' : ''}${deltaNum} u.`,
      tone,
    };
  });
}

/** Construye una inspección legible en español sin exponer JSON crudo ni floats de dinero. */
export function buildAuditLogInspection(log: any): AuditLogInspection {
  const oldV = asObj(log?.oldValues);
  const newV = asObj(log?.newValues);
  const hasOld = Object.keys(oldV).length > 0;
  const hasNew = Object.keys(newV).length > 0;

  const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)])).filter(
    (k) => !IGNORED_KEYS.has(k),
  );

  const changes: AuditChangeRow[] = [];
  for (const key of keys) {
    const oldVal = oldV[key];
    const newVal = newV[key];
    if (!hasValue(oldVal) && !hasValue(newVal)) continue;

    if (hasOld && hasNew) {
      const beforeFormatted = hasValue(oldVal) ? formatFieldValue(key, oldVal, log, oldV) : '—';
      const afterFormatted = hasValue(newVal) ? formatFieldValue(key, newVal, log, newV) : '—';
      if (beforeFormatted === afterFormatted) continue;
      changes.push({ key, label: formatFieldLabel(key), before: beforeFormatted, after: afterFormatted });
    } else if (hasOld) {
      changes.push({ key, label: formatFieldLabel(key), before: formatFieldValue(key, oldVal, log, oldV) });
    } else {
      changes.push({ key, label: formatFieldLabel(key), after: formatFieldValue(key, newVal, log, newV) });
    }
  }

  const statusKey = String(log?.status || '').toUpperCase();
  const errorBanner =
    (statusKey === 'ERROR' || statusKey === 'WARNING') &&
    typeof log?.errorMessage === 'string' &&
    log.errorMessage.trim()
      ? log.errorMessage.trim()
      : undefined;

  return {
    metadata: buildMetadata(log),
    errorBanner,
    changes,
    hasBeforeColumn: changes.some((row) => row.before !== undefined),
    batchItems: buildBatchItems(log, newV),
  };
}
