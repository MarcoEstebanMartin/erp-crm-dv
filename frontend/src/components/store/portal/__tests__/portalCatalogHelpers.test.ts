import { describe, expect, it } from 'vitest';
import {
  type StoreCategoryGroup,
  type StoreProduct,
  formatApproxWeight,
  formatIntegerMoney,
  groupProductsByCategory,
  resolveProductImageSrc,
} from '../portal.types';

function makeProduct(partial: Partial<StoreProduct>): StoreProduct {
  return {
    id: partial.id ?? 1,
    sku: partial.sku ?? '0001',
    name: partial.name ?? 'Producto',
    description: null,
    barcode: null,
    price: partial.price ?? 1000,
    listPriceA: partial.price ?? 1000,
    listPriceB: partial.price ?? 1000,
    listPriceC: partial.price ?? 1000,
    stock: partial.stock ?? 50,
    isPesable: partial.isPesable ?? false,
    approximateWeight: partial.approximateWeight ?? null,
    estimatedPiecePrice: partial.estimatedPiecePrice ?? null,
    unitsPerBox: partial.unitsPerBox ?? 1,
    imageUrl: partial.imageUrl ?? null,
    rubroId: 1,
    rubroName: 'General',
    commercialGroupId: partial.commercialGroupId ?? 'melincue',
    commercialGroupName: partial.commercialGroupName ?? 'Melincué',
    commercialGroupIcon: partial.commercialGroupIcon ?? '🧀',
    isOffer: partial.isOffer ?? false,
    offerDiscount: partial.offerDiscount ?? 0,
    previousPrice: partial.previousPrice ?? null,
    specialTag: partial.specialTag ?? null,
    offerName: null,
  };
}

describe('portalCatalogHelpers', () => {
  it('agrupa productos respetando el orden oficial de commercialGroups y omite secciones vacías', () => {
    const groups: StoreCategoryGroup[] = [
      { id: 'all', name: 'Todas', icon: '🌟' },
      { id: 'melincue', name: 'Melincué', icon: '🧀' },
      { id: 'cremigal', name: 'Cremigal', icon: '🥛' },
      { id: 'fiambres', name: 'Fiambres', icon: '🥓' },
    ];
    const products: StoreProduct[] = [
      makeProduct({ id: 2, commercialGroupId: 'fiambres', commercialGroupName: 'Fiambres', commercialGroupIcon: '🥓' }),
      makeProduct({ id: 1, commercialGroupId: 'melincue', commercialGroupName: 'Melincué', commercialGroupIcon: '🧀' }),
    ];

    const sections = groupProductsByCategory(products, groups);
    expect(sections.map((s) => s.id)).toEqual(['melincue', 'fiambres']);
    expect(sections[0].products).toHaveLength(1);
    expect(sections[1].products).toHaveLength(1);
  });

  it('formatea precios en pesos enteros sin centavos y pesos aproximados prolijos', () => {
    expect(formatIntegerMoney(11156)).toBe('$11.156');
    expect(formatIntegerMoney(44624.4)).toBe('$44.624');
    expect(formatApproxWeight(4)).toBe('4');
    expect(formatApproxWeight(3.5)).toBe('3,5');
  });

  it('resuelve URLs de imágenes absolutas, relativas y de nombre de archivo', () => {
    expect(resolveProductImageSrc(null)).toBeNull();
    expect(resolveProductImageSrc('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(resolveProductImageSrc('/uploads/products/1.webp')).toBe('/uploads/products/1.webp?v=1.2');
    expect(resolveProductImageSrc('1.webp')).toBe('/uploads/products/1.webp?v=1.2');
  });
});
