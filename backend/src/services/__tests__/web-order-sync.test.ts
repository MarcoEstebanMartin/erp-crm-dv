import { describe, expect, it } from 'vitest';
import { OrderStatus } from '@prisma/client';
import {
  extractComparableArPhoneDigits,
  mapErpOrderStatusToWeb,
  mapWebOrderStatusToErp,
  parseCatalogCombosMap,
  translateWebOrderItemsToErpLines,
  type ErpProductForWebOrder,
} from '../../engines/web-order-sync.engine';

describe('Paso P1 — Motor Matemático de Pedidos Entrantes Web y WhatsApp', () => {
  it('normaliza teléfonos argentinos (+549, 0 y 15) a 10 dígitos comparables sin duplicar clientes', () => {
    expect(extractComparableArPhoneDigits('5493388501086')).toBe('3388501086');
    expect(extractComparableArPhoneDigits('+54 9 3388 50-1086')).toBe('3388501086');
    expect(extractComparableArPhoneDigits('03388-15501086')).toBe('3388501086');
    expect(extractComparableArPhoneDigits('3388501086')).toBe('3388501086');
  });

  it('desglosa productos pesables de precio por pieza a precio por kg exacto para la balanza', () => {
    const productsMap = new Map<string, ErpProductForWebOrder>([
      [
        '0003',
        {
          id: 1737,
          sku: '0003',
          name: 'MELINCUÉ CREMOSO X KG',
          costPrice: '7200.00',
          listPrice: '8999.00',
          stock: 15,
          isPesable: true,
          approximateWeight: '4.000',
          unitsPerBox: 4,
        },
      ],
      [
        '0491',
        {
          id: 2100,
          sku: '0491',
          name: 'BRANCA FERNET X 750 ML',
          costPrice: '14500.00',
          listPrice: '18132.00',
          stock: 24,
          isPesable: false,
          approximateWeight: null,
          unitsPerBox: 12,
        },
      ],
    ]);

    const translated = translateWebOrderItemsToErpLines(
      [
        {
          sku: '0003',
          product_name: 'MELINCUÉ CREMOSO X KG (Pieza aprox. 4 kg)',
          unit_price: 35996, // 8999 * 4 kg enviado como pieza desde web/bot
          quantity: 1,
          subtotal: 35996,
        },
        {
          sku: '0491',
          product_name: 'BRANCA FERNET X 750 ML',
          unit_price: 18132,
          quantity: 1,
          subtotal: 18132,
        },
      ],
      productsMap,
    );

    expect(translated.lines).toHaveLength(2);
    // Clave crítica: unitPrice queda en $8.999/kg para que al pesar en balanza no cuadruplique el cobro
    expect(translated.lines[0].unitPrice).toBe(8999);
    expect(translated.lines[0].weight).toBeNull();
    expect(translated.lines[0].subtotal).toBe(35996);
    expect(translated.lines[1].unitPrice).toBe(18132);
    expect(translated.totalAmount).toBe(54128);
    expect(translated.netAmount + translated.taxAmount).toBe(54128);
  });

  it('expande COMBOS de donvenancio.com.ar en sus SKUs físicos reales respetando unidades y bonificados', () => {
    const sampleCatalogState = JSON.stringify({
      catalogItems: [
        {
          id: 'combo_1792249087605',
          is_combo: true,
          combo_num: 'COMBO 1',
          title: 'RAID + MATA CUCARACHA',
          prod1: { sku: '0784', uxb: '6 U x B', price: 6870, condition: '1 BULTO' },
          prod2: { sku: '0785', uxb: '2 U x B', price: 5975, is_free: true, condition: '2 UNIDADES' },
        },
      ],
    });

    const combosMap = parseCatalogCombosMap(sampleCatalogState);
    const productsMap = new Map<string, ErpProductForWebOrder>([
      [
        '0784',
        {
          id: 301,
          sku: '0784',
          name: 'RAID INSECT. AEROSOL X 360 CC',
          costPrice: '5100.00',
          listPrice: '7200.00',
          stock: 30,
          isPesable: false,
          approximateWeight: null,
          unitsPerBox: 6,
        },
      ],
      [
        '0785',
        {
          id: 302,
          sku: '0785',
          name: 'RAID MATA CUCARACHA X 360 CC',
          costPrice: '4500.00',
          listPrice: '5975.00',
          stock: 10,
          isPesable: false,
          approximateWeight: null,
          unitsPerBox: 6,
        },
      ],
    ]);

    const translated = translateWebOrderItemsToErpLines(
      [
        {
          sku: 'COMBO_1',
          product_name: 'COMBO 1: RAID + MATA CUCARACHA',
          unit_price: 41220, // 6 * 6870 + 0 (2 unidades sin cargo)
          quantity: 2,
          subtotal: 82440,
        },
        {
          sku: 'CHAT',
          product_name: '2x escobillón a confirmar',
          unit_price: 0,
          quantity: 1,
          subtotal: 0,
        },
      ],
      productsMap,
      combosMap,
    );

    expect(translated.lines).toHaveLength(2);
    expect(translated.lines[0]).toMatchObject({
      sku: '0784',
      quantity: 12,
      unitPrice: 6870,
      subtotal: 82440,
    });
    expect(translated.lines[1]).toMatchObject({
      sku: '0785',
      quantity: 4,
      unitPrice: 0,
      subtotal: 0,
      discountPctSnapshot: 100,
    });
    expect(translated.totalAmount).toBe(82440);
    expect(translated.unmappedNotes).toEqual(['1x 2x escobillón a confirmar']);
  });

  it('mapea estados bidireccionales entre ERP y Web sin ambigüedad', () => {
    expect(mapWebOrderStatusToErp('nuevo')).toBe(OrderStatus.PENDING);
    expect(mapWebOrderStatusToErp('confirmado')).toBe(OrderStatus.PENDING);
    expect(mapWebOrderStatusToErp('en_armado')).toBe(OrderStatus.PREPARING);
    expect(mapWebOrderStatusToErp('cancelado')).toBe(OrderStatus.CANCELLED);

    expect(mapErpOrderStatusToWeb(OrderStatus.PENDING)).toBe('confirmado');
    expect(mapErpOrderStatusToWeb(OrderStatus.PREPARING)).toBe('en_armado');
    expect(mapErpOrderStatusToWeb(OrderStatus.PREPARED)).toBe('en_reparto');
    expect(mapErpOrderStatusToWeb(OrderStatus.DELIVERED)).toBe('entregado');
    expect(mapErpOrderStatusToWeb(OrderStatus.CANCELLED)).toBe('cancelado');
  });
});
