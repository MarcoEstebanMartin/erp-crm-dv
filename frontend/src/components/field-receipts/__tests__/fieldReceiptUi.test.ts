import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fieldReceiptToPublicData } from '../FieldTodayReceiptsCard';
import type { FieldReceiptDTO } from '../../../api/fieldReceipts.api';

const baseReceipt: FieldReceiptDTO = {
  id: 42,
  receiptNumber: 'REC-C-0000042',
  provisionalCode: 'PROV-10-XYZ',
  personaId: 7,
  persona: { id: 7, name: 'ALMACEN DON PEDRO', phone: '3454123456' },
  totalAmount: 15000,
  status: 'ISSUED',
  capturedAt: '2026-11-21T12:00:00.000Z',
  whatsappStatus: 'PENDING',
  whatsappError: null,
  pdfUrl: '/uploads/receipts/REC-C-0000042.pdf',
  payments: [
    {
      id: 1,
      paymentMethod: 'CASH',
      amount: 15000,
      status: 'IN_TRANSIT',
      bankAccountId: null,
      transferReference: null,
      proofImageUrl: null,
      checkBank: null,
      checkNumber: null,
      checkDueDate: null,
      checkFrontImageUrl: null,
      isEcheq: false,
      rejectionReason: null,
    },
  ],
};

describe('Recibos de Vendedores (UI y PDF moderno)', () => {
  it('convierte un FieldReceiptDTO en PublicReceiptData limpio para el PDF moderno', () => {
    const mapped = fieldReceiptToPublicData(baseReceipt);
    expect(mapped.id).toBe(42);
    expect(mapped.receiptNumber).toBe('REC-C-0000042');
    expect(mapped.amount).toBe(15000);
    expect(mapped.paymentMethod).toBe('CASH');
    expect(mapped.description).toBe('Pago a cuenta corriente');
    expect(mapped.verificationCode).toBe('PROV-10-XYZ');
    expect(mapped.persona?.name).toBe('ALMACEN DON PEDRO');
  });

  it('incluye el detalle de medios múltiples o cheque en la descripción del PDF', () => {
    const multi = fieldReceiptToPublicData({
      ...baseReceipt,
      payments: [
        ...baseReceipt.payments,
        {
          ...baseReceipt.payments[0],
          id: 2,
          paymentMethod: 'CHECK',
          amount: 5000,
          checkBank: 'Nación',
          checkNumber: '987654',
        },
      ],
    });
    expect(multi.description).toContain('Cheque N° 987654');

    const mixed = fieldReceiptToPublicData({
      ...baseReceipt,
      payments: [
        ...baseReceipt.payments,
        {
          ...baseReceipt.payments[0],
          id: 3,
          paymentMethod: 'BANK_TRANSFER',
          amount: 5000,
        },
      ],
    });
    expect(mixed.description).toBe('Pago a cuenta corriente (Efectivo + Transferencia)');
  });

  it('usa NativeModalDialog centrado en FieldCollectModal y mantiene todos los archivos bajo 450 líneas', () => {
    const dir = path.resolve(__dirname, '..');
    const modalSrc = fs.readFileSync(path.join(dir, 'FieldCollectModal.tsx'), 'utf8');
    const pageSrc = fs.readFileSync(path.join(dir, 'FieldCollectionPage.tsx'), 'utf8');
    const rowSrc = fs.readFileSync(path.join(dir, 'FieldCollectPaymentRow.tsx'), 'utf8');
    const cardSrc = fs.readFileSync(path.join(dir, 'FieldTodayReceiptsCard.tsx'), 'utf8');
    const waModalSrc = fs.readFileSync(path.join(dir, 'ReceiptWhatsAppSendModal.tsx'), 'utf8');

    expect(modalSrc).toContain('NativeModalDialog');
    expect(modalSrc).not.toMatch(/<dialog\b/);

    // El vendedor solo puede enviar por WhatsApp (sin botón de descarga PDF directo) para capturar números
    expect(pageSrc).not.toContain('downloadReceiptPdf');
    expect(cardSrc).not.toContain('downloadReceiptPdf');
    expect(waModalSrc).not.toContain('downloadReceiptPdf');

    // Recibos de hoy aparece antes del buscador/listado de 60 clientes
    expect(pageSrc.indexOf('<FieldTodayReceiptsCard')).toBeGreaterThan(-1);
    expect(pageSrc.indexOf('<FieldTodayReceiptsCard')).toBeLessThan(pageSrc.indexOf('<search'));

    expect(modalSrc.split('\n').length).toBeLessThanOrEqual(450);
    expect(pageSrc.split('\n').length).toBeLessThanOrEqual(450);
    expect(rowSrc.split('\n').length).toBeLessThanOrEqual(450);
    expect(cardSrc.split('\n').length).toBeLessThanOrEqual(450);
    expect(waModalSrc.split('\n').length).toBeLessThanOrEqual(450);
  });
});
