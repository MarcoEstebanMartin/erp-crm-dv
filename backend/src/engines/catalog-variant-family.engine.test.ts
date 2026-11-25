import { describe, it, expect } from 'vitest';
import {
  collapseCatalogVariantFamilies,
  extractFamilyVarieties,
  parseVariantSkuBase,
  type CatalogVariantRecord,
} from './catalog-variant-family.engine';

function makeProduct(overrides: Partial<CatalogVariantRecord>): CatalogVariantRecord {
  return {
    id: 1,
    sku: '0001',
    name: 'PRODUCTO BASE',
    price: 1000,
    costPrice: 800,
    previousListPrice: null,
    oldPrice: null,
    showOldPrice: false,
    marginPct: 25,
    category: 'Bebidas',
    badge: null,
    minQty: null,
    minOrderQuantity: 1,
    varieties: null,
    imageUrl: null,
    stock: 0,
    isActive: true,
    catalogVisible: true,
    ...overrides,
  };
}

describe('catalog-variant-family.engine', () => {
  it('identifica correctamente el SKU base de variantes con guion y número', () => {
    expect(parseVariantSkuBase('0456-1')).toBe('0456');
    expect(parseVariantSkuBase('0034-12')).toBe('0034');
    expect(parseVariantSkuBase('0456')).toBeNull();
    expect(parseVariantSkuBase('MOSQUI-TRAP')).toBeNull();
    expect(parseVariantSkuBase('')).toBeNull();
  });

  it('extrae sabores limpios en familias con múltiples variantes y tolera diferencias del padre', () => {
    expect(
      extractFamilyVarieties(
        [
          'TERMA SERRANO x 1350ml',
          'TERMA LIMON x 1350ml',
          'TERMA POMELO ROSADO x 1350ml',
        ],
        'TERMA X 1350ML',
      ),
    ).toBe('SERRANO - LIMON - POMELO ROSADO');

    expect(
      extractFamilyVarieties(
        [
          'CREMIGAL QUESO UNTABLE AZUL x 190gr',
          'CREMIGAL QUESO UNTABLE CHEDDAR x 190gr',
          'CREMIGAL QUESO UNTABLE LIGHT x 190gr',
        ],
        'CREMIGAL QUESOS UNTABLES X 190GR',
      ),
    ).toBe('AZUL - CHEDDAR - LIGHT');

    expect(
      extractFamilyVarieties(
        [
          'DR. LEMON LIMON LATA x 473 ml',
          'DR. LEMON VODKA LATA x 473 ml',
        ],
        'DR.LEMON LIMON LATA X 473 ML',
      ),
    ).toBe('LIMON - VODKA');
  });

  it('agrupa hijos activos bajo su padre inactivo sumando stock y tomando precio de los hijos', () => {
    const parent = makeProduct({
      id: 100,
      sku: '0456',
      name: 'TERMA X 1350ML',
      price: 1500, // precio viejo en el padre inactivo
      costPrice: 1000,
      stock: 197, // stock residual viejo del padre no debe sumarse
      isActive: false,
      imageUrl: '/uploads/products/0456.jpg',
      badge: 'DESTACADO',
    });

    const child1 = makeProduct({
      id: 101,
      sku: '0456-1',
      name: 'TERMA SERRANO x 1350ml',
      price: 1999,
      costPrice: 1500,
      stock: 12,
      isActive: true,
    });
    const child2 = makeProduct({
      id: 102,
      sku: '0456-2',
      name: 'TERMA LIMON x 1350ml',
      price: 1999,
      costPrice: 1500,
      stock: 8,
      isActive: true,
    });
    const standalone = makeProduct({
      id: 200,
      sku: '0001',
      name: 'MELINCUÉ BARRA TYBO X KG',
      price: 11156,
      stock: 50,
      isActive: true,
    });

    const result = collapseCatalogVariantFamilies([child1, child2, standalone], [parent]);

    expect(result).toHaveLength(2);
    const terma = result.find((p) => p.sku === '0456');
    expect(terma).toBeDefined();
    expect(terma?.isActive).toBe(true);
    expect(terma?.price).toBe(1999);
    expect(terma?.stock).toBe(20);
    expect(terma?.imageUrl).toBe('/uploads/products/0456.jpg');
    expect(terma?.badge).toBe('DESTACADO');
    expect(terma?.varieties).toBe('SERRANO - LIMON');
  });

  it('respeta las variedades editadas a mano en el padre y oculta padres sin hijos activos', () => {
    const parentWithManual = makeProduct({
      id: 10,
      sku: '0034',
      name: 'CREMIGAL YOGURT SACHET X 900 ML',
      isActive: false,
      varieties: 'FRUTILLA / VAINILLA',
      badge: 'OFERTON',
    });
    const orphanParent = makeProduct({
      id: 20,
      sku: '0420',
      name: 'MOCORETÁ JUGO 6 X 1500 CC',
      isActive: false,
    });
    const child = makeProduct({
      id: 11,
      sku: '0034-1',
      name: 'CREMIGAL YOGURT SACHET FRUTILLA x 900 ml',
      price: 1678,
      stock: 5,
      isActive: true,
    });

    const result = collapseCatalogVariantFamilies([child], [parentWithManual, orphanParent]);
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('0034');
    expect(result[0].varieties).toBe('FRUTILLA / VAINILLA');
  });
});
