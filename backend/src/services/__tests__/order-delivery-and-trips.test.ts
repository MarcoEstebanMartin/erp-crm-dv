import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryMethod, OrderStatus, Role } from '@prisma/client';

vi.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    order: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    deliveryRoute: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    vehicle: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    employee: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../utils/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../orders/web-order-status-bridge.service', () => ({
  notifyWebOrderStatusForErpOrder: vi.fn(),
}));

import prisma from '../../utils/prisma';
import { OrderQueriesService } from '../orders/order-queries.service';
import { OrderDeliveryService } from '../orders/order-delivery.service';
import { deliveryRouteService } from '../logistics/delivery-route.service';
import { logisticsResourcesService } from '../logistics/logistics-resources.service';

describe('Paso 1 Entregas y Viajes — Queries, Asignación, Rutas y Recursos Reales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('OrderQueriesService.getOrders selecciona latitude/longitude y filtra RETIRO_LOCAL, SIN_VIAJE y dispatchQueue', async () => {
    (prisma.order.findMany as any).mockResolvedValue([]);
    (prisma.order.count as any).mockResolvedValue(0);

    await OrderQueriesService.getOrders({
      userId: 1,
      userRole: Role.ADMIN,
      statusGroup: 'RETIRO_LOCAL',
    });

    const firstCall = (prisma.order.findMany as any).mock.calls[0][0];
    expect(firstCall.include.persona.select.latitude).toBe(true);
    expect(firstCall.include.persona.select.longitude).toBe(true);
    expect(firstCall.include.deliveryRoute.select.routeName).toBe(true);
    expect(firstCall.where.AND).toContainEqual({
      deliveryMethod: DeliveryMethod.PICKUP,
      status: { not: OrderStatus.CANCELLED },
    });

    await OrderQueriesService.getOrders({
      userId: 1,
      userRole: Role.ADMIN,
      statusGroup: 'SIN_VIAJE',
      dispatchQueue: 'true',
    });

    const secondCall = (prisma.order.findMany as any).mock.calls[1][0];
    expect(secondCall.where.AND).toContainEqual(
      expect.objectContaining({
        deliveryMethod: DeliveryMethod.DELIVERY,
        deliveryRouteId: null,
        deliveredAt: null,
      }),
    );
  });

  it('OrderDeliveryService.updateOrderDelivery asigna viaje con secuencia, recalcula bultos y valida factura en retiro', async () => {
    const updatedOrderMock = {
      id: 21,
      personaId: 10,
      deliveryMethod: DeliveryMethod.DELIVERY,
      deliveryRouteId: 5,
      deliverySequence: 2,
      deliveredAt: null,
      status: OrderStatus.PREPARED,
    };

    const mockTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 21 }]),
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 21,
          sellerId: 66,
          status: OrderStatus.PREPARED,
          invoiceNumber: 'INT-00021',
          deliveryMethod: DeliveryMethod.DELIVERY,
          deliveryRouteId: null,
          deliverySequence: null,
          deliveredAt: null,
          deliveryRoute: null,
          persona: { id: 10, name: 'Despensa Norte' },
        }),
        count: vi.fn().mockResolvedValue(1),
        update: vi.fn().mockResolvedValue(updatedOrderMock),
        findMany: vi.fn().mockResolvedValue([
          { id: 19, status: OrderStatus.PREPARED, bultosCount: 2, totalAmount: '5000' },
          { id: 21, status: OrderStatus.PREPARED, bultosCount: 3, totalAmount: '8000' },
        ]),
      },
      deliveryRoute: {
        findUnique: vi.fn().mockResolvedValue({ id: 5, status: 'PENDING' }),
        update: vi.fn().mockResolvedValue({ id: 5, totalBultos: 5 }),
      },
    };
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const res = await OrderDeliveryService.updateOrderDelivery({
      orderId: 21,
      userId: 71,
      userRole: Role.ADMIN,
      deliveryMethod: DeliveryMethod.DELIVERY,
      deliveryRouteId: 5,
    });

    expect(res.deliveryRouteId).toBe(5);
    expect(mockTx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 21 },
        data: expect.objectContaining({
          deliveryMethod: DeliveryMethod.DELIVERY,
          deliveryRouteId: 5,
          deliverySequence: 2,
          deliveredAt: null,
        }),
      }),
    );
    expect(mockTx.deliveryRoute.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { totalBultos: 5 },
    });

    // Rechaza marcar retirado si no tiene comprobante facturado
    mockTx.order.findUnique.mockResolvedValueOnce({
      id: 22,
      sellerId: 66,
      status: OrderStatus.PREPARED,
      invoiceNumber: null,
      deliveryMethod: DeliveryMethod.DELIVERY,
      deliveryRouteId: null,
      deliveryRoute: null,
      persona: { id: 10, name: 'Despensa Norte' },
    });

    await expect(
      OrderDeliveryService.updateOrderDelivery({
        orderId: 22,
        userId: 71,
        userRole: Role.ADMIN,
        deliveryMethod: DeliveryMethod.PICKUP,
        markPickedUp: true,
      }),
    ).rejects.toThrow(/debe facturarse antes de registrar su entrega/i);
  });

  it('OrderDeliveryService.bulkUpdateOrdersDelivery asigna varios pedidos en lote en una transacción', async () => {
    const orderUpdate = vi.fn().mockResolvedValue({});
    const mockTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      deliveryRoute: {
        findUnique: vi.fn().mockResolvedValue({ id: 9, status: 'PENDING' }),
        update: vi.fn().mockResolvedValue({ id: 9, totalBultos: 4 }),
      },
      order: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            { id: 101, status: OrderStatus.PREPARED, invoiceNumber: 'INT-00101', deliveryMethod: DeliveryMethod.DELIVERY, deliveryRouteId: null, deliverySequence: null, deliveredAt: null, deliveryRoute: null },
            { id: 102, status: OrderStatus.PREPARED, invoiceNumber: 'INT-00102', deliveryMethod: DeliveryMethod.PICKUP, deliveryRouteId: null, deliverySequence: null, deliveredAt: null, deliveryRoute: null },
          ])
          .mockResolvedValueOnce([
            { id: 101, status: OrderStatus.PREPARED, bultosCount: 2, totalAmount: '10000' },
            { id: 102, status: OrderStatus.PREPARED, bultosCount: 2, totalAmount: '15000' },
          ]),
        count: vi.fn().mockResolvedValue(0),
        update: orderUpdate,
      },
    };
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const result = await OrderDeliveryService.bulkUpdateOrdersDelivery({
      orderIds: [101, 102],
      userId: 71,
      userRole: Role.ADMIN,
      deliveryMethod: DeliveryMethod.DELIVERY,
      deliveryRouteId: 9,
    });

    expect(result).toEqual({ updatedCount: 2, deliveryMethod: DeliveryMethod.DELIVERY, deliveryRouteId: 9 });
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 101 },
        data: expect.objectContaining({ deliveryRouteId: 9, deliverySequence: 1 }),
      }),
    );
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 102 },
        data: expect.objectContaining({ deliveryRouteId: 9, deliverySequence: 2 }),
      }),
    );
  });

  it('deliveryRouteService.createDeliveryRoute y updateDeliveryRoute guardan routeName, driverEmployeeId, vehicleId y orden 1..N', async () => {
    (prisma.employee.findUnique as any).mockResolvedValue({
      id: 75,
      firstName: 'Matías Ignacio',
      lastName: 'Rodríguez',
      isActive: true,
    });
    (prisma.vehicle.findUnique as any).mockResolvedValue({
      id: 1,
      plate: 'AB 919 WO',
      brand: 'MERCEDES BENZ',
      model: 'ACCELO 1016',
    });

    const txOrderUpdate = vi.fn().mockResolvedValue({});
    const mockTx: any = {
      deliveryRoute: {
        create: vi.fn().mockResolvedValue({ id: 15, status: 'PENDING', totalBultos: 0 }),
        update: vi.fn().mockResolvedValue({
          id: 15,
          routeName: 'Bunge y Charlone',
          driverName: 'Matías Ignacio Rodríguez',
          driverEmployeeId: 75,
          vehicleId: 1,
          vehiclePlate: 'AB 919 WO',
          totalBultos: 4,
          status: 'PENDING',
        }),
      },
      order: {
        findMany: vi.fn().mockResolvedValue([
          { id: 30, status: OrderStatus.PREPARED, invoiceNumber: 'INT-00030', deliveryMethod: DeliveryMethod.DELIVERY, deliveryRouteId: null, deliveredAt: null, bultosCount: 2, totalAmount: '12000', deliveryRoute: null },
          { id: 31, status: OrderStatus.PREPARED, invoiceNumber: 'INT-00031', deliveryMethod: DeliveryMethod.DELIVERY, deliveryRouteId: null, deliveredAt: null, bultosCount: 2, totalAmount: '14000', deliveryRoute: null },
        ]),
        update: txOrderUpdate,
      },
    };
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const created = await deliveryRouteService.createDeliveryRoute({
      userId: 71,
      routeName: 'Bunge y Charlone',
      driverEmployeeId: 75,
      vehicleId: 1,
      orderIds: [31, 30],
    });

    expect(created.id).toBe(15);
    expect(txOrderUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 31 },
        data: expect.objectContaining({ deliveryRouteId: 15, deliverySequence: 1 }),
      }),
    );
    expect(txOrderUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 30 },
        data: expect.objectContaining({ deliveryRouteId: 15, deliverySequence: 2 }),
      }),
    );

    // Bloquea editar viaje si no está en PENDING
    (prisma.deliveryRoute.findUnique as any).mockResolvedValueOnce({
      id: 15,
      status: 'IN_TRANSIT',
      orders: [],
    });
    await expect(
      deliveryRouteService.updateDeliveryRoute({ routeId: 15, routeName: 'Nuevo nombre' }),
    ).rejects.toThrow(/estado Pendiente/i);
  });

  it('logisticsResourcesService.getLogisticsResources devuelve vehículos viales y choferes reales desde DB', async () => {
    (prisma.vehicle.findMany as any).mockResolvedValue([
      { id: 1, plate: 'AB 919 WO', brand: 'MERCEDES BENZ', model: 'ACCELO 1016', status: 'ACTIVE', currentOdometer: 100000 },
      { id: 10, plate: 'ELEV-VERDE', brand: 'AUTOELEVADOR', model: 'VERDE ELECTRICO', status: 'ACTIVE', currentOdometer: 500 },
    ]);
    (prisma.employee.findMany as any).mockResolvedValue([
      { id: 75, firstName: 'Matías Ignacio', lastName: 'Rodríguez', position: 'Chofer / Repartidor', department: 'LOGISTICA', isActive: true, userId: 75 },
      { id: 81, firstName: 'Marco Esteban', lastName: 'Martín', position: 'Socio / Dirección', department: 'DIRECCION', isActive: true, userId: null },
    ]);
    (prisma.deliveryRoute.findMany as any).mockResolvedValue([]);

    const resources = await logisticsResourcesService.getLogisticsResources();
    expect(resources.fleetVehicles).toHaveLength(1);
    expect(resources.fleetVehicles[0].plate).toBe('AB 919 WO');
    expect(resources.driverOptions).toHaveLength(1);
    expect(resources.driverOptions[0].fullName).toBe('Matías Ignacio Rodríguez');
    expect(resources.drivers).toEqual(['Matías Ignacio Rodríguez']);
  });
});
