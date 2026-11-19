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
  authenticity?: {
    verified: boolean;
    issuer: string;
  };
}

export function buildReceiptPdfFilename(receipt: Pick<PublicReceiptData, 'id' | 'receiptNumber'>): string {
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
  });
  return `${datePart} · ${timePart}`;
}

/**
 * Genera el comprobante oficial en PDF con estética minimalista y QR de verificación
 * generado 100% localmente en el navegador (sin enviar enlaces a servicios externos).
 */
export async function generateReceiptPdfBlob(receipt: PublicReceiptData): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 24;
  const contentWidth = pageWidth - marginX * 2;

  const receiptNo = receipt.receiptNumber || `REC-${String(receipt.id).padStart(5, '0')}`;
  const customerName = formatCustomerDisplayName(receipt.persona?.name);
  const amountText = formatReceiptAmountAr(receipt.amount);
  const methodLabel = formatPaymentMethodLabel(receipt.paymentMethod, receipt.bankAccount?.name);
  const dateTimeLabel = formatReceiptDateTimeAr(receipt.createdAt);
  const verificationCode = receipt.verificationCode || '';
  const verifyUrl = receipt.publicUrl || (typeof window !== 'undefined' ? window.location.href : '');

  // Encabezado sobrio
  doc.setFillColor(24, 24, 27); // zinc-900
  doc.roundedRect(marginX, 22, 11, 11, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DV', marginX + 5.5, 29.2, { align: 'center' });

  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Distribuidora Don Venancio', marginX + 15, 27.5);

  doc.setTextColor(113, 113, 122); // zinc-500
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Recibo de Cobro', marginX + 15, 32.5);

  // Número a la derecha
  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(receiptNo, pageWidth - marginX, 27.5, { align: 'right' });

  // Línea divisoria 1px
  doc.setDrawColor(228, 228, 231); // zinc-200
  doc.setLineWidth(0.3);
  doc.line(marginX, 40, pageWidth - marginX, 40);

  // Bloque de monto + badge verificado
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(167, 243, 208); // emerald-200
  doc.roundedRect(marginX, 49, 44, 7.5, 3.5, 3.5, 'FD');
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('VERIFICADO EN VIVO', marginX + 22, 54, { align: 'center' });

  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(amountText, marginX, 71);

  doc.setDrawColor(228, 228, 231);
  doc.line(marginX, 79, pageWidth - marginX, 79);

  // Detalle limpio en 2 columnas
  const rows: Array<[string, string]> = [
    ['Cliente', customerName],
    ...(receipt.persona?.cuit ? [['CUIT', receipt.persona.cuit] as [string, string]] : []),
    ['Fecha', dateTimeLabel],
    ['Medio de pago', methodLabel],
    ...(receipt.description ? [['Concepto', receipt.description] as [string, string]] : []),
    ...(receipt.user?.username ? [['Emitido por', receipt.user.username] as [string, string]] : []),
  ];

  let y = 91;
  for (const [label, value] of rows) {
    doc.setTextColor(113, 113, 122);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(label, marginX, y);

    doc.setTextColor(24, 24, 27);
    doc.setFont('helvetica', 'bold');
    const wrapped = doc.splitTextToSize(value, contentWidth - 48);
    doc.text(wrapped, pageWidth - marginX, y, { align: 'right' });

    const rowHeight = Math.max(10, wrapped.length * 5.2 + 4);
    doc.setDrawColor(244, 244, 245);
    doc.line(marginX, y + rowHeight - 5.5, pageWidth - marginX, y + rowHeight - 5.5);
    y += rowHeight;
  }

  // Bloque inferior anti-estafas con QR
  const qrBoxY = Math.max(y + 10, 178);
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(228, 228, 231);
  doc.roundedRect(marginX, qrBoxY, contentWidth, 38, 3, 3, 'FD');

  if (verifyUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 220,
        margin: 1,
        color: { dark: '#18181B', light: '#FAFAFA' },
      });
      doc.addImage(qrDataUrl, 'PNG', marginX + 5, qrBoxY + 4, 30, 30);
    } catch {
      // Si el entorno sin canvas falla, continuamos con el código textual sin romper la descarga
    }
  }

  const textStartX = marginX + 41;
  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Autenticidad verificable', textStartX, qrBoxY + 12);

  if (verificationCode) {
    doc.setTextColor(24, 24, 27);
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text(verificationCode, textStartX, qrBoxY + 20);
  }

  if (verifyUrl) {
    doc.setTextColor(113, 113, 122);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const shortUrl = doc.splitTextToSize(verifyUrl, contentWidth - 46);
    doc.text(shortUrl, textStartX, qrBoxY + 27);
  }

  return doc.output('blob');
}

export async function downloadReceiptPdf(receipt: PublicReceiptData): Promise<void> {
  const blob = await generateReceiptPdfBlob(receipt);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildReceiptPdfFilename(receipt);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
