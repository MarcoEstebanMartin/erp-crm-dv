import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

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
  capturedAt: Date;
  customerName: string;
  customerCuit?: string | null;
  collectorName: string;
  totalAmount: number;
  balanceAfter: number;
  hasPendingTransfer: boolean;
  payments: ReceiptPdfPaymentItem[];
}

function formatArs(amount: number): string {
  return `$${Math.round(amount).toLocaleString('es-AR')}`;
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

function escapePdfText(input: string): string {
  // Normaliza caracteres fuera de ASCII básico para compatibilidad universal PDF Type1
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ');
  return normalized.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildMinimalPdfBuffer(lines: Array<{ text: string; size: number; bold?: boolean; y: number }>): Buffer {
  const ops: string[] = [];
  for (const line of lines) {
    const font = line.bold ? '/F2' : '/F1';
    ops.push(`BT ${font} ${line.size} Tf 50 ${line.y} Td (${escapePdfText(line.text)}) Tj ET`);
  }
  const stream = ops.join('\n');

  const objects: string[] = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >> endobj',
    `4 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    '6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj + '\n';
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

export const receiptPdfService = {
  computeVerificationCode(receiptNumber: string, totalAmount: number): string {
    return crypto
      .createHash('sha256')
      .update(`${receiptNumber}:${Math.round(totalAmount)}`)
      .digest('hex')
      .slice(0, 10)
      .toUpperCase();
  },

  async generateAndSaveReceiptPdf(data: ReceiptPdfData) {
    const verificationCode = this.computeVerificationCode(data.receiptNumber, data.totalAmount);
    const dateStr = data.capturedAt.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

    const lines: Array<{ text: string; size: number; bold?: boolean; y: number }> = [
      { text: 'DISTRIBUIDORA DON VENANCIO', size: 16, bold: true, y: 780 },
      { text: 'RECIBO DE COBRANZA DIGITAL', size: 12, bold: true, y: 758 },
      { text: `Comprobante Nro: ${data.receiptNumber}`, size: 11, bold: true, y: 730 },
      { text: `Fecha y hora: ${dateStr}`, size: 10, y: 712 },
      { text: `Cobrador: ${data.collectorName}`, size: 10, y: 696 },
      { text: `Cliente: ${data.customerName}${data.customerCuit ? ` (CUIT: ${data.customerCuit})` : ''}`, size: 10, bold: true, y: 670 },
      { text: '--------------------------------------------------------------------------', size: 10, y: 652 },
      { text: 'Detalle de Medios de Pago:', size: 11, bold: true, y: 632 },
    ];

    let y = 612;
    for (const p of data.payments) {
      lines.push({
        text: `- ${formatMethodLabel(p)}: ${formatArs(p.amount)}`,
        size: 10,
        y,
      });
      y -= 18;
    }

    y -= 10;
    lines.push({ text: '--------------------------------------------------------------------------', size: 10, y });
    y -= 22;
    lines.push({ text: `TOTAL RECIBIDO: ${formatArs(data.totalAmount)}`, size: 13, bold: true, y });
    y -= 20;
    lines.push({ text: `Saldo en Cuenta Corriente: ${formatArs(data.balanceAfter)}`, size: 10, y });

    if (data.hasPendingTransfer) {
      y -= 20;
      lines.push({
        text: 'NOTA: Pago por transferencia sujeto a acreditacion bancaria.',
        size: 9,
        bold: true,
        y,
      });
    }

    y -= 30;
    lines.push({
      text: `Codigo de verificacion: ${verificationCode} | Ref: ${data.provisionalCode}`,
      size: 8,
      y,
    });

    const buffer = buildMinimalPdfBuffer(lines);
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
