import { describe, expect, it } from 'vitest';
import { computeDebtorFifoMetrics } from '../persona-debtors.engine';

describe('persona-debtors.engine (Motor Puro FIFO con Decimal.js)', () => {
  it('devuelve métricas en cero cuando el saldo pendiente es cero o acreedor (negativo)', () => {
    const zeroBalance = computeDebtorFifoMetrics({
      outstandingBalance: 0,
      orders: [
        {
          id: 1,
          billingType: 'OFFICIAL',
          totalAmount: 15000,
          directIncomeSum: 0,
          directCreditNoteSum: 0,
        },
      ],
      unallocatedOfficialCredit: 0,
      unallocatedInternalCredit: 0,
    });

    expect(zeroBalance).toEqual({
      outstandingBalance: 0,
      debtA: 0,
      debtX: 0,
      pendingInvoicesCount: 0,
      hasMultiplePendingInvoices: false,
    });

    const negativeBalance = computeDebtorFifoMetrics({
      outstandingBalance: -1500.4,
      orders: [],
      unallocatedOfficialCredit: 0,
      unallocatedInternalCredit: 0,
    });

    expect(negativeBalance).toEqual({
      outstandingBalance: 0,
      debtA: 0,
      debtX: 0,
      pendingInvoicesCount: 0,
      hasMultiplePendingInvoices: false,
    });
  });

  it('aplica FIFO cronológico por sucursal independiente (OFFICIAL vs INTERNAL)', () => {
    const result = computeDebtorFifoMetrics({
      outstandingBalance: 25000,
      orders: [
        {
          id: 10,
          billingType: 'OFFICIAL',
          totalAmount: 10000,
          directIncomeSum: 0,
          directCreditNoteSum: 0,
        },
        {
          id: 11,
          billingType: 'OFFICIAL',
          totalAmount: 15000,
          directIncomeSum: 0,
          directCreditNoteSum: 0,
        },
        {
          id: 12,
          billingType: 'INTERNAL',
          totalAmount: 10000,
          directIncomeSum: 0,
          directCreditNoteSum: 0,
        },
      ],
      // Cancela completamente el pedido #10 ($10.000) y deja saldo completo en #11 ($15.000)
      unallocatedOfficialCredit: 10000,
      // El crédito interno no tiene más pedidos que saldar con exceso y no toca #11 OFFICIAL
      unallocatedInternalCredit: 0,
    });

    expect(result.outstandingBalance).toBe(25000);
    expect(result.debtA).toBe(15000);
    expect(result.debtX).toBe(10000);
    expect(result.pendingInvoicesCount).toBe(2);
    expect(result.hasMultiplePendingInvoices).toBe(true);
    expect(result.debtA + result.debtX).toBe(result.outstandingBalance);
  });

  it('descuenta cobros directos y notas de crédito aprobadas aplicando umbral > 0.5', () => {
    const result = computeDebtorFifoMetrics({
      outstandingBalance: 8500,
      orders: [
        {
          id: 21,
          billingType: 'INTERNAL',
          totalAmount: 10000,
          directIncomeSum: 7000,
          directCreditNoteSum: 2999.6, // deuda restante 0.4 <= 0.5 => saldada
        },
        {
          id: 22,
          billingType: 'INTERNAL',
          totalAmount: 8500,
          directIncomeSum: 0,
          directCreditNoteSum: 0,
        },
      ],
      unallocatedOfficialCredit: 0,
      unallocatedInternalCredit: 0,
    });

    expect(result.pendingInvoicesCount).toBe(1);
    expect(result.hasMultiplePendingInvoices).toBe(false);
    expect(result.debtA).toBe(0);
    expect(result.debtX).toBe(8500);
  });

  it('garantiza invariante debtA + debtX === roundToIntegerPeso(outstandingBalance) sin deriva Float', () => {
    // Caso propenso a deriva IEEE-754: 1/3 y 2/3 sobre saldo con decimales .5 (ROUND_HALF_UP)
    const result = computeDebtorFifoMetrics({
      outstandingBalance: '10000.50',
      orders: [
        {
          id: 31,
          billingType: 'OFFICIAL',
          totalAmount: '100.10',
          directIncomeSum: 0,
          directCreditNoteSum: 0,
        },
        {
          id: 32,
          billingType: 'INTERNAL',
          totalAmount: '200.20',
          directIncomeSum: 0,
          directCreditNoteSum: 0,
        },
      ],
      unallocatedOfficialCredit: 0,
      unallocatedInternalCredit: 0,
    });

    expect(result.outstandingBalance).toBe(10001);
    expect(result.debtA).toBe(3334);
    expect(result.debtX).toBe(6667);
    expect(result.debtA + result.debtX).toBe(result.outstandingBalance);
  });
});
