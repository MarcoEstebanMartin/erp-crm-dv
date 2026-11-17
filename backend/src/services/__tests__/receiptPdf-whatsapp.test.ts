import { describe, expect, it } from 'vitest';
import { receiptPdfService } from '../receiptPdf.service';
import { normalizeArgentinaWhatsAppPhone } from '../whatsappDispatch.service';

describe('T004 — Generador PDF de Recibo y Normalización WhatsApp Argentina', () => {
  it('genera un PDF 1.4 válido con código de verificación determinístico', async () => {
    const pdf = await receiptPdfService.generateAndSaveReceiptPdf({
      receiptNumber: 'REC-C-0000099',
      provisionalCode: 'PROV-TEST-99',
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

    expect(pdf.buffer.subarray(0, 8).toString('utf8')).toBe('%PDF-1.4');
    expect(pdf.publicUrl).toBe('/uploads/receipts/REC-C-0000099.pdf');
    expect(pdf.verificationCode).toHaveLength(10);
    expect(pdf.verificationCode).toBe(
      receiptPdfService.computeVerificationCode('REC-C-0000099', 125000),
    );
  });

  it('normaliza teléfonos argentinos al formato internacional 549...', () => {
    expect(normalizeArgentinaWhatsAppPhone('+54 9 3388 412345')).toBe('5493388412345');
    expect(normalizeArgentinaWhatsAppPhone('03388 412345')).toBe('5493388412345');
    expect(normalizeArgentinaWhatsAppPhone('11 5544 3322')).toBe('5491155443322');
    expect(normalizeArgentinaWhatsAppPhone('123')).toBeNull();
    expect(normalizeArgentinaWhatsAppPhone(null)).toBeNull();
  });
});
