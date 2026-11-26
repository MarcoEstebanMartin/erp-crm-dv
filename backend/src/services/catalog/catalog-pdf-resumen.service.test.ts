import { describe, it, expect } from 'vitest';
import { renderCatalogResumenPdf } from './catalog-pdf-resumen.service';
import type { CatalogProductInput } from '../../engines/catalog-studio.engine';

const SAMPLE_PRODUCTS: CatalogProductInput[] = [
  { id: 1, sku: '0001', name: 'MELINCUE BARRA TYBO X KG', price: 11156, category: 'Melincué', badge: 'OFERTON' },
  { id: 2, sku: '0002', name: 'MELINCUE CREMOSO X KG', price: 8999, category: 'Melincué', badge: 'OFERTON', minOrderQuantity: 6 },
  { id: 3, sku: '0003', name: 'CREMIGAL MOZZARELLA X KG', price: 10360, category: 'Cremigal', badge: 'DESTACADO' },
  { id: 4, sku: '0004', name: 'COCINERO ACEITE MEZCLA 1.5 LT', price: 4999, category: 'Aceites y Vinagres', badge: 'OFERTON' },
  { id: 5, sku: '0005', name: 'BAGGIO JUGO NARANJA 1 LT', price: 3040, category: 'Bebidas', badge: 'DESTACADO', minOrderQuantity: 6 },
];

describe('catalog-pdf-resumen.service', () => {
  it('genera PDF válido en modo all con columnas diferenciadas de Ofertones y Destacados', async () => {
    const buffer = await renderCatalogResumenPdf(SAMPLE_PRODUCTS, {
      subtitle: 'EDICION 26/11',
      resumenMode: 'all',
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('soporta listas desbalanceadas y paginación multipágina sin errores', async () => {
    const manyOfertones: CatalogProductInput[] = Array.from({ length: 65 }, (_, i) => ({
      id: i + 1,
      sku: `OF-${i + 1}`,
      name: `PRODUCTO OFERTON ${i + 1}`,
      price: 1500 + i * 10,
      category: i < 15 ? 'Melincué' : 'Almacén',
      badge: 'OFERTON',
    }));
    const fewDestacados: CatalogProductInput[] = [
      { id: 500, sku: 'DE-1', name: 'PRODUCTO DESTACADO 1', price: 4200, category: 'Bebidas', badge: 'DESTACADO' },
    ];

    const buffer = await renderCatalogResumenPdf([...manyOfertones, ...fewDestacados], {
      subtitle: 'EDICION 26/11',
      resumenMode: 'all',
    });

    expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(2000);
  });

  it('genera PDF válido cuando solo hay Ofertones o cuando no hay productos destacados', async () => {
    const onlyOfertonesBuf = await renderCatalogResumenPdf(
      SAMPLE_PRODUCTS.filter((p) => p.badge === 'OFERTON'),
      { resumenMode: 'all' },
    );
    expect(onlyOfertonesBuf.subarray(0, 5).toString('utf8')).toBe('%PDF-');

    const emptyBuf = await renderCatalogResumenPdf([], { resumenMode: 'all' });
    expect(emptyBuf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
  });

  it('genera PDF válido en modos individuales ofertones y destacados', async () => {
    const ofBuf = await renderCatalogResumenPdf(SAMPLE_PRODUCTS, { resumenMode: 'ofertones' });
    const deBuf = await renderCatalogResumenPdf(SAMPLE_PRODUCTS, { resumenMode: 'destacados' });

    expect(ofBuf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(deBuf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
  });
});
