import path from 'path';
import { pathToFileURL } from 'url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  computeErpProductSyncPatch,
  extractCategoryOrderFromCatalogState,
  normalizeRubroCanonicalName,
} from '../../engines/catalog-sync.engine';

let helpers: any;

describe('Lista de Precios PDF — Espejo Exacto de Categorías Oficiales chatbot-dv', () => {
  beforeAll(async () => {
    const modalsDir = path.resolve(__dirname, '../../../../frontend/src/components/modals');
    helpers = await import(pathToFileURL(path.join(modalsDir, 'priceListHelpers.ts')).href);
  });

  const sampleCatalog = [
    { id: 1, sku: '0792', name: 'CIF DETERGENTE BIO ACTIVE LIMA X 500 CC', description: null, commercialCategory: 'Limpieza', rubro: { name: 'LIMPIEZA' }, listPrice: 3801, isActive: true },
    { id: 2, sku: '0795', name: 'BAGGIO VIDA AGUA SAB. POMELO 6X1500C', description: null, commercialCategory: 'Bebidas', rubro: { name: 'BEBIDAS' }, listPrice: 1190, isActive: true },
    { id: 3, sku: '0072', name: 'CREMIGAL SARDO QUESO X KG', description: 'QUESOS', commercialCategory: 'Cremigal', rubro: { name: 'SANCOR Y CREMIGAL' }, listPrice: 15999, isActive: true },
    { id: 4, sku: '0062', name: 'CREMIGAL MOZZARELLA CILINDRO X KG', description: 'QUESOS', commercialCategory: 'Cremigal', rubro: { name: 'SANCOR Y CREMIGAL' }, listPrice: 10360, isActive: true },
    { id: 5, sku: '0001', name: 'MELINCUÉ BARRA TYBO X KG', description: 'MELINCUÉ', commercialCategory: 'Melincué', rubro: { name: 'REMOTTI' }, listPrice: 11156, isActive: true },
    { id: 6, sku: '0002', name: 'MELINCUÉ CHEDDAR X KG', description: 'MELINCUÉ', commercialCategory: 'Melincué', rubro: { name: 'REMOTTI' }, listPrice: 14063, isActive: true },
    { id: 7, sku: '0802', name: 'SANCOR QUESO DANBO X KG', description: 'QUESOS', commercialCategory: 'Sancor', rubro: { name: 'SANCOR' }, listPrice: 14014, isActive: true },
    { id: 8, sku: '0999', name: 'PRODUCTO PAUSADO SIN STOCK', description: null, commercialCategory: 'Melincué', rubro: { name: 'REMOTTI' }, listPrice: 5000, isActive: false },
  ];

  it('separa Melincué, Cremigal, Sancor, Bebidas y Limpieza sin mezclar productos y excluye sin stock', () => {
    const grouped = helpers.groupPriceListProducts(sampleCatalog);
    expect(grouped.map((g: any) => g.name)).toEqual([
      'MELINCUÉ',
      'CREMIGAL',
      'SANCOR',
      'BEBIDAS',
      'LIMPIEZA',
    ]);

    const melincueGroup = grouped.find((g: any) => g.key === 'MELINCUE');
    expect(melincueGroup.directProducts.map((p: any) => p.sku)).toEqual(['0001', '0002']);
  });

  it('respeta el orden dinámico Subir/Bajar leído de metadata.catalog_active_state en chatbot-dv', () => {
    const mockState = JSON.stringify({
      catalogItems: [
        { category: 'COMBOS 💣', is_combo: true },
        { sku: '0802', category: 'Sancor' },
        { sku: '0001', category: 'Melincué' },
        { sku: '0072', category: 'Cremigal' },
      ],
    });
    const order = extractCategoryOrderFromCatalogState(mockState);
    expect(order).toEqual(['Sancor', 'Melincué', 'Cremigal']);

    const grouped = helpers.groupPriceListProducts(sampleCatalog, order);
    expect(grouped.slice(0, 3).map((g: any) => g.name)).toEqual(['SANCOR', 'MELINCUÉ', 'CREMIGAL']);
  });

  it('sincroniza categoría, rubro y subrubro desde chatbot-dv y distingue quesos Melincué vs Cremigal', () => {
    expect(normalizeRubroCanonicalName('Melincué')).toBe('REMOTTI');
    expect(normalizeRubroCanonicalName('Conservas')).toBe('CONSERVAS');

    const patch = computeErpProductSyncPatch(
      {
        id: 1,
        sku: '0001',
        name: 'MELINCUÉ BARRA TYBO X KG',
        costPrice: 8000,
        listPrice: 11156,
        listPriceB: 11156,
        listPriceC: 11156,
        profitMargin: 39.45,
        imageUrl: '/uploads/products/0001.png',
        isActive: true,
        isPesable: true,
        minOrderQuantity: 1,
        approximateWeight: 4,
        commercialCategory: 'Refrigerados',
        description: null,
        rubroId: 121,
      },
      {
        sku: '0001',
        name: 'MELINCUÉ BARRA TYBO X KG',
        price: 11156,
        active: 1,
        category: 'Melincué',
        rubro: 'REMOTTI',
        subrubro: 'MELINCUÉ',
      },
      '/uploads/products/0001.png',
      new Date(),
      97,
    );

    expect(patch.categoryChanged).toBe(true);
    expect(patch.rubroChanged).toBe(true);
    expect(patch.updateData.commercialCategory).toBe('Melincué');
    expect(patch.updateData.rubroId).toBe(97);
    expect(patch.updateData.description).toBe('MELINCUÉ');

    // Mozzarella Cremigal no dice "QUESO" en name pero sí en subrubro/description ("QUESOS")
    expect(helpers.isQueso(sampleCatalog[3])).toBe(true);
    expect(helpers.isQuesoRemotti(sampleCatalog[3])).toBe(false);
    expect(helpers.isQuesoRemotti(sampleCatalog[4])).toBe(true);
  });
});
