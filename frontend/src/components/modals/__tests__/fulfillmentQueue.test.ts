import { describe, expect, it } from 'vitest';
import { BillingType } from '../../../utils/types';
import {
  getNextQueueIndex,
  resolvePreparingQueueOrders,
  summarizeFulfillmentQueue,
  type FulfillmentQueueResult,
} from '../fulfillmentQueue.helper';

describe('fulfillmentQueue.helper', () => {
  it('avanza el índice secuencialmente y devuelve null al llegar al final', () => {
    expect(getNextQueueIndex(0, 3)).toBe(1);
    expect(getNextQueueIndex(1, 3)).toBe(2);
    expect(getNextQueueIndex(2, 3)).toBeNull();
    expect(getNextQueueIndex(0, 0)).toBeNull();
  });

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

  it('resume facturados, saltados y suma exacta en pesos enteros', () => {
    const results: FulfillmentQueueResult[] = [
      {
        orderId: 108,
        clientName: 'ADRIANA MORAL',
        status: 'INVOICED',
        billingType: BillingType.INTERNAL,
        invoiceNumber: 'X-0001-0000108',
        totalAmount: 27336,
      },
      {
        orderId: 107,
        clientName: 'ACEVEDO LIDIA',
        status: 'SKIPPED',
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

    const summary = summarizeFulfillmentQueue(results);
    expect(summary.invoicedCount).toBe(2);
    expect(summary.skippedCount).toBe(1);
    expect(summary.invoicedTotalPesos).toBe(74122n);
  });
});
