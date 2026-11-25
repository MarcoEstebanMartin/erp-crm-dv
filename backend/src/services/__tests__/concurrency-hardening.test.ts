import { describe, it, expect, vi } from 'vitest';
import { decrementStockByProductMapInTx } from '../orders/order-weekly-promos.helper';
import { withAfipVoucherLock } from '../afip.service';

describe('Paso 1 - Blindaje de concurrencia (Stock sin deadlocks y AFIP por tipo de comprobante)', () => {
  it('bloquea productos en orden ascendente y descuenta stock sin deadlocks', async () => {
    const updatedProductIds: number[] = [];
    const queryRawMock = vi.fn().mockResolvedValue([]);
    const updateManyMock = vi.fn().mockImplementation(async ({ where }: any) => {
      updatedProductIds.push(where.id);
      return { count: 1 };
    });

    const tx = {
      $queryRaw: queryRawMock,
      product: {
        updateMany: updateManyMock,
      },
    };

    await decrementStockByProductMapInTx({
      tx,
      stockRequiredByProduct: {
        42: 3,
        7: 2,
        19: 5,
      },
      dbProducts: [
        { id: 42, name: 'Queso' },
        { id: 7, name: 'Jamón' },
        { id: 19, name: 'Salame' },
      ],
    });

    expect(queryRawMock).toHaveBeenCalledTimes(1);
    expect(updatedProductIds).toEqual([7, 19, 42]);
  });

  it('serializa emisiones AFIP del mismo (puntoVenta:cbteTipo) y permite paralelismo entre tipos distintos', async () => {
    const events: string[] = [];

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const pA1 = withAfipVoucherLock('1:1', async () => {
      events.push('A1-start');
      await delay(30);
      events.push('A1-end');
      return 'A1';
    });

    const pA2 = withAfipVoucherLock('1:1', async () => {
      events.push('A2-start');
      await delay(5);
      events.push('A2-end');
      return 'A2';
    });

    const pB1 = withAfipVoucherLock('1:6', async () => {
      events.push('B1-start');
      await delay(5);
      events.push('B1-end');
      return 'B1';
    });

    const results = await Promise.all([pA1, pA2, pB1]);
    expect(results).toEqual(['A1', 'A2', 'B1']);

    // A2 nunca empieza antes de que termine A1 (correlatividad estricta en Factura A)
    expect(events.indexOf('A1-end')).toBeLessThan(events.indexOf('A2-start'));
    // B1 (Factura B) no queda bloqueada esperando a que termine A1 (Factura A)
    expect(events.indexOf('B1-end')).toBeLessThan(events.indexOf('A1-end'));
  });
});
