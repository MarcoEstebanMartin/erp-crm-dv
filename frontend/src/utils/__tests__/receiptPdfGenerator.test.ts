import { describe, it, expect } from 'vitest';
import {
  buildReceiptPdfFilename,
  formatClientReceiptConcept,
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

  it('formatea fecha y hora válidas en 24h y tolera fechas inválidas', () => {
    const formatted = formatReceiptDateTimeAr('2026-11-18T15:30:00.000Z');
    expect(formatted).toMatch(/\d{2}\/\d{2}\/2026 · \d{2}:\d{2}/);
    expect(formatted).not.toMatch(/a\.\s*m\.|p\.\s*m\./i);
    expect(formatReceiptDateTimeAr('invalida')).toBe('');
  });

  it('oculta textos internos de reparto/rendición y muestra conceptos limpios al cliente', () => {
    expect(
      formatClientReceiptConcept(
        'Rendición Reparto - Chofer: Fabian - Ruta #3 - Pago de GOMEZ CARLOS',
      ),
    ).toBe('Pago a cuenta corriente');

    expect(
      formatClientReceiptConcept(
        'Rendición Reparto - Cheque N° 455201 (Emisor: KIOSCO CENTRAL) - Chofer: Miguel - Ruta #3',
      ),
    ).toBe('Pago a cuenta corriente · Cheque N° 455201');

    expect(formatClientReceiptConcept('Cobro inmediato Factura 0001-00000500')).toBe(
      'Pago Factura 0001-00000500',
    );

    expect(formatClientReceiptConcept(null, '0001-00000888')).toBe('Pago Factura 0001-00000888');
    expect(formatClientReceiptConcept(null)).toBe('Pago a cuenta corriente');
    expect(formatClientReceiptConcept('Anticipo mercadería')).toBe('Anticipo mercadería');
  });

  it('genera un Blob PDF válido con cabecera %PDF- sin exponer textos internos ni usuario', async () => {
    const blob = await generateReceiptPdfBlob({
      id: 52,
      receiptNumber: 'REC-00052',
      amount: 388108,
      paymentMethod: 'BANK_TRANSFER',
      description: 'Rendición Reparto - Chofer: Fabian - Ruta #3 - Pago de MARTIN MARCO ESTEBAN',
      createdAt: '2026-11-18T15:30:00.000Z',
      verificationCode: 'DV-8F3A-9C12',
      publicUrl: 'https://erp-dv-prueba-production.up.railway.app/recibo/52?v=8f3a9c12b4e17d05',
      persona: {
        id: 10,
        name: 'MARTIN MARCO ESTEBAN',
        cuit: '20-30123456-7',
      },
      user: { id: 1, username: 'admin' },
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(500);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });
});
