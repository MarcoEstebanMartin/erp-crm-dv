import { describe, it, expect } from 'vitest';
import { renderCatalogMagazinePdf } from './catalog-pdf-magazine.service';
import { formatComboUxb, parseComboProductDisplay } from './catalog-pdf-combo.helper';
import type { CatalogComboInput, CatalogProductInput } from '../../engines/catalog-studio.engine';

const SAMPLE_PRODUCTS: CatalogProductInput[] = [
  {
    id: 1,
    sku: '0001',
    name: 'MELINCUE CREMOSO X KG',
    price: 8999,
    oldPrice: 11414,
    showOldPrice: true,
    category: 'Melincué',
    badge: 'OFERTON',
    minOrderQuantity: 6,
  },
  {
    id: 2,
    sku: '0002',
    name: 'CREMIGAL MOZZARELLA X KG',
    price: 10360,
    category: 'Cremigal',
    badge: 'DESTACADO',
  },
  {
    id: 3,
    sku: '0003',
    name: 'COCINERO ACEITE MEZCLA 1.5 LT',
    price: 4999,
    category: 'Aceites y Vinagres',
    badge: null,
  },
];

const SAMPLE_COMBOS: CatalogComboInput[] = [
  {
    id: 'combo-1',
    comboNum: 'COMBO 1',
    title: 'BODEGA ZUCCARDI',
    category: 'COMBOS',
    product1: {
      name: 'ALAMBRADO CABERNET SAUVIG X 750 ML',
      price: 6691,
      condition: '1 BULTO',
      uxb: '6 u.',
    },
    product2: {
      name: 'SANTA JULIA CHENIN DULCE X 750 ML',
      price: 5499,
      condition: '1 O 2 BULTOS',
      uxb: '6',
    },
  },
];

describe('catalog-pdf-magazine.service', () => {
  it('renderiza catálogo revista con etiquetas nuevas de Ofertón, Destacado y producto común', async () => {
    const buffer = await renderCatalogMagazinePdf(SAMPLE_PRODUCTS, SAMPLE_COMBOS, {
      title: 'OFERTAS SEMANALES',
      subtitle: 'EDICION 26/11',
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(5000);
  });

  it('separa marca, varietal y volumen en productos de combo y normaliza UxB', () => {
    expect(parseComboProductDisplay('SANTA JULIA CHENIN DULCE X 750 ML')).toEqual({
      brand: 'SANTA JULIA',
      varietal: 'CHENIN DULCE',
      volume: 'x 750 ml',
    });
    expect(parseComboProductDisplay('ALAMBRADO CABERNET SAUVIG X 750 ML')).toEqual({
      brand: 'ALAMBRADO',
      varietal: 'CABERNET SAUVIG',
      volume: 'x 750 ml',
    });
    expect(formatComboUxb('6')).toBe('6 u.');
    expect(formatComboUxb('6 u.')).toBe('6 u.');
    expect(formatComboUxb('')).toBe('');
  });
});
