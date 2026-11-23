export interface AuditBadgeStyle {
  label: string;
  bg: string;
  color: string;
}

type AuditTone = 'success' | 'info' | 'warn' | 'danger' | 'config' | 'neutral';

interface ActionEntry {
  label: string;
  verb: string;
  tone: AuditTone;
}

const TONE_STYLES: Record<AuditTone, { bg: string; color: string }> = {
  success: { bg: '#E8F8F5', color: '#117A65' },
  info: { bg: '#EBF5FB', color: '#2980B9' },
  warn: { bg: '#FEF9E7', color: '#B7950B' },
  danger: { bg: '#FDEDEC', color: '#C0392B' },
  config: { bg: '#F4ECF7', color: '#8E44AD' },
  neutral: { bg: '#F1F5F9', color: '#475569' },
};

const ACTION_MAP: Record<string, ActionEntry> = {
  // Accesos y Seguridad
  LOGIN: { label: 'Inicio de Sesión', verb: 'Inició sesión en el sistema', tone: 'success' },
  LOGIN_FAILED: { label: 'Ingreso Fallido', verb: 'Intento de ingreso rechazado', tone: 'danger' },
  CHANGE_OWN_PASSWORD: { label: 'Cambio de Clave Propia', verb: 'Actualizó su propia contraseña de acceso', tone: 'info' },

  // Empleados y RRHH
  CREATE_USER: { label: 'Creación de Empleado', verb: 'Creó una nueva cuenta de empleado', tone: 'info' },
  UPDATE_USER: { label: 'Edición de Empleado', verb: 'Modificó datos o clave de empleado', tone: 'info' },
  TOGGLE_USER_STATUS: { label: 'Cambio Estado Empleado', verb: 'Cambió el estado de acceso del empleado', tone: 'warn' },
  DELETE_USER: { label: 'Eliminación de Empleado', verb: 'Eliminó una cuenta de empleado', tone: 'danger' },
  CREATE_EMPLOYEE: { label: 'Alta de Legajo RRHH', verb: 'Creó el legajo laboral de un empleado', tone: 'info' },
  UPDATE_EMPLOYEE: { label: 'Edición de Legajo RRHH', verb: 'Actualizó el legajo laboral de un empleado', tone: 'info' },

  // Depósito WMS, Stock y Lotes
  ASSIGN_WMS_LOCATION: { label: 'Ubicación en Depósito', verb: 'Ubicó mercadería en depósito', tone: 'info' },
  CLEAR_WMS_LOCATION: { label: 'Liberación de Posición', verb: 'Liberó una posición del depósito', tone: 'warn' },
  UPSERT_WAREHOUSE_CELL: { label: 'Configuración de Posición', verb: 'Configuró una posición del plano WMS', tone: 'config' },
  RESET_WAREHOUSE_CELL: { label: 'Restauración de Posición', verb: 'Restauró una posición del plano WMS', tone: 'warn' },
  ADJUST_STOCK: { label: 'Ajuste de Stock', verb: 'Ajustó el stock', tone: 'warn' },
  ADJUST_STOCK_BATCH: { label: 'Ajuste de Stock', verb: 'Ajustó el stock', tone: 'warn' },
  RECONCILE_STOCK_DRIFT: { label: 'Conciliación de Stock', verb: 'Ejecutó conciliación de desvíos de stock', tone: 'info' },
  RECONCILE_STOCK: { label: 'Conciliación de Stock', verb: 'Ejecutó control y conciliación de stock', tone: 'info' },
  UPDATE_LOT: { label: 'Edición de Lote', verb: 'Modificó datos de un lote', tone: 'warn' },
  DELETE_LOT: { label: 'Eliminación de Lote', verb: 'Eliminó un lote sin movimientos', tone: 'danger' },
  TRANSFER_LOT_STOCK: { label: 'Traslado entre Lotes', verb: 'Transfirió unidades entre lotes', tone: 'warn' },

  // Catálogo, Precios y Ofertas
  CREATE_PRODUCT: { label: 'Alta de Producto', verb: 'Creó el producto', tone: 'info' },
  UPDATE_PRODUCT: { label: 'Edición de Producto', verb: 'Modificó el producto', tone: 'info' },
  UPDATE_PRODUCT_IMAGE: { label: 'Foto de Producto', verb: 'Actualizó la imagen del producto', tone: 'info' },
  IMPORT_PRODUCT_IMAGE_ZIP: { label: 'Importación de Fotos', verb: 'Importó foto desde archivo ZIP', tone: 'info' },
  IMPORT_PRODUCTS_CSV: { label: 'Importación de Precios', verb: 'Importó lista de productos/precios', tone: 'info' },
  BULK_UPDATE_PRICES: { label: 'Actualización Masiva de Precios', verb: 'Actualizó precios masivamente', tone: 'warn' },
  REVERT_PRICES_UNDO: { label: 'Reversión de Precios', verb: 'Revirtió el último cambio masivo de precios', tone: 'warn' },
  SYNC_FROM_PRODUCTION_CATALOG: { label: 'Sincronización de Catálogo', verb: 'Sincronizó catálogo desde Tienda Online', tone: 'info' },
  EXCEL_IMPORT: { label: 'Importación desde Excel', verb: 'Importó datos desde planilla Excel', tone: 'info' },
  CREATE_RUBRO: { label: 'Alta de Rubro', verb: 'Creó el rubro', tone: 'info' },
  UPDATE_RUBRO: { label: 'Edición de Rubro', verb: 'Modificó el rubro', tone: 'info' },
  DELETE_RUBRO: { label: 'Eliminación de Rubro', verb: 'Eliminó el rubro', tone: 'danger' },
  CREATE_WEEKLY_PROMO: { label: 'Nueva Oferta Semanal', verb: 'Creó la oferta semanal', tone: 'success' },
  TOGGLE_WEEKLY_PROMO: { label: 'Estado Oferta Semanal', verb: 'Cambió el estado de la oferta semanal', tone: 'warn' },
  DELETE_WEEKLY_PROMO: { label: 'Baja Oferta Semanal', verb: 'Eliminó la oferta semanal', tone: 'danger' },

  // Clientes y Proveedores
  CREATE_PERSONA: { label: 'Alta Cliente / Proveedor', verb: 'Creó la ficha', tone: 'info' },
  UPDATE_PERSONA: { label: 'Edición Cliente / Proveedor', verb: 'Actualizó la ficha', tone: 'info' },
  DELETE_PERSONA: { label: 'Baja Cliente / Proveedor', verb: 'Eliminó la ficha', tone: 'danger' },
  CLIENT_VISIT_FAIL: { label: 'Visita Sin Compra', verb: 'Registró visita sin compra', tone: 'warn' },

  // Pedidos, Facturación y Notas de Crédito
  CREATE_ORDER: { label: 'Nuevo Pedido', verb: 'Creó el pedido', tone: 'info' },
  CREATE_ORDER_FAILED: { label: 'Error al Crear Pedido', verb: 'Falló la creación del pedido', tone: 'danger' },
  UPDATE_ORDER: { label: 'Edición de Pedido', verb: 'Modificó el pedido', tone: 'info' },
  UPDATE_ORDER_ITEMS: { label: 'Edición de Ítems', verb: 'Modificó los artículos del pedido', tone: 'warn' },
  UPDATE_ORDER_WEIGHTS: { label: 'Pesaje en Balanza', verb: 'Actualizó los pesos reales en balanza', tone: 'warn' },
  CONFIRM_ARMADO: { label: 'Armado de Pedido', verb: 'Confirmó el armado del pedido en depósito', tone: 'warn' },
  UPDATE_ORDER_STATUS: { label: 'Estado de Pedido', verb: 'Cambió el estado del pedido', tone: 'info' },
  INVOICE_ORDER: { label: 'Facturación de Pedido', verb: 'Facturó el pedido', tone: 'success' },
  EMIT_AFIP_INVOICE: { label: 'Emisión Factura AFIP', verb: 'Emitió factura electrónica AFIP/ARCA', tone: 'success' },
  CREATE_DIRECT_INVOICE: { label: 'Facturación Directa', verb: 'Emitió factura directa en mostrador', tone: 'success' },
  CANCEL_ORDER: { label: 'Anulación de Pedido', verb: 'Anuló el pedido', tone: 'danger' },
  CREATE_CREDIT_NOTE: { label: 'Nueva Nota de Crédito', verb: 'Emitió nota de crédito', tone: 'warn' },
  APPROVE_CREDIT_NOTE: { label: 'Aprobación Nota de Crédito', verb: 'Aprobó nota de crédito', tone: 'success' },
  REJECT_CREDIT_NOTE: { label: 'Rechazo Nota de Crédito', verb: 'Rechazó nota de crédito', tone: 'danger' },

  // Compras e Impuestos
  CREATE_PURCHASE_ORDER: { label: 'Orden de Compra', verb: 'Generó orden de compra', tone: 'info' },
  RECEIVE_PURCHASE_ORDER: { label: 'Recepción de Compra', verb: 'Recibió mercadería de orden de compra', tone: 'success' },
  CREATE_SUPPLIER_INVOICE: { label: 'Factura de Compra', verb: 'Cargó factura de proveedor', tone: 'info' },
  DELETE_SUPPLIER_INVOICE: { label: 'Baja Factura de Compra', verb: 'Eliminó factura de proveedor', tone: 'danger' },
  CREATE_TAX_WITHHOLDING: { label: 'Retención / Percepción', verb: 'Registró certificado impositivo', tone: 'config' },
  UPDATE_PERCEPTION_TYPE: { label: 'Alícuota Impositiva', verb: 'Actualizó alícuota impositiva', tone: 'config' },

  // Caja, Bancos, Cobranzas y Gastos
  RECORD_PERSONA_PAYMENT: { label: 'Cobro / Pago', verb: 'Registró movimiento de cuenta corriente', tone: 'success' },
  REGISTER_PAYMENT: { label: 'Cobro / Recibo', verb: 'Registró cobro / recibo', tone: 'success' },
  CREATE_COLLECTION: { label: 'Cobranza en Calle', verb: 'Registró cobranza en ruta', tone: 'success' },
  DELETE_COLLECTION_RECEIPT: { label: 'Anulación de Recibo', verb: 'Anuló un recibo de cobranza', tone: 'danger' },
  CANCEL_TRANSACTION: { label: 'Anulación Financiera', verb: 'Anuló movimiento financiero', tone: 'danger' },
  CLOSE_OPERATIVE_DRAWER_RENDICION: { label: 'Rendición de Caja', verb: 'Aprobó rendición de cobranza', tone: 'success' },
  OPEN_CASH_DRAWER: { label: 'Apertura de Caja', verb: 'Abrió caja operativa', tone: 'success' },
  CLOSE_CASH_DRAWER: { label: 'Cierre de Caja', verb: 'Cerró caja operativa', tone: 'neutral' },
  CLOSE_CENTRAL_DRAWER: { label: 'Cierre Caja Central', verb: 'Ejecutó cierre de Caja Central', tone: 'config' },
  CREATE_BANK_ACCOUNT: { label: 'Alta Cuenta Bancaria', verb: 'Creó cuenta bancaria', tone: 'info' },
  UPDATE_BANK_ACCOUNT: { label: 'Edición Cuenta Bancaria', verb: 'Actualizó cuenta bancaria', tone: 'info' },
  DEPOSIT_CASH_TO_BANK: { label: 'Depósito Bancario', verb: 'Depositó efectivo de caja a banco', tone: 'success' },
  VERIFY_BANK_TRANSFER: { label: 'Conciliación Bancaria', verb: 'Verificó transferencia bancaria', tone: 'success' },
  CREATE_EXPENSE: { label: 'Registro de Gasto', verb: 'Registró un gasto operativo', tone: 'warn' },
  BULK_CREATE_EXPENSES: { label: 'Carga Masiva de Gastos', verb: 'Registró gastos en lote', tone: 'warn' },
  IMPORT_EXPENSES_EXCEL: { label: 'Importación de Gastos', verb: 'Importó gastos desde planilla Excel', tone: 'info' },
  DELETE_EXPENSE: { label: 'Eliminación de Gasto', verb: 'Eliminó un gasto operativo', tone: 'danger' },

  // Logística, Preventa y Flota
  CREATE_DELIVERY_ROUTE: { label: 'Nueva Hoja de Reparto', verb: 'Creó hoja de reparto', tone: 'info' },
  UPDATE_DELIVERY_ROUTE_STATUS: { label: 'Estado de Reparto', verb: 'Actualizó estado de hoja de reparto', tone: 'info' },
  DELETE_DELIVERY_ROUTE: { label: 'Baja Hoja de Reparto', verb: 'Eliminó hoja de reparto', tone: 'danger' },
  TRANSFER_ROUTE_CUSTODY: { label: 'Custodia de Reparto', verb: 'Transfirió custodia de mercadería al chofer', tone: 'warn' },
  SETTLE_DELIVERY_ROUTE: { label: 'Liquidación de Reparto', verb: 'Liquidó hoja de reparto', tone: 'success' },
  CREATE_SALE_ROUTE: { label: 'Nueva Ruta Preventa', verb: 'Creó ruta de preventa', tone: 'info' },
  UPDATE_SALE_ROUTE: { label: 'Edición Ruta Preventa', verb: 'Actualizó ruta de preventa', tone: 'info' },
  DELETE_SALE_ROUTE: { label: 'Baja Ruta Preventa', verb: 'Eliminó ruta de preventa', tone: 'danger' },
  UPDATE_SALE_ROUTE_SEQUENCE: { label: 'Orden de Visitas', verb: 'Actualizó secuencia de clientes en ruta', tone: 'info' },
  ADD_CLIENT_TO_ROUTE: { label: 'Asignación a Ruta', verb: 'Agregó cliente a ruta de preventa', tone: 'info' },
  RECORD_ROUTE_VISIT: { label: 'Visita de Preventa', verb: 'Registró visita en ruta de preventa', tone: 'info' },
  CREATE_VEHICLE: { label: 'Alta de Vehículo', verb: 'Registró vehículo en flota', tone: 'info' },
  UPDATE_VEHICLE: { label: 'Edición de Vehículo', verb: 'Actualizó datos del vehículo', tone: 'info' },
  DELETE_VEHICLE: { label: 'Baja de Vehículo', verb: 'Eliminó vehículo de flota', tone: 'danger' },
  CREATE_VEHICLE_MAINTENANCE: { label: 'Mantenimiento de Flota', verb: 'Registró mantenimiento de vehículo', tone: 'warn' },
  DELETE_VEHICLE_MAINTENANCE: { label: 'Baja Mantenimiento', verb: 'Eliminó registro de mantenimiento', tone: 'danger' },
  CREATE_VEHICLE_EXPIRY: { label: 'Vencimiento Vehicular', verb: 'Registró vencimiento de vehículo', tone: 'info' },
  UPDATE_VEHICLE_EXPIRY: { label: 'Edición Vencimiento', verb: 'Actualizó vencimiento de vehículo', tone: 'info' },
  DELETE_VEHICLE_EXPIRY: { label: 'Baja Vencimiento', verb: 'Eliminó vencimiento de vehículo', tone: 'danger' },
  CREATE_FUEL_LOG: { label: 'Carga de Combustible', verb: 'Registró carga de combustible', tone: 'info' },
  DELETE_FUEL_LOG: { label: 'Baja Combustible', verb: 'Eliminó registro de combustible', tone: 'danger' },

  // Sistema y Respaldos
  UPDATE_CONFIG: { label: 'Configuración General', verb: 'Modificó la configuración general del sistema', tone: 'config' },
  ENCRYPTED_DATABASE_BACKUP: { label: 'Respaldo Encriptado', verb: 'Generó copia de seguridad encriptada de la base', tone: 'success' },
  SYNC_BALANCES: { label: 'Auditoría de Saldos', verb: 'Sincronizó saldos de cuentas corrientes', tone: 'info' },
};

const ENTITY_LABELS: Record<string, string> = {
  Product: 'Producto',
  ProductLot: 'Lote',
  WarehouseCell: 'Posición de Depósito',
  Persona: 'Cliente / Proveedor',
  Order: 'Pedido',
  User: 'Empleado',
  Employee: 'Legajo RRHH',
  Rubro: 'Rubro',
  SupplierInvoice: 'Factura de Compra',
  PurchaseOrder: 'Orden de Compra',
  CreditNote: 'Nota de Crédito',
  Transaction: 'Movimiento Financiero',
  CashDrawer: 'Caja',
  BankAccount: 'Cuenta Bancaria',
  Expense: 'Gasto',
  TaxWithholding: 'Retención / Percepción',
  PerceptionType: 'Alícuota Impositiva',
  DeliveryRoute: 'Hoja de Reparto',
  SaleRoute: 'Ruta de Preventa',
  SaleRouteVisit: 'Visita de Preventa',
  Vehicle: 'Vehículo',
  VehicleMaintenance: 'Mantenimiento',
  VehicleExpiry: 'Vencimiento Vehicular',
  FuelLog: 'Carga de Combustible',
  WeeklyPromo: 'Oferta Semanal',
  SystemSetting: 'Configuración General',
  DATABASE: 'Base de Datos',
  PRODUCTS: 'Productos',
  PRICES: 'Precios',
  CLIENTS: 'Clientes',
  PROVIDERS: 'Proveedores',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PREPARING: 'En preparación',
  PREPARED: 'Armado',
  INVOICED: 'Facturado',
  IN_TRANSIT: 'En reparto',
  DELIVERED: 'Entregado',
  CANCELLED: 'Anulado',
  COMPLETED: 'Completado',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  PENDING_APPROVAL: 'Pendiente de aprobación',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  FACTURACION: 'Oficina',
  VENDEDOR: 'Vendedor',
  DEPOSITO: 'Depósito',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  BANK_TRANSFER: 'Transferencia',
  TRANSFER: 'Transferencia',
  CHECK: 'Cheque',
  CREDIT_CARD: 'Tarjeta',
  CURRENT_ACCOUNT: 'Cuenta Corriente',
  MERCADOPAGO: 'MercadoPago',
};

const PREFIX_MAP: Record<string, { labelPrefix: string; verbPrefix: string; tone: AuditTone }> = {
  CREATE: { labelPrefix: 'Alta de', verbPrefix: 'Creó', tone: 'info' },
  UPDATE: { labelPrefix: 'Edición de', verbPrefix: 'Actualizó', tone: 'info' },
  DELETE: { labelPrefix: 'Eliminación de', verbPrefix: 'Eliminó', tone: 'danger' },
  TOGGLE: { labelPrefix: 'Cambio de', verbPrefix: 'Cambió estado de', tone: 'warn' },
  IMPORT: { labelPrefix: 'Importación de', verbPrefix: 'Importó', tone: 'info' },
  SYNC: { labelPrefix: 'Sincronización de', verbPrefix: 'Sincronizó', tone: 'info' },
  APPROVE: { labelPrefix: 'Aprobación de', verbPrefix: 'Aprobó', tone: 'success' },
  REJECT: { labelPrefix: 'Rechazo de', verbPrefix: 'Rechazó', tone: 'danger' },
  VERIFY: { labelPrefix: 'Verificación de', verbPrefix: 'Verificó', tone: 'success' },
  RECORD: { labelPrefix: 'Registro de', verbPrefix: 'Registró', tone: 'info' },
  CLOSE: { labelPrefix: 'Cierre de', verbPrefix: 'Cerró', tone: 'neutral' },
  OPEN: { labelPrefix: 'Apertura de', verbPrefix: 'Abrió', tone: 'success' },
  ASSIGN: { labelPrefix: 'Asignación de', verbPrefix: 'Asignó', tone: 'info' },
  CLEAR: { labelPrefix: 'Liberación de', verbPrefix: 'Liberó', tone: 'warn' },
  RESET: { labelPrefix: 'Restauración de', verbPrefix: 'Restauró', tone: 'warn' },
  RECONCILE: { labelPrefix: 'Conciliación de', verbPrefix: 'Concilió', tone: 'info' },
  BULK: { labelPrefix: 'Operación Masiva de', verbPrefix: 'Ejecutó cambio masivo en', tone: 'warn' },
  TRANSFER: { labelPrefix: 'Traslado de', verbPrefix: 'Transfirió', tone: 'warn' },
  CANCEL: { labelPrefix: 'Anulación de', verbPrefix: 'Anuló', tone: 'danger' },
  EMIT: { labelPrefix: 'Emisión de', verbPrefix: 'Emitió', tone: 'success' },
  SETTLE: { labelPrefix: 'Liquidación de', verbPrefix: 'Liquidó', tone: 'success' },
  UPSERT: { labelPrefix: 'Configuración de', verbPrefix: 'Configuró', tone: 'config' },
  ADD: { labelPrefix: 'Incorporación de', verbPrefix: 'Agregó', tone: 'info' },
  REVERT: { labelPrefix: 'Reversión de', verbPrefix: 'Revirtió', tone: 'warn' },
};

const TOKEN_ES: Record<string, string> = {
  PRODUCT: 'Producto', PRODUCTS: 'Productos', ORDER: 'Pedido', ORDERS: 'Pedidos',
  USER: 'Empleado', EMPLOYEE: 'Legajo', STOCK: 'Stock', LOT: 'Lote', WMS: 'Depósito',
  LOCATION: 'Ubicación', CELL: 'Posición', WAREHOUSE: 'Depósito', PRICE: 'Precio',
  PRICES: 'Precios', PROMO: 'Oferta', WEEKLY: 'Semanal', PERSONA: 'Cliente / Proveedor',
  CLIENT: 'Cliente', SUPPLIER: 'Proveedor', INVOICE: 'Factura', CREDIT: 'Crédito',
  NOTE: 'Nota', PURCHASE: 'Compra', COLLECTION: 'Cobranza', RECEIPT: 'Recibo',
  TRANSACTION: 'Movimiento', PAYMENT: 'Pago', CASH: 'Caja', DRAWER: 'Caja',
  CENTRAL: 'Central', BANK: 'Banco', ACCOUNT: 'Cuenta', EXPENSE: 'Gasto',
  EXPENSES: 'Gastos', DELIVERY: 'Reparto', ROUTE: 'Ruta', SALE: 'Preventa',
  VISIT: 'Visita', VEHICLE: 'Vehículo', MAINTENANCE: 'Mantenimiento',
  EXPIRY: 'Vencimiento', FUEL: 'Combustible', LOG: 'Registro', RUBRO: 'Rubro',
  PERCEPTION: 'Percepción', TAX: 'Impuesto', WITHHOLDING: 'Retención',
  CONFIG: 'Configuración', DATABASE: 'Base de Datos', BACKUP: 'Respaldo',
  IMAGE: 'Imagen', ZIP: 'Archivo ZIP', CSV: 'Planilla CSV', EXCEL: 'Excel',
  ITEMS: 'Ítems', WEIGHTS: 'Pesos', STATUS: 'Estado', SEQUENCE: 'Secuencia',
  CUSTODY: 'Custodia', DRIFT: 'Desvío', BATCH: 'en Lote', FAILED: 'Fallida',
  LOGIN: 'Ingreso', PASSWORD: 'Clave', OWN: 'Propia', TYPE: 'Tipo',
  NEW: 'Nueva', FEATURE: 'Funcionalidad', RECORD: 'Registro',
};

function fallbackTranslateAction(actionRaw: string): ActionEntry {
  const tokens = actionRaw.trim().toUpperCase().split('_').filter(Boolean);
  if (tokens.length === 0) return { label: 'Operación del Sistema', verb: 'Realizó una operación', tone: 'neutral' };

  const prefix = PREFIX_MAP[tokens[0]];
  const nounTokens = prefix ? tokens.slice(1) : tokens;
  const translatedWords = nounTokens
    .filter((t) => t !== 'NEW' || nounTokens.length === 1)
    .map((t) => TOKEN_ES[t] || t.charAt(0) + t.slice(1).toLowerCase());

  const subject = translatedWords.join(' ').trim() || 'Registro';
  if (prefix) {
    return {
      label: `${prefix.labelPrefix} ${subject}`,
      verb: `${prefix.verbPrefix} ${subject.toLowerCase()}`,
      tone: prefix.tone,
    };
  }
  return { label: subject, verb: `Operó sobre ${subject.toLowerCase()}`, tone: 'neutral' };
}

function getActionEntry(actionRaw?: string | null): ActionEntry {
  const key = String(actionRaw || '').trim().toUpperCase();
  if (!key) return { label: 'Operación del Sistema', verb: 'Realizó una operación', tone: 'neutral' };
  return ACTION_MAP[key] || fallbackTranslateAction(key);
}

export function resolveAuditBadge(actionRaw: string): AuditBadgeStyle {
  const entry = getActionEntry(actionRaw);
  const style = TONE_STYLES[entry.tone];
  return { label: entry.label, bg: style.bg, color: style.color };
}

export function translateAuditAction(actionRaw: string): string {
  return getActionEntry(actionRaw).label;
}

export function translateAuditVerb(actionRaw: string): string {
  return getActionEntry(actionRaw).verb;
}

export function translateEntityType(entityTypeRaw?: string | null): string {
  const key = String(entityTypeRaw || '').trim();
  if (!key) return 'Registro';
  return ENTITY_LABELS[key] || ENTITY_LABELS[key.toUpperCase()] || key.replace(/_/g, ' ');
}

export function translateOrderStatus(statusRaw?: string | null): string {
  const key = String(statusRaw || '').trim().toUpperCase();
  return ORDER_STATUS_LABELS[key] || key || 'Desconocido';
}

export function translateRole(roleRaw?: string | null): string {
  const key = String(roleRaw || '').trim().toUpperCase();
  return ROLE_LABELS[key] || roleRaw || '';
}

export function translatePaymentMethod(methodRaw?: string | null): string {
  const key = String(methodRaw || '').trim().toUpperCase();
  return PAYMENT_METHOD_LABELS[key] || methodRaw || '';
}

export interface AuditModuleOption {
  value: 'SALES' | 'CLIENTS' | 'STOCK_CATALOG' | 'FINANCE' | 'LOGISTICS' | 'SYSTEM';
  label: string;
}

export const AUDIT_MODULES: AuditModuleOption[] = [
  { value: 'SALES', label: 'Ventas' },
  { value: 'CLIENTS', label: 'Clientes' },
  { value: 'STOCK_CATALOG', label: 'Stock y Catálogo' },
  { value: 'FINANCE', label: 'Finanzas' },
  { value: 'LOGISTICS', label: 'Logística' },
  { value: 'SYSTEM', label: 'Sistema' },
];

const MODULE_GROUPS: Array<[string, string[], string[]]> = [
  ['Ventas', ['CREATE_ORDER', 'CREATE_ORDER_FAILED', 'UPDATE_ORDER', 'UPDATE_ORDER_ITEMS', 'UPDATE_ORDER_WEIGHTS', 'CONFIRM_ARMADO', 'UPDATE_ORDER_STATUS', 'INVOICE_ORDER', 'EMIT_AFIP_INVOICE', 'CREATE_DIRECT_INVOICE', 'CANCEL_ORDER', 'CREATE_CREDIT_NOTE', 'APPROVE_CREDIT_NOTE', 'REJECT_CREDIT_NOTE'], ['Order', 'CreditNote']],
  ['Clientes', ['CREATE_PERSONA', 'UPDATE_PERSONA', 'DELETE_PERSONA', 'CLIENT_VISIT_FAIL'], ['Persona', 'CLIENTS', 'PROVIDERS']],
  ['Stock y Catálogo', ['ASSIGN_WMS_LOCATION', 'CLEAR_WMS_LOCATION', 'UPSERT_WAREHOUSE_CELL', 'RESET_WAREHOUSE_CELL', 'ADJUST_STOCK', 'ADJUST_STOCK_BATCH', 'RECONCILE_STOCK_DRIFT', 'RECONCILE_STOCK', 'UPDATE_LOT', 'DELETE_LOT', 'TRANSFER_LOT_STOCK', 'CREATE_PRODUCT', 'UPDATE_PRODUCT', 'UPDATE_PRODUCT_IMAGE', 'IMPORT_PRODUCT_IMAGE_ZIP', 'IMPORT_PRODUCTS_CSV', 'BULK_UPDATE_PRICES', 'REVERT_PRICES_UNDO', 'SYNC_FROM_PRODUCTION_CATALOG', 'EXCEL_IMPORT', 'CREATE_RUBRO', 'UPDATE_RUBRO', 'DELETE_RUBRO', 'CREATE_WEEKLY_PROMO', 'TOGGLE_WEEKLY_PROMO', 'DELETE_WEEKLY_PROMO'], ['Product', 'ProductLot', 'WarehouseCell', 'Rubro', 'WeeklyPromo', 'PRODUCTS', 'PRICES']],
  ['Finanzas', ['RECORD_PERSONA_PAYMENT', 'REGISTER_PAYMENT', 'CREATE_COLLECTION', 'DELETE_COLLECTION_RECEIPT', 'CANCEL_TRANSACTION', 'CLOSE_OPERATIVE_DRAWER_RENDICION', 'OPEN_CASH_DRAWER', 'CLOSE_CASH_DRAWER', 'CLOSE_CENTRAL_DRAWER', 'CREATE_BANK_ACCOUNT', 'UPDATE_BANK_ACCOUNT', 'DEPOSIT_CASH_TO_BANK', 'VERIFY_BANK_TRANSFER', 'CREATE_EXPENSE', 'BULK_CREATE_EXPENSES', 'IMPORT_EXPENSES_EXCEL', 'DELETE_EXPENSE', 'CREATE_PURCHASE_ORDER', 'RECEIVE_PURCHASE_ORDER', 'CREATE_SUPPLIER_INVOICE', 'DELETE_SUPPLIER_INVOICE', 'CREATE_TAX_WITHHOLDING', 'UPDATE_PERCEPTION_TYPE'], ['Transaction', 'CashDrawer', 'BankAccount', 'Expense', 'PurchaseOrder', 'SupplierInvoice', 'TaxWithholding', 'PerceptionType']],
  ['Logística', ['CREATE_DELIVERY_ROUTE', 'UPDATE_DELIVERY_ROUTE_STATUS', 'DELETE_DELIVERY_ROUTE', 'TRANSFER_ROUTE_CUSTODY', 'SETTLE_DELIVERY_ROUTE', 'CREATE_SALE_ROUTE', 'UPDATE_SALE_ROUTE', 'DELETE_SALE_ROUTE', 'UPDATE_SALE_ROUTE_SEQUENCE', 'ADD_CLIENT_TO_ROUTE', 'RECORD_ROUTE_VISIT', 'CREATE_VEHICLE', 'UPDATE_VEHICLE', 'DELETE_VEHICLE', 'CREATE_VEHICLE_MAINTENANCE', 'DELETE_VEHICLE_MAINTENANCE', 'CREATE_VEHICLE_EXPIRY', 'UPDATE_VEHICLE_EXPIRY', 'DELETE_VEHICLE_EXPIRY', 'CREATE_FUEL_LOG', 'DELETE_FUEL_LOG'], ['DeliveryRoute', 'SaleRoute', 'SaleRouteVisit', 'Vehicle', 'VehicleMaintenance', 'VehicleExpiry', 'FuelLog']],
  ['Sistema', ['LOGIN', 'LOGIN_FAILED', 'CHANGE_OWN_PASSWORD', 'CREATE_USER', 'UPDATE_USER', 'TOGGLE_USER_STATUS', 'DELETE_USER', 'CREATE_EMPLOYEE', 'UPDATE_EMPLOYEE', 'UPDATE_CONFIG', 'ENCRYPTED_DATABASE_BACKUP', 'SYNC_BALANCES'], ['Employee', 'SystemSetting', 'DATABASE']],
];

export function resolveAuditModuleLabel(actionRaw?: string | null, entityTypeRaw?: string | null): string {
  const action = String(actionRaw || '').trim().toUpperCase();
  const entity = String(entityTypeRaw || '').trim();
  for (const [label, actions] of MODULE_GROUPS) {
    if (actions.includes(action)) return label;
  }
  for (const [label, , entities] of MODULE_GROUPS) {
    if (entities.includes(entity)) return label;
  }
  return 'Operación General';
}

export function getAllKnownAuditActionCodes(): string[] {
  return Object.keys(ACTION_MAP);
}

export function getAllKnownEntityTypeCodes(): string[] {
  return Object.keys(ENTITY_LABELS);
}
