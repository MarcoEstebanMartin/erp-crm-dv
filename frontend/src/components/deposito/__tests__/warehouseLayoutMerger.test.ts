import { describe, expect, it } from 'vitest';
import { mergeWarehouseLayout, extractSlotLevels } from '../warehouseLayoutMerger';

describe('mergeWarehouseLayout', () => {
  it('mantiene los 209 slots reales y corrige Cámaras 1/2, baño y celda verde no-storage', () => {
    const res = mergeWarehouseLayout([]);
    expect(res.activeSlotsCount).toBe(209);
    expect(res.mergedMatrix.length).toBe(32);
    expect(res.originalCellByCode['D1-R01-C04']).toEqual({
      isStorage: true,
      levels: 'A-B-C',
    });

    // Bloque superior = Cámara 2 Frío (Quesos); Bloque inferior = Cámara 1 Frío (Lácteos)
    expect(res.mergedSlots.find((s) => s.code === 'D1-R01-C11')?.chamber).toBe('CAMARA_2');
    expect(res.mergedSlots.find((s) => s.code === 'D1-R07-C06')?.chamber).toBe('CAMARA_1');

    // Baño (R5C17) y ex-celda verde sin storage (R6C08) quedan no-storage y blancos
    const banoCell = res.mergedMatrix[4][16];
    expect(banoCell.code).toBe('D1-R05-C17');
    expect(banoCell.is_storage).toBe(false);
    expect(banoCell.chamber).toBe('BANO');
    expect(banoCell.fill).toBe('#FFFFFF');

    const emptyChamberCell = res.mergedMatrix[5][7];
    expect(emptyChamberCell.code).toBe('D1-R06-C08');
    expect(emptyChamberCell.is_storage).toBe(false);
    expect(emptyChamberCell.fill).toBe('#FFFFFF');
  });

  it('habilita un nuevo slot sobre un pasillo blanco con relleno visible por depósito y aplica bloqueos', () => {
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

    expect(res.activeSlotsCount).toBe(210);
    const added = res.mergedSlots.find((s) => s.code === 'D1-R01-C01');
    expect(added).toBeDefined();
    expect(added?.nivel).toBe('A-B-C-D');
    expect(added?.isBlocked).toBe(true);
    expect(added?.customLabel).toBe('Quesos Premium');
    expect(added?.fill).not.toBe('#FFFFFF');
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

    expect(res.activeSlotsCount).toBe(208);
    expect(res.mergedMatrix[0][3].is_storage).toBe(false);
    expect(res.mergedMatrix[0][3].val).toBe('Acceso Autoelevador');
  });
});
