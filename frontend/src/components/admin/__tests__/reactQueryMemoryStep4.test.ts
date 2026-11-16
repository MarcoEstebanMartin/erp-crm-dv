import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_DIR = path.resolve(TEST_DIR, '..');
const QUERIES_DIR = path.resolve(TEST_DIR, '../../../hooks/queries');

function readAdminFile(filename: string): string {
  return fs.readFileSync(path.join(ADMIN_DIR, filename), 'utf8');
}

describe('Paso 4 Velocidad — Memoria Instantánea entre Pestañas (@tanstack/react-query)', () => {
  it('OrdersTab y HomeTab consumen hooks React Query con caché compartida y keepPreviousData', () => {
    const ordersTabSrc = readAdminFile('OrdersTab.tsx');
    const homeTabSrc = readAdminFile('HomeTab.tsx');
    const ordersHookSrc = fs.readFileSync(path.join(QUERIES_DIR, 'useOrdersQuery.ts'), 'utf8');
    const homeHookSrc = fs.readFileSync(path.join(QUERIES_DIR, 'useHomeQuery.ts'), 'utf8');

    expect(ordersHookSrc).toContain('keepPreviousData');
    expect(ordersTabSrc).toContain('useOrdersPageQuery');
    expect(ordersTabSrc).toContain('useQueryClient');

    expect(homeHookSrc).toContain('usePendingRendicionesQuery');
    expect(homeHookSrc).toContain('useWeeklyScheduleQuery');
    expect(homeTabSrc).toContain('usePendingRendicionesQuery');
    expect(homeTabSrc).toContain('useWeeklyScheduleQuery');
    expect(homeTabSrc.split(/\r?\n/).length).toBeLessThanOrEqual(300);
  });

  it('useAdminController hidrata desde QueryClient e invalida las 4 familias en fetchData', () => {
    const ctrlSrc = readAdminFile('useAdminController.ts');

    expect(ctrlSrc).toContain('useQueryClient');
    expect(ctrlSrc).toContain('queryClient.getQueryData');
    expect(ctrlSrc).toContain('queryClient.fetchQuery');
    expect(ctrlSrc).toContain('queryClient.invalidateQueries');
    expect(ctrlSrc).toContain('ORDERS_QUERY_KEYS.all');
    expect(ctrlSrc).toContain('CLIENTS_QUERY_KEYS.all');
    expect(ctrlSrc).toContain('PRODUCTS_QUERY_KEYS.all');
    expect(ctrlSrc).toContain('HOME_QUERY_KEYS.all');
  });
});
