import { describe, it, expect } from 'vitest';
import {
  buildSearchIndex,
  filterIndexedItems,
  sortVendedorCatalog,
} from '../vendedorHelpers';

describe('Vendedor Paso 2 — Motor de Búsqueda Pre-Indexado y Ordenamiento', () => {
  it('filtra por múltiples tokens en cualquier orden ignorando tildes y mayúsculas', () => {
    const items = [
      { id: 1, name: 'Azúcar Ledesma 1Kg', sku: '102', barcode: '779123' },
      { id: 2, name: 'Yerba Mate Playadito 500g', sku: '55', barcode: '779999' },
      { id: 3, name: 'Fideos Matarazzo Tirabuzón', sku: '210', barcode: '779555' },
    ];
    const index = buildSearchIndex(items, (p) => [p.name, p.sku, p.barcode]);

    expect(filterIndexedItems(index, 'azucar 1kg').map((i) => i.id)).toEqual([1]);
    expect(filterIndexedItems(index, '500 playadito').map((i) => i.id)).toEqual([2]);
    expect(filterIndexedItems(index, 'tirabuzon').map((i) => i.id)).toEqual([3]);
    expect(filterIndexedItems(index, '779999').map((i) => i.id)).toEqual([2]);
    expect(filterIndexedItems(index, '')).toHaveLength(3);
  });

  it('ordena el catálogo numéricamente por SKU usando Map de rubros sin degradar O(N log N)', () => {
    const rubros = [
      { id: 1, name: 'Lácteos' },
      { id: 2, name: 'Almacén' },
    ];
    const products = [
      { id: 1, sku: '100', name: 'A', rubroId: 1 },
      { id: 2, sku: '20', name: 'B', rubroId: 2 },
      { id: 3, sku: '3', name: 'C', rubroId: 1 },
    ];

    const sortedAll = sortVendedorCatalog(products, rubros, '');
    expect(sortedAll.map((p) => p.sku)).toEqual(['3', '20', '100']);

    const sortedByRubro = sortVendedorCatalog(products, rubros, '1');
    expect(sortedByRubro.map((p) => p.id)).toEqual([2, 3, 1]);
  });

  it('filtra 2000 productos pre-indexados en pocos milisegundos', () => {
    const bigList = Array.from({ length: 2000 }, (_, i) => ({
      id: i + 1,
      sku: String(i + 1),
      name: i === 1850 ? 'Queso Cremoso Remotti Horma' : `Producto Genérico ${i}`,
      barcode: `779000${i}`,
    }));
    const index = buildSearchIndex(bigList, (p) => [p.name, p.sku, p.barcode]);

    const t0 = performance.now();
    const res = filterIndexedItems(index, 'remotti queso');
    const elapsed = performance.now() - t0;

    expect(res).toHaveLength(1);
    expect(res[0].id).toBe(1851);
    expect(elapsed).toBeLessThan(25);
  });
});
