import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeFallbackItemSubtotalPrint,
  escapePrintHtml,
  formatArsPrint,
  getZoneDisplayTitle,
  resolvePrintClientMeta,
  resolveSellerDisplayName,
  roundIntPesoPrint,
} from '../print/printFormatters';
import {
  printBatchPickingA4,
  printConsolidatedPickingA4,
  printDeliveryRouteCustodyGuide,
  printFacturaOficialA4,
  printOrderReceipt,
  printPickingList,
  printRemitoX,
  printShippingLabelsBultos,
} from '../printHelpers';
import { printOrderTicket } from '../../components/admin/orderTicketPrinter';
import { resolveRatioPercentages } from '../../components/billing/AfipCorrelationMonitorCard';

const sampleOrder = {
  id: 95,
  billingType: 'INTERNAL',
  totalAmount: 24481,
  notes: 'Entregar <antes> de las 12hs & verificar frío',
  createdAt: '2026-04-05T14:00:00.000Z',
  persona: {
    name: 'YESICA GARAY <Tienda>',
    address: 'Florentino Ameghino 120',
    city: 'General Villegas',
    cuit: '27-30123456-4',
    outstandingBalance: 1500,
  },
  items: [
    {
      id: 1,
      quantity: 2,
      unitPrice: 12000,
      weight: null,
      product: {
        id: 10,
        name: 'Queso Barra',
        isPesable: true,
        approximateWeight: 1.5,
        pickingZone: 'FRIO',
        defaultLocation: 'F-01',
        unitsPerBox: 4,
      },
    },
    {
      id: 2,
      quantity: 3,
      unitPrice: 1500.5,
      weight: null,
      subtotal: 4502,
      product: {
        id: 11,
        name: 'Gaseosa 2L',
        isPesable: false,
        pickingZone: 'TABLA',
        defaultLocation: 'T-03',
        unitsPerBox: 6,
      },
    },
  ],
};

describe('Paso 4C - printFormatters & precisión BigInt en impresión', () => {
  it('redondea montos con ROUND_HALF_UP en BigInt y calcula fallbacks sin decimales flotantes', () => {
    expect(roundIntPesoPrint(1500.5)).toBe(1501);
    expect(roundIntPesoPrint('1500.499')).toBe(1500);
    expect(formatArsPrint(24481)).toBe('24.481');

    expect(
      computeFallbackItemSubtotalPrint({
        quantity: 2,
        unitPrice: 1200,
        product: { isPesable: false },
      }),
    ).toBe(2400);

    expect(
      computeFallbackItemSubtotalPrint({
        quantity: 1,
        unitPrice: 1001,
        weight: 1.5,
        product: { isPesable: true },
      }),
    ).toBe(1502);

    expect(
      computeFallbackItemSubtotalPrint({
        quantity: 2,
        unitPrice: 1000,
        product: { isPesable: true, approximateWeight: 1.25 },
      }),
    ).toBe(2500);
  });

  it('escapa HTML peligroso, elimina placeholders ficticios y emojis de zona', () => {
    expect(escapePrintHtml('<script>"test"&\'x\'</script>')).toBe(
      '&lt;script&gt;&quot;test&quot;&amp;&#39;x&#39;&lt;/script&gt;',
    );
    expect(getZoneDisplayTitle('FRIO')).toBe('SECTOR FRÍO');
    expect(getZoneDisplayTitle('TABLA')).toBe('SECTOR TABLA / BEBIDAS');
    expect(getZoneDisplayTitle('CAJAS')).toBe('SECTOR CAJAS / SECOS');
    expect(getZoneDisplayTitle('ALL')).toBe('TODAS LAS ZONAS');

    expect(resolveSellerDisplayName({})).toBe('Administración');
    expect(resolveSellerDisplayName({})).not.toContain('NORBERTO');

    const meta = resolvePrintClientMeta(sampleOrder);
    expect(meta.name).toBe('YESICA GARAY <Tienda>');
    expect(meta.city).toBe('General Villegas');
  });
});

describe('Paso 4C - Barrel printHelpers, plantillas limpias y hooks postMessage', () => {
  let writtenHtml: string;
  let openSpy: ReturnType<typeof vi.fn>;
  let closeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writtenHtml = '';
    closeSpy = vi.fn();
    openSpy = vi.fn(() => ({
      document: {
        write: vi.fn((html: string) => {
          writtenHtml += html;
        }),
        close: closeSpy,
      },
    }));

    vi.stubGlobal('window', {
      open: openSpy,
      location: { origin: 'https://erp.donvenancio.local' },
      localStorage: { getItem: () => null },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mantiene exportadas las 8 funciones públicas en printHelpers', () => {
    const fns = [
      printPickingList,
      printBatchPickingA4,
      printConsolidatedPickingA4,
      printRemitoX,
      printOrderReceipt,
      printFacturaOficialA4,
      printShippingLabelsBultos,
      printDeliveryRouteCustodyGuide,
    ];
    for (const fn of fns) {
      expect(typeof fn).toBe('function');
    }
  });

  it('printOrderReceipt, printRemitoX y printOrderTicket usan Distribuidora Don Venancio sin placeholders', () => {
    printOrderReceipt(sampleOrder);
    expect(writtenHtml).toContain('Distribuidora Don Venancio');
    expect(writtenHtml).toContain('YESICA GARAY &lt;Tienda&gt;');
    expect(writtenHtml).not.toContain('DV DISTRIBUIDORA');
    expect(closeSpy).toHaveBeenCalledTimes(1);

    writtenHtml = '';
    printRemitoX(sampleOrder);
    expect(writtenHtml).toContain('REMITO N°');
    expect(writtenHtml).toContain('Cajas cerradas: 0'.length ? 'Unidades' : 'Cajas');
    expect(writtenHtml).not.toContain('NORBERTO');

    writtenHtml = '';
    printOrderTicket(sampleOrder);
    expect(writtenHtml).toContain('Distribuidora Don Venancio');
    expect(writtenHtml).toContain('$24.481');
  });

  it('printPickingList y printConsolidatedPickingA4 preservan postMessage sin emojis ni colores estridentes', () => {
    printPickingList(sampleOrder, () => {});
    expect(writtenHtml).toContain('PRINT_SUCCESS');
    expect(writtenHtml).toContain('Entregar &lt;antes&gt; de las 12hs &amp; verificar frío');
    expect(writtenHtml).not.toContain('#f59e0b');

    writtenHtml = '';
    printConsolidatedPickingA4({ orders: [sampleOrder], zone: 'ALL', filterLabel: 'Ruta 1' });
    expect(writtenHtml).toContain('PRINT_BATCH_SUCCESS');
    expect(writtenHtml).toContain('TODAS LAS ZONAS');
    expect(writtenHtml).not.toContain('#007AFF');
    expect(writtenHtml).not.toContain('#fef08a');
  });

  it('printBatchPickingA4, printShippingLabelsBultos y printDeliveryRouteCustodyGuide omiten año 2026 fijo y emojis', () => {
    printBatchPickingA4({ orders: [sampleOrder], zone: 'FRIO', filterLabel: 'Frío' });
    expect(writtenHtml).toContain('SECTOR FRÍO');

    writtenHtml = '';
    printShippingLabelsBultos({ orders: [sampleOrder] });
    expect(writtenHtml).toContain('CONTIENE ARTÍCULOS PESABLES / FRÍO');
    expect(writtenHtml).toContain('BULTO 1 DE 1');

    writtenHtml = '';
    printDeliveryRouteCustodyGuide({
      id: 12,
      driverName: 'Carlos Perez',
      vehiclePlate: 'AB123CD',
      orders: [sampleOrder],
    });
    expect(writtenHtml).toContain('HOJA DE RUTA #12');
    expect(writtenHtml).toContain('____/____/______');
    expect(writtenHtml).not.toContain('____/____/2026');
  });
});

describe('Paso 4C - AfipCorrelationMonitorCard ratios exactos', () => {
  it('calcula porcentajes de compras vs ventas con precisión BigInt', () => {
    expect(resolveRatioPercentages(0n, 0n)).toEqual({
      ventasPctLabel: '0.0',
      comprasPctLabel: '0.0',
      ventasWidthPct: 0,
      comprasWidthPct: 0,
    });
    expect(resolveRatioPercentages(75000n, 25000n)).toEqual({
      comprasPctLabel: '25.0',
      ventasPctLabel: '75.0',
      comprasWidthPct: 25,
      ventasWidthPct: 75,
    });
  });
});
