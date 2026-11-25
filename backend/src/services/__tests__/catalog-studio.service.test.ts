import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogStudioService } from '../catalog/catalog-studio.service';
import prisma from '../../utils/prisma';

vi.mock('../../utils/prisma', () => ({
  default: {
    catalogStudioState: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('CatalogStudioService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve productos reales del ERP con margen calculado y orden personalizado', async () => {
    (prisma.catalogStudioState.findUnique as any).mockResolvedValue({
      title: 'OFERTAS SEMANALES',
      subtitle: 'EDICION 25/11',
      hideOutOfStock: true,
      categoryOrder: ['Melincué', 'Cremigal'],
      itemOrder: ['0002', '0001'],
      combos: [],
      updatedAt: new Date('2026-11-25T12:00:00Z'),
    });

    (prisma.product.findMany as any).mockResolvedValue([
      {
        id: 1,
        sku: '0001',
        name: 'BARRA TYBO X KG',
        listPrice: 11156,
        costPrice: 9000,
        previousListPrice: 12000,
        stock: 15,
        isActive: true,
        isPesable: true,
        unitsPerBox: 1,
        minOrderQuantity: 1,
        imageUrl: '/uploads/products/0001.jpg',
        commercialCategory: 'Melincué',
        catalogBadge: 'OFERTON',
        catalogVarieties: null,
        catalogMinQtyLabel: null,
        catalogShowOldPrice: true,
        catalogOldPrice: null,
        catalogVisible: true,
        rubro: { name: 'LACTEOS' },
      },
      {
        id: 2,
        sku: '0002',
        name: 'YOGURT SACHET X 900 ML',
        listPrice: 1678,
        costPrice: 1200,
        previousListPrice: null,
        stock: 0,
        isActive: true,
        isPesable: false,
        unitsPerBox: 12,
        minOrderQuantity: 6,
        imageUrl: null,
        commercialCategory: 'Cremigal',
        catalogBadge: 'DESTACADO',
        catalogVarieties: 'FRUTILLA - VAINILLA',
        catalogMinQtyLabel: '6 UNID.',
        catalogShowOldPrice: false,
        catalogOldPrice: null,
        catalogVisible: true,
        rubro: { name: 'CREMIGAL' },
      },
    ]);

    const res = await CatalogStudioService.getStudioData();
    expect(res.products.map((p) => p.sku)).toEqual(['0002', '0001']);
    expect(res.products[1].price).toBe(11156);
    expect(res.products[1].marginPct).toBe(24);
    expect(res.products[1].oldPrice).toBe(12000);
  });

  it('updateProductCatalogFields solo actualiza atributos visuales y nunca listPrice ni stock', async () => {
    (prisma.product.findUnique as any).mockResolvedValue({ id: 10 });
    (prisma.product.update as any).mockResolvedValue({
      id: 10,
      sku: '0010',
      catalogBadge: 'OFERTON',
      catalogVarieties: 'LIMON - NARANJA',
      catalogMinQtyLabel: '3 CAJA',
      catalogShowOldPrice: true,
      catalogOldPrice: 1999,
      catalogVisible: true,
      commercialCategory: 'Bebidas',
    });

    await CatalogStudioService.updateProductCatalogFields(10, {
      catalogBadge: 'OFERTON',
      catalogVarieties: '  LIMON - NARANJA  ',
      catalogMinQtyLabel: '3 CAJA',
      catalogShowOldPrice: true,
      catalogOldPrice: 1999,
      catalogVisible: true,
      commercialCategory: 'BEBIDAS',
    });

    const callArg = (prisma.product.update as any).mock.calls[0][0];
    expect(callArg.data).not.toHaveProperty('listPrice');
    expect(callArg.data).not.toHaveProperty('costPrice');
    expect(callArg.data).not.toHaveProperty('stock');
    expect(callArg.data.catalogBadge).toBe('OFERTON');
    expect(callArg.data.commercialCategory).toBe('Bebidas');
  });

  it('genera ambos PDFs respetando hideOutOfStock y catalogVisible', async () => {
    (prisma.catalogStudioState.findUnique as any).mockResolvedValue({
      title: 'OFERTAS SEMANALES',
      subtitle: 'EDICION 25/11',
      hideOutOfStock: true,
      categoryOrder: [],
      itemOrder: [],
      combos: [],
      updatedAt: new Date(),
    });

    (prisma.product.findMany as any).mockResolvedValue([
      {
        id: 1,
        sku: '0001',
        name: 'BARRA TYBO X KG',
        listPrice: 11156,
        costPrice: 9000,
        previousListPrice: null,
        stock: 10,
        isActive: true,
        isPesable: true,
        unitsPerBox: 1,
        minOrderQuantity: 1,
        imageUrl: null,
        commercialCategory: 'Melincué',
        catalogBadge: 'OFERTON',
        catalogVarieties: null,
        catalogMinQtyLabel: null,
        catalogShowOldPrice: false,
        catalogOldPrice: null,
        catalogVisible: true,
        rubro: { name: 'MELINCUE' },
      },
      {
        id: 2,
        sku: '0002',
        name: 'SIN STOCK',
        listPrice: 1500,
        costPrice: 1000,
        previousListPrice: null,
        stock: 0,
        isActive: true,
        isPesable: false,
        unitsPerBox: 1,
        minOrderQuantity: 1,
        imageUrl: null,
        commercialCategory: 'Melincué',
        catalogBadge: 'OFERTON',
        catalogVarieties: null,
        catalogMinQtyLabel: null,
        catalogShowOldPrice: false,
        catalogOldPrice: null,
        catalogVisible: true,
        rubro: { name: 'MELINCUE' },
      },
    ]);

    const mag = await CatalogStudioService.generateMagazinePdf();
    const res = await CatalogStudioService.generateResumenPdf(false);

    expect(mag.buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(mag.filename).toContain('OFERTA_SEMANAL_DON_VENANCIO_EDICION_25_11');
    expect(res.buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(res.filename).toContain('RESUMEN_OFERTAS_DON_VENANCIO_EDICION_25_11');
  });
});
