import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Role, BillingType, OrderStatus } from '@prisma/client';

// Mock de prisma
jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    persona: {
      findUnique: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '../../utils/prisma';
import { OrderService } from '../order.service';

describe('OrderService Business Rules & Invariants Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockPersona = {
    id: 100,
    name: 'Cliente Prueba',
    sellerId: 10,
    priceList: 'A',
    discount: 0,
    maxUnpaidInvoices: 0,
    creditLimit: 100000,
    outstandingBalance: 0,
  };

  const mockProduct = {
    id: 50,
    sku: 'SKU-050',
    name: 'Queso Barra x Kg',
    listPrice: 5000,
    listPriceB: 0,
    listPriceC: 0,
    stock: 5,
    minOrderQuantity: 10,
    isPesable: false,
    rubroId: 1,
    rubro: { id: 1, name: 'Lácteos' },
  };

  it('Debe rechazar la venta si el vendedor no es el asignado al cliente', async () => {
    (prisma.persona.findUnique as any).mockResolvedValue(mockPersona);

    await expect(
      OrderService.createOrder({
        sellerId: 99, // Distinto al sellerId 10 de mockPersona
        userRole: Role.VENDEDOR,
        personaId: 100,
        items: [{ productId: 50, quantity: 10 }],
      })
    ).rejects.toThrow('No podés cargar un pedido para un cliente asignado a otro vendedor.');
  });

  it('Debe rechazar la venta si la cantidad solicitada es menor al mínimo de pedido y no hay excepción por emergencia', async () => {
    (prisma.persona.findUnique as any).mockResolvedValue(mockPersona);
    (prisma.order.findFirst as any).mockResolvedValue(null);

    const mockTx = {
      product: {
        findMany: jest.fn<any>().mockResolvedValue([mockProduct]),
      },
      discountRule: {
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    await expect(
      OrderService.createOrder({
        sellerId: 10,
        userRole: Role.VENDEDOR,
        personaId: 100,
        items: [{ productId: 50, quantity: 5, isEmergencyOverride: false }], // minOrderQuantity es 10
      })
    ).rejects.toThrow('exige un mínimo de 10 unidades');
  });

  it('Debe rechazar la venta si el stock disponible en memoria es inferior a la cantidad solicitada', async () => {
    (prisma.persona.findUnique as any).mockResolvedValue(mockPersona);
    (prisma.order.findFirst as any).mockResolvedValue(null);

    const mockProductLowStock = {
      ...mockProduct,
      minOrderQuantity: 1,
      stock: 3, // Stock 3, solicitado 5
    };

    const mockTx = {
      product: {
        findMany: jest.fn<any>().mockResolvedValue([mockProductLowStock]),
      },
      discountRule: {
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    await expect(
      OrderService.createOrder({
        sellerId: 10,
        userRole: Role.VENDEDOR,
        personaId: 100,
        items: [{ productId: 50, quantity: 5 }],
      })
    ).rejects.toThrow('Stock insuficiente para "Queso Barra x Kg" (Disponible: 3, Solicitado: 5)');
  });

  it('Debe rechazar la venta si una operación concurrente consumió el stock (updateMany res.count === 0)', async () => {
    (prisma.persona.findUnique as any).mockResolvedValue(mockPersona);
    (prisma.order.findFirst as any).mockResolvedValue(null);

    const mockProductSufficientMemory = {
      ...mockProduct,
      minOrderQuantity: 1,
      stock: 10, // En memoria parece haber 10
    };

    const mockTx = {
      product: {
        findMany: jest.fn<any>().mockResolvedValue([mockProductSufficientMemory]),
        updateMany: jest.fn<any>().mockResolvedValue({ count: 0 }), // Pero en la BD otra tx se lo llevó
      },
      discountRule: {
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
      order: {
        create: jest.fn<any>().mockResolvedValue({ id: 1 }),
      },
      orderItem: {
        createMany: jest.fn<any>().mockResolvedValue({ count: 1 }),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    await expect(
      OrderService.createOrder({
        sellerId: 10,
        userRole: Role.VENDEDOR,
        personaId: 100,
        items: [{ productId: 50, quantity: 5 }],
      })
    ).rejects.toThrow('debido a una operación concurrente');
  });

  it('Debe permitir la venta si hay excepción por emergencia habilitada aún por debajo del mínimo', async () => {
    (prisma.persona.findUnique as any).mockResolvedValue(mockPersona);
    (prisma.order.findFirst as any).mockResolvedValue(null);

    const mockProductNormal = {
      ...mockProduct,
      minOrderQuantity: 10,
      stock: 20,
    };

    const mockTx = {
      product: {
        findMany: jest.fn<any>().mockResolvedValue([mockProductNormal]),
        updateMany: jest.fn<any>().mockResolvedValue({ count: 1 }),
      },
      discountRule: {
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
      order: {
        create: jest.fn<any>().mockResolvedValue({ id: 77, status: OrderStatus.PENDING }),
      },
      orderItem: {
        createMany: jest.fn<any>().mockResolvedValue({ count: 1 }),
      },
      stockMovement: {
        createMany: jest.fn<any>().mockResolvedValue({ count: 1 }),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const result = await OrderService.createOrder({
      sellerId: 10,
      userRole: Role.VENDEDOR,
      personaId: 100,
      items: [{ productId: 50, quantity: 3, isEmergencyOverride: true }], // Solicita 3 teniendo min 10
    });

    expect(result.id).toBe(77);
    expect(mockTx.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 50, stock: { gte: 3 } },
        data: { stock: { decrement: 3 } },
      })
    );
  });
});
