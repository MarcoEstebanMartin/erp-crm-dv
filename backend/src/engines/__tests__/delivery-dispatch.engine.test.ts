import { describe, expect, it } from 'vitest';
import {
  buildDispatchDriverCandidates,
  computeTripSummaryMetrics,
  isRoadFleetVehicle,
  normalizeStopSequences,
  resolveDefaultDeliveryMethod,
  validateOrderDeliveryAssignment,
} from '../delivery-dispatch.engine';

describe('delivery-dispatch.engine — Reglas Puras de Despacho, Flota y Retiro Local', () => {
  it('filtra ELEV-VERDE, ELEV-ROSA, DEP-GRAL, particulares/gerenciales e inactivos dejando solo vehículos de reparto ACTIVE', () => {
    const vehicles = [
      { id: 1, plate: 'AB 919 WO', brand: 'MERCEDES BENZ', model: 'ACCELO 1016', status: 'ACTIVE' },
      { id: 2, plate: 'ELEV-VERDE', brand: 'AUTOELEVADOR', model: 'VERDE ELECTRICO', status: 'ACTIVE' },
      { id: 3, plate: 'ELEV-ROSA', brand: 'AUTOELEVADOR', model: 'ROSA', status: 'ACTIVE' },
      { id: 4, plate: 'DEP-GRAL', brand: 'ADMINISTRACION', model: 'DEPOSITO Y CHOFERES', status: 'ACTIVE' },
      { id: 5, plate: 'FUL 385', brand: 'MERCEDES BENZ', model: '710', status: 'MAINTENANCE' },
      { id: 6, plate: 'AE 764 FE', brand: 'PEUGEOT', model: 'PARTNER', status: 'ACTIVE' },
      { id: 7, plate: 'AF 747 KX', brand: 'VOLKSWAGEN', model: 'AMAROK 3.0', status: 'ACTIVE' },
      { id: 8, plate: 'AD 032 KX', brand: 'VOLKSWAGEN', model: 'AMAROK 2.0', status: 'ACTIVE' },
      { id: 9, plate: 'OTF 197', brand: 'AUDI', model: 'A1 1.4 T SPORTBACK', status: 'ACTIVE' },
    ];

    const roadPlates = vehicles.filter(isRoadFleetVehicle).map((v) => v.plate);
    expect(roadPlates).toEqual(['AB 919 WO', 'AE 764 FE']);
  });

  it('prioriza choferes de LOGISTICA, excluye Dirección sin rol de chofer e inactivos', () => {
    const candidates = buildDispatchDriverCandidates([
      { id: 81, firstName: 'Marco Esteban', lastName: 'Martín', position: 'Socio / Dirección', department: 'DIRECCION', isActive: true, userId: null },
      { id: 76, firstName: 'Tiago Iván', lastName: 'Balmaceda', position: 'Operario Depósito', department: 'DEPOSITO', isActive: true, userId: 76 },
      { id: 75, firstName: 'Matías Ignacio', lastName: 'Rodríguez', position: 'Chofer / Repartidor', department: 'LOGISTICA', isActive: true, userId: 75 },
      { id: 78, firstName: 'Miguel', lastName: 'Alberca', position: 'Chofer / Repartidor', department: 'LOGISTICA', isActive: true, userId: 74 },
      { id: 79, firstName: 'Norberto', lastName: 'Ramos', position: 'Vendedor Preventista / Reparto', department: 'VENTAS', isActive: true, userId: 68 },
      { id: 99, firstName: 'Inactivo', lastName: 'Test', position: 'Chofer', department: 'LOGISTICA', isActive: false, userId: null },
    ]);

    expect(candidates.map((c) => c.employeeId)).toEqual([75, 78, 79, 76]);
    expect(candidates[0].isPrimaryDriver).toBe(true);
    expect(candidates[2].isPrimaryDriver).toBe(true);
    expect(candidates[3].isPrimaryDriver).toBe(false);
  });

  it('resuelve defaults exactos: Preventa/Web -> DELIVERY y Factura Directa Mostrador -> PICKUP', () => {
    expect(resolveDefaultDeliveryMethod({ salesChannel: 'PREVENTA_RUTA' })).toBe('DELIVERY');
    expect(resolveDefaultDeliveryMethod({ salesChannel: 'TIENDA_WEB' })).toBe('DELIVERY');
    expect(resolveDefaultDeliveryMethod({ salesChannel: 'MOSTRADOR', isDirectCounterInvoice: false })).toBe('DELIVERY');
    expect(resolveDefaultDeliveryMethod({ salesChannel: 'MOSTRADOR', isDirectCounterInvoice: true })).toBe('PICKUP');
    expect(
      resolveDefaultDeliveryMethod({
        salesChannel: 'MOSTRADOR',
        isDirectCounterInvoice: true,
        explicitMethod: 'DELIVERY',
      }),
    ).toBe('DELIVERY');
  });

  it('rechaza reasignar pedidos en viaje IN_TRANSIT/COMPLETED, rutas no pendientes o markPickedUp sin factura', () => {
    expect(() =>
      validateOrderDeliveryAssignment({
        order: {
          id: 50,
          status: 'DELIVERED',
          invoiceNumber: 'INT-00050',
          deliveryMethod: 'DELIVERY',
          deliveryRouteId: 3,
          currentRouteStatus: 'IN_TRANSIT',
        },
        targetMethod: 'PICKUP',
      }),
    ).toThrow(/viaje en curso o completado/i);

    expect(() =>
      validateOrderDeliveryAssignment({
        order: {
          id: 51,
          status: 'PREPARED',
          invoiceNumber: null,
          deliveryMethod: 'DELIVERY',
          deliveryRouteId: null,
        },
        targetMethod: 'PICKUP',
        markPickedUp: true,
      }),
    ).toThrow(/debe facturarse antes de registrar su entrega/i);

    expect(() =>
      validateOrderDeliveryAssignment({
        order: {
          id: 52,
          status: 'PREPARED',
          invoiceNumber: 'INT-00052',
          deliveryMethod: 'DELIVERY',
          deliveryRouteId: null,
        },
        targetMethod: 'DELIVERY',
        targetRoute: { id: 8, status: 'IN_TRANSIT' },
      }),
    ).toThrow(/estado Pendiente/i);

    expect(() =>
      validateOrderDeliveryAssignment({
        order: {
          id: 53,
          status: 'PREPARED',
          invoiceNumber: 'INT-00053',
          deliveryMethod: 'DELIVERY',
          deliveryRouteId: null,
        },
        targetMethod: 'PICKUP',
        targetRoute: { id: 8, status: 'PENDING' },
      }),
    ).toThrow(/retiro en local no puede tener un viaje asignado/i);

    const okPickup = validateOrderDeliveryAssignment({
      order: {
        id: 54,
        status: 'DELIVERED',
        invoiceNumber: '00001-00000054',
        deliveryMethod: 'DELIVERY',
        deliveryRouteId: null,
      },
      targetMethod: 'PICKUP',
      markPickedUp: true,
    });
    expect(okPickup).toEqual({
      deliveryMethod: 'PICKUP',
      deliveryRouteId: null,
      clearSequence: true,
      stampDeliveredAt: true,
      clearDeliveredAt: false,
    });

    const okDirectDelivery = validateOrderDeliveryAssignment({
      order: {
        id: 55,
        status: 'DELIVERED',
        invoiceNumber: 'INT-00055',
        deliveryMethod: 'DELIVERY',
        deliveryRouteId: null,
      },
      targetMethod: 'DELIVERY',
      markDelivered: true,
    });
    expect(okDirectDelivery).toEqual({
      deliveryMethod: 'DELIVERY',
      deliveryRouteId: null,
      clearSequence: true,
      stampDeliveredAt: true,
      clearDeliveredAt: false,
    });

    expect(() =>
      validateOrderDeliveryAssignment({
        order: {
          id: 56,
          status: 'PREPARED',
          invoiceNumber: null,
          deliveryMethod: 'DELIVERY',
          deliveryRouteId: null,
        },
        targetMethod: 'DELIVERY',
        markDelivered: true,
      }),
    ).toThrow(/debe facturarse antes de registrar su entrega directa/i);

    expect(() =>
      validateOrderDeliveryAssignment({
        order: {
          id: 57,
          status: 'DELIVERED',
          invoiceNumber: 'INT-00057',
          deliveryMethod: 'DELIVERY',
          deliveryRouteId: null,
        },
        targetMethod: 'DELIVERY',
        targetRoute: { id: 8, status: 'PENDING' },
        markDelivered: true,
      }),
    ).toThrow(/no se puede registrar entrega directa y asignar un viaje pendiente/i);

    expect(() =>
      validateOrderDeliveryAssignment({
        order: {
          id: 58,
          status: 'DELIVERED',
          invoiceNumber: 'INT-00058',
          deliveryMethod: 'DELIVERY',
          deliveryRouteId: 3,
          currentRouteStatus: 'IN_TRANSIT',
        },
        targetMethod: 'DELIVERY',
        markDelivered: true,
      }),
    ).toThrow(/viaje en curso o completado/i);

    expect(() =>
      validateOrderDeliveryAssignment({
        order: {
          id: 59,
          status: 'PREPARED',
          invoiceNumber: null,
          deliveryMethod: 'DELIVERY',
          deliveryRouteId: null,
        },
        targetMethod: 'DELIVERY',
        targetRoute: { id: 8, status: 'PENDING' },
      }),
    ).toThrow(/debe facturarse antes de asignarse a un viaje/i);
  });

  it('normaliza secuencias de parada deduplicadas y suma bultos/pesos con Decimal.js ROUND_HALF_UP', () => {
    expect(normalizeStopSequences([14, 9, 14, -2, 22])).toEqual([
      { orderId: 14, deliverySequence: 1 },
      { orderId: 9, deliverySequence: 2 },
      { orderId: 22, deliverySequence: 3 },
    ]);

    const metrics = computeTripSummaryMetrics([
      { status: 'PREPARED', bultosCount: 3, totalAmount: '12500.50' },
      { status: 'DELIVERED', bultosCount: 0, totalAmount: '8499.49' },
      { status: 'CANCELLED', bultosCount: 10, totalAmount: '99999.00' },
    ]);
    expect(metrics).toEqual({
      ordersCount: 2,
      totalBultos: 4,
      totalAmountPesos: 21000,
    });
  });
});
