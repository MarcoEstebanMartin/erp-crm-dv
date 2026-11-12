import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../utils/prisma';
import { productWmsSubService } from '../catalog/product-wms.service';
import { productStockSubService } from '../catalog/product-stock.service';
import {
  adjustStockBatchSchema,
  assignWmsLocationSchema,
  clearWmsLocationSchema,
} from '../../validators/product.validator';

describe('Paso 1 — Blindaje de Stock Concurrente, Inventario Rápido Atómico y Mapa WMS Seguro', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 1 } as any);
  });

  it('assignWmsLocation (modo RELOCATE por defecto) parte un lote de S/U hacia el Slot sin alterar Product.stock (Δ Stock = 0)', async () => {
    const productUpdates: any[] = [];
    const lotUpdates: any[] = [];
    const createdMovements: any[] = [];

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      const txMock = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: 77 }]),
        product: {
          findUnique: vi.fn().mockResolvedValue({ id: 77, stock: 50, defaultLocation: null }),
          update: vi.fn().mockImplementation(async (args) => {
            productUpdates.push(args);
            return { id: 77, stock: 50, ...args.data };
          }),
        },
        orderItem: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
        },
        productLot: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 10,
              productId: 77,
              lotNumber: 'L-2026',
              stock: 50,
              location: 'S/U',
              expirationDate: new Date('2027-02-01T00:00:00Z'),
            },
          ]),
          create: vi.fn().mockImplementation(async ({ data }) => ({ id: 11, ...data })),
          update: vi.fn().mockImplementation(async (args) => {
            lotUpdates.push(args);
            return { id: args.where.id, stock: 20, location: 'D1-R01-C04-A', ...args.data };
          }),
        },
        stockMovement: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            createdMovements.push(data);
            return { id: createdMovements.length, ...data };
          }),
        },
      };
      return cb(txMock);
    });

    await productWmsSubService.assignWmsLocation(
      { productId: 77, locationCode: 'D1-R01-C04-A', quantity: 20, lotNumber: 'L-2026' },
      1,
    );

    // El producto conserva su stock comercial intacto (jamás usa Math.max ni inventa stock)
    expect(productUpdates).toHaveLength(1);
    expect(productUpdates[0].data.stock).toBeUndefined();
    expect(productUpdates[0].data.defaultLocation).toBe('D1-R01-C04-A');

    // Movimientos internos simétricos (-20 + 20 = 0 neto en Libro Mayor)
    expect(createdMovements).toHaveLength(2);
    expect(createdMovements[0].quantity + createdMovements[1].quantity).toBe(0);
    expect(lotUpdates[0]).toEqual({
      where: { id: 10 },
      data: { stock: 30 },
    });
  });

  it('assignWmsLocation (modo STOCK_IN explícito) incrementa tanto el lote como Product.stock sin pisar otros racks', async () => {
    let productUpdateData: any = null;

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      const txMock = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: 88 }]),
        product: {
          findUnique: vi.fn().mockResolvedValue({ id: 88, stock: 50, defaultLocation: 'D1-R01-C01-A' }),
          update: vi.fn().mockImplementation(async ({ data }) => {
            productUpdateData = data;
            return { id: 88, stock: 75, defaultLocation: data.defaultLocation };
          }),
        },
        productLot: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 21,
              productId: 88,
              lotNumber: 'L-100',
              stock: 50,
              location: 'D1-R01-C01-A',
              expirationDate: new Date('2027-05-01T00:00:00Z'),
            },
          ]),
          create: vi.fn().mockImplementation(async ({ data }) => ({ id: 22, ...data })),
        },
        stockMovement: {
          create: vi.fn().mockResolvedValue({ id: 900 }),
        },
      };
      return cb(txMock);
    });

    await productWmsSubService.assignWmsLocation(
      {
        productId: 88,
        locationCode: 'D1-R01-C07-B',
        quantity: 25,
        lotNumber: 'L-100',
        mode: 'STOCK_IN',
      },
      1,
    );

    expect(productUpdateData).toEqual({
      stock: { increment: 25 },
      defaultLocation: 'D1-R01-C07-B',
    });
  });

  it('clearWmsLocation (modo UNASSIGN por defecto) devuelve las unidades a S/U sin destruir Product.stock ni lotes vecinos', async () => {
    const updatedLots: any[] = [];
    const productUpdates: any[] = [];

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      const txMock = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: 55 }]),
        productLot: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 301, productId: 55, lotNumber: 'L-QUESO@D1-R01-C04-A', stock: 12, location: 'D1-R01-C04-A' },
              // Si un filtro externo devolviera un falso vecino D1-R01-C040, doesLotMatchWmsScope lo descarta
              { id: 302, productId: 55, lotNumber: 'L-VECINO', stock: 9, location: 'D1-R01-C040' },
            ])
            .mockResolvedValueOnce([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 301,
            productId: 55,
            lotNumber: 'L-QUESO@D1-R01-C04-A',
            stock: 12,
            location: 'D1-R01-C04-A',
          }),
          update: vi.fn().mockImplementation(async (args) => {
            updatedLots.push(args);
            return args;
          }),
          count: vi.fn().mockResolvedValue(0),
        },
        product: {
          findMany: vi.fn().mockResolvedValue([{ id: 55, defaultLocation: 'D1-R01-C04-A' }]),
          update: vi.fn().mockImplementation(async (args) => {
            productUpdates.push(args);
            return args;
          }),
        },
      };
      return cb(txMock);
    });

    const out = await productWmsSubService.clearWmsLocation('D1-R01-C04', 1);

    expect(out.result.clearedLotsCount).toBe(1);
    expect(out.result.movedUnitsToUnassigned).toBe(12);
    expect(updatedLots).toEqual([
      {
        where: { id: 301 },
        data: { location: 'S/U', lotNumber: 'L-QUESO' },
      },
    ]);
    // Limpia defaultLocation pero jamás resta Product.stock
    expect(productUpdates).toEqual([{ where: { id: 55 }, data: { defaultLocation: null } }]);
  });

  it('clearWmsLocation bloquea WRITE_OFF para roles no ADMIN', async () => {
    await expect(
      productWmsSubService.clearWmsLocation(
        { locationCode: 'D1-R01-C04-A', mode: 'WRITE_OFF', userRole: 'DEPOSITO' },
        2,
      ),
    ).rejects.toThrow(/Solo un Administrador/);
  });

  it('adjustStockBatch ejecuta conteo rápido en 1 sola transacción ordenando IDs ascendentes contra deadlocks', async () => {
    const parseOk = adjustStockBatchSchema.safeParse({
      body: {
        items: [
          { productId: 30, quantityChange: 5, reason: 'Conteo' },
          { productId: 10, quantityChange: -2, reason: 'Conteo' },
        ],
      },
    });
    expect(parseOk.success).toBe(true);

    expect(assignWmsLocationSchema.safeParse({ body: { productId: 1, locationCode: 'D1-R01-C04-A', quantity: 2.5 } }).success).toBe(false);
    expect(clearWmsLocationSchema.safeParse({ body: { locationCode: '' } }).success).toBe(false);

    const processedOrder: number[] = [];
    let txCount = 0;

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      txCount += 1;
      const txMock = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        product: {
          findUnique: vi.fn().mockImplementation(async ({ where }) => {
            processedOrder.push(where.id);
            return { id: where.id, name: `SKU-${where.id}`, stock: 10, defaultLocation: null };
          }),
          update: vi.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, stock: data.stock })),
        },
        productLot: {
          findUnique: vi.fn().mockResolvedValue({
            id: 500,
            productId: 10,
            lotNumber: 'S/L',
            stock: 10,
            location: 'S/U',
          }),
          // El ajuste individual resuelve el lote físico (productId, lotNumber, location) sobre la lista del producto
          findMany: vi.fn().mockResolvedValue([
            { id: 500, productId: 10, lotNumber: 'S/L', stock: 10, location: 'S/U', expirationDate: '2036-12-31' },
          ]),
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue({ id: 500 }),
        },
        stockMovement: {
          create: vi.fn().mockImplementation(async ({ data }) => ({ id: 1, ...data })),
        },
      };
      return cb(txMock);
    });

    const batchRes = await productStockSubService.adjustStockBatch(
      [
        { productId: 30, quantityChange: 5, reason: 'Inventario rápido' },
        { productId: 10, quantityChange: -2, reason: 'Inventario rápido' },
      ],
      1,
    );

    expect(txCount).toBe(1);
    expect(processedOrder).toEqual([10, 30]);
    expect(batchRes.appliedCount).toBe(2);
  });
});
