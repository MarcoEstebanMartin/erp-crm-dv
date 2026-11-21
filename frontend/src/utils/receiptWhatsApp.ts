export const DEFAULT_PUBLIC_RECEIPT_ORIGIN = 'https://erp-dv-prueba-production.up.railway.app';

const UPPERCASE_TOKENS = new Set(['S.A.', 'S.R.L.', 'S.A.S.', 'S.H.', 'SA', 'SRL', 'SAS', 'SH']);
const LOWERCASE_CONNECTORS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);

export function normalizeArgentinaWhatsAppPhone(raw?: string | null): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('549')) return digits;
  if (digits.startsWith('54')) return `549${digits.slice(2)}`;
  if (digits.startsWith('0')) return `549${digits.slice(1)}`;
  return digits.length >= 8 ? `549${digits}` : '';
}

/**
 * Convierte nombres en MAYÚSCULAS GRITADAS ("MARTIN MARCO ESTEBAN") a formato
 * editorial limpio ("Martin Marco Esteban"), respetando siglas societarias (S.A., S.R.L.).
 */
export function formatCustomerDisplayName(rawName?: string | null): string {
  const trimmed = (rawName || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Cliente';

  const words = trimmed.split(' ');
  return words
    .map((word, index) => {
      const upper = word.toUpperCase();
      if (UPPERCASE_TOKENS.has(upper)) return upper;

      const lower = word.toLowerCase();
      if (index > 0 && LOWERCASE_CONNECTORS.has(lower)) return lower;

      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function formatReceiptDateAr(isoDate?: string | null): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatReceiptAmountAr(amount: number | string): string {
  const numeric = Number(amount);
  const rounded = Number.isFinite(numeric) ? Math.round(numeric) : 0;
  return `$${rounded.toLocaleString('es-AR')}`;
}

export function formatPaymentMethodLabel(
  paymentMethod?: string | null,
  bankAccountName?: string | null,
): string {
  switch (paymentMethod) {
    case 'CASH':
      return 'Efectivo';
    case 'BANK_TRANSFER':
      return bankAccountName ? `Transferencia (${bankAccountName})` : 'Transferencia';
    case 'CHECK':
      return 'Cheque';
    default:
      return 'Otro medio';
  }
}

export function formatFieldPaymentsSummary(
  payments?: Array<{ paymentMethod: string; isEcheq?: boolean }>,
): string {
  if (!payments || payments.length === 0) return 'Cobro registrado';
  const labels = Array.from(
    new Set(
      payments.map((p) => {
        if (p.paymentMethod === 'CHECK' && p.isEcheq) return 'E-Cheq';
        return formatPaymentMethodLabel(p.paymentMethod);
      }),
    ),
  );
  return labels.join(' + ');
}

const EPHEMERAL_HOST_SUFFIXES = [
  '.trycloudflare.com',
  '.ngrok-free.app',
  '.ngrok.io',
  '.loca.lt',
];

/**
 * Garantiza que los enlaces enviados por WhatsApp nunca salgan con `localhost`
 * ni con túneles temporales muertos (trycloudflare / ngrok).
 */
export function resolvePublicReceiptOrigin(rawOrigin?: string | null): string {
  const trimmed = (rawOrigin || '').trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_PUBLIC_RECEIPT_ORIGIN;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      EPHEMERAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
    ) {
      return DEFAULT_PUBLIC_RECEIPT_ORIGIN;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return DEFAULT_PUBLIC_RECEIPT_ORIGIN;
  }
}

export interface OfficeReceiptMessageInput {
  id: number;
  receiptNumber?: string | null;
  amount: number | string;
  paymentMethod?: string | null;
  createdAt?: string | null;
  persona?: { name?: string | null; phone?: string | null } | null;
  bankAccount?: { name?: string | null } | null;
  verificationCode?: string | null;
  publicUrl?: string | null;
}

export function buildOfficeReceiptWhatsAppMessage(
  receipt: OfficeReceiptMessageInput,
  _fallbackOrigin?: string,
): string {
  const nro = receipt.receiptNumber || `REC-${String(receipt.id).padStart(5, '0')}`;
  const customer = formatCustomerDisplayName(receipt.persona?.name);
  const dateStr = formatReceiptDateAr(receipt.createdAt);
  const method = formatPaymentMethodLabel(receipt.paymentMethod, receipt.bankAccount?.name);
  const total = formatReceiptAmountAr(receipt.amount);

  const lines: string[] = [
    '*Don Venancio* · Recibo de Cobro',
    '',
    `*N°:* ${nro}`,
    `*Cliente:* ${customer}`,
  ];

  if (dateStr) lines.push(`*Fecha:* ${dateStr}`);
  lines.push(`*Medio:* ${method}`);
  lines.push(`*Importe:* *${total}*`);

  if (receipt.verificationCode) {
    lines.push('');
    lines.push(`Código único: \`${receipt.verificationCode}\``);
  }

  return lines.join('\n');
}

export interface FieldReceiptMessageInput {
  receiptNumber?: string | null;
  provisionalCode: string;
  totalAmount: number | string;
  capturedAt?: string | null;
  pdfUrl?: string | null;
  publicUrl?: string | null;
  verificationCode?: string | null;
  persona?: { name?: string | null; phone?: string | null } | null;
  payments?: Array<{ paymentMethod: string; isEcheq?: boolean }>;
}

export function buildFieldReceiptWhatsAppMessage(
  receipt: FieldReceiptMessageInput,
  fallbackOrigin?: string,
): string {
  const nro = receipt.receiptNumber || receipt.provisionalCode;
  const customer = formatCustomerDisplayName(receipt.persona?.name);
  const dateStr = formatReceiptDateAr(receipt.capturedAt);
  const method = formatFieldPaymentsSummary(receipt.payments);
  const total = formatReceiptAmountAr(receipt.totalAmount);

  const lines: string[] = [
    '*Don Venancio* · Recibo Digital',
    '',
    `*N°:* ${nro}`,
    `*Cliente:* ${customer}`,
  ];

  if (dateStr) lines.push(`*Fecha:* ${dateStr}`);
  lines.push(`*Medio:* ${method}`);
  lines.push(`*Importe:* *${total}*`);

  if (receipt.publicUrl) {
    const absoluteUrl = receipt.publicUrl.startsWith('http')
      ? receipt.publicUrl
      : `${resolvePublicReceiptOrigin(fallbackOrigin)}${receipt.publicUrl}`;
    lines.push('');
    lines.push('Ver recibo:');
    lines.push(absoluteUrl);
  }

  return lines.join('\n');
}

export function buildWhatsAppDeepLink(phoneRaw: string | null | undefined, text: string): string {
  const phone = normalizeArgentinaWhatsAppPhone(phoneRaw);
  const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}
