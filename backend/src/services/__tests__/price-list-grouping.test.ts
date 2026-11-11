import path from 'path';
import { pathToFileURL } from 'url';
import { beforeAll, describe, expect, it } from 'vitest';

let helpers: any;

describe('Lista de Precios PDF — Agrupación por Categorías Comerciales y Rubros', () => {
  beforeAll(async () => {
    const modalsDir = path.resolve(__dirname, '../../../../frontend/src/components/modals');
    helpers = await import(pathToFileURL(path.join(modalsDir, 'priceListHelpers.ts')).href);
  });

  const sampleCatalog = [
    { id: 1, sku: '0552', name: '1882 FERNET X 1 LT', description: null, commercialCategory: 'Bebidas Alcohólicas', rubro: { name: 'BEBIDAS' }, listPrice: 12240, isActive: true },
    { id: 2, sku: '0553', name: 'ALAMBRADO MALBEC X 750 ML', description: null, commercialCategory: 'Bebidas Alcoholicas', rubro: { name: 'BEBIDAS' }, listPrice: 6691, isActive: true },
    { id: 3, sku: '0210', name: '308 AVE MARIA SEMOLA X 500 GR', description: null, commercialCategory: 'Pastas Secas', rubro: { name: 'PASTAS SECAS' }, listPrice: 864, isActive: true },
    { id: 4, sku: '0005', name: 'MELINCUÉ CREMOSO HORMA X KG', description: null, commercialCategory: 'Refrigerados', rubro: { name: 'REMOTTI' }, listPrice: 7500, isActive: true },
    { id: 5, sku: '0020', name: 'SANCOR MANTECA X 200 GR', description: null, commercialCategory: 'Refrigerados', rubro: { name: 'LÁCTEOS' }, listPrice: 2800, isActive: true },
    { id: 6, sku: '0110', name: 'SODECAR JAMON COCIDO X KG', description: null, commercialCategory: 'Fiambres', rubro: { name: 'SODECAR' }, listPrice: 9900, isActive: true },
    { id: 7, sku: '0780', name: 'AMANDA TERMO TERMOLAR X 1 LT', description: null, commercialCategory: 'No comestibles', rubro: { name: 'NO COMESTIBLES' }, listPrice: 23129, isActive: true },
    { id: 8, sku: '0990', name: 'ITEM SIN CLASIFICAR', description: null, commercialCategory: null, rubro: null, listPrice: 1000, isActive: true },
    { id: 9, sku: '0999', name: 'PRODUCTO INACTIVO BORRADO', description: null, commercialCategory: 'Refrigerados', rubro: { name: 'REMOTTI' }, listPrice: 5000, isActive: false },
  ];

  it('ordena por Categorías Comerciales en orden comercial lógico y unifica variantes con/sin tilde', () => {
    const grouped = helpers.groupPriceListProducts(sampleCatalog, 'category');
    expect(grouped.map((g: any) => g.name)).toEqual([
      'REFRIGERADOS',
      'FIAMBRES',
      'PASTAS SECAS',
      'BEBIDAS ALCOHÓLICAS',
      'NO COMESTIBLES',
      'VARIOS',
    ]);

    // Excluye inactivos y ordena alfabéticamente dentro de cada categoría
    const refrigerados = grouped.find((g: any) => g.key === 'REFRIGERADOS');
    expect(refrigerados.directProducts.map((p: any) => p.name)).toEqual([
      'MELINCUÉ CREMOSO HORMA X KG',
      'SANCOR MANTECA X 200 GR',
    ]);

    const bebidasAlc = grouped.find((g: any) => g.key === 'BEBIDAS ALCOHOLICAS');
    expect(bebidasAlc.totalCount).toBe(2);
    expect(bebidasAlc.directProducts.map((p: any) => p.name)).toEqual([
      '1882 FERNET X 1 LT',
      'ALAMBRADO MALBEC X 750 ML',
    ]);
  });

  it('alterna limpiamente a agrupación por Rubros manteniendo orden lógico', () => {
    const groupedByRubro = helpers.groupPriceListProducts(sampleCatalog, 'rubro');
    expect(groupedByRubro.map((g: any) => g.name)).toEqual([
      'REMOTTI',
      'LÁCTEOS',
      'SODECAR',
      'PASTAS SECAS',
      'BEBIDAS',
      'NO COMESTIBLES',
      'VARIOS',
    ]);
  });

  it('detecta MELINCUÉ con tilde en tarifas especiales y redondea pesos enteros ROUND_HALF_UP', () => {
    const melincue = sampleCatalog[3];
    expect(helpers.isQuesoRemotti(melincue)).toBe(true);
    expect(helpers.isQueso(melincue)).toBe(true);
    expect(helpers.roundIntegerPeso(100.5)).toBe(101);
    expect(helpers.roundIntegerPeso(100.49)).toBe(100);
  });
});
