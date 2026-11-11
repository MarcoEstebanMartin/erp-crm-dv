import { describe, expect, it } from 'vitest';
import {
  buildOutboundProductPayload,
  formatWebCurrencyArs,
  normalizeWebSku,
  patchCatalogActiveStateJson,
} from '../../engines/catalog-bridge.engine';
import { productionOutboundBridgeService } from '../catalog/production-outbound-bridge.service';

describe('Paso U3 — Puente Vivo Permanente ERP -> Producción (donvenancio.com.ar)', () => {
  it('formatea precios al estándar visual web ARS con puntos de miles y redondeo entero', () => {
    expect(formatWebCurrencyArs(9112)).toBe('$9.112');
    expect(formatWebCurrencyArs('11156.49')).toBe('$11.156');
    expect(formatWebCurrencyArs('20944.70')).toBe('$20.945');
    expect(formatWebCurrencyArs(550)).toBe('$550');
    expect(formatWebCurrencyArs(0)).toBe('$0');
    expect(formatWebCurrencyArs(1250400)).toBe('$1.250.400');
  });

  it('normaliza SKUs y construye payload de salida compatible con chatbot-dv', () => {
    expect(normalizeWebSku('31')).toBe('0031');
    expect(normalizeWebSku('29.0')).toBe('0029');
    expect(normalizeWebSku('0034-1')).toBe('0034-1');

    const payload = buildOutboundProductPayload({
      sku: '29',
      name: 'MELINCUE BARRA X KG',
      listPrice: '11712.4',
      isActive: true,
      minOrderQuantity: 4,
      approximateWeight: '4.250',
      imageUrl: '/uploads/products/0029_1794388000.png?v=3.5',
      commercialCategory: 'Melincué',
      rubroName: 'REMOTTI',
    });

    expect(payload).toEqual({
      sku: '0029',
      name: 'MELINCUÉ BARRA X KG',
      price: 11712,
      priceFormatted: '$11.712',
      active: 1,
      minQty: '4',
      pesoPromedio: 4.25,
      rubro: 'REMOTTI',
      category: 'Melincué',
      fallbackPhotoFile: '0029_1794388000.png',
    });

    const singleUnit = buildOutboundProductPayload({
      sku: '0031',
      name: 'CREMIGAL LECHE EN POLVO X 800 GR',
      listPrice: 9112,
      isActive: false,
      minOrderQuantity: 1,
      approximateWeight: null,
      imageUrl: null,
      rubroName: 'LÁCTEOS',
    });
    expect(singleUnit.active).toBe(0);
    expect(singleUnit.minQty).toBe('');
    expect(singleUnit.pesoPromedio).toBeNull();
    expect(singleUnit.fallbackPhotoFile).toBeNull();
  });

  it('parchea metadata.catalog_active_state incluyendo productos sueltos y combos sin tocar banners', () => {
    const sampleState = JSON.stringify({
      catalogItems: [
        { id: 'banner_1', is_banner: true, title: 'OFERTAS DE LA SEMANA' },
        {
          id: 'combo_1',
          is_combo: true,
          prod1: { sku: '0031', photo_file: '0031_old.jpg', has_photo: true },
          prod2: { sku: '0029', photo_file: '0029.jpg', has_photo: true },
        },
        {
          sku: '0031',
          name: 'CREMIGAL LECHE EN POLVO X 800 GR',
          price: 8637,
          price_formatted: '$8.637',
          min_qty: '',
          peso_promedio: null,
          photo_file: '0031_old.jpg',
          has_photo: true,
          badge: 'OFERTA',
        },
      ],
      items: [],
      timestamp: 1000,
      saved_at: '2026-11-01T00:00:00Z',
    });

    const res = patchCatalogActiveStateJson(
      sampleState,
      [
        {
          sku: '31',
          price: 9112,
          priceFormatted: '$9.112',
          minQty: '2',
          photoFile: '0031_1794390000.png',
          hasPhoto: true,
        },
      ],
      '2026-11-10T21:30:00.000Z',
      1794366600000,
    );

    expect(res.changed).toBe(true);
    const updated = JSON.parse(res.nextJson);
    expect(updated.catalogItems[0]).toEqual({
      id: 'banner_1',
      is_banner: true,
      title: 'OFERTAS DE LA SEMANA',
    });
    expect(updated.catalogItems[1].prod1.photo_file).toBe('0031_1794390000.png');
    expect(updated.catalogItems[1].prod2.photo_file).toBe('0029.jpg');
    expect(updated.catalogItems[2]).toMatchObject({
      sku: '0031',
      price: 9112,
      price_formatted: '$9.112',
      min_qty: '2',
      photo_file: '0031_1794390000.png',
      has_photo: true,
      badge: 'OFERTA',
    });
    expect(updated.timestamp).toBe(1794366600000);
    expect(updated.saved_at).toBe('2026-11-10T21:30:00.000Z');
  });

  it('mantiene desactivado el auto-disparo hacia Producción cuando corre bajo entorno Vitest', () => {
    expect(productionOutboundBridgeService.isAutoBridgeActive()).toBe(false);
    productionOutboundBridgeService.enqueueProductSyncById(999999);
    expect(productionOutboundBridgeService.getBridgeStats().queue.pending).toBe(0);
  });
});
