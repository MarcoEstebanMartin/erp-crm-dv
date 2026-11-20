import { describe, expect, it } from 'vitest';
import { BillingType } from '../../../utils/types';
import {
  buildBatchOrderWeightItems,
  resolvePreparingQueueOrders,
  summarizeBatchInvoiceResults,
  type BatchInvoiceResult,
} from '../fulfillmentQueue.helper';

describe('fulfillmentQueue.helper', () => {
  it('selecciona los pedidos marcados preservando el orden visible de la lista', () => {
    const preparing = [{ id: 108 }, { id: 107 }, { id: 103 }, { id: 102 }];
    const selected = resolvePreparingQueueOrders(preparing, [102, 108]);
    expect(selected.map((o) => o.id)).toEqual([108, 102]);
  });

  it('si no hay selección explícita, toma todos los pedidos visibles en armado', () => {
    const preparing = [{ id: 108 }, { id: 107 }];
    const selected = resolvePreparingQueueOrders(preparing, []);
    expect(selected.map((o) => o.id)).toEqual([108, 107]);
  });

  it('construye los weightItems solo para ítems pesables no bonificados', () => {
    const order = {
      items: [
        { id: 1, quantity: 2, unitPrice: 5000, isPromoBonus: false, product: { isPesable: true, approximateWeight: 3.5 } },
        { id: 2, quantity: 5, unitPrice: 1200, isPromoBonus: false, product: { isPesable: false } },
        { id: 3, quantity: 1, unitPrice: 0, isPromoBonus: true, product: { isPesable: true, approximateWeight: 2 } },
      ],
    };
    expect(buildBatchOrderWeightItems(order)).toEqual([{ orderItemId: 1, weight: 7 }]);
  });

  it('resume facturados, errores y suma exacta en pesos enteros', () => {
    const results: BatchInvoiceResult[] = [
      {
        orderId: 108,
        clientName: 'ADRIANA MORAL',
        status: 'INVOICED',
        billingType: BillingType.INTERNAL,
        invoiceNumber: 'INT-00108',
        totalAmount: 27336,
      },
      {
        orderId: 107,
        clientName: 'ACEVEDO LIDIA',
        status: 'ERROR',
        errorMessage: 'Stock insuficiente',
      },
      {
        orderId: 103,
        clientName: 'MARTIN MARCO ESTEBAN',
        status: 'INVOICED',
        billingType: BillingType.OFFICIAL,
        invoiceNumber: 'A-0002-0000103',
        totalAmount: 46786,
      },
    ];

    const summary = summarizeBatchInvoiceResults(results);
    expect(summary.invoicedCount).toBe(2);
    expect(summary.errorCount).toBe(1);
    expect(summary.invoicedTotalPesos).toBe(74122n);
  });
});
