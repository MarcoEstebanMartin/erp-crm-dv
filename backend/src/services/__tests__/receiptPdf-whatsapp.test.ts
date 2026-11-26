import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { receiptPdfService } from '../receiptPdf.service';
import { normalizeArgentinaWhatsAppPhone } from '../whatsappDispatch.service';

function extractPdfPageText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const match = raw.match(/\/Filter \/FlateDecode[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/);
  const stream = match ? zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1') : raw;
  const decodedRuns: string[] = [];
  for (const tj of stream.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) {
    const text = Array.from(tj[1].matchAll(/<([0-9a-fA-F]+)>/g))
      .map((m) => Buffer.from(m[1], 'hex').toString('latin1'))
      .join('');
    decodedRuns.push(text);
  }
  return decodedRuns.join('\n');
}

describe('T004 — Generador PDF de Recibo y Normalización WhatsApp Argentina', () => {
  it('genera PDF 1.4 oficial (Sucursal A) con logo y marca Don Venancio y provisorio (Sucursal X) sin Don Venancio', async () => {
    const officialPdf = await receiptPdfService.generateAndSaveReceiptPdf({
      receiptNumber: 'REC-C-0000099',
      provisionalCode: 'PROV-TEST-99',
      billingType: 'OFFICIAL',
      capturedAt: new Date('2026-11-17T13:50:00Z'),
      customerName: 'Supermercado El Sol',
      customerCuit: '30-71234567-9',
      collectorName: 'Gemini Reparto',
      totalAmount: 125000,
      balanceAfter: 35000,
      hasPendingTransfer: true,
      payments: [
        { paymentMethod: 'CASH', amount: 75000 },
        { paymentMethod: 'BANK_TRANSFER', amount: 50000, transferReference: 'MP-88912' },
      ],
    });

    expect(officialPdf.buffer.subarray(0, 8).toString('utf8')).toBe('%PDF-1.4');
    expect(officialPdf.publicUrl).toBe('/uploads/receipts/REC-C-0000099.pdf');
    expect(officialPdf.verificationCode).toHaveLength(10);
    expect(officialPdf.verificationCode).toBe(
      receiptPdfService.computeVerificationCode('REC-C-0000099', 125000),
    );
    expect(officialPdf.buffer.toString('latin1')).toContain('Don Venancio');

    const internalPdf = await receiptPdfService.generateAndSaveReceiptPdf({
      receiptNumber: 'REC-C-0000100',
      provisionalCode: 'PROV-TEST-100',
      billingType: 'INTERNAL',
      capturedAt: new Date('2026-11-17T13:55:00Z'),
      customerName: 'Kiosco Centro',
      collectorName: 'Gemini Ventas',
      totalAmount: 42000,
      balanceAfter: 0,
      hasPendingTransfer: false,
      payments: [{ paymentMethod: 'CASH', amount: 42000 }],
    });

    expect(internalPdf.buffer.subarray(0, 8).toString('utf8')).toBe('%PDF-1.4');
    expect(internalPdf.buffer.toString('latin1')).not.toContain('Don Venancio');
    const internalStream = extractPdfPageText(internalPdf.buffer);
    expect(internalStream).toContain('RECIBO PROVISORIO');
    expect(internalStream).not.toContain('Recibo Provisorio');
  });

  it('normaliza teléfonos argentinos al formato internacional 549...', () => {
    expect(normalizeArgentinaWhatsAppPhone('+54 9 3388 412345')).toBe('5493388412345');
    expect(normalizeArgentinaWhatsAppPhone('03388 412345')).toBe('5493388412345');
    expect(normalizeArgentinaWhatsAppPhone('11 5544 3322')).toBe('5491155443322');
    expect(normalizeArgentinaWhatsAppPhone('123')).toBeNull();
    expect(normalizeArgentinaWhatsAppPhone(null)).toBeNull();
  });
});
