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
  validateSlotAllowsStockAssignment,
} from '../../engines/warehouse-layout.engine';
import {
  upsertWarehouseCellSchema,
  resetWarehouseCellSchema,
} from '../../validators/warehouse-layout.validator';
import { warehouseLayoutService } from '../catalog/warehouse-layout.service';
import { productWmsSubService } from '../catalog/product-wms.service';

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
});
