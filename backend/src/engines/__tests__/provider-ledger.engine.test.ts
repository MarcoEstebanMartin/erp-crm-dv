import { describe, expect, it } from 'vitest';
import {
  buildProviderStatementRows,
  computeProviderBalanceView,
  formatSupplierCuit,
} from '../provider-ledger.engine';

describe('provider-ledger.engine — Normalización de CUIT, Saldos y Estado de Cuenta', () => {
  it('formatSupplierCuit formatea 11 dígitos con guiones y respeta vacíos o valores cortos', () => {
    expect(formatSupplierCuit('30555386997')).toBe('30-55538699-7');
    expect(formatSupplierCuit('30-50121427-9')).toBe('30-50121427-9');
    expect(formatSupplierCuit('   ')).toBeNull();
    expect(formatSupplierCuit(null)).toBeNull();
    expect(formatSupplierCuit(undefined)).toBeNull();
    expect(formatSupplierCuit('123456')).toBe('123456');
  });

  it('computeProviderBalanceView interpreta saldo negativo como deuda a pagar y positivo como saldo a favor', () => {
    expect(computeProviderBalanceView({ outstandingBalance: '-150000.50' })).toEqual({
      payableBalance: 150000.5,
      favorBalance: 0,
      netSupplierBalance: -150000.5,
    });

    expect(computeProviderBalanceView({ outstandingBalance: '25000.25' })).toEqual({
      payableBalance: 0,
      favorBalance: 25000.25,
      netSupplierBalance: 25000.25,
    });

    expect(computeProviderBalanceView({ outstandingBalance: '0.00' })).toEqual({
      payableBalance: 0,
      favorBalance: 0,
      netSupplierBalance: 0,
    });
  });

  it('computeProviderBalanceView aísla movimientos de proveedor en personas con doble rol Cliente + Proveedor', () => {
    // Ejemplo real: cliente nos debe $388.108 (outstandingBalance = +388108), pero como proveedor está en $0
    expect(
      computeProviderBalanceView({
        outstandingBalance: '388108',
        isClient: true,
        providerCredits: '0',
        providerDebits: '0',
      }),
    ).toEqual({
      payableBalance: 0,
      favorBalance: 0,
      netSupplierBalance: 0,
    });

    // Doble rol con facturas de compra por $100.000 y pagos por $40.000 -> debemos $60.000
    expect(
      computeProviderBalanceView({
        outstandingBalance: '328108',
        isClient: true,
        providerCredits: '100000',
        providerDebits: '40000',
      }),
    ).toEqual({
      payableBalance: 60000,
      favorBalance: 0,
      netSupplierBalance: -60000,
    });
  });

  it('buildProviderStatementRows calcula saldos acumulados con Decimal.js y filtra ventas en doble rol', () => {
    const mixedLedger = [
      {
        id: 'order-901',
        type: 'DEBIT',
        sourceType: 'ORDER_INVOICE',
        reference: 'Factura Venta #901',
        description: 'Venta cliente',
        amount: 388108,
      },
      {
        id: 'supplier-invoice-10',
        type: 'CREDIT',
        sourceType: 'SUPPLIER_INVOICE',
        reference: 'Factura Nro 0001-00001234',
        description: 'Compra - Factura A',
        amount: 120500.45,
      },
      {
        id: 'transaction-55',
        type: 'DEBIT',
        sourceType: 'SUPPLIER_PAYMENT',
        reference: 'Pago #55',
        description: 'Pago parcial transferencia',
        amount: 50000.15,
      },
    ];

    const dualRows = buildProviderStatementRows(mixedLedger, true);
    expect(dualRows).toHaveLength(2);
    expect(dualRows[0]).toMatchObject({
      kindLabel: 'Factura',
      compraAmount: 120500.45,
      pagoAmount: 0,
      runningPayable: 120500.45,
    });
    expect(dualRows[1]).toMatchObject({
      kindLabel: 'Pago',
      compraAmount: 0,
      pagoAmount: 50000.15,
      runningPayable: 70500.3,
    });
  });
});
