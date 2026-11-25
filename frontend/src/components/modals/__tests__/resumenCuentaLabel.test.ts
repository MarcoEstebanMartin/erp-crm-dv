import { describe, expect, it } from 'vitest';
import { formatMovementLabel } from '../ResumenCuentaModal';
import { buildResumenRows, formatSignedCurrency } from '../resumenCuenta.utils';

describe('ResumenCuentaModal — formatMovementLabel', () => {
  it('muestra únicamente el número de recibo para cobros en el Haber (con receiptNumber explícito)', () => {
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
    ).toBe('REC-00145');
  });

  it('muestra únicamente el número de recibo cuando el cobro fue en mostrador con cheque o factura directa sin receiptNumber', () => {
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
    ).toBe('REC-01033');

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
    ).toBe('REC-01064');
  });

  it('omite la palabra Factura/Fc. dejando solo el código del comprobante', () => {
    expect(
      formatMovementLabel({
        id: 'order-100',
        sourceType: 'ORDER_INVOICE',
        description: 'Factura INT-00100',
        debit: 178496,
        credit: 0,
      }),
    ).toBe('INT-00100');

    expect(
      formatMovementLabel({
        id: 'order-101',
        sourceType: 'ORDER_INVOICE',
        description: 'Factura A 0001-00000105',
        debit: 356992,
        credit: 0,
      }),
    ).toBe('A 0001-0105');
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

describe('ResumenCuentaModal — buildResumenRows y saldo acumulado', () => {
  it('calcula el saldo acumulado sumando DEBE y restando HABER (incluyendo saldos a favor negativos)', () => {
    const ledger = [
      { id: 'order-1', type: 'DEBIT', amount: 30692, date: '2026-11-16T10:00:00.000Z', description: 'Factura 0001-0001' },
      { id: 'transaction-1', type: 'CREDIT', amount: 50000, date: '2026-11-16T11:00:00.000Z', description: 'Recibo REC-00001' },
      { id: 'order-2', type: 'DEBIT', amount: 44624, date: '2026-11-20T09:00:00.000Z', description: 'Factura INT-00091' },
      { id: 'order-3', type: 'DEBIT', amount: 24520, date: '2026-11-20T10:00:00.000Z', description: 'Factura 0001-0009' },
    ];

    const result = buildResumenRows(ledger, {
      branchFilter: 'ALL',
      dateRange: 'all',
      now: new Date('2026-11-20T15:00:00.000Z'),
    });

    expect(result.hasPriorEntries).toBe(false);
    expect(result.priorBalance).toBe(0);
    expect(result.rows.map((r) => r.balance)).toEqual([30692, -19308, 25316, 49836]);
    expect(result.finalBalance).toBe(49836);
  });

  it('conserva el saldo anterior acumulado al filtrar por rango de fechas para que el saldo final no se altere', () => {
    const ledger = [
      { id: 'order-old', type: 'DEBIT', amount: 15000, date: '2026-09-01T10:00:00.000Z', description: 'Factura INT-00001' },
      { id: 'tx-old', type: 'CREDIT', amount: 5000, date: '2026-09-10T10:00:00.000Z', description: 'Recibo REC-00001' },
      { id: 'order-recent', type: 'DEBIT', amount: 20000, date: '2026-11-18T10:00:00.000Z', description: 'Factura INT-00002' },
      { id: 'tx-recent', type: 'CREDIT', amount: 8000, date: '2026-11-19T10:00:00.000Z', description: 'Recibo REC-00002' },
    ];

    const result = buildResumenRows(ledger, {
      branchFilter: 'ALL',
      dateRange: '30days',
      now: new Date('2026-11-20T12:00:00.000Z'),
    });

    expect(result.hasPriorEntries).toBe(true);
    expect(result.priorBalance).toBe(10000);
    expect(result.rows.map((r) => r.balance)).toEqual([30000, 22000]);
    expect(result.finalBalance).toBe(22000);
  });

  it('formatea correctamente saldos positivos, negativos y cero', () => {
    expect(formatSignedCurrency(49836)).toBe('$49.836');
    expect(formatSignedCurrency(-25480)).toBe('-$25.480');
    expect(formatSignedCurrency(0)).toBe('$0');
  });

  it('oculta pares de recibo anulado + reversión por defecto manteniendo saldo idéntico y los muestra si includeVoided=true', () => {
    const ledger = [
      { id: 'order-1', type: 'DEBIT', amount: 100000, date: '2026-11-20T09:00:00.000Z', description: 'Factura INT-00010' },
      { id: 'transaction-979', type: 'CREDIT', sourceType: 'COLLECTION_RECEIPT', isVoided: true, amount: 79726, date: '2026-11-25T10:00:00.000Z', description: 'Recibo REC-00979' },
      { id: 'ledger-980', type: 'DEBIT', sourceType: 'RECEIPT_REVERSAL', isVoided: true, amount: 79726, date: '2026-11-25T10:05:00.000Z', description: 'Reversión Recibo REC-00979' },
      { id: 'transaction-981', type: 'CREDIT', sourceType: 'COLLECTION_RECEIPT', isVoided: false, amount: 25000, date: '2026-11-25T11:00:00.000Z', description: 'Recibo REC-00981' },
    ];

    const clean = buildResumenRows(ledger, {
      branchFilter: 'ALL',
      dateRange: 'all',
      now: new Date('2026-11-25T15:00:00.000Z'),
    });

    expect(clean.hasVoidedEntries).toBe(true);
    expect(clean.rows.map((r) => r.id)).toEqual(['order-1', 'transaction-981']);
    expect(clean.finalBalance).toBe(75000);

    const withVoided = buildResumenRows(ledger, {
      branchFilter: 'ALL',
      dateRange: 'all',
      includeVoided: true,
      now: new Date('2026-11-25T15:00:00.000Z'),
    });

    expect(withVoided.rows).toHaveLength(4);
    expect(withVoided.finalBalance).toBe(75000);
  });
});
