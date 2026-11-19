import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PUBLIC_RECEIPT_ORIGIN,
  buildFieldReceiptWhatsAppMessage,
  buildOfficeReceiptWhatsAppMessage,
  buildWhatsAppDeepLink,
  formatCustomerDisplayName,
  resolvePublicReceiptOrigin,
} from '../receiptWhatsApp';

describe('receiptWhatsApp (mensajes profesionales, minimalistas y sin localhost)', () => {
  it('formatea nombres en MAYÚSCULAS a formato limpio respetando siglas societarias', () => {
    expect(formatCustomerDisplayName('MARTIN MARCO ESTEBAN')).toBe('Martin Marco Esteban');
    expect(formatCustomerDisplayName('DISTRIBUIDORA DEL SUR S.R.L.')).toBe(
      'Distribuidora del Sur S.R.L.',
    );
    expect(formatCustomerDisplayName('   ')).toBe('Cliente');
  });

  it('jamás emite localhost en el origen público', () => {
    expect(resolvePublicReceiptOrigin('http://localhost:5174')).toBe(
      DEFAULT_PUBLIC_RECEIPT_ORIGIN,
    );
    expect(resolvePublicReceiptOrigin('http://127.0.0.1:5173')).toBe(
      DEFAULT_PUBLIC_RECEIPT_ORIGIN,
    );
    expect(resolvePublicReceiptOrigin('https://erp.donvenancio.com.ar/')).toBe(
      'https://erp.donvenancio.com.ar',
    );
  });

  it('genera mensaje limpio y estructurado para recibo de oficina con link firmado y código DV', () => {
    const text = buildOfficeReceiptWhatsAppMessage(
      {
        id: 52,
        receiptNumber: 'REC-00052',
        amount: 388108,
        paymentMethod: 'BANK_TRANSFER',
        createdAt: '2026-11-18T15:00:00.000Z',
        persona: { name: 'MARTIN MARCO ESTEBAN', phone: '3388123456' },
        bankAccount: { name: 'Banco Nación' },
        verificationCode: 'DV-8F3A-9C12',
        publicUrl: 'https://erp-dv-prueba-production.up.railway.app/recibo/52?v=8f3a9c12b4e17d05',
      },
      'http://localhost:5174',
    );

    expect(text).toContain('*Don Venancio* · Recibo de Cobro');
    expect(text).toContain('*N°:* REC-00052');
    expect(text).toContain('*Cliente:* Martin Marco Esteban');
    expect(text).toContain('*Medio:* Transferencia (Banco Nación)');
    expect(text).toContain('*Importe:* *$388.108*');
    expect(text).toContain(
      'https://erp-dv-prueba-production.up.railway.app/recibo/52?v=8f3a9c12b4e17d05',
    );
    expect(text).toContain('Verificación: `DV-8F3A-9C12`');
    expect(text).not.toContain('localhost');
  });

  it('genera mensaje limpio para recibo digital de calle sin localhost', () => {
    const text = buildFieldReceiptWhatsAppMessage(
      {
        receiptNumber: 'RC-00018',
        provisionalCode: 'PROV-1',
        totalAmount: 125000,
        capturedAt: '2026-11-18T15:00:00.000Z',
        pdfUrl: '/uploads/receipts/RC-00018.pdf',
        persona: { name: 'ALMACEN LA ESQUINA' },
        payments: [
          { paymentMethod: 'CASH' },
          { paymentMethod: 'CHECK', isEcheq: true },
        ],
      },
      'http://localhost:5174',
    );

    expect(text).toContain('*Don Venancio* · Recibo Digital');
    expect(text).toContain('*Cliente:* Almacen la Esquina');
    expect(text).toContain('*Medio:* Efectivo + E-Cheq');
    expect(text).toContain(`${DEFAULT_PUBLIC_RECEIPT_ORIGIN}/uploads/receipts/RC-00018.pdf`);
    expect(text).not.toContain('localhost');
  });

  it('construye deep link de WhatsApp normalizando teléfonos argentinos', () => {
    const url = buildWhatsAppDeepLink('03388 45-6789', 'Hola');
    expect(url).toBe('https://wa.me/5493388456789?text=Hola');
  });
});
