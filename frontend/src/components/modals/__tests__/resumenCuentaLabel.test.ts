import { describe, expect, it } from 'vitest';
import { formatMovementLabel } from '../ResumenCuentaModal';

describe('ResumenCuentaModal — formatMovementLabel', () => {
  it('muestra únicamente Recibo + número para cobros en el Haber (con receiptNumber explícito)', () => {
    expect(
      formatMovementLabel({
        id: 'transaction-88',
        sourceType: 'COLLECTION_RECEIPT',
        receiptNumber: 'REC-00145',
        description: 'Recibo N° REC-00145 - Arqueo de Caja (Cheque #123)',
        reference: 'Recibo #88',
        movementId: 1033,
        debit: 0,
        credit: 178496,
      }),
    ).toBe('Recibo REC-00145');
  });

  it('muestra únicamente Recibo + número cuando el cobro fue en mostrador con cheque o factura directa sin receiptNumber', () => {
    expect(
      formatMovementLabel({
        id: 'transaction-90',
        sourceType: 'COLLECTION_RECEIPT',
        receiptNumber: null,
        description: 'Cheque N° 1233333 (Emisor: Pedro Perez2 (Echeq)) recibido en mostrador por factura #100 (INT-00100)',
        reference: 'Recibo #90',
        movementId: 1033,
        debit: 0,
        credit: 178496,
      }),
    ).toBe('Recibo REC-01033');

    expect(
      formatMovementLabel({
        id: 'transaction-91',
        sourceType: 'COLLECTION_RECEIPT',
        receiptNumber: null,
        description: 'Cobro de Factura INT-00105',
        reference: 'Recibo #91',
        movementId: 1064,
        debit: 0,
        credit: 356992,
      }),
    ).toBe('Recibo REC-01064');
  });

  it('abrevia Factura como Fc. para comprobantes internos y oficiales', () => {
    expect(
      formatMovementLabel({
        id: 'order-100',
        sourceType: 'ORDER_INVOICE',
        description: 'Factura INT-00100',
        debit: 178496,
        credit: 0,
      }),
    ).toBe('Fc. INT-00100');

    expect(
      formatMovementLabel({
        id: 'order-101',
        sourceType: 'ORDER_INVOICE',
        description: 'Factura A 0001-00000105',
        debit: 356992,
        credit: 0,
      }),
    ).toBe('Fc. A 0001-0105');
  });

  it('preserva etiquetas de Notas de Crédito y Retenciones sin convertirlas en Recibo', () => {
    expect(
      formatMovementLabel({
        id: 'credit-note-12',
        sourceType: 'CREDIT_NOTE',
        description: 'Nota de Crédito INT-00012',
        debit: 0,
        credit: 5000,
      }),
    ).toBe('Nota de Crédito INT-00012');

    expect(
      formatMovementLabel({
        id: 'withholding-4',
        sourceType: 'TAX_WITHHOLDING',
        description: 'Retención IIBB #4455',
        debit: 0,
        credit: 1200,
      }),
    ).toBe('Retención IIBB #4455');
  });
});
