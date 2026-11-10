import { describe, it, expect } from 'vitest';
import {
  computeNextLedgerBalance,
  computeRunningBalances,
  computeReconciliationAdjustment,
} from '../account-ledger.engine';

describe('account-ledger.engine (Motor Puro Decimal.js)', () => {
  it('calcula saldo siguiente para DEBIT y CREDIT en cuenta corriente de cliente', () => {
    const step1 = computeNextLedgerBalance(0, 'DEBIT', 125000);
    expect(step1).toEqual({ normalizedAmount: 125000, nextBalance: 125000 });

    const step2 = computeNextLedgerBalance(step1.nextBalance, 'CREDIT', 50000);
    expect(step2).toEqual({ normalizedAmount: 50000, nextBalance: 75000 });

    const step3 = computeNextLedgerBalance(step2.nextBalance, 'CREDIT', 75000);
    expect(step3).toEqual({ normalizedAmount: 75000, nextBalance: 0 });
  });

  it('respeta la convención universal en proveedores (CREDIT factura negativa, DEBIT pago acerca a cero)', () => {
    const inv = computeNextLedgerBalance(0, 'CREDIT', '184520.55');
    expect(inv).toEqual({ normalizedAmount: 184520.55, nextBalance: -184520.55 });

    const pay = computeNextLedgerBalance(inv.nextBalance, 'DEBIT', '84520.55');
    expect(pay).toEqual({ normalizedAmount: 84520.55, nextBalance: -100000 });
  });

  it('rechaza montos nulos o negativos', () => {
    expect(() => computeNextLedgerBalance(0, 'DEBIT', 0)).toThrow(/mayor a 0/);
    expect(() => computeNextLedgerBalance(100, 'CREDIT', -50)).toThrow(/mayor a 0/);
  });

  it('calcula saldos corridos sin deriva de punto flotante IEEE-754', () => {
    const { items, finalBalance } = computeRunningBalances([
      { entryType: 'DEBIT', amount: '0.10' },
      { entryType: 'DEBIT', amount: '0.20' },
      { entryType: 'CREDIT', amount: '0.30' },
    ]);

    expect(items.map((i) => i.runningBalance)).toEqual([0.1, 0.3, 0]);
    expect(finalBalance).toBe(0);
  });

  it('calcula asiento de conciliación / saldo inicial exacto para clientes y proveedores', () => {
    expect(computeReconciliationAdjustment(10000, 10000)).toEqual({
      needed: false,
      entryType: 'DEBIT',
      amount: 0,
      difference: 0,
    });

    // Cliente tenía deuda previa de $45.000 antes de cargar pedidos al sistema
    expect(computeReconciliationAdjustment(0, 45000)).toEqual({
      needed: true,
      entryType: 'DEBIT',
      amount: 45000,
      difference: 45000,
    });

    // Proveedor tenía saldo acreedor previo de -$120.000,50
    expect(computeReconciliationAdjustment(0, -120000.5)).toEqual({
      needed: true,
      entryType: 'CREDIT',
      amount: 120000.5,
      difference: -120000.5,
    });
  });
});
