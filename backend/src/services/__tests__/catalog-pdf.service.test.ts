import { describe, it, expect } from 'vitest';
import { renderCatalogMagazinePdf } from '../catalog/catalog-pdf-magazine.service';
import { renderCatalogResumenPdf } from '../catalog/catalog-pdf-resumen.service';
import type { CatalogComboInput, CatalogProductInput } from '../../engines/catalog-studio.engine';

const SAMPLE_PRODUCTS: CatalogProductInput[] = [
  {
    id: 1,
    sku: '0001',
    name: 'BARRA TYBO X KG',
    price: 11156,
    oldPrice: 12500,
    showOldPrice: true,
    category: 'Melincué',
    badge: 'OFERTON',
    minQty: null,
  },
  {
    id: 2,
    sku: '0002',
    name: 'YOGURT SACHET X 900 ML',
    price: 1678,
    category: 'Cremigal',
    badge: 'DESTACADO',
    varieties: 'FRUTILLA - VAINILLA',
  },
  {
    id: 3,
    sku: '0003',
    name: 'NIDO HUEVO X 500 GR 308',
    price: 1690,
    oldPrice: 1999,
    showOldPrice: true,
    category: 'Pastas Secas',
    badge: 'OFERTON',
    minQty: '3 CAJA',
    varieties: 'N1 , N2 , N3 , N4',
  },
];

const SAMPLE_COMBOS: CatalogComboInput[] = [
  {
    id: 'c1',
    comboNum: 'COMBO 1',
    title: 'COMBO VERANO',
    category: 'COMBOS',
    product1: {
      name: 'FERNET BRANCA 750 ML',
      price: 17772,
      uxb: '6 u.',
      condition: '1 CAJA',
    },
    product2: {
      name: 'GASEOSA COLA 2.25 LT',
      price: 0,
      condition: '1 PACK',
      isFree: true,
      freeLabel: 'SIN CARGO',
    },
  },
];

describe('Catalog Studio PDF Renderers', () => {
  it('genera un PDF Revista válido con combos, secciones, badges, tachado y mínimos', async () => {
    const buffer = await renderCatalogMagazinePdf(SAMPLE_PRODUCTS, SAMPLE_COMBOS, {
      title: 'OFERTAS SEMANALES',
      subtitle: 'EDICION 25/11',
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(2000);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('genera un PDF Resumen válido agrupando Refrigerados y Varios', async () => {
    const buffer = await renderCatalogResumenPdf(SAMPLE_PRODUCTS, {
      subtitle: 'EDICION 25/11',
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1500);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('maneja catálogo vacío sin romper en ambos renderizadores', async () => {
    const mag = await renderCatalogMagazinePdf([], []);
    const res = await renderCatalogResumenPdf([]);
    expect(mag.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(res.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
