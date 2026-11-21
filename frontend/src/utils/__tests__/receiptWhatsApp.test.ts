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

  it('jamás emite localhost ni túneles temporales en el origen público', () => {
    expect(resolvePublicReceiptOrigin('http://localhost:5174')).toBe(
      DEFAULT_PUBLIC_RECEIPT_ORIGIN,
    );
    expect(resolvePublicReceiptOrigin('http://127.0.0.1:5173')).toBe(
      DEFAULT_PUBLIC_RECEIPT_ORIGIN,
    );
    expect(resolvePublicReceiptOrigin('https://briefs-ones.trycloudflare.com')).toBe(
      DEFAULT_PUBLIC_RECEIPT_ORIGIN,
    );
    expect(resolvePublicReceiptOrigin('https://erp.donvenancio.com.ar/')).toBe(
      'https://erp.donvenancio.com.ar',
    );
  });

  it('genera mensaje limpio para recibo de oficina sin link feo y con código único DV', () => {
    const text = buildOfficeReceiptWhatsAppMessage(
      {
        id: 52,
        receiptNumber: 'REC-00052',
        amount: 388108,
        paymentMethod: 'BANK_TRANSFER',
        createdAt: '2026-11-18T15:00:00.000Z',
        persona: { name: 'MARTIN MARCO ESTEBAN', phone: '3388123456' },
        bankAccount: { name: 'Banco Nación' },
        verificationCode: 'DV-8F3A-9C12-4B7E',
        publicUrl: 'https://erp-dv-prueba-production.up.railway.app/recibo/52?v=DV-8F3A-9C12-4B7E',
      },
      'http://localhost:5174',
    );

    expect(text).toContain('*Don Venancio* · Recibo de Cobro');
    expect(text).toContain('*N°:* REC-00052');
    expect(text).toContain('*Cliente:* Martin Marco Esteban');
    expect(text).toContain('*Medio:* Transferencia (Banco Nación)');
    expect(text).toContain('*Importe:* *$388.108*');
    expect(text).toContain('Código único: `DV-8F3A-9C12-4B7E`');
    expect(text).not.toContain('/recibo/');
    expect(text).not.toContain('localhost');
  });

  it('genera mensaje limpio para recibo digital de calle apuntando al recibo oficial /recibo/:id sin localhost', () => {
    const text = buildFieldReceiptWhatsAppMessage(
      {
        receiptNumber: 'RC-00018',
        provisionalCode: 'PROV-1',
        totalAmount: 125000,
        capturedAt: '2026-11-18T15:00:00.000Z',
        pdfUrl: '/uploads/receipts/RC-00018.pdf',
        publicUrl: '/recibo/18?v=DV-1A2B-3C4D-5E6F',
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
    expect(text).toContain(
      `${DEFAULT_PUBLIC_RECEIPT_ORIGIN}/recibo/18?v=DV-1A2B-3C4D-5E6F`,
    );
    expect(text).not.toContain('/uploads/receipts/');
    expect(text).not.toContain('localhost');
  });

  it('construye deep link de WhatsApp normalizando teléfonos argentinos', () => {
    const url = buildWhatsAppDeepLink('03388 45-6789', 'Hola');
    expect(url).toBe('https://wa.me/5493388456789?text=Hola');
  });
});
