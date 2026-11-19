import { describe, it, expect } from 'vitest';
import {
  buildReceiptPdfFilename,
  formatReceiptDateTimeAr,
  generateReceiptPdfBlob,
} from '../receiptPdfGenerator';

describe('receiptPdfGenerator (PDF minimalista con QR anti-estafas)', () => {
  it('sanitiza el nombre del archivo PDF', () => {
    expect(buildReceiptPdfFilename({ id: 52, receiptNumber: 'REC-00052' })).toBe(
      'Recibo-REC-00052.pdf',
    );
    expect(buildReceiptPdfFilename({ id: 7, receiptNumber: null })).toBe('Recibo-REC-00007.pdf');
  });

  it('formatea fecha y hora válidas y tolera fechas inválidas', () => {
    expect(formatReceiptDateTimeAr('2026-11-18T15:30:00.000Z')).toMatch(/\d{2}\/\d{2}\/2026/);
    expect(formatReceiptDateTimeAr('invalida')).toBe('');
  });

  it('genera un Blob PDF válido con cabecera %PDF-', async () => {
    const blob = await generateReceiptPdfBlob({
      id: 52,
      receiptNumber: 'REC-00052',
      amount: 388108,
      paymentMethod: 'BANK_TRANSFER',
      description: 'Pago cuenta corriente',
      createdAt: '2026-11-18T15:30:00.000Z',
      verificationCode: 'DV-8F3A-9C12',
      publicUrl: 'https://erp-dv-prueba-production.up.railway.app/recibo/52?v=8f3a9c12b4e17d05',
      persona: {
        id: 10,
        name: 'MARTIN MARCO ESTEBAN',
        cuit: '20-30123456-7',
      },
      user: { id: 1, username: 'esteban' },
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(500);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });
});
