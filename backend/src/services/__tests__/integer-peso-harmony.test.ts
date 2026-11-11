import { describe, it, expect, vi } from 'vitest';
import {
  BillingType,
  LedgerEntryType,
  LedgerSourceType,
  PaymentMethod,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import { computeRubroProductsPriceUpdates } from '../catalog/rubro.service';
import {
  computeInvoiceTaxBreakdown,
  settleOrderFinancials,
} from '../orders/order-tax.helpers';
import { recordLedgerMovement } from '../ledger/account-ledger.service';

describe('Paso M1 — Armonía de Pesos Enteros en Precios y Cuenta Corriente + Doble Capa ARCA', () => {
  it('computeRubroProductsPriceUpdates recalcula listas A/B/C en pesos enteros exactos y respeta margen propio', () => {
    const products = [
      {
        id: 1,
        costPrice: '3456.78',
        listPrice: '4320',
        listPriceB: '4104', // 0.95
        listPriceC: '3888', // 0.90
        profitMargin: null,
      },
      {
        id: 2,
        costPrice: '5000.00',
        listPrice: '6000',
        listPriceB: '5820', // ratio personalizado 0.97 (-3% Melincué)
        listPriceC: '5700', // ratio personalizado 0.95 (-5% Melincué)
        profitMargin: null,
      },
      {
        id: 3,
        costPrice: '2000.00',
        listPrice: '3000',
        listPriceB: '2850',
        listPriceC: '2700',
        profitMargin: '1.50', // margen propio -> no debe tocarse
      },
    ];

    const updates = computeRubroProductsPriceUpdates(products, '1.35');

    expect(updates).toHaveLength(2);

    // Producto 1: 3456.78 * 1.35 = 4666.653 -> $4667 entero (0 centavos)
    expect(updates[0]).toEqual({
      id: 1,
      listPrice: 4667,
      listPriceB: 4434, // 4667 * 0.95 = 4433.65 -> 4434
      listPriceC: 4200, // 4667 * 0.90 = 4200.30 -> 4200
    });
    expect(Number.isInteger(updates[0].listPrice)).toBe(true);
    expect(Number.isInteger(updates[0].listPriceB)).toBe(true);
    expect(Number.isInteger(updates[0].listPriceC)).toBe(true);

    // Producto 2: 5000 * 1.35 = 6750; preserva ratios 0.97 y 0.95 -> 6548 y 6413 enteros
    expect(updates[1]).toEqual({
      id: 2,
      listPrice: 6750,
      listPriceB: 6548, // 6750 * 0.97 = 6547.5 -> 6548 (ROUND_HALF_UP)
      listPriceC: 6413, // 6750 * 0.95 = 6412.5 -> 6413 (ROUND_HALF_UP)
    });
  });

  it('Factura A con Percepción IIBB mantiene 2 decimales exactos para ARCA pero asienta Pesos Enteros en Cuenta Corriente (saldo $0 al cobrar)', async () => {
    vi.spyOn(prisma.perceptionType, 'findUnique').mockResolvedValue(null);

    // Venta comercial base $100.000 a Responsable Inscripto con 3% IIBB
    const taxInfo = await computeInvoiceTaxBreakdown(100000, BillingType.OFFICIAL, {
      cuit: '30-71234567-9',
      iibbAliquot: '3.00',
    });

    // 1. Capa Fiscal ARCA: Neto (82644.63) + IVA (17355.37) + IIBB 3% (2479.34) = 102479.34 exacto
    expect(taxInfo.net).toBe(82644.63);
    expect(taxInfo.tax).toBe(17355.37);
    expect(taxInfo.percepIIBB).toBe(2479.34);
    expect(taxInfo.finalTotal).toBe(102479.34);

    // 2. Capa Comercial / Cuenta Corriente: entra $102.479 entero y al cobrar $102.479 queda $0 clavado
    let clientBalance = 0;
    const ledgerEntries: any[] = [];
    const createdTxs: any[] = [];

    const mockTx: any = {
      bankAccount: { update: vi.fn().mockResolvedValue({}) },
      persona: {
        update: vi.fn().mockImplementation(({ data }) => {
          if (data.outstandingBalance.increment) clientBalance += data.outstandingBalance.increment;
          if (data.outstandingBalance.decrement) clientBalance -= data.outstandingBalance.decrement;
          return Promise.resolve({ id: 55, outstandingBalance: clientBalance.toFixed(2) });
        }),
      },
      transaction: {
        create: vi.fn().mockImplementation(({ data }) => {
          const row = { id: 701, movementId: 701, ...data };
          createdTxs.push(row);
          return Promise.resolve(row);
        }),
      },
      accountLedger: {
        create: vi.fn().mockImplementation(({ data }) => {
          ledgerEntries.push(data);
          return Promise.resolve({ id: ledgerEntries.length, ...data });
        }),
      },
    };

    await settleOrderFinancials(mockTx, {
      orderId: 900,
      personaId: 55,
      adminId: 1,
      billingType: BillingType.OFFICIAL,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amount: taxInfo.finalTotal, // 102479.34 desde flujo fiscal
      invoiceTotal: taxInfo.finalTotal,
      invoiceNumber: '00001-00000900',
      description: 'Transferencia Factura A',
      bankAccountId: 2,
    });

    expect(ledgerEntries[0].amount).toBe(102479);
    expect(createdTxs[0].amount).toBe(102479);
    expect(ledgerEntries[1].amount).toBe(102479);
    expect(clientBalance).toBe(0);
  });

  it('preserva 2 decimales exactos en facturas de proveedores y retenciones legales', async () => {
    let supplierBalance = 0;
    const mockTx: any = {
      persona: {
        update: vi.fn().mockImplementation(({ data }) => {
          if (data.outstandingBalance.increment) supplierBalance += data.outstandingBalance.increment;
          if (data.outstandingBalance.decrement) supplierBalance -= data.outstandingBalance.decrement;
          return Promise.resolve({ id: 88, outstandingBalance: supplierBalance.toFixed(2) });
        }),
      },
      accountLedger: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
      },
    };

    const res = await recordLedgerMovement(mockTx, {
      personaId: 88,
      entryType: LedgerEntryType.CREDIT,
      sourceType: LedgerSourceType.SUPPLIER_INVOICE,
      billingType: BillingType.OFFICIAL,
      amount: '458120.65',
      supplierInvoiceId: 12,
      reference: 'Compra #12',
      description: 'Factura Proveedor F-0001-00099123',
    });

    expect(res?.entry.amount).toBe(458120.65);
    expect(res?.balanceAfter).toBe(-458120.65);
  });
});
