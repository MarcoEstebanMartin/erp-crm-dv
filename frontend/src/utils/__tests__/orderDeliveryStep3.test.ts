import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  formatDeliveryRouteOptionLabel,
  formatOrderDeliverySummary,
  parseDeliverySelectionValue,
} from '../orderDeliveryHelpers';
import { getOrderStatusInfo } from '../orderStatusHelper';
import { matchesOrderStatusFilter } from '../orderSearchAndStatus.helper';
import { buildDirectInvoiceRequest } from '../../components/billing/sales/salesBilling.helpers';
import { INITIAL_DIRECT_INVOICE_FORM } from '../../components/billing/sales/sales.types';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(TEST_DIR, '../..');

const STEP3_FILES = [
  'utils/types.ts',
  'utils/orderStatusHelper.ts',
  'utils/orderSearchAndStatus.helper.ts',
  'utils/orderDeliveryHelpers.ts',
  'api/order.api.ts',
  'hooks/queries/useOrdersQuery.ts',
  'components/common/OrderDeliveryBadgeControl.tsx',
  'components/admin/AdminCreateQuickOrderModal.tsx',
  'components/modals/OrderFulfillmentModal.tsx',
  'components/modals/OrderFulfillmentBillingPanel.tsx',
  'components/billing/sales/sales.types.ts',
  'components/billing/sales/salesBilling.helpers.ts',
  'components/billing/sales/DirectInvoicePaymentPanel.tsx',
  'components/admin/OrdersTab.tsx',
  'components/admin/FulfillmentDashboard.tsx',
  'components/admin/FulfillmentOrderCard.tsx',
  'components/admin/FulfillmentListView.tsx',
  'components/admin/AdminOrderDetailsModal.tsx',
  'components/AdminDashboard.tsx',
] as const;

const STEP3_IDEAL_MODULES = [
  'utils/orderDeliveryHelpers.ts',
  'components/common/OrderDeliveryBadgeControl.tsx',
  'components/admin/FulfillmentListView.tsx',
] as const;

const UNICODE_EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const EJ_PLACEHOLDER_RE = /\bej\s*:/i;

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(SRC_DIR, relPath), 'utf8');
}

describe('Paso 3 — Designación Directa en Pedidos (Viaje Específico o Retiro en Local)', () => {
  it('formatea etiquetas de viajes y resúmenes de entrega (sin viaje, pendiente, en curso, retiro local y cancelado)', () => {
    expect(
      formatDeliveryRouteOptionLabel({
        id: 14,
        routeName: 'Sur Ruta 33',
        driverName: 'Matías Rodríguez',
      }),
    ).toBe('Viaje #14 · Sur Ruta 33 (Matías Rodríguez)');

    expect(
      formatDeliveryRouteOptionLabel({
        id: 15,
        driverName: 'Norberto Ramos',
        vehiclePlate: 'AB 919 WO',
      }),
    ).toBe('Viaje #15 · Norberto Ramos · AB 919 WO');

    const unassigned = formatOrderDeliverySummary({
      id: 1,
      status: 'PENDING',
      deliveryMethod: 'DELIVERY',
      deliveryRouteId: null,
    });
    expect(unassigned).toMatchObject({
      method: 'DELIVERY',
      routeId: null,
      isLocked: false,
      canMarkPickedUp: false,
      badgeLabel: 'Reparto · Sin viaje',
      selectValue: 'DELIVERY_UNASSIGNED',
    });

    const pendingTrip = formatOrderDeliverySummary({
      id: 2,
      status: 'PREPARED',
      deliveryMethod: 'DELIVERY',
      deliveryRouteId: 14,
      deliveryRoute: {
        id: 14,
        routeName: 'Ameghino',
        status: 'PENDING',
        driverName: 'Matías Rodríguez',
        vehiclePlate: 'AB 919 WO',
      },
    });
    expect(pendingTrip).toMatchObject({
      method: 'DELIVERY',
      routeId: 14,
      isLocked: false,
      badgeLabel: 'Viaje #14 · Ameghino',
      subLabel: 'Matías Rodríguez · AB 919 WO',
      selectValue: 'ROUTE:14',
    });

    const inTransitLocked = formatOrderDeliverySummary({
      id: 3,
      status: 'DELIVERED',
      deliveryMethod: 'DELIVERY',
      deliveryRouteId: 14,
      deliveryRoute: { id: 14, status: 'IN_TRANSIT' },
    });
    expect(inTransitLocked.isLocked).toBe(true);

    const pickupPendingBill = formatOrderDeliverySummary({
      id: 4,
      status: 'PREPARED',
      deliveryMethod: 'PICKUP',
      invoiceNumber: null,
    });
    expect(pickupPendingBill).toMatchObject({
      method: 'PICKUP',
      isPickedUp: false,
      canMarkPickedUp: false,
      badgeLabel: 'Retiro local',
      selectValue: 'PICKUP',
    });

    const pickupReady = formatOrderDeliverySummary({
      id: 5,
      status: 'DELIVERED',
      deliveryMethod: 'PICKUP',
      invoiceNumber: 'INT-00005',
      deliveredAt: null,
    });
    expect(pickupReady.canMarkPickedUp).toBe(true);
    expect(pickupReady.badgeLabel).toBe('Retiro local');

    const pickupDone = formatOrderDeliverySummary({
      id: 6,
      status: 'DELIVERED',
      deliveryMethod: 'PICKUP',
      invoiceNumber: 'INT-00006',
      deliveredAt: '2026-11-16T15:00:00.000Z',
    });
    expect(pickupDone).toMatchObject({
      isPickedUp: true,
      canMarkPickedUp: false,
      badgeLabel: 'Retirado en local',
    });

    const cancelled = formatOrderDeliverySummary({
      id: 7,
      status: 'CANCELLED',
      deliveryMethod: 'DELIVERY',
    });
    expect(cancelled.isLocked).toBe(true);

    const directDeliveryReady = formatOrderDeliverySummary({
      id: 8,
      status: 'DELIVERED',
      deliveryMethod: 'DELIVERY',
      deliveryRouteId: null,
      invoiceNumber: 'INT-00008',
      deliveredAt: null,
    });
    expect(directDeliveryReady.canMarkDirectDelivered).toBe(true);

    const directDeliveryNoInvoice = formatOrderDeliverySummary({
      id: 9,
      status: 'PREPARED',
      deliveryMethod: 'DELIVERY',
      deliveryRouteId: null,
      invoiceNumber: null,
      deliveredAt: null,
    });
    expect(directDeliveryNoInvoice.canMarkDirectDelivered).toBe(false);

    const directDeliveryWithRoute = formatOrderDeliverySummary({
      id: 10,
      status: 'DELIVERED',
      deliveryMethod: 'DELIVERY',
      deliveryRouteId: 14,
      deliveryRoute: { id: 14, status: 'PENDING' },
      invoiceNumber: 'INT-00010',
      deliveredAt: null,
    });
    expect(directDeliveryWithRoute.canMarkDirectDelivered).toBe(false);

    const directDeliveryAlreadyDone = formatOrderDeliverySummary({
      id: 11,
      status: 'DELIVERED',
      deliveryMethod: 'DELIVERY',
      deliveryRouteId: null,
      invoiceNumber: 'INT-00011',
      deliveredAt: '2026-11-18T13:00:00.000Z',
    });
    expect(directDeliveryAlreadyDone.canMarkDirectDelivered).toBe(false);
  });

  it('parsea el selector controlado hacia el contrato de PATCH /api/orders/:id/delivery', () => {
    expect(parseDeliverySelectionValue('PICKUP')).toEqual({
      deliveryMethod: 'PICKUP',
      deliveryRouteId: null,
    });
    expect(parseDeliverySelectionValue('ROUTE:27')).toEqual({
      deliveryMethod: 'DELIVERY',
      deliveryRouteId: 27,
    });
    expect(parseDeliverySelectionValue('DELIVERY_UNASSIGNED')).toEqual({
      deliveryMethod: 'DELIVERY',
      deliveryRouteId: null,
    });
  });

  it('refleja deliveredAt y filtros RETIRO_LOCAL / SIN_VIAJE en estados de pedidos', () => {
    expect(
      getOrderStatusInfo({
        status: 'DELIVERED',
        invoiceNumber: '0002-00000100',
        deliveryMethod: 'DELIVERY',
        deliveredAt: null,
      }).label,
    ).toBe('Facturado');

    expect(
      getOrderStatusInfo({
        status: 'DELIVERED',
        invoiceNumber: '0002-00000100',
        deliveryMethod: 'PICKUP',
        deliveredAt: '2026-11-16T15:00:00.000Z',
      }).label,
    ).toBe('Entregado');

    expect(
      getOrderStatusInfo({
        status: 'DELIVERED',
        invoiceNumber: '0002-00000101',
        deliveryRoute: { status: 'IN_TRANSIT' },
      }).label,
    ).toBe('En Viaje');

    expect(
      matchesOrderStatusFilter(
        { status: 'DELIVERED', deliveryMethod: 'PICKUP', deliveredAt: null },
        'RETIRO_LOCAL',
      ),
    ).toBe(true);

    expect(
      matchesOrderStatusFilter(
        { status: 'DELIVERED', deliveryMethod: 'DELIVERY', deliveryRouteId: null, deliveredAt: null },
        'SIN_VIAJE',
      ),
    ).toBe(true);

    expect(
      matchesOrderStatusFilter(
        { status: 'DELIVERED', deliveryMethod: 'DELIVERY', deliveryRouteId: 9, deliveredAt: null },
        'SIN_VIAJE',
      ),
    ).toBe(false);
  });

  it('factura directa nace en Retiro local por defecto y soporta cambio a Reparto', () => {
    expect(INITIAL_DIRECT_INVOICE_FORM.deliveryMethod).toBe('PICKUP');

    const cart = [
      {
        product: { id: 10, minOrderQuantity: 1 },
        quantity: 2,
        weight: null,
        unitPrice: 1000,
        subtotal: 2000,
      },
    ];

    const pickupReq = buildDirectInvoiceRequest(
      { ...INITIAL_DIRECT_INVOICE_FORM, personaId: '50', cashDrawerId: '1' },
      cart,
      [{ id: 1 }],
      [],
    );
    expect(pickupReq.error).toBeUndefined();
    expect(pickupReq.payload?.deliveryMethod).toBe('PICKUP');
    expect(pickupReq.payload?.markDelivered).toBe(true);

    const deliveryReq = buildDirectInvoiceRequest(
      {
        ...INITIAL_DIRECT_INVOICE_FORM,
        personaId: '50',
        cashDrawerId: '1',
        deliveryMethod: 'DELIVERY',
      },
      cart,
      [{ id: 1 }],
      [],
    );
    expect(deliveryReq.error).toBeUndefined();
    expect(deliveryReq.payload?.deliveryMethod).toBe('DELIVERY');
    expect(deliveryReq.payload?.markDelivered).toBe(false);
  });

  it('respeta topes de líneas, minimalismo sin emojis ni ej: y cero alert/confirm nativo en Paso 3', () => {
    for (const relPath of STEP3_FILES) {
      const content = readSrc(relPath);
      const lineCount = content.split(/\r?\n/).length;
      expect(lineCount, `${relPath} tiene ${lineCount} líneas`).toBeLessThanOrEqual(450);
      expect(content, `${relPath} no debe tener emojis`).not.toMatch(UNICODE_EMOJI_RE);
      expect(content, `${relPath} no debe tener ej:`).not.toMatch(EJ_PLACEHOLDER_RE);
      expect(content, `${relPath} no debe usar alert(`).not.toMatch(/(?:^|[^\w$.])alert\s*\(/m);
      expect(content, `${relPath} no debe usar window.confirm`).not.toContain('window.confirm');
    }

    for (const relPath of STEP3_IDEAL_MODULES) {
      const lineCount = readSrc(relPath).split(/\r?\n/).length;
      expect(lineCount, `${relPath} tiene ${lineCount} líneas`).toBeLessThanOrEqual(300);
    }

    const detailsModal = readSrc('components/admin/AdminOrderDetailsModal.tsx');
    expect(detailsModal).not.toMatch(/textTransform:\s*['"]uppercase['"]/);
  });
});
