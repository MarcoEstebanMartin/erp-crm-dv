import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  formatCustomerDisplayName,
  formatPaymentMethodLabel,
  formatReceiptAmountAr,
} from './receiptWhatsApp';

export interface PublicReceiptData {
  id: number;
  receiptNumber?: string | null;
  amount: number | string;
  paymentMethod: string;
  description?: string | null;
  createdAt: string;
  verified?: boolean;
  verificationCode?: string | null;
  publicUrl?: string | null;
  persona?: {
    id: number;
    name: string;
    cuit?: string | null;
    address?: string | null;
    city?: string | null;
  } | null;
  user?: {
    id: number;
    username: string;
  } | null;
  bankAccount?: {
    id: number;
    name: string;
  } | null;
  order?: {
    id?: number;
    invoiceNumber?: string | null;
  } | null;
  authenticity?: {
    verified: boolean;
    issuer: string;
  };
}

const INTERNAL_CONCEPT_PATTERN =
  /rendici[oó]n|chofer\s*:|ruta\s*#|reparto|vendedor\s*:|pago\s+de\s+|emisor\s*:|cierre\s+de|caja\s+|arqueo|backfill|migraci[oó]n|interno|auditor|cobro\s+digital|recibo\s+digital|en\s+calle/i;

/**
 * Sanitiza cualquier descripción interna (ej. "Rendición Reparto - Chofer: ... - Ruta #3")
 * para que el cliente vea únicamente un concepto comercial limpio, profesional y seguro.
 */
export function formatClientReceiptConcept(
  rawDescription?: string | null,
  invoiceNumber?: string | null,
): string {
  const cleanInvoice = (invoiceNumber || '').trim();
  if (cleanInvoice) {
    return `Pago Factura ${cleanInvoice}`;
  }

  const trimmed = (rawDescription || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return 'Pago a cuenta corriente';
  }

  const invoiceMatch = trimmed.match(/factura\s+([A-Z]?\s*\d{4}-\d{8})/i);
  if (invoiceMatch) {
    return `Pago Factura ${invoiceMatch[1].replace(/\s+/g, ' ').trim()}`;
  }

  const checkMatch = trimmed.match(/cheque\s*n[°º]?\s*([A-Z0-9-]+)/i);
  if (checkMatch && checkMatch[1].toUpperCase() !== 'S/N') {
    return `Pago a cuenta corriente · Cheque N° ${checkMatch[1]}`;
  }

  if (INTERNAL_CONCEPT_PATTERN.test(trimmed)) {
    return 'Pago a cuenta corriente';
  }

  if (/^pago\s+(a\s+)?cuenta\s+corriente$/i.test(trimmed)) {
    return 'Pago a cuenta corriente';
  }

  return trimmed.length > 60 ? `${trimmed.slice(0, 57).trimEnd()}…` : trimmed;
}

export function buildReceiptPdfFilename(
  receipt: Pick<PublicReceiptData, 'id' | 'receiptNumber'>,
): string {
  const raw = receipt.receiptNumber || `REC-${String(receipt.id).padStart(5, '0')}`;
  const safe = raw.replace(/[^A-Za-z0-9_-]/g, '');
  return `Recibo-${safe}.pdf`;
}

export function formatReceiptDateTimeAr(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  const datePart = d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${datePart} · ${timePart}`;
}

/**
 * Genera el comprobante oficial en PDF con formato móvil compacto (105 mm de ancho,
 * estilo recibo bancario / Mercado Pago) para lectura nítida en celular sin hacer zoom.
 */
export async function generateReceiptPdfBlob(receipt: PublicReceiptData): Promise<Blob> {
  const pageWidth = 105;
  const marginX = 8;
  const contentWidth = pageWidth - marginX * 2;

  const receiptNo = receipt.receiptNumber || `REC-${String(receipt.id).padStart(5, '0')}`;
  const customerName = formatCustomerDisplayName(receipt.persona?.name);
  const amountText = formatReceiptAmountAr(receipt.amount);
  const methodLabel = formatPaymentMethodLabel(receipt.paymentMethod);
  const dateTimeLabel = formatReceiptDateTimeAr(receipt.createdAt);
  const conceptLabel = formatClientReceiptConcept(
    receipt.description,
    receipt.order?.invoiceNumber,
  );
  const verificationCode = receipt.verificationCode || '';
  const verifyUrl =
    receipt.publicUrl || (typeof window !== 'undefined' ? window.location.href : '');

  const rows: Array<[string, string]> = [
    ['Cliente', customerName],
    ...(receipt.persona?.cuit ? [['CUIT', receipt.persona.cuit] as [string, string]] : []),
    ['Fecha', dateTimeLabel],
    ['Medio de pago', methodLabel],
    ['Concepto', conceptLabel],
  ];

  // Calculamos el alto exacto del comprobante para eliminar espacio muerto inferior
  const measureDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageWidth, 200] });
  measureDoc.setFont('helvetica', 'bold');
  measureDoc.setFontSize(10.5);

  const measuredRows = rows.map(([label, value]) => {
    const wrapped = measureDoc.splitTextToSize(value, contentWidth - 28) as string[];
    const height = Math.max(10.5, wrapped.length * 4.8 + 5.2);
    return { label, wrapped, height };
  });

  const rowsStartY = 64;
  const rowsTotalHeight = measuredRows.reduce((acc, r) => acc + r.height, 0);
  const qrBoxY = rowsStartY + rowsTotalHeight + 5;
  const qrBoxHeight = 32;
  const pageHeight = Math.max(150, Math.ceil(qrBoxY + qrBoxHeight + 10));

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidth, pageHeight],
  });

  // Fondo blanco limpio + encabezado institucional
  doc.setFillColor(17, 24, 39); // gray-900
  doc.roundedRect(marginX, 9, 11, 11, 2.2, 2.2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DV', marginX + 5.5, 16, { align: 'center' });

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Don Venancio', marginX + 14, 13.8);

  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Recibo de Cobro', marginX + 14, 18.8);

  // Número de recibo en pill superior derecha
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(pageWidth - marginX - 27, 10.5, 27, 7.5, 1.8, 1.8, 'F');
  doc.setTextColor(55, 65, 81);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.text(receiptNo, pageWidth - marginX - 13.5, 15.4, { align: 'center' });

  // Línea divisoria 1px
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(marginX, 25, pageWidth - marginX, 25);

  // Bloque central de monto (grande y legible en celular)
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(pageWidth / 2 - 24, 30, 48, 7.2, 3.6, 3.6, 'FD');
  doc.setTextColor(4, 120, 87);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('COMPROBANTE OFICIAL', pageWidth / 2, 34.8, { align: 'center' });

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(amountText, pageWidth / 2, 50.5, { align: 'center' });

  doc.setDrawColor(229, 231, 235);
  doc.line(marginX, 57, pageWidth - marginX, 57);

  // Detalle limpio con tipografía grande para celular
  let y = rowsStartY;
  for (let i = 0; i < measuredRows.length; i += 1) {
    const row = measuredRows[i];
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(row.label, marginX, y);

    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(row.wrapped, pageWidth - marginX, y, { align: 'right' });

    if (i < measuredRows.length - 1) {
      doc.setDrawColor(243, 244, 246);
      doc.line(marginX, y + row.height - 4.2, pageWidth - marginX, y + row.height - 4.2);
    }
    y += row.height;
  }

  // Bloque inferior de verificación (QR + Código único destacado)
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(marginX, qrBoxY, contentWidth, qrBoxHeight, 2.8, 2.8, 'FD');

  if (verifyUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 220,
        margin: 1,
        color: { dark: '#111827', light: '#F9FAFB' },
      });
      doc.addImage(qrDataUrl, 'PNG', marginX + 4, qrBoxY + 4, 24, 24);
    } catch {
      // Si el entorno sin canvas falla, continuamos con el código textual sin romper la descarga
    }
  }

  const textStartX = marginX + 32;
  doc.setTextColor(4, 120, 87);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Verificación digital', textStartX, qrBoxY + 10.5);

  if (verificationCode) {
    doc.setTextColor(17, 24, 39);
    doc.setFont('courier', 'bold');
    doc.setFontSize(10.5);
    doc.text(verificationCode, textStartX, qrBoxY + 18);
  }

  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Escaneá el QR para validar este recibo', textStartX, qrBoxY + 25.5);

  return doc.output('blob');
}

function triggerBrowserPdfDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadReceiptPdf(receipt: PublicReceiptData): Promise<void> {
  const blob = await generateReceiptPdfBlob(receipt);
  triggerBrowserPdfDownload(blob, buildReceiptPdfFilename(receipt));
}

export interface ShareReceiptPdfOptions {
  shareText?: string;
  whatsappUrl?: string;
}

/**
 * Flujo unificado de envío de recibo en PDF:
 * - En celular compatible: comparte el archivo PDF (+ texto corto) directo a WhatsApp vía Web Share API.
 * - En PC: descarga el PDF automáticamente y, si se provee `whatsappUrl`, abre el chat del cliente en WhatsApp Web.
 */
export async function shareOrDownloadReceiptPdf(
  receipt: PublicReceiptData,
  options?: ShareReceiptPdfOptions,
): Promise<'shared' | 'downloaded'> {
  const blob = await generateReceiptPdfBlob(receipt);
  const filename = buildReceiptPdfFilename(receipt);

  if (typeof navigator !== 'undefined' && typeof File !== 'undefined') {
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (
      typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        title: `Recibo ${receipt.receiptNumber || `REC-${receipt.id}`}`,
        ...(options?.shareText ? { text: options.shareText } : {}),
        files: [file],
      });
      return 'shared';
    }
  }

  triggerBrowserPdfDownload(blob, filename);
  if (options?.whatsappUrl && typeof window !== 'undefined') {
    window.open(options.whatsappUrl, '_blank', 'noopener,noreferrer');
  }
  return 'downloaded';
}
