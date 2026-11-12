import { describe, expect, it } from 'vitest';
import { mergeWarehouseLayout, extractSlotLevels } from '../warehouseLayoutMerger';

describe('mergeWarehouseLayout', () => {
  it('mantiene los 210 slots originales cuando no hay personalizaciones en DB', () => {
    const res = mergeWarehouseLayout([]);
    expect(res.activeSlotsCount).toBe(210);
    expect(res.mergedMatrix.length).toBe(32);
    expect(res.originalCellByCode['D1-R01-C04']).toEqual({
      isStorage: true,
      levels: 'A-B-C',
    });
  });

  it('habilita un nuevo slot sobre un pasillo blanco y aplica etiquetas y bloqueos', () => {
    const res = mergeWarehouseLayout([
      {
        id: 1,
        code: 'D1-R01-C01',
        depId: 'D1',
        row: 1,
        col: 1,
        isStorage: true,
        levels: 'A-B-C-D',
        chamber: 'CAMARA_2',
        label: 'Quesos Premium',
        isBlocked: true,
      },
    ]);

    expect(res.activeSlotsCount).toBe(211);
    const added = res.mergedSlots.find((s) => s.code === 'D1-R01-C01');
    expect(added).toBeDefined();
    expect(added?.nivel).toBe('A-B-C-D');
    expect(added?.isBlocked).toBe(true);
    expect(added?.customLabel).toBe('Quesos Premium');
    expect(extractSlotLevels(added?.nivel)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('permite convertir un slot vacío en pasillo descontándolo del conteo activo', () => {
    const res = mergeWarehouseLayout([
      {
        id: 2,
        code: 'D1-R01-C04',
        depId: 'D1',
        row: 1,
        col: 4,
        isStorage: false,
        levels: '',
        chamber: 'GENERAL',
        label: 'Acceso Autoelevador',
        isBlocked: false,
      },
    ]);

    expect(res.activeSlotsCount).toBe(209);
    expect(res.mergedMatrix[0][3].is_storage).toBe(false);
    expect(res.mergedMatrix[0][3].val).toBe('Acceso Autoelevador');
  });
});
