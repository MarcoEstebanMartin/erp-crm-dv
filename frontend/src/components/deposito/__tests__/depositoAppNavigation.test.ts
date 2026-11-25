import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeDepositoTab } from '../../../pages/deposito/DepositoPages';
import { prefetchTabChunk, resetPrefetchedTabsForTest } from '../../../utils/tabPrefetcher';

const readDepositoFile = (name: string) =>
  readFileSync(resolve(process.cwd(), 'src/components/deposito', name), 'utf8');

describe('App Depósito — Navegación unificada y permisos de reparto', () => {
  beforeEach(() => {
    resetPrefetchedTabsForTest();
  });

  it('normaliza rutas y aliases hacia pedidos, stock y mapa', () => {
    expect(normalizeDepositoTab(undefined, false)).toBe('pedidos');
    expect(normalizeDepositoTab('picking', false)).toBe('pedidos');
    expect(normalizeDepositoTab('deposito', false)).toBe('pedidos');
    expect(normalizeDepositoTab('pedidos', false)).toBe('pedidos');
    expect(normalizeDepositoTab('stock', false)).toBe('stock');
    expect(normalizeDepositoTab('products', false)).toBe('stock');
    expect(normalizeDepositoTab('mapa', false)).toBe('mapa');
    expect(normalizeDepositoTab('wms-map', false)).toBe('mapa');
  });

  it('bloquea reparto y cobrar para operarios de depósito sin canDeliver', () => {
    expect(normalizeDepositoTab('reparto', false)).toBe('pedidos');
    expect(normalizeDepositoTab('cobrar', false)).toBe('pedidos');
    expect(normalizeDepositoTab('field-receipts', false)).toBe('pedidos');
  });

  it('habilita reparto y cobrar cuando el operario tiene permiso canDeliver', () => {
    expect(normalizeDepositoTab('reparto', true)).toBe('reparto');
    expect(normalizeDepositoTab('logistica', true)).toBe('reparto');
    expect(normalizeDepositoTab('cobrar', true)).toBe('cobrar');
    expect(normalizeDepositoTab('field-receipts', true)).toBe('cobrar');
  });

  it('soporta prefetch para las pestañas unificadas de DEPOSITO', () => {
    expect(prefetchTabChunk('DEPOSITO', 'pedidos')).toBe(true);
    expect(prefetchTabChunk('DEPOSITO', 'stock')).toBe(true);
    expect(prefetchTabChunk('DEPOSITO', 'mapa')).toBe(true);
    expect(prefetchTabChunk('DEPOSITO', 'inexistente')).toBe(false);
  });

  it('mantiene los componentes de Pedidos y Picking táctil <= 300 líneas y con flujo de 1 toque', () => {
    const queue = readDepositoFile('PickingOrdersQueueTab.tsx');
    const active = readDepositoFile('PickingActiveOrderView.tsx');
    const card = readDepositoFile('PickingItemCard.tsx');

    expect(queue.split(/\r?\n/).length).toBeLessThanOrEqual(300);
    expect(active.split(/\r?\n/).length).toBeLessThanOrEqual(300);
    expect(card.split(/\r?\n/).length).toBeLessThanOrEqual(300);
    expect(queue).toContain('onOpenOrder(o)');
    expect(queue).not.toContain('Lotes Próximos a Vencer (Menos de 30 días)');
    expect(card).toContain('dep-stepper');
  });
});
