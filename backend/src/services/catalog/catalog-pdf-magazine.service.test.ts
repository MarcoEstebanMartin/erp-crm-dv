import { describe, it, expect } from 'vitest';
import { renderCatalogMagazinePdf } from './catalog-pdf-magazine.service';
import type { CatalogProductInput } from '../../engines/catalog-studio.engine';

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

describe('catalog-pdf-magazine.service', () => {
  it('renderiza catálogo revista con etiquetas nuevas de Ofertón, Destacado y producto común', async () => {
    const buffer = await renderCatalogMagazinePdf(SAMPLE_PRODUCTS, [], {
      title: 'OFERTAS SEMANALES',
      subtitle: 'EDICION 26/11',
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(5000);
  });
});
