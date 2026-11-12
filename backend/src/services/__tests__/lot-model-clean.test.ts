import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../utils/prisma';
import { productWmsSubService } from '../catalog/product-wms.service';
import { lotService } from '../lot.service';

/**
 * Paso 2 — Modelo de Lotes Limpio: identidad física única (productId, lotNumber, location).
 * Escenario real del SKU 0001 (MELINCUÉ BARRA TYBO X KG): 80 u. 'S/L' en S/U + 20 u. 'S/L' en D1-R01-C04-C.
 */
const SENTINEL = new Date('2036-12-31T00:00:00Z');

function buildMovementSink() {
  const movements: any[] = [];
  const create = vi.fn().mockImplementation(async ({ data }) => {
    movements.push(data);
    return { id: movements.length, ...data };
  });
  return { movements, create };
}

describe('Modelo de Lotes Limpio — sin sufijos @SLOT y con fusión atómica al mover de piso', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 1 } as any);
  });

  it('assignWmsLocation ubica 20 de 100 u. genéricas en un rack creando otro lote "S/L" limpio (nunca "S/L@...")', async () => {
    const createdLots: any[] = [];
    const sink = buildMovementSink();

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockResolvedValue([]),
        product: {
          findUnique: vi.fn().mockResolvedValue({ id: 1735, stock: 100, defaultLocation: null }),
          update: vi.fn().mockImplementation(async ({ data }) => ({ id: 1735, stock: 100, ...data })),
        },
        orderItem: { aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 0 } }) },
        productLot: {
          findMany: vi.fn().mockResolvedValue([
            { id: 868, productId: 1735, lotNumber: 'S/L', stock: 100, location: 'S/U', expirationDate: SENTINEL },
          ]),
          create: vi.fn().mockImplementation(async ({ data }) => {
            createdLots.push(data);
            return { id: 1115, ...data };
          }),
          findUniqueOrThrow: vi.fn(),
          update: vi.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })),
        },
        stockMovement: { create: sink.create },
      }),
    );

    await productWmsSubService.assignWmsLocation(
      { productId: 1735, locationCode: 'D1-R01-C04-C', quantity: 20 },
      1,
    );

    expect(createdLots).toHaveLength(1);
    expect(createdLots[0]).toMatchObject({ lotNumber: 'S/L', location: 'D1-R01-C04-C' });
    expect(createdLots[0].lotNumber).not.toContain('@');
    expect(sink.movements.reduce((acc, m) => acc + m.quantity, 0)).toBe(0);
  });

  it('clearWmsLocation libera el rack fusionando en el "S/L" de S/U y deja el lote origen en 0 sin DELETE ni colisión', async () => {
    const lotUpdates: any[] = [];
    const sink = buildMovementSink();
    const rackLot = { id: 1115, productId: 1735, lotNumber: 'S/L', stock: 20, location: 'D1-R01-C04-C' };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockResolvedValue([]),
        productLot: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([rackLot])
            .mockResolvedValueOnce([{ id: 868, productId: 1735, lotNumber: 'S/L', stock: 80, location: 'S/U' }]),
          findUnique: vi.fn().mockResolvedValue(rackLot),
          update: vi.fn().mockImplementation(async (args) => {
            lotUpdates.push(args);
            return args;
          }),
          delete: vi.fn().mockRejectedValue(new Error('No debe intentarse DELETE dentro de la transacción')),
          count: vi.fn().mockResolvedValue(0),
        },
        product: {
          findMany: vi.fn().mockResolvedValue([{ id: 1735, defaultLocation: 'D1-R01-C04-C' }]),
          update: vi.fn().mockResolvedValue({ id: 1735 }),
        },
        stockMovement: { create: sink.create },
      }),
    );

    const out = await productWmsSubService.clearWmsLocation(
      { locationCode: 'D1-R01-C04-C', productId: 1735, lotId: 1115 },
      1,
    );

    expect(out.result.movedUnitsToUnassigned).toBe(20);
    expect(lotUpdates).toEqual([
      { where: { id: 868 }, data: { stock: { increment: 20 }, location: 'S/U' } },
      { where: { id: 1115 }, data: { stock: 0 } },
    ]);
    expect(sink.movements.map((m) => [m.productLotId, m.quantity])).toEqual([
      [1115, -20],
      [868, 20],
    ]);
  });

  function buildLotTx(params: { lot: any; collision: any | null; movementRefs?: number }) {
    const lotUpdates: any[] = [];
    const deletes: any[] = [];
    const sink = buildMovementSink();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      warehouseCell: { findUnique: vi.fn().mockResolvedValue(null) },
      productLot: {
        findUnique: vi.fn().mockImplementation(async ({ where }) =>
          where.id !== undefined ? params.lot : params.collision,
        ),
        update: vi.fn().mockImplementation(async ({ where, data }) => {
          lotUpdates.push({ where, data });
          return { ...(where.id === params.lot.id ? params.lot : params.collision), ...data };
        }),
        delete: vi.fn().mockImplementation(async (args) => deletes.push(args)),
      },
      stockMovement: { create: sink.create, count: vi.fn().mockResolvedValue(params.movementRefs ?? 0) },
      orderItemLot: { count: vi.fn().mockResolvedValue(0) },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(tx));
    return { lotUpdates, deletes, sink };
  }

  it('updateLot: mover "S/L" del piso C al piso A donde ya hay "S/L" FUSIONA atómicamente con asientos OUT/IN', async () => {
    const lot = { id: 1115, productId: 1735, lotNumber: 'S/L', stock: 20, location: 'D1-R01-C04-C', expirationDate: SENTINEL };
    const collision = { id: 1200, productId: 1735, lotNumber: 'S/L', stock: 5, location: 'D1-R01-C04-A', expirationDate: SENTINEL };
    const { lotUpdates, deletes, sink } = buildLotTx({ lot, collision });

    const updated = await lotService.updateLot(1115, { location: 'D1-R01-C04-A' }, 1);

    expect(updated.id).toBe(1200);
    expect(lotUpdates).toEqual([
      { where: { id: 1200 }, data: { stock: { increment: 20 } } },
      { where: { id: 1115 }, data: { stock: 0 } },
    ]);
    expect(sink.movements.map((m) => [m.productLotId, m.quantity, m.type])).toEqual([
      [1115, -20, 'OUT'],
      [1200, 20, 'IN'],
    ]);
    expect(deletes).toHaveLength(0);
  });

  it('updateLot: liberar "S/L" del rack a S/U fusiona con el "S/L" genérico existente (cero violación de clave única)', async () => {
    const lot = { id: 1115, productId: 1735, lotNumber: 'S/L', stock: 20, location: 'D1-R01-C04-C', expirationDate: SENTINEL };
    const collision = { id: 868, productId: 1735, lotNumber: 'S/L', stock: 80, location: 'S/U', expirationDate: SENTINEL };
    const { lotUpdates, sink } = buildLotTx({ lot, collision });

    const updated = await lotService.updateLot(1115, { location: 'S/U' }, 1);

    expect(updated).toMatchObject({ id: 868, location: 'S/U' });
    expect(lotUpdates[0]).toEqual({ where: { id: 868 }, data: { stock: { increment: 20 } } });
    expect(sink.movements.reduce((acc, m) => acc + m.quantity, 0)).toBe(0);
  });

  it('updateLot: lote vacío sin historial que colisiona se elimina limpiamente', async () => {
    const lot = { id: 1300, productId: 1735, lotNumber: 'S/L', stock: 0, location: 'D1-R01-C04-B', expirationDate: SENTINEL };
    const collision = { id: 868, productId: 1735, lotNumber: 'S/L', stock: 80, location: 'S/U', expirationDate: SENTINEL };
    const { deletes, sink } = buildLotTx({ lot, collision, movementRefs: 0 });

    await lotService.updateLot(1300, { location: 'S/U' }, 1);

    expect(deletes).toEqual([{ where: { id: 1300 } }]);
    expect(sink.movements).toHaveLength(0);
  });

  it('updateLot: mover a un piso libre actualiza la ubicación, limpia el código y deja traza OUT/IN en Kardex', async () => {
    const lot = { id: 1115, productId: 1735, lotNumber: 'S/L@D1-R01-C04-C', stock: 20, location: 'D1-R01-C04-C', expirationDate: SENTINEL };
    const { lotUpdates, sink } = buildLotTx({ lot, collision: null });

    await lotService.updateLot(1115, { location: 'D1-R01-C04-A' }, 1);

    expect(lotUpdates).toEqual([
      { where: { id: 1115 }, data: { lotNumber: 'S/L', location: 'D1-R01-C04-A' } },
    ]);
    expect(sink.movements.map((m) => [m.productLotId, m.quantity])).toEqual([
      [1115, -20],
      [1115, 20],
    ]);
  });
});
