import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../utils/prisma';
import { lotService } from '../lot.service';
import { productWmsSubService } from '../catalog/product-wms.service';
import { transferLotStockSchema } from '../../validators/lot.validator';
import { moveWmsSlotSchema } from '../../validators/product.validator';

vi.mock('../../utils/audit', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));

describe('Paso 3 WMS Usability — transferStock con toLotId y moveWmsSlot atómico', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validadores Zod aceptan transferStock con toLotId sin toLotNumber y moveWmsSlotSchema', () => {
    expect(
      transferLotStockSchema.safeParse({
        params: { productId: '10' },
        body: { fromLotId: 101, toLotId: 202, quantity: 5 },
      }).success,
    ).toBe(true);

    expect(
      transferLotStockSchema.safeParse({
        params: { productId: '10' },
        body: { fromLotId: 101, quantity: 5 },
      }).success,
    ).toBe(false);

    expect(
      moveWmsSlotSchema.safeParse({
        body: { fromSlotCode: 'D1-R01-C04', toSlotCode: 'D1-R02-C04' },
      }).success,
    ).toBe(true);
  });

  it('lotService.transferStock transfiere por toLotId aunque origen y destino compartan lotNumber en distintos racks', async () => {
    const lotUpdates: any[] = [];
    const movements: any[] = [];

    const fromLot = {
      id: 101,
      productId: 50,
      lotNumber: 'L-2026',
      location: 'D1-R01-C04-A',
      stock: 20,
      expirationDate: new Date('2027-06-01T00:00:00Z'),
    };
    const toLot = {
      id: 202,
      productId: 50,
      lotNumber: 'L-2026',
      location: 'D1-R02-C04-A',
      stock: 5,
      expirationDate: new Date('2027-06-01T00:00:00Z'),
    };

    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockResolvedValue([{ id: 50 }]),
        warehouseCell: { findUnique: vi.fn().mockResolvedValue(null) },
        productLot: {
          findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
            if (where?.id === 101) return { ...fromLot };
            if (where?.id === 202) return { ...toLot };
            return null;
          }),
          update: vi.fn().mockImplementation(async (args: any) => {
            lotUpdates.push(args);
            if (args.where.id === 101) return { ...fromLot, stock: 12 };
            return { ...toLot, stock: 13 };
          }),
        },
        stockMovement: {
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            movements.push(data);
            return { id: movements.length, ...data };
          }),
        },
      }),
    );

    const res = await lotService.transferStock(
      50,
      { fromLotId: 101, toLotId: 202, quantity: 8 },
      1,
    );

    expect(res.fromLot.stock).toBe(12);
    expect(res.toLot.stock).toBe(13);
    expect(lotUpdates).toEqual([
      { where: { id: 101 }, data: { stock: { decrement: 8 } } },
      { where: { id: 202 }, data: { stock: { increment: 8 } } },
    ]);
    expect(movements).toHaveLength(2);
    expect(movements[0]).toMatchObject({ productLotId: 101, quantity: -8, type: 'OUT' });
    expect(movements[1]).toMatchObject({ productLotId: 202, quantity: 8, type: 'IN' });

    // Rechaza si el lote destino pertenece a otro producto
    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockResolvedValue([{ id: 50 }]),
        warehouseCell: { findUnique: vi.fn().mockResolvedValue(null) },
        productLot: {
          findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
            if (where?.id === 101) return { ...fromLot };
            if (where?.id === 999) return { ...toLot, id: 999, productId: 88 };
            return null;
          }),
        },
      }),
    );

    await expect(
      lotService.transferStock(50, { fromLotId: 101, toLotId: 999, quantity: 4 }, 1),
    ).rejects.toThrow(/no pertenece/);
  });

  it('moveWmsSlot muda múltiples lotes y pisos preservando niveles, defaultLocation y Kardex con fusión en colisión', async () => {
    const lotUpdates: any[] = [];
    const prodUpdates: any[] = [];
    const movements: any[] = [];

    const lotA = {
      id: 1,
      productId: 10,
      lotNumber: 'L-1@D1-R01-C04-A',
      stock: 15,
      location: 'D1-R01-C04-A',
      expirationDate: new Date('2027-01-01T00:00:00Z'),
    };
    const lotC = {
      id: 2,
      productId: 11,
      lotNumber: 'L-2',
      stock: 7,
      location: 'D1-R01-C04-C',
      expirationDate: new Date('2027-05-01T00:00:00Z'),
    };
    const existingDestC = {
      id: 99,
      productId: 11,
      lotNumber: 'L-2',
      stock: 3,
      location: 'D1-R02-C04-C',
      expirationDate: new Date('2027-05-01T00:00:00Z'),
    };

    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockResolvedValue([]),
        warehouseCell: { findUnique: vi.fn().mockResolvedValue(null) },
        productLot: {
          findMany: vi.fn().mockResolvedValue([lotA, lotC]),
          findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
            if (where?.id === 1) return lotA;
            if (where?.id === 2) return lotC;
            if (
              where?.productId_lotNumber_location?.productId === 11 &&
              where?.productId_lotNumber_location?.lotNumber === 'L-2' &&
              where?.productId_lotNumber_location?.location === 'D1-R02-C04-C'
            ) {
              return existingDestC;
            }
            return null;
          }),
          update: vi.fn().mockImplementation(async (args: any) => {
            lotUpdates.push(args);
            return { ...args.data, id: args.where.id };
          }),
        },
        product: {
          findMany: vi.fn().mockResolvedValue([{ id: 10, defaultLocation: 'D1-R01-C04-A' }]),
          update: vi.fn().mockImplementation(async (args: any) => {
            prodUpdates.push(args);
            return args;
          }),
        },
        stockMovement: {
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            movements.push(data);
            return { id: movements.length, ...data };
          }),
        },
      }),
    );

    const out = await productWmsSubService.moveWmsSlot(
      { fromSlotCode: 'D1-R01-C04', toSlotCode: 'D1-R02-C04' },
      7,
    );

    expect(out.result).toEqual({
      fromSlotCode: 'D1-R01-C04',
      toSlotCode: 'D1-R02-C04',
      movedLotsCount: 2,
      movedUnits: 22,
      updatedProductsCount: 1,
    });
    expect(lotUpdates).toContainEqual({
      where: { id: 1 },
      data: { location: 'D1-R02-C04-A', lotNumber: 'L-1' },
    });
    expect(lotUpdates).toContainEqual({
      where: { id: 99 },
      data: { stock: { increment: 7 } },
    });
    expect(lotUpdates).toContainEqual({
      where: { id: 2 },
      data: { stock: 0 },
    });
    expect(prodUpdates).toEqual([
      { where: { id: 10 }, data: { defaultLocation: 'D1-R02-C04-A' } },
    ]);
    expect(movements).toHaveLength(4);
  });

  it('moveWmsSlot rechaza destino pasillo, destino bloqueado o destino sin el piso requerido', async () => {
    const lotC = {
      id: 2,
      productId: 11,
      lotNumber: 'L-2',
      stock: 7,
      location: 'D1-R01-C04-C',
    };

    // Destino D1-R01-C11 solo tiene Nivel A en el plano base -> rechaza nivel C
    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) =>
      cb({
        warehouseCell: { findUnique: vi.fn().mockResolvedValue(null) },
        productLot: { findMany: vi.fn().mockResolvedValue([lotC]) },
      }),
    );
    await expect(
      productWmsSubService.moveWmsSlot(
        { fromSlotCode: 'D1-R01-C04', toSlotCode: 'D1-R01-C11' },
        7,
      ),
    ).rejects.toThrow(/Nivel C/);

    // Destino es pasillo (D1-R01-C01)
    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) =>
      cb({
        warehouseCell: { findUnique: vi.fn().mockResolvedValue(null) },
        productLot: { findMany: vi.fn().mockResolvedValue([{ ...lotC, location: 'D1-R01-C04-A' }]) },
      }),
    );
    await expect(
      productWmsSubService.moveWmsSlot(
        { fromSlotCode: 'D1-R01-C04', toSlotCode: 'D1-R01-C01' },
        7,
      ),
    ).rejects.toThrow(/Pasillo/);

    // Destino bloqueado en DB
    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) =>
      cb({
        warehouseCell: {
          findUnique: vi.fn().mockResolvedValue({
            code: 'D1-R02-C04',
            isStorage: true,
            isBlocked: true,
            levels: 'A-B-C',
          }),
        },
        productLot: { findMany: vi.fn().mockResolvedValue([lotC]) },
      }),
    );
    await expect(
      productWmsSubService.moveWmsSlot(
        { fromSlotCode: 'D1-R01-C04', toSlotCode: 'D1-R02-C04' },
        7,
      ),
    ).rejects.toThrow(/bloqueado temporalmente/);
  });
});
