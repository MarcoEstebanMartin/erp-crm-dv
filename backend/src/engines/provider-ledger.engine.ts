import { NumericInput, roundToTwoDecimals, toDecimal } from '../core/money';

export interface ProviderBalanceView {
  payableBalance: number;
  favorBalance: number;
  netSupplierBalance: number;
}

export interface ProviderStatementRowInput {
  id?: string;
  type?: 'DEBIT' | 'CREDIT' | string;
  sourceType?: string | null;
  reference?: string | null;
  description?: string | null;
  amount?: NumericInput;
  date?: Date | string;
  [key: string]: any;
}

export interface ProviderStatementRow extends ProviderStatementRowInput {
  compraAmount: number;
  pagoAmount: number;
  runningPayable: number;
  kindLabel: 'Factura' | 'Pago' | 'Anulación' | 'Ajuste';
}

const PROVIDER_LEDGER_SOURCE_TYPES = new Set([
  'SUPPLIER_INVOICE',
  'SUPPLIER_INVOICE_REVERSAL',
  'SUPPLIER_PAYMENT',
]);

/**
 * Normaliza un CUIT argentino a formato XX-XXXXXXXX-X cuando posee 11 dígitos.
 */
export function formatSupplierCuit(raw?: string | null): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const cleanDigits = trimmed.replace(/\D/g, '');
  if (cleanDigits.length === 11) {
    return `${cleanDigits.slice(0, 2)}-${cleanDigits.slice(2, 10)}-${cleanDigits.slice(10)}`;
  }
  return trimmed;
}

/**
 * Convierte el saldo contable del Libro Mayor (donde CREDIT de factura de compra lleva el saldo
 * a negativo y DEBIT de pago/anulación lo acerca a 0) a la vista humana de Proveedores:
 *  - payableBalance: cuánto debemos al proveedor (>= 0).
 *  - favorBalance: saldo a nuestro favor (>= 0).
 * En personas con doble rol (Cliente + Proveedor), aísla los asientos propios de compras/pagos.
 */
export function computeProviderBalanceView(params: {
  outstandingBalance: NumericInput;
  isClient?: boolean;
  providerCredits?: NumericInput;
  providerDebits?: NumericInput;
}): ProviderBalanceView {
  const hasIsolatedProviderTotals =
    Boolean(params.isClient) &&
    (params.providerCredits !== undefined || params.providerDebits !== undefined);

  const netDec = hasIsolatedProviderTotals
    ? roundToTwoDecimals(
        toDecimal(params.providerDebits ?? 0).minus(toDecimal(params.providerCredits ?? 0)),
      )
    : roundToTwoDecimals(toDecimal(params.outstandingBalance ?? 0));

  if (netDec.lt(0)) {
    return {
      payableBalance: roundToTwoDecimals(netDec.abs()).toNumber(),
      favorBalance: 0,
      netSupplierBalance: netDec.toNumber(),
    };
  }

  if (netDec.gt(0)) {
    return {
      payableBalance: 0,
      favorBalance: netDec.toNumber(),
      netSupplierBalance: netDec.toNumber(),
    };
  }

  return {
    payableBalance: 0,
    favorBalance: 0,
    netSupplierBalance: 0,
  };
}

function isProviderLedgerEntry(item: ProviderStatementRowInput): boolean {
  if (item.sourceType && PROVIDER_LEDGER_SOURCE_TYPES.has(String(item.sourceType))) {
    return true;
  }
  const idStr = String(item.id || '');
  const refStr = String(item.reference || '');
  const descStr = String(item.description || '');
  return (
    idStr.startsWith('supplier-invoice-') ||
    refStr.startsWith('Pago #') ||
    descStr.startsWith('Compra -') ||
    descStr.startsWith('Reversión por eliminación de Factura')
  );
}

function resolveStatementKindLabel(
  item: ProviderStatementRowInput,
): 'Factura' | 'Pago' | 'Anulación' | 'Ajuste' {
  if (item.sourceType === 'SUPPLIER_INVOICE') return 'Factura';
  if (item.sourceType === 'SUPPLIER_INVOICE_REVERSAL') return 'Anulación';
  if (item.sourceType === 'SUPPLIER_PAYMENT') return 'Pago';
  if (item.sourceType === 'RECONCILIATION_ADJUSTMENT' || item.sourceType === 'LEGACY_ADJUSTMENT') {
    return 'Ajuste';
  }
  return item.type === 'CREDIT' ? 'Factura' : 'Pago';
}

/**
 * Construye filas cronológicas en perspectiva de Proveedor usando Decimal.js:
 *  - compraAmount: facturas recibidas (incrementan deuda a pagar).
 *  - pagoAmount: pagos o anulaciones (reducen deuda a pagar).
 *  - runningPayable: saldo pendiente acumulado tras cada asiento (+ debemos / - a favor).
 */
export function buildProviderStatementRows<T extends ProviderStatementRowInput>(
  ledgerItems: T[],
  isDualClientProvider = false,
): Array<T & ProviderStatementRow> {
  const scoped = isDualClientProvider
    ? ledgerItems.filter((item) => isProviderLedgerEntry(item))
    : ledgerItems;

  let runningPayableDec = toDecimal(0);

  return scoped.map((item) => {
    const amtDec = roundToTwoDecimals(item.amount ?? 0);
    const isPurchaseCredit = item.type === 'CREDIT';
    const compraAmount = isPurchaseCredit ? amtDec.toNumber() : 0;
    const pagoAmount = !isPurchaseCredit ? amtDec.toNumber() : 0;

    runningPayableDec = roundToTwoDecimals(
      runningPayableDec.plus(compraAmount).minus(pagoAmount),
    );

    return {
      ...item,
      compraAmount,
      pagoAmount,
      runningPayable: runningPayableDec.toNumber(),
      kindLabel: resolveStatementKindLabel(item),
    };
  });
}
