import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const txMock: any = {
    productLot: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    warehouseCell: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    orderItem: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
    },
    stockMovement: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  txMock.$transaction = vi.fn(async (cb: any) => cb(txMock));
  return { prismaMock: txMock };
});

vi.mock('../../utils/prisma', () => ({ default: prismaMock }));
vi.mock('../../utils/audit', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));

import {
  buildCanonicalSlotCode,
  extractSupportedLevels,
  validateCellMutationAgainstStock,
  validateRequestedWmsLocationFormat,
  validateSlotAllowsStockAssignment,
  validateStorageChamberRule,
} from '../../engines/warehouse-layout.engine';
import {
  upsertWarehouseCellSchema,
  resetWarehouseCellSchema,
} from '../../validators/warehouse-layout.validator';
import { warehouseLayoutService } from '../catalog/warehouse-layout.service';
import { productWmsSubService } from '../catalog/product-wms.service';
import { productStockSubService } from '../catalog/product-stock.service';
import { applyPurchaseStockInTx } from '../purchases/purchase-stock-tx.helper';
import { assertSlotAcceptsStockInTx, getBaseWarehouseCell } from '../../utils/warehouse-base-layout.util';

describe('Warehouse Layout Engine & Editable Slots Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('construye códigos canónicos y extrae niveles habilitados', () => {
    expect(buildCanonicalSlotCode('d1', 1, 4)).toBe('D1-R01-C04');
    expect(buildCanonicalSlotCode('D3', 32, 7)).toBe('D3-R32-C07');
    expect(extractSupportedLevels('A-B-C')).toEqual(['A', 'B', 'C']);
    expect(extractSupportedLevels('A-B-C-D-E-F')).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(extractSupportedLevels('')).toEqual(['A']);
  });

  it('impide convertir en pasillo o quitar pisos que contienen mercadería activa', () => {
    const activeLots = [{ lotNumber: 'L-100', stock: 25, location: 'D1-R01-C04-C' }];

    const toAisle = validateCellMutationAgainstStock({
      cellCode: 'D1-R01-C04',
      nextIsStorage: false,
      nextLevels: '',
      activeLotsInSlot: activeLots,
    });
    expect(toAisle.allowed).toBe(false);
    expect(toAisle.reason).toContain('25 u. ubicadas');

    const shrinkFloorC = validateCellMutationAgainstStock({
      cellCode: 'D1-R01-C04',
      nextIsStorage: true,
      nextLevels: 'A-B',
      activeLotsInSlot: activeLots,
    });
    expect(shrinkFloorC.allowed).toBe(false);
    expect(shrinkFloorC.reason).toContain('Nivel C');

    const expandTo4Floors = validateCellMutationAgainstStock({
      cellCode: 'D1-R01-C04',
      nextIsStorage: true,
      nextLevels: 'A-B-C-D',
      activeLotsInSlot: activeLots,
    });
    expect(expandTo4Floors.allowed).toBe(true);
  });

  it('valida asignaciones contra celdas bloqueadas, pasillos o pisos inexistentes', () => {
    expect(
      validateSlotAllowsStockAssignment(
        { code: 'D1-R01-C04', isStorage: false, isBlocked: false, levels: '' },
        'D1-R01-C04-A',
      ).allowed,
    ).toBe(false);

    expect(
      validateSlotAllowsStockAssignment(
        { code: 'D1-R01-C04', isStorage: true, isBlocked: true, levels: 'A-B-C' },
        'D1-R01-C04-A',
      ).allowed,
    ).toBe(false);

    expect(
      validateSlotAllowsStockAssignment(
        { code: 'D1-R01-C04', isStorage: true, isBlocked: false, levels: 'A-B' },
        'D1-R01-C04-C',
      ).allowed,
    ).toBe(false);

    expect(
      validateSlotAllowsStockAssignment(
        { code: 'D1-R01-C04', isStorage: true, isBlocked: false, levels: 'A-B-C' },
        'D1-R01-C04-B',
      ).allowed,
    ).toBe(true);
  });

  it('valida contratos Zod para edición y restauración de celdas', () => {
    const valid = upsertWarehouseCellSchema.safeParse({
      body: {
        depId: 'D1',
        row: 2,
        col: 5,
        isStorage: true,
        levels: 'A-B-C',
        chamber: 'CAMARA_2',
        label: 'Quesos Duros',
        isBlocked: false,
      },
    });
    expect(valid.success).toBe(true);

    const badLevels = upsertWarehouseCellSchema.safeParse({
      body: {
        depId: 'D1',
        row: 2,
        col: 5,
        isStorage: true,
        levels: 'X-Y-Z',
      },
    });
    expect(badLevels.success).toBe(false);

    const validReset = resetWarehouseCellSchema.safeParse({
      params: { code: 'D1-R01-C04' },
      body: { fallbackBlueprint: { isStorage: true, levels: 'A-B-C' } },
    });
    expect(validReset.success).toBe(true);
  });

  it('WarehouseLayoutService.upsertCell persiste cuando es seguro y rechaza si dejaría stock huérfano', async () => {
    prismaMock.productLot.findMany.mockResolvedValueOnce([
      { lotNumber: 'L-1', stock: 12, location: 'D1-R01-C04-B' },
    ]);

    await expect(
      warehouseLayoutService.upsertCell(
        { depId: 'D1', row: 1, col: 4, isStorage: true, levels: 'A' },
        71,
      ),
    ).rejects.toThrow(/Nivel B/);

    prismaMock.productLot.findMany.mockResolvedValueOnce([]);
    prismaMock.warehouseCell.upsert.mockResolvedValueOnce({
      id: 1,
      code: 'D1-R01-C05',
      depId: 'D1',
      row: 1,
      col: 5,
      isStorage: true,
      levels: 'A-B-C',
      chamber: 'ESTANTERIA',
      label: 'Nuevo Rack',
      isBlocked: false,
    });

    const saved = await warehouseLayoutService.upsertCell(
      {
        depId: 'D1',
        row: 1,
        col: 5,
        isStorage: true,
        levels: 'A-B-C',
        chamber: 'ESTANTERIA',
        label: 'Nuevo Rack',
      },
      71,
    );
    expect(saved.code).toBe('D1-R01-C05');
    expect(prismaMock.warehouseCell.upsert).toHaveBeenCalledTimes(1);
  });

  it('ProductWmsSubService.assignWmsLocation rechaza cargar mercadería en un slot bloqueado en DB', async () => {
    prismaMock.warehouseCell.findUnique.mockResolvedValueOnce({
      code: 'D1-R01-C04',
      isStorage: true,
      isBlocked: true,
      levels: 'A-B-C',
    });

    await expect(
      productWmsSubService.assignWmsLocation(
        {
          productId: 10,
          locationCode: 'D1-R01-C04-A',
          quantity: 5,
        },
        71,
      ),
    ).rejects.toThrow(/bloqueado temporalmente/);
  });

  it('valida el plano base limpio (deposito-mapa.json) contra pasillos, carteles, baño y niveles inexistentes', async () => {
    expect(getBaseWarehouseCell('D1-R01-C11')?.chamber).toBe('CAMARA_2');
    expect(getBaseWarehouseCell('D1-R07-C06')?.chamber).toBe('CAMARA_1');
    expect(getBaseWarehouseCell('D1-R05-C17')?.isStorage).toBe(false);
    expect(getBaseWarehouseCell('D1-R06-C08')?.isStorage).toBe(false);

    expect(validateRequestedWmsLocationFormat('BAÑO').allowed).toBe(false);
    expect(validateRequestedWmsLocationFormat('D1-R01-C04-Z').allowed).toBe(false);
    expect(validateStorageChamberRule(true, 'BANO').allowed).toBe(false);

    const baseTx = { warehouseCell: { findUnique: vi.fn().mockResolvedValue(null) } };

    // Válidos en plano base corregido
    await expect(assertSlotAcceptsStockInTx(baseTx, 'D1-R01-C11-A')).resolves.toBeUndefined();
    await expect(assertSlotAcceptsStockInTx(baseTx, 'D1-R07-C06-F')).resolves.toBeUndefined();

    // Inválidos: pasillo, cartel, baño, ex-celda verde no-storage, piso B en slot solo A, fuera de mapa
    await expect(assertSlotAcceptsStockInTx(baseTx, 'D1-R01-C01-A')).rejects.toThrow(/Pasillo/);
    await expect(assertSlotAcceptsStockInTx(baseTx, 'D1-R03-C08-A')).rejects.toThrow(/Pasillo/);
    await expect(assertSlotAcceptsStockInTx(baseTx, 'D1-R06-C17-A')).rejects.toThrow(/Pasillo/);
    await expect(assertSlotAcceptsStockInTx(baseTx, 'D1-R05-C17-A')).rejects.toThrow(/Pasillo/);
    await expect(assertSlotAcceptsStockInTx(baseTx, 'D1-R06-C08-A')).rejects.toThrow(/Pasillo/);
    await expect(assertSlotAcceptsStockInTx(baseTx, 'D1-R01-C11-B')).rejects.toThrow(/Nivel B/);
    await expect(assertSlotAcceptsStockInTx(baseTx, 'D1-R01-C04-Z')).rejects.toThrow(/niveles permitidos/);
    await expect(assertSlotAcceptsStockInTx(baseTx, 'D1-R99-C99-A')).rejects.toThrow(/no existe/);

    // Override en DB habilita un pasillo original (D1-R01-C01) como rack A-B
    const overrideTx = {
      warehouseCell: {
        findUnique: vi.fn().mockResolvedValue({
          code: 'D1-R01-C01',
          isStorage: true,
          isBlocked: false,
          levels: 'A-B',
        }),
      },
    };
    await expect(assertSlotAcceptsStockInTx(overrideTx, 'D1-R01-C01-B')).resolves.toBeUndefined();
  });

  it('upsertCell bloquea sector BANO para storage, limpia defaultLocation huérfano y deleteCellOverride respeta el plano base', async () => {
    await expect(
      warehouseLayoutService.upsertCell(
        { depId: 'D1', row: 5, col: 17, isStorage: true, levels: 'A', chamber: 'BANO' },
        71,
      ),
    ).rejects.toThrow(/Baño/);

    // Pasar D1-R01-C04 a pasillo limpia defaultLocation huérfano de productos sin tocar falsos vecinos C040
    prismaMock.productLot.findMany.mockResolvedValueOnce([]);
    prismaMock.warehouseCell.upsert.mockResolvedValueOnce({
      id: 2,
      code: 'D1-R01-C04',
      isStorage: false,
      levels: '',
      chamber: 'GENERAL',
      label: 'Pasillo',
      isBlocked: false,
    });
    prismaMock.product.findMany.mockResolvedValueOnce([
      { id: 10, defaultLocation: 'D1-R01-C04-A' },
      { id: 11, defaultLocation: 'D1-R01-C040-A' },
    ]);

    await warehouseLayoutService.upsertCell(
      { depId: 'D1', row: 1, col: 4, isStorage: false, levels: '', chamber: 'GENERAL', label: 'Pasillo' },
      71,
    );
    expect(prismaMock.product.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { defaultLocation: null },
    });

    // deleteCellOverride sobre ex-pasillo base D1-R01-C01 rechaza revertir si todavía hay stock aunque el cliente mande fallbackBlueprint falso
    prismaMock.warehouseCell.findUnique.mockResolvedValueOnce({ id: 3, code: 'D1-R01-C01' });
    prismaMock.productLot.findMany.mockResolvedValueOnce([
      { lotNumber: 'L-1', stock: 8, location: 'D1-R01-C01-A' },
    ]);
    await expect(
      warehouseLayoutService.deleteCellOverride('D1-R01-C01', 71, { isStorage: true, levels: 'A-B' }),
    ).rejects.toThrow(/8 u\. ubicadas/);
  });

  it('adjustStock positivo y applyPurchaseStockInTx rechazan ubicaciones pasillo/inválidas pero permiten descargas negativas', async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      id: 50,
      name: 'Queso Tybo',
      stock: 10,
      defaultLocation: 'D1-R01-C01-A',
    });
    prismaMock.productLot.findMany.mockResolvedValue([
      { id: 501, productId: 50, lotNumber: 'L-1', stock: 10, location: 'D1-R01-C01-A', expirationDate: new Date('2027-01-01') },
    ]);
    prismaMock.warehouseCell.findUnique.mockResolvedValue(null);

    await expect(
      productStockSubService.adjustStock(
        50,
        { quantityChange: 5, location: 'D1-R01-C01-A', lotNumber: 'L-1' },
        71,
      ),
    ).rejects.toThrow(/Pasillo/);

    await expect(
      applyPurchaseStockInTx(prismaMock, {
        userId: 71,
        purchaseOrderId: 9,
        reason: 'Compra',
        items: [{ productId: 50, quantity: 5, location: 'D1-R05-C17-A' }],
      }),
    ).rejects.toThrow(/Pasillo/);

    // Ajuste negativo sobre mercadería existente en ubicación heredada sí permite vaciarla
    prismaMock.productLot.findUnique.mockResolvedValueOnce({
      id: 501,
      productId: 50,
      lotNumber: 'L-1',
      stock: 10,
      location: 'D1-R01-C01-A',
    });
    prismaMock.productLot.update.mockResolvedValueOnce({ id: 501, stock: 6 });
    prismaMock.stockMovement.create.mockResolvedValueOnce({ id: 88 });
    prismaMock.product.update.mockResolvedValueOnce({ id: 50, stock: 6 });

    const res = await productStockSubService.adjustStock(
      50,
      { quantityChange: -4, location: 'D1-R01-C01-A', lotId: 501 },
      71,
    );
    expect(res.movement.id).toBe(88);
  });
});
