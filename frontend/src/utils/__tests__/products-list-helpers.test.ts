import { describe, expect, it } from 'vitest';
import {
  extractProductFilterOptions,
  filterAndSortProducts,
  getProductCategoryInfo,
  marginPctToMultiplier,
  resolveProductImageUrl,
  resolveProductMarginPct,
  sanitizeProductArray,
} from '../productsListHelpers';

describe('ProductsList Helpers — Filtrado Rápido, Búsqueda sin Tildes y Ordenamiento SKU O(N)', () => {
  const sampleProducts = [
    {
      id: 1,
      sku: '100',
      name: 'Jamón Cocido Natural',
      barcode: '779000100',
      commercialCategory: 'Fiambres',
      rubro: { name: 'SODECAR' },
      description: 'Feteables',
      isActive: true,
    },
    {
      id: 2,
      sku: '12',
      name: 'Queso Cremoso Horma',
      barcode: '779000012',
      commercialCategory: 'Melincué',
      rubro: { name: 'REMOTTI' },
      description: 'Blandos',
      isActive: true,
    },
    {
      id: 3,
      sku: '55',
      name: 'Producto Discontinuado',
      barcode: '779000055',
      commercialCategory: 'Almacén',
      rubro: 'VARIOS',
      description: 'Secos',
      isActive: false,
    },
  ];

  it('ordena numéricamente por SKU y filtra activos/inactivos según pestaña', () => {
    const safe = sanitizeProductArray([null, ...sampleProducts, undefined]);
    expect(safe).toHaveLength(3);

    const active = filterAndSortProducts(safe, {
      selectedCategory: '',
      selectedRubro: '',
      selectedSubrubro: '',
      catalogTab: 'products',
      activeFilter: 'all',
      searchQuery: '',
    });
    expect(active.map((p) => p.sku)).toEqual(['12', '100']);

    const inactive = filterAndSortProducts(safe, {
      selectedCategory: '',
      selectedRubro: '',
      selectedSubrubro: '',
      catalogTab: 'inactive_products',
      activeFilter: 'all',
      searchQuery: '',
    });
    expect(inactive.map((p) => p.sku)).toEqual(['55']);
  });

  it('permite buscar sin tildes ni mayúsculas por nombre, SKU o código de barras', () => {
    const byAccentFreeName = filterAndSortProducts(sampleProducts, {
      selectedCategory: '',
      selectedRubro: '',
      selectedSubrubro: '',
      catalogTab: 'products',
      activeFilter: 'all',
      searchQuery: 'jamon',
    });
    expect(byAccentFreeName).toHaveLength(1);
    expect(byAccentFreeName[0].sku).toBe('100');

    const byBarcode = filterAndSortProducts(sampleProducts, {
      selectedCategory: '',
      selectedRubro: '',
      selectedSubrubro: '',
      catalogTab: 'products',
      activeFilter: 'all',
      searchQuery: '779000012',
    });
    expect(byBarcode).toHaveLength(1);
    expect(byBarcode[0].sku).toBe('12');
  });

  it('extrae categorías, rubros y subrubros en una sola pasada y resuelve URLs de miniaturas', () => {
    const opts = extractProductFilterOptions(sampleProducts, 'REMOTTI');
    expect(opts.availableCategories).toEqual(['Almacén', 'Fiambres', 'Melincué']);
    expect(opts.availableRubros).toEqual(['REMOTTI', 'SODECAR', 'VARIOS']);
    expect(opts.availableSubrubros).toEqual(['Blandos']);

    expect(getProductCategoryInfo(sampleProducts[1])).toEqual({
      name: 'Melincué',
      icon: '🧀',
    });
    expect(resolveProductImageUrl('12_abc.png', '3.5')).toBe('/uploads/products/12_abc.png?v=3.5');
    expect(resolveProductImageUrl('/uploads/products/12.jpg', '3.5')).toBe(
      '/uploads/products/12.jpg?v=3.5',
    );
    expect(resolveProductImageUrl('https://cdn.example.com/12.webp')).toBe(
      'https://cdn.example.com/12.webp',
    );
  });

  it('resuelve el margen de producto en porcentaje directo (sin restar 1 ni multiplicar por 100) y convierte el factor del rubro', () => {
    // Caso Melincué SKU 0001: profitMargin=32 en BD -> debe mostrar 32, nunca 3100
    expect(resolveProductMarginPct({ profitMargin: '32', rubro: { profitMargin: '1.25' } })).toBe(32);
    expect(resolveProductMarginPct({ profitMargin: 0, rubro: { profitMargin: '1.25' } })).toBe(0);
    expect(resolveProductMarginPct({ profitMargin: -4.5, rubro: { profitMargin: '1.25' } })).toBe(-4.5);
    // Sin margen propio: cae al factor multiplicador del rubro (1.25 -> 25%)
    expect(resolveProductMarginPct({ profitMargin: null, rubro: { profitMargin: '1.25' } })).toBe(25);
    expect(resolveProductMarginPct({ profitMargin: undefined, rubro: null })).toBe(25);

    expect(marginPctToMultiplier(32)).toBeCloseTo(1.32, 4);
    expect(marginPctToMultiplier(0)).toBe(1);
    expect(marginPctToMultiplier(-10)).toBeCloseTo(0.9, 4);
    expect(marginPctToMultiplier(-150)).toBe(1);
  });
});
