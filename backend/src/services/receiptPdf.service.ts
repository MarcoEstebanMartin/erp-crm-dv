import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import PDFDocument from 'pdfkit';
import { roundToIntegerPeso } from '../core/money';

export interface ReceiptPdfPaymentItem {
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHECK';
  amount: number;
  transferReference?: string | null;
  checkBank?: string | null;
  checkNumber?: string | null;
}

export interface ReceiptPdfData {
  receiptNumber: string;
  provisionalCode: string;
  billingType?: 'OFFICIAL' | 'INTERNAL';
  capturedAt: Date;
  customerName: string;
  customerCuit?: string | null;
  collectorName: string;
  totalAmount: number;
  balanceAfter: number;
  hasPendingTransfer: boolean;
  payments: ReceiptPdfPaymentItem[];
}

const OFFICIAL_LOGO_PATH = path.resolve(__dirname, '..', '..', 'assets', 'logo_dv_clean.png');

function formatArs(amount: number): string {
  return `$${roundToIntegerPeso(amount).toNumber().toLocaleString('es-AR')}`;
}

function formatMethodLabel(item: ReceiptPdfPaymentItem): string {
  if (item.paymentMethod === 'CASH') return 'Efectivo';
  if (item.paymentMethod === 'BANK_TRANSFER') {
    return item.transferReference
      ? `Transferencia (Ref: ${item.transferReference})`
      : 'Transferencia Bancaria';
  }
  const bank = item.checkBank ?? 'Banco';
  const num = item.checkNumber ?? 'S/N';
  return `Cheque ${bank} N° ${num}`;
}

async function tryReadOfficialLogo(): Promise<Buffer | null> {
  try {
    return await fs.readFile(OFFICIAL_LOGO_PATH);
  } catch {
    return null;
  }
}

async function buildStyledReceiptPdfBuffer(
  data: ReceiptPdfData,
  verificationCode: string,
): Promise<Buffer> {
  const isOfficial = data.billingType === 'OFFICIAL';
  const logoBuffer = isOfficial ? await tryReadOfficialLogo() : null;
  const dateStr = data.capturedAt.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Formato móvil compacto (105 mm = 297.6 pt de ancho) consistente con el PDF del frontend
  const pageWidth = 298;
  const marginX = 22;
  const contentWidth = pageWidth - marginX * 2;
  const detailRows: Array<[string, string]> = [
    ['Cliente', data.customerName],
    ...(data.customerCuit ? [['CUIT', data.customerCuit] as [string, string]] : []),
    ['Fecha', dateStr],
    ['Cobrador', data.collectorName],
    ...data.payments.map((p) => [formatMethodLabel(p), formatArs(p.amount)] as [string, string]),
    ['Saldo en Cta. Cte.', formatArs(data.balanceAfter)],
  ];

  const estimatedHeight = Math.max(
    410,
    210 + detailRows.length * 24 + (data.hasPendingTransfer ? 28 : 0) + 64,
  );

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      pdfVersion: '1.4',
      size: [pageWidth, estimatedHeight],
      margin: 0,
      info: {
        Title: isOfficial
          ? `Recibo ${data.receiptNumber}`
          : `Recibo Provisorio ${data.receiptNumber}`,
        Author: isOfficial ? 'Distribuidora Don Venancio' : 'Comprobante Digital',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Fondo blanco
    doc.rect(0, 0, pageWidth, estimatedHeight).fill('#FFFFFF');

    // Encabezado diferenciado por sucursal
    if (isOfficial) {
      let textX = marginX + 40;
      if (logoBuffer) {
        doc.image(logoBuffer, marginX, 22, { height: 32 });
        textX = marginX + 60;
      } else {
        doc.roundedRect(marginX, 24, 30, 30, 6).fill('#111827');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12);
        doc.text('DV', marginX, 34, { width: 30, align: 'center' });
      }
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12.5);
      doc.text('Don Venancio', textX, 26, { width: 120 });
      doc.fillColor('#6B7280').font('Helvetica').fontSize(8.5);
      doc.text('Recibo de Cobro', textX, 41, { width: 120 });
    } else {
      doc.roundedRect(marginX, 24, 30, 30, 6).fill('#111827');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(15);
      doc.text('D', marginX, 32.5, { width: 30, align: 'center' });
    }

    // Pill número de recibo
    const pillW = 86;
    const pillX = pageWidth - marginX - pillW;
    doc.roundedRect(pillX, 28, pillW, 20, 5).fill('#F3F4F6');
    doc.fillColor('#374151').font('Courier-Bold').fontSize(8);
    doc.text(data.receiptNumber, pillX, 34, { width: pillW, align: 'center' });

    // Divisoria
    doc.moveTo(marginX, 68).lineTo(pageWidth - marginX, 68).lineWidth(0.75).strokeColor('#E5E7EB').stroke();

    // Badge central
    const badgeW = 136;
    const badgeX = (pageWidth - badgeW) / 2;
    if (isOfficial) {
      doc.roundedRect(badgeX, 82, badgeW, 20, 10).fillAndStroke('#ECFDF5', '#A7F3D0');
      doc.fillColor('#047857').font('Helvetica-Bold').fontSize(8);
      doc.text('COMPROBANTE OFICIAL', badgeX, 88.5, { width: badgeW, align: 'center' });
    } else {
      doc.roundedRect(badgeX, 82, badgeW, 20, 10).fillAndStroke('#F3F4F6', '#D1D5DB');
      doc.fillColor('#374151').font('Helvetica-Bold').fontSize(8);
      doc.text('RECIBO PROVISORIO', badgeX, 88.5, { width: badgeW, align: 'center' });
    }

    // Monto principal
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(26);
    doc.text(formatArs(data.totalAmount), marginX, 114, { width: contentWidth, align: 'center' });

    doc.moveTo(marginX, 152).lineTo(pageWidth - marginX, 152).lineWidth(0.75).strokeColor('#E5E7EB').stroke();

    // Detalle
    let y = 166;
    for (let i = 0; i < detailRows.length; i += 1) {
      const [label, value] = detailRows[i];
      doc.fillColor('#6B7280').font('Helvetica').fontSize(9);
      doc.text(label, marginX, y, { width: 112 });
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9.5);
      doc.text(value, marginX + 114, y, { width: contentWidth - 114, align: 'right' });

      if (i < detailRows.length - 1) {
        doc
          .moveTo(marginX, y + 18)
          .lineTo(pageWidth - marginX, y + 18)
          .lineWidth(0.5)
          .strokeColor('#F3F4F6')
          .stroke();
      }
      y += 24;
    }

    if (data.hasPendingTransfer) {
      y += 4;
      doc.roundedRect(marginX, y, contentWidth, 22, 5).fillAndStroke('#FFFBEB', '#FDE68A');
      doc.fillColor('#92400E').font('Helvetica-Bold').fontSize(7.5);
      doc.text('Transferencia sujeta a acreditación bancaria.', marginX + 8, y + 7, {
        width: contentWidth - 16,
        align: 'center',
      });
      y += 30;
    }

    // Pie de verificación
    const footerY = y + 8;
    doc.roundedRect(marginX, footerY, contentWidth, 38, 6).fillAndStroke('#F9FAFB', '#E5E7EB');
    doc.fillColor('#047857').font('Helvetica-Bold').fontSize(8);
    doc.text('Verificación digital', marginX + 10, footerY + 8, { width: contentWidth - 20 });
    doc.fillColor('#111827').font('Courier-Bold').fontSize(9.5);
    doc.text(`${verificationCode}  ·  ${data.provisionalCode}`, marginX + 10, footerY + 21, {
      width: contentWidth - 20,
    });

    doc.end();
  });
}

export const receiptPdfService = {
  computeVerificationCode(receiptNumber: string, totalAmount: number): string {
    return crypto
      .createHash('sha256')
      .update(`${receiptNumber}:${roundToIntegerPeso(totalAmount).toNumber()}`)
      .digest('hex')
      .slice(0, 10)
      .toUpperCase();
  },

  async generateAndSaveReceiptPdf(data: ReceiptPdfData) {
    const verificationCode = this.computeVerificationCode(data.receiptNumber, data.totalAmount);
    const buffer = await buildStyledReceiptPdfBuffer(data, verificationCode);
    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'receipts');
    await fs.mkdir(uploadsDir, { recursive: true });

    const safeFileName = `${data.receiptNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    const filePath = path.join(uploadsDir, safeFileName);
    await fs.writeFile(filePath, buffer);

    return {
      filePath,
      publicUrl: `/uploads/receipts/${safeFileName}`,
      verificationCode,
      buffer,
    };
  },
};
