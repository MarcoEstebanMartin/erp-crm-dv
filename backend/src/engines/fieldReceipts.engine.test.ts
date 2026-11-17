import { describe, expect, it } from 'vitest';
import {
  computeBalanceAfterReceipt,
  computeCollectorSettlementSummary,
  computeReceiptBreakdown,
  computeReversalAmount,
  evaluateSettlementArqueo,
} from './fieldReceipts.engine';

describe('fieldReceipts.engine — Motor Matemático de Recibos en Calle', () => {
  it('calcula recibo combinado (efectivo + transferencia + cheque) en pesos enteros', () => {
    const result = computeReceiptBreakdown([
      { paymentMethod: 'CASH', amount: 45000.4 },
      { paymentMethod: 'BANK_TRANSFER', amount: 30000.6 },
      { paymentMethod: 'CHECK', amount: 25000 },
    ]);

    expect(result.totalAmount.toNumber()).toBe(100001);
    expect(result.cashAmount.toNumber()).toBe(45000);
    expect(result.transferAmount.toNumber()).toBe(30001);
    expect(result.checkAmount.toNumber()).toBe(25000);
    expect(result.initialReceiptStatus).toBe('PENDING_VERIFICATION');
    expect(result.payments.map((p) => p.initialStatus)).toEqual([
      'IN_TRANSIT',
      'PENDING_BANK',
      'IN_TRANSIT',
    ]);
  });

  it('emite como ISSUED cuando no hay transferencias pendientes', () => {
    const result = computeReceiptBreakdown([
      { paymentMethod: 'CASH', amount: 120000 },
    ]);

    expect(result.initialReceiptStatus).toBe('ISSUED');
    expect(result.totalAmount.toNumber()).toBe(120000);
  });

  it('rechaza recibos sin pagos o con montos <= 0', () => {
    expect(() => computeReceiptBreakdown([])).toThrow();
    expect(() =>
      computeReceiptBreakdown([{ paymentMethod: 'CASH', amount: 0 }]),
    ).toThrow();
    expect(() =>
      computeReceiptBreakdown([{ paymentMethod: 'CHECK', amount: -500 }]),
    ).toThrow();
  });

  it('soporta pagos parciales y pagos a cuenta (saldo a favor negativo)', () => {
    // Pago parcial sobre deuda de $150.000
    expect(computeBalanceAfterReceipt(150000, 60000).toNumber()).toBe(90000);
    // Pago a cuenta mayor a la deuda actual -> saldo a favor -$20.000
    expect(computeBalanceAfterReceipt(80000, 100000).toNumber()).toBe(-20000);
  });

  it('calcula la rendición diaria ignorando recibos anulados y pagos rechazados', () => {
    const summary = computeCollectorSettlementSummary([
      {
        status: 'ISSUED',
        payments: [
          { paymentMethod: 'CASH', amount: 50000, status: 'IN_TRANSIT' },
          { paymentMethod: 'CHECK', amount: 80000, status: 'IN_TRANSIT' },
        ],
      },
      {
        status: 'PENDING_VERIFICATION',
        payments: [
          { paymentMethod: 'BANK_TRANSFER', amount: 40000, status: 'PENDING_BANK' },
          { paymentMethod: 'BANK_TRANSFER', amount: 25000, status: 'CLEARED' },
        ],
      },
      {
        // Anulado: no debe sumar
        status: 'VOIDED',
        payments: [{ paymentMethod: 'CASH', amount: 99999, status: 'IN_TRANSIT' }],
      },
      {
        // Pago rechazado: no debe sumar
        status: 'ISSUED',
        payments: [{ paymentMethod: 'CHECK', amount: 15000, status: 'REJECTED' }],
      },
    ]);

    expect(summary.expectedCash.toNumber()).toBe(50000);
    expect(summary.expectedChecksCount).toBe(1);
    expect(summary.expectedChecksAmount.toNumber()).toBe(80000);
    expect(summary.pendingTransfersAmount.toNumber()).toBe(40000);
    expect(summary.clearedTransfersAmount.toNumber()).toBe(25000);
    expect(summary.totalValidCollected.toNumber()).toBe(195000);
  });

  it('evalúa arqueo exacto, faltante y sobrante de efectivo', () => {
    const exact = evaluateSettlementArqueo(50000, 50000);
    expect(exact.status).toBe('APPROVED');
    expect(exact.cashDifference.toNumber()).toBe(0);

    const shortage = evaluateSettlementArqueo(50000, 48500);
    expect(shortage.status).toBe('DISCREPANCY');
    expect(shortage.cashDifference.toNumber()).toBe(-1500);

    const surplus = evaluateSettlementArqueo(50000, 51000);
    expect(surplus.status).toBe('DISCREPANCY');
    expect(surplus.cashDifference.toNumber()).toBe(1000);
  });

  it('calcula reversión exacta ante rechazo de cheque/transferencia o anulación', () => {
    expect(computeReversalAmount(85000).toNumber()).toBe(85000);
    expect(() => computeReversalAmount(0)).toThrow();
  });
});
