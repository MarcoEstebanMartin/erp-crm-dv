import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const readComp = (relPath: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../', relPath), 'utf8');

describe('QA Paso 3 — Regresión de fixes Gastos, Stock, WMS, Percepciones y Reparto', () => {
  it('useGastosController consulta /fleet y no el endpoint inexistente /fleet/vehicles', () => {
    const content = readComp('gastos/useGastosController.ts');
    expect(content).toContain('${API_BASE_URL}/fleet');
    expect(content).not.toContain('/fleet/vehicles');
  });

  it('StockInventoryTable aplica renderizado progresivo por bloques con IntersectionObserver', () => {
    const content = readComp('stock/StockInventoryTable.tsx');
    expect(content).toContain('INITIAL_VISIBLE_ROWS');
    expect(content).toContain('IntersectionObserver');
    expect(content).toContain('Mostrar todos');
  });

  it('PerceptionsTab y WarehouseMap soportan apilado responsive en pantallas angostas', () => {
    const perceptions = readComp('admin/config/PerceptionsTab.tsx');
    const wmsMap = readComp('deposito/WarehouseMap.tsx');
    expect(perceptions).toContain('repeat(auto-fit, minmax(');
    expect(wmsMap).toContain("flexWrap: 'wrap'");
  });

  it('RepartoDashboard evita que el badge de estado de viaje se parta en dos líneas', () => {
    const reparto = readComp('RepartoDashboard.tsx');
    expect(reparto).toContain("whiteSpace: 'nowrap'");
  });
});
