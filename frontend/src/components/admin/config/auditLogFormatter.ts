import { extractCleanLotNumber, formatCleanExpirationDate } from '../../stock/lotLabel';
import {
  translateAuditVerb,
  translateEntityType,
  translateOrderStatus,
  translatePaymentMethod,
  translateRole,
} from './auditLogDictionary';

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

/** Formatea montos a pesos enteros ARS usando BigInt y redondeo comercial HALF_UP (cero Float). */
export function formatAuditPesos(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '$0';
  const cleaned = String(raw).trim().replace(',', '.').replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return '$0';

  const isNegative = cleaned.startsWith('-');
  const unsigned = isNegative ? cleaned.slice(1) : cleaned;
  const [rawInt = '0', rawDec = ''] = unsigned.split('.');
  const intDigits = rawInt.replace(/\D/g, '') || '0';
  let intVal = BigInt(intDigits);

  if (rawDec.length > 0 && rawDec.charAt(0) >= '5') {
    intVal += 1n;
  }

  const formatted = intVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative && intVal > 0n ? `-$${formatted}` : `$${formatted}`;
}

export function formatAuditIp(ip?: string | null): string {
  if (!ip) return '';
  const clean = String(ip).replace(/^::ffff:/i, '').trim();
  if (!clean) return '';
  if (clean === '::1' || clean === '127.0.0.1') return 'Red local';
  return clean;
}

function getObj(val: unknown): Record<string, any> {
  return val && typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, any>) : {};
}

function resolveProduct(log: any, productId?: number | null): string {
  if (!productId || productId <= 0) return 'Producto';
  const fromCtx = log?.resolvedContext?.productsById?.[productId];
  if (fromCtx) return `${fromCtx.name} (SKU ${fromCtx.sku})`;
  if (log?.entityType === 'Product' && Number(log?.entityId) === productId && log?.resolvedContext?.entityLabel) {
    return log.resolvedContext.entityLabel;
  }
  return `Producto #${productId}`;
}

function resolvePersona(log: any, personaId?: number | null): string {
  if (!personaId || personaId <= 0) return 'Cliente / Proveedor';
  const fromCtx = log?.resolvedContext?.personasById?.[personaId];
  if (fromCtx) return fromCtx.name;
  if (log?.entityType === 'Persona' && Number(log?.entityId) === personaId && log?.resolvedContext?.entityLabel) {
    return log.resolvedContext.entityLabel;
  }
  return `Cliente / Proveedor #${personaId}`;
}

function resolveTarget(log: any): string | null {
  if (log?.resolvedContext?.entityLabel) return log.resolvedContext.entityLabel;
  const newV = getObj(log?.newValues);
  const oldV = getObj(log?.oldValues);
  const snapName =
    newV.name || oldV.name || newV.plate || oldV.plate || oldV.receiptNumber || oldV.invoiceNumber || oldV.description;
  const id = Number(log?.entityId || 0);
  if (snapName && typeof snapName === 'string') {
    return id > 0 ? `${snapName} (#${id})` : snapName;
  }
  if (Number.isInteger(id) && id > 0 && log?.entityType) {
    return `${translateEntityType(log.entityType)} #${id}`;
  }
  return null;
}

function targetOr(log: any, noun: string): string {
  const resolved = resolveTarget(log);
  if (resolved) return resolved;
  const id = Number(log?.entityId || 0);
  return Number.isInteger(id) && id > 0 ? `${noun} #${id}` : noun.toLowerCase();
}

function formatDeltaUnits(delta: unknown): string {
  const num = Number(delta);
  if (!Number.isFinite(num) || delta === null || delta === undefined) return '';
  return ` (${num > 0 ? `+${num}` : num} u.)`;
}

function sanitizeLegacyMessage(msg: string): string {
  return msg
    .replace(/\b([A-Z]+(?:_[A-Z0-9]+)+)\b/g, (code) => translateAuditVerb(code))
    .replace(
      /\b(ProductLot|SupplierInvoice|PurchaseOrder|CreditNote|CashDrawer|BankAccount|DeliveryRoute|SaleRouteVisit|SaleRoute|VehicleMaintenance|VehicleExpiry|FuelLog|WarehouseCell|WeeklyPromo|PerceptionType|SystemSetting|Transaction|Persona|Product|Order|Employee|Expense|Vehicle|Rubro|User)\b/g,
      (ent) => translateEntityType(ent),
    );
}

function formatStockAndWms(action: string, log: any, oldV: Record<string, any>, newV: Record<string, any>): string | null {
  if (action === 'ASSIGN_WMS_LOCATION') {
    const qty = newV.quantity !== undefined ? `${newV.quantity} u.` : 'mercadería';
    const loc = newV.locationCode || 'depósito';
    const target = resolveTarget(log) || 'producto';
    const isStockIn = String(newV.mode || '').toUpperCase() === 'STOCK_IN';
    return isStockIn ? `Ingresó ${qty} nuevas en posición ${loc} — ${target}` : `Ubicó ${qty} en posición ${loc} — ${target}`;
  }

  if (action === 'CLEAR_WMS_LOCATION') {
    const loc = newV.locationCode || 'sin código';
    const suffix = Number(log?.entityId) > 0 ? ` — ${resolveProduct(log, Number(log.entityId))}` : '';
    if (String(newV.mode || '').toUpperCase() === 'UNASSIGN' || newV.movedUnitsToUnassigned !== undefined) {
      return `Liberó posición ${loc} hacia Sin Ubicar (${newV.movedUnitsToUnassigned ?? 0} u. resguardadas)${suffix}`;
    }
    return `Vació posición ${loc} con baja de ${newV.writtenOffUnits ?? 0} u.${suffix}`;
  }

  if (action === 'ADJUST_STOCK') {
    const target = resolveTarget(log) || 'producto';
    const prev = oldV.physicalUnits ?? oldV.stock;
    const next = newV.physicalUnits ?? newV.stock;
    if (prev !== undefined && next !== undefined) {
      return `Ajustó stock físico de ${target}: de ${prev} → ${next} u.${formatDeltaUnits(newV.appliedDelta)}`;
    }
    return `Ajustó stock de ${target}`;
  }

  if (action === 'ADJUST_STOCK_BATCH') {
    const list: any[] = Array.isArray(newV.adjustments) ? newV.adjustments : [];
    if (list.length === 1) {
      const a = list[0];
      const prod = resolveProduct(log, Number(a.productId));
      const prev = a.previousPhysical ?? a.previousStock;
      const next = a.newPhysical ?? a.newStock;
      if (prev !== undefined && next !== undefined) {
        return `Ajustó stock físico de ${prod}: de ${prev} → ${next} u.${formatDeltaUnits(a.appliedDelta)}`;
      }
      return `Ajustó stock físico de ${prod}`;
    }
    if (list.length > 1) {
      const total = newV.count ?? list.length;
      const preview = list.slice(0, 3).map((a) => {
        const name = log?.resolvedContext?.productsById?.[Number(a.productId)]?.name || `Producto #${a.productId}`;
        const prev = a.previousPhysical ?? a.previousStock ?? '?';
        const next = a.newPhysical ?? a.newStock ?? '?';
        return `${name} (${prev} → ${next} u.)`;
      });
      const extra = list.length > 3 ? ` y ${list.length - 3} más` : '';
      return `Ajustó stock de ${total} productos: ${preview.join(', ')}${extra}`;
    }
    return 'Ejecutó ajuste masivo de stock en productos';
  }

  if (action === 'TRANSFER_LOT_STOCK') {
    const fromLot = log?.resolvedContext?.lotsById?.[Number(oldV.fromLotId)];
    const toLot = log?.resolvedContext?.lotsById?.[Number(newV.toLotId)];
    const prod = fromLot?.productName || toLot?.productName;
    const fromTxt = fromLot ? `${extractCleanLotNumber(fromLot.lotNumber)} (${fromLot.location})` : 'lote origen';
    const toTxt = toLot ? `${extractCleanLotNumber(toLot.lotNumber)} (${toLot.location})` : 'lote destino';
    return `Transfirió ${oldV.quantity ?? 0} u.${prod ? ` de ${prod}` : ''}: ${fromTxt} → ${toTxt}`;
  }

  if (action === 'UPDATE_LOT' || action === 'DELETE_LOT') {
    const lotCtx = log?.resolvedContext?.lotsById?.[Number(log?.entityId)];
    const prodName = lotCtx?.productName || (oldV.productId ? resolveProduct(log, Number(oldV.productId)) : '');
    const lotNum = extractCleanLotNumber(newV.lotNumber || oldV.lotNumber || lotCtx?.lotNumber);
    if (action === 'DELETE_LOT') {
      return `Eliminó lote ${lotNum} (${oldV.location || 'S/U'})${prodName ? ` — ${prodName}` : ''}`;
    }
    const locChange = oldV.location && newV.location && oldV.location !== newV.location ? ` · Ubicación ${oldV.location} → ${newV.location}` : '';
    const expNote = newV.expirationDate && newV.expirationDate !== oldV.expirationDate ? ` · Vto. ${formatCleanExpirationDate(newV.expirationDate)}` : '';
    return `Modificó lote ${lotNum}${prodName ? ` de ${prodName}` : ''}${locChange}${expNote}`;
  }

  if (action === 'UPSERT_WAREHOUSE_CELL' || action === 'RESET_WAREHOUSE_CELL') {
    const code = newV.code || oldV.code || resolveTarget(log) || 'posición';
    return action === 'RESET_WAREHOUSE_CELL'
      ? `Restauró la posición ${code} del plano WMS`
      : `Configuró la posición ${code} del plano WMS${newV.isBlocked ? ' (Bloqueada)' : ''}`;
  }

  return null;
}

function formatUsersAndAuth(action: string, log: any, oldV: Record<string, any>, newV: Record<string, any>): string | null {
  const ip = formatAuditIp(log?.ipAddress);
  const ipTag = ip ? ` [IP: ${ip}]` : '';
  const uname = newV.username || oldV.username || log?.resolvedContext?.entityLabel || '';
  const roleTag = newV.role ? ` (${translateRole(newV.role)})` : '';

  if (action === 'LOGIN') return `Inició sesión en el sistema${roleTag}${ipTag}`;
  if (action === 'LOGIN_FAILED') {
    const reason = log?.errorMessage || 'Intento de ingreso rechazado';
    return `${reason}${uname ? ` (${uname})` : ''}${ipTag}`;
  }
  if (action === 'CHANGE_OWN_PASSWORD') return `Actualizó su propia contraseña de acceso${ipTag}`;
  if (action === 'CREATE_USER') {
    const who = uname || (Number(log?.entityId) > 0 ? `#${log.entityId}` : 'nuevo');
    return `Creó la cuenta del empleado ${who}${roleTag}`;
  }
  if (action === 'DELETE_USER') {
    const who = oldV.username || uname || (Number(log?.entityId) > 0 ? `#${log.entityId}` : 'seleccionado');
    return `Eliminó la cuenta del empleado ${who}`;
  }
  if (action === 'TOGGLE_USER_STATUS') {
    const label = uname || (Number(log?.entityId) > 0 ? `Empleado #${log.entityId}` : 'seleccionado');
    if (newV.isActive === false) return `Desactivó el acceso del empleado ${label}`;
    if (newV.isActive === true) return `Activó el acceso del empleado ${label}`;
    return `Cambió el estado de acceso del empleado ${label}`;
  }
  if (action === 'UPDATE_USER') {
    const parts: string[] = [];
    if (oldV.role && newV.role && oldV.role !== newV.role) {
      parts.push(`rol ${translateRole(oldV.role)} → ${translateRole(newV.role)}`);
    }
    if (newV.passwordChanged) parts.push('clave actualizada');
    const who = uname || (Number(log?.entityId) > 0 ? `#${log.entityId}` : 'seleccionado');
    return `Modificó al empleado ${who}${parts.length > 0 ? ` (${parts.join(' · ')})` : ''}`;
  }
  if (action === 'UPDATE_CONFIG') {
    if (oldV.ignoreStock !== undefined && newV.ignoreStock !== undefined && oldV.ignoreStock !== newV.ignoreStock) {
      return `Modificó configuración: facturación sin stock ${newV.ignoreStock ? 'activada' : 'desactivada'}`;
    }
    return 'Modificó la configuración general del sistema';
  }
  return null;
}

function formatCatalogAndPrices(action: string, log: any, oldV: Record<string, any>, newV: Record<string, any>): string | null {
  if (action === 'UPDATE_PRODUCT') {
    const target =
      resolveTarget(log) ||
      (newV.name ? `${newV.name}${newV.sku ? ` (SKU ${newV.sku})` : ''}` : targetOr(log, 'Producto'));
    const diffs: string[] = [];
    if (oldV.listPrice !== undefined && newV.listPrice !== undefined && String(oldV.listPrice) !== String(newV.listPrice)) {
      diffs.push(`Lista A: ${formatAuditPesos(oldV.listPrice)} → ${formatAuditPesos(newV.listPrice)}`);
    }
    if (oldV.listPriceB !== undefined && newV.listPriceB !== undefined && String(oldV.listPriceB) !== String(newV.listPriceB)) {
      diffs.push(`Lista B: ${formatAuditPesos(oldV.listPriceB)} → ${formatAuditPesos(newV.listPriceB)}`);
    }
    if (oldV.listPriceC !== undefined && newV.listPriceC !== undefined && String(oldV.listPriceC) !== String(newV.listPriceC)) {
      diffs.push(`Lista C: ${formatAuditPesos(oldV.listPriceC)} → ${formatAuditPesos(newV.listPriceC)}`);
    }
    if (oldV.costPrice !== undefined && newV.costPrice !== undefined && String(oldV.costPrice) !== String(newV.costPrice)) {
      diffs.push(`Costo: ${formatAuditPesos(oldV.costPrice)} → ${formatAuditPesos(newV.costPrice)}`);
    }
    if (oldV.isActive !== undefined && newV.isActive !== undefined && oldV.isActive !== newV.isActive) {
      diffs.push(newV.isActive ? 'Activado' : 'Pausado');
    }
    return diffs.length > 0 ? `Modificó ${target}: ${diffs.slice(0, 4).join(' · ')}` : `Modificó ${target}`;
  }

  if (action === 'BULK_UPDATE_PRICES') {
    const listMap: Record<string, string> = { all: 'todas las listas', listPrice: 'Lista A', listPriceB: 'Lista B', listPriceC: 'Lista C' };
    const listLabel = listMap[String(newV.priceList || '')] || 'precios';
    const scope: string[] = [];
    if (newV.rubroId) scope.push(`Rubro: ${log?.resolvedContext?.rubrosById?.[Number(newV.rubroId)]?.name || `#${newV.rubroId}`}`);
    if (newV.providerId) scope.push(`Proveedor: ${resolvePersona(log, Number(newV.providerId))}`);
    const delta = newV.type === 'fixed' ? formatAuditPesos(newV.value) : newV.value !== undefined ? `${newV.value}%` : '';
    return `Actualizó ${listLabel} en ${newV.updatedCount ?? 0} productos${delta ? ` (${delta})` : ''}${scope.length > 0 ? ` · ${scope.join(' · ')}` : ''}`;
  }

  if (action === 'TOGGLE_WEEKLY_PROMO') {
    const target = resolveTarget(log) || 'oferta semanal';
    return `${newV.isActive ? 'Activó' : 'Pausó'} oferta semanal — ${target}`;
  }
  if (action === 'REVERT_PRICES_UNDO') return `Revirtió los precios de ${newV.revertedCount ?? 0} productos a su valor anterior`;
  if (action === 'IMPORT_PRODUCTS_CSV') return `Importó precios CSV: ${newV.createdCount ?? 0} creados, ${newV.updatedCount ?? 0} actualizados`;
  if (action === 'EXCEL_IMPORT') return `Importó ${translateEntityType(newV.domain || log.entityType)} desde Excel (${newV.createdCount ?? 0} creados, ${newV.updatedCount ?? 0} actualizados)`;
  if (action === 'SYNC_FROM_PRODUCTION_CATALOG') return `Sincronizó catálogo desde Tienda Online (${newV.createdProductsCount ?? 0} nuevos, ${newV.updatedProductsCount ?? 0} actualizados)`;
  return null;
}

function formatOrdersAndFinance(action: string, log: any, oldV: Record<string, any>, newV: Record<string, any>): string | null {
  const target = resolveTarget(log);
  if (action === 'UPDATE_ORDER_STATUS') {
    return `Cambió estado de ${targetOr(log, 'Pedido')}: ${translateOrderStatus(oldV.status)} → ${translateOrderStatus(newV.status)}`;
  }
  if (action === 'INVOICE_ORDER' || action === 'CREATE_DIRECT_INVOICE') {
    const inv = newV.invoiceNumber ? ` (${newV.invoiceNumber})` : '';
    const amt = newV.total ?? newV.totalAmount;
    const totalTxt = amt !== undefined ? ` por ${formatAuditPesos(amt)}` : '';
    return `${action === 'CREATE_DIRECT_INVOICE' ? 'Emitió factura directa' : 'Facturó'} ${targetOr(log, 'Pedido')}${inv}${totalTxt}`;
  }
  if (action === 'CREATE_ORDER') {
    const cli = newV.personaId && !target?.includes('—') ? ` de ${resolvePersona(log, Number(newV.personaId))}` : '';
    const totalTxt = newV.total !== undefined || newV.totalAmount !== undefined ? ` por ${formatAuditPesos(newV.total ?? newV.totalAmount)}` : '';
    return `Creó ${targetOr(log, 'Pedido')}${cli}${totalTxt}`;
  }
  if (action === 'UPDATE_ORDER_ITEMS') {
    const totalTxt = newV.total !== undefined ? ` (Total ${formatAuditPesos(newV.total)})` : '';
    return `Modificó artículos de ${targetOr(log, 'Pedido')}: ${oldV.itemsCount ?? '?'} → ${newV.itemsCount ?? '?'} ítems${totalTxt}`;
  }
  if (action === 'CLIENT_VISIT_FAIL') {
    return `Registró visita sin compra — ${targetOr(log, 'Cliente')}${newV.reason ? ` (${newV.reason})` : ''}`;
  }
  if (action === 'RECORD_PERSONA_PAYMENT') {
    const totalTxt = newV.totalAmount !== undefined ? ` por ${formatAuditPesos(newV.totalAmount)}` : '';
    return `Registró ${newV.type === 'OUTCOME' ? 'pago a' : 'cobro de'} ${target || resolvePersona(log, Number(log.entityId))}${totalTxt}`;
  }
  if (action === 'DELETE_COLLECTION_RECEIPT') {
    const cli = oldV.personaName ? `${oldV.personaName} · ` : '';
    const ref = oldV.receiptNumber || (Number(log?.entityId) > 0 ? `#${log.entityId}` : 'de cobranza');
    return `Anuló recibo ${ref} (${cli}${formatAuditPesos(oldV.amount)})`;
  }
  if (action === 'DEPOSIT_CASH_TO_BANK') {
    return `Depositó ${formatAuditPesos(newV.amount)} de caja en cuenta ${newV.bankAccountName || target || 'bancaria'}`;
  }
  if (action === 'VERIFY_BANK_TRANSFER') {
    const ref = target || (Number(log?.entityId) > 0 ? `#${log.entityId}` : 'bancaria');
    return `${newV.verified ? 'Verificó' : 'Marcó pendiente'} transferencia ${ref} por ${formatAuditPesos(newV.amount)}`;
  }
  if (action === 'CLOSE_CENTRAL_DRAWER') {
    return `Ejecutó cierre de Caja Central (Saldo declarado: ${formatAuditPesos(newV.realBalanceDeclared)})`;
  }
  if (action === 'CLOSE_OPERATIVE_DRAWER_RENDICION') {
    return `Aprobó rendición de cobranza (${newV.transactionsCount ?? 0} movs. · Efectivo ${formatAuditPesos(newV.realCash)})`;
  }
  return null;
}

export function formatAuditMessage(log: any): string {
  if (!log) return '';
  if (log.message && typeof log.message === 'string') return sanitizeLegacyMessage(log.message);

  const action = String(log.action || '').trim().toUpperCase();
  const oldV = getObj(log.oldValues);
  const newV = getObj(log.newValues);

  const specialized =
    formatStockAndWms(action, log, oldV, newV) ||
    formatUsersAndAuth(action, log, oldV, newV) ||
    formatCatalogAndPrices(action, log, oldV, newV) ||
    formatOrdersAndFinance(action, log, oldV, newV);
  if (specialized) return specialized;

  const verb = translateAuditVerb(action);
  const target = resolveTarget(log);
  const details: string[] = [];

  const amt = newV.totalAmount ?? newV.total ?? newV.amount ?? newV.totalCost ?? oldV.amount ?? oldV.cost;
  if (amt !== undefined && amt !== null) details.push(formatAuditPesos(amt));
  if (newV.paymentMethod) details.push(translatePaymentMethod(newV.paymentMethod));
  if (newV.count !== undefined && !target) details.push(`${newV.count} registros`);
  if (newV.fileName) details.push(String(newV.fileName));
  if (action === 'UPDATE_VEHICLE_EXPIRY' && newV.expirationDate) {
    details.push(`Vto. ${formatCleanExpirationDate(newV.expirationDate)}`);
  }

  const base = target ? `${verb} — ${target}` : verb;
  return details.length > 0 ? `${base} (${details.join(' · ')})` : base;
}
