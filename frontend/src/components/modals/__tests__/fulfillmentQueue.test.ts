import { describe, expect, it } from 'vitest';
import {
  getNextQueueIndex,
  resolvePreparingQueueOrders,
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
});
