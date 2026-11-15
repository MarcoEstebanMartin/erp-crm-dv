import { describe, expect, it } from 'vitest';
import {
  getCompanyProfile,
  OFFICIAL_COMPANY_PROFILE,
  type StorageLike,
} from '../companyProfile';
import {
  matchesOrderSearch,
  matchesOrderStatusFilter,
  shouldShowInFulfillmentBilledColumn,
} from '../orderSearchAndStatus.helper';

function createMemoryStorage(initial: Record<string, string>): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

describe('Paso 2 — Búsqueda fonética, filtros de estado, CAE diferido y perfil oficial', () => {
  it('encuentra pedidos usando order.persona (sin order.client), búsqueda fonética rioplatense, #id y código web DV', () => {
    const order = {
      id: 95,
      notes: '[DV-1042] Retira cliente',
      persona: {
        name: 'YESICA GARAY',
        cuit: '27-33444555-6',
        city: 'FLORENTINO AMEGHINO',
        saleRoute: { name: 'RUTA 188' },
      },
    };

    expect(matchesOrderSearch(order, 'yesica')).toBe(true);
    expect(matchesOrderSearch(order, 'llésica garai')).toBe(true);
    expect(matchesOrderSearch(order, 'yessika')).toBe(true);
    expect(matchesOrderSearch(order, '#95')).toBe(true);
    expect(matchesOrderSearch(order, 'DV-1042')).toBe(true);
    expect(matchesOrderSearch(order, 'ameghino')).toBe(true);
    expect(matchesOrderSearch(order, 'cliente inexistente')).toBe(false);
  });

  it('mapea correctamente los filtros de estado Recibido, En Picking, Armado y Facturado', () => {
    const pendingOrder = { id: 1, status: 'PENDING', pickingStarted: false };
    const pickingOrder = { id: 2, status: 'PREPARING' };
    const preparedOrder = { id: 3, status: 'PREPARED' };
    const invoicedOrder = { id: 4, status: 'PREPARED', invoiceNumber: 'PRE-B-000004' };

    expect(matchesOrderStatusFilter(pendingOrder, 'RECIBIDO')).toBe(true);
    expect(matchesOrderStatusFilter(pendingOrder, 'PENDIENTE')).toBe(true);
    expect(matchesOrderStatusFilter(pickingOrder, 'EN_PICKING')).toBe(true);
    expect(matchesOrderStatusFilter(preparedOrder, 'ARMADO')).toBe(true);
    expect(matchesOrderStatusFilter(invoicedOrder, 'FACTURADO')).toBe(true);
    expect(matchesOrderStatusFilter(pendingOrder, 'FACTURADO')).toBe(false);
  });

  it('retiene Pre-Facturas oficiales de días anteriores sin CAE en Facturados Hoy y oculta las que ya tienen CAE de otro día', () => {
    const now = new Date('2026-11-14T15:00:00.000-03:00');

    const priorDayPendingCae = {
      id: 101,
      status: 'DELIVERED',
      billingType: 'OFFICIAL',
      invoiceNumber: 'PRE-A-00012',
      cae: null,
      updatedAt: '2026-11-12T18:00:00.000-03:00',
    };

    const priorDayWithCae = {
      id: 102,
      status: 'DELIVERED',
      billingType: 'OFFICIAL',
      invoiceNumber: '0001-00000102',
      cae: '74123456789012',
      updatedAt: '2026-11-12T18:00:00.000-03:00',
    };

    const todayWithCae = {
      id: 103,
      status: 'DELIVERED',
      billingType: 'OFFICIAL',
      invoiceNumber: '0001-00000103',
      cae: '74123456789013',
      updatedAt: '2026-11-14T00:30:00.000-03:00',
    };

    expect(shouldShowInFulfillmentBilledColumn(priorDayPendingCae, now)).toBe(true);
    expect(shouldShowInFulfillmentBilledColumn(priorDayWithCae, now)).toBe(false);
    expect(shouldShowInFulfillmentBilledColumn(todayWithCae, now)).toBe(true);
  });

  it('depura placeholders legados en localStorage y devuelve el perfil oficial de Don Venancio', () => {
    const storage = createMemoryStorage({
      auth_config: JSON.stringify({
        company: {
          razonSocial: 'Distribuidora de Bebidas SRL',
          nombreFantasia: 'DISTRIBUIDORA DV',
          cuit: '30-71490283-9',
          direccion: 'Calle Falsa 1234, Quilmes',
          telefono: '0800-333-1212',
          email: 'contacto@distribuidoradv.com',
          puntoVenta: 2,
        },
      }),
    });

    const profile = getCompanyProfile(storage);
    expect(profile.razonSocial).toBe(OFFICIAL_COMPANY_PROFILE.razonSocial);
    expect(profile.nombreFantasia).toBe(OFFICIAL_COMPANY_PROFILE.nombreFantasia);
    expect(profile.cuit).toBe(OFFICIAL_COMPANY_PROFILE.cuit);
    expect(profile.direccion).toBe(OFFICIAL_COMPANY_PROFILE.direccion);
    expect(profile.telefono).toBe(OFFICIAL_COMPANY_PROFILE.telefono);
    expect(profile.email).toBe(OFFICIAL_COMPANY_PROFILE.email);
    expect(profile.puntoVenta).toBe(2);
  });
});
