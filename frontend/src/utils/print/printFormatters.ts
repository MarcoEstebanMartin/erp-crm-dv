import { formatCompanyPhone, getCompanyProfile } from '../companyProfile';
import { resolveOrderPersona } from '../orderSearchAndStatus.helper';
import { SCALE, divRoundHalfUp, parseScaledBigInt } from '../exactStockMath';

export const PRINT_FONT_STACK =
  "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const ZONE_LABELS: Record<string, string> = {
  FRIO: 'SECTOR FRÍO',
  TABLA: 'SECTOR TABLA / BEBIDAS',
  CAJAS: 'SECTOR CAJAS / SECOS',
  ALL: 'TODAS LAS ZONAS',
};

export function getZoneDisplayTitle(zone: string = 'ALL'): string {
  return ZONE_LABELS[zone] || ZONE_LABELS.ALL;
}

/** Escapa caracteres HTML especiales antes de escribir en plantillas de impresión. */
export function escapePrintHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Redondea un monto monetario al peso entero más cercano usando aritmética BigInt ROUND_HALF_UP. */
export function roundIntPesoPrint(value: unknown): number {
  const scaled = parseScaledBigInt(value as number | string | null | undefined);
  return Number(divRoundHalfUp(scaled, SCALE));
}

export function formatArsPrint(value: unknown): string {
  return roundIntPesoPrint(value).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Calcula subtotal entero exacto de un renglón cuando el comprobante no trae `subtotal` persistido. */
export function computeFallbackItemSubtotalPrint(item: any): number {
  if (item?.subtotal !== undefined && item?.subtotal !== null) {
    return roundIntPesoPrint(item.subtotal);
  }
  const priceScaled = parseScaledBigInt(item?.unitPrice ?? item?.price ?? 0);
  const weightVal = Number(item?.weight || 0);
  const isPesable = Boolean(item?.product?.isPesable || item?.isPesable || weightVal > 0);
  const qtyScaled = parseScaledBigInt(item?.quantity || 0);

  let factorScaled: bigint;
  if (weightVal > 0) {
    factorScaled = parseScaledBigInt(weightVal);
  } else if (isPesable) {
    const approxScaled = parseScaledBigInt(item?.product?.approximateWeight || 1);
    factorScaled = divRoundHalfUp(qtyScaled * approxScaled, SCALE);
  } else {
    factorScaled = qtyScaled;
  }

  return Number(divRoundHalfUp(priceScaled * factorScaled, SCALE * SCALE));
}

export function resolveSellerDisplayName(order: any): string {
  return (
    order?.seller?.name ||
    order?.sellerName ||
    order?.user?.name ||
    order?.user?.username ||
    'Administración'
  );
}

export function resolvePrintClientMeta(order: any) {
  const persona = resolveOrderPersona(order);
  const name = persona?.name || order?.clientName || 'CONSUMIDOR FINAL';
  const address = persona?.address || 'Retira en local';
  const city = persona?.city || '';
  const cuit = persona?.cuit || 'Consumidor Final';
  const taxCondition = persona?.taxCondition || 'Consumidor Final';
  const outstandingBalance = persona?.outstandingBalance ?? 0;
  return { persona, name, address, city, cuit, taxCondition, outstandingBalance };
}

export function getPrintCompanyContext() {
  const company = getCompanyProfile();
  return {
    company,
    phone: formatCompanyPhone(company.telefono),
  };
}

export function openPrintDocument(windowFeatures: string, html: string): void {
  const printWindow = window.open('', '_blank', windowFeatures);
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
}
