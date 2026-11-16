import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_DIR = path.resolve(TEST_DIR, '..');

function readAdminFile(filename: string): string {
  return fs.readFileSync(path.join(ADMIN_DIR, filename), 'utf8');
}

describe('Paso 3 Velocidad — Inicio Liviano y Paginación Real en Pedidos', () => {
  it('useAdminController usa getOrdersSummary en dashboard y evita bajar todos los pedidos en orders', () => {
    const controllerSrc = readAdminFile('useAdminController.ts');
    expect(controllerSrc).toContain('api.getOrdersSummary()');

    const dashboardBlock = controllerSrc.split("activeTab === 'dashboard'")[1]?.split('} else if (')[0] || '';
    expect(dashboardBlock).not.toContain('api.getOrders()');

    const ordersBlock = controllerSrc.split("activeTab === 'orders'")[1]?.split('} catch')[0] || '';
    expect(ordersBlock).not.toContain('api.getOrders()');
  });

  it('OrdersTab usa getOrdersPage con límite 50, HomeTab <= 300 líneas y AdminSummaryCardModal consulta paginado', () => {
    const ordersTabSrc = readAdminFile('OrdersTab.tsx');
    const homeTabSrc = readAdminFile('HomeTab.tsx');
    const summaryModalSrc = readAdminFile('AdminSummaryCardModal.tsx');

    expect(ordersTabSrc).toContain('api.getOrdersPage');
    expect(ordersTabSrc).toContain('ORDERS_PAGE_LIMIT = 50');
    expect(ordersTabSrc).toContain('Anterior');
    expect(ordersTabSrc).toContain('Siguiente');

    expect(summaryModalSrc).toContain('getOrdersPage');
    expect(homeTabSrc).toContain('ordersSummary');
    expect(homeTabSrc.split(/\r?\n/).length).toBeLessThanOrEqual(300);
    expect(ordersTabSrc.split(/\r?\n/).length).toBeLessThanOrEqual(450);
  });
});
