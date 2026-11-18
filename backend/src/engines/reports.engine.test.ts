import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  classifyOrderModality,
  computeFinancialSummaryMetrics,
  computeOrderRealBultos,
  computeProfitabilityMetrics,
  resolveItemHistoricalMetrics,
} from './reports-core.engine';
import { computeEmployeeReportMetrics } from './reports-employee.engine';
import {
  getArgentinaWeekMondayIso,
  resolveReportDateRange,
} from '../services/admin/admin-report.helpers';
import {
  getEmployeeReportQuerySchema,
  getExecutiveReportQuerySchema,
  getFinancialReportsQuerySchema,
  getProfitabilityQuerySchema,
  getSellerMeetingQuerySchema,
  getZoneReportsQuerySchema,
} from '../validators/reports.validator';

describe('Reportes Minimalistas — Motores Decimal.js, Fechas AR (-03:00), Notas de Crédito y Zod', () => {
  it('resolveItemHistoricalMetrics respeta unitCostSnapshot, fallbackUnitCostSnapshot, pesables kg (3 dec.) y ROUND_HALF_UP', () => {
    const weighedItem = resolveItemHistoricalMetrics({
      productId: 10,
      quantity: 1,
      weight: '2.3456',
      unitPrice: 4125.5,
      subtotal: null,
      unitCostSnapshot: '2500.25',
      product: { isPesable: true, costPrice: '9999.00' },
    });

    expect(weighedItem.qtyOrWeight).toBe(2.346);
    expect(weighedItem.unitCostUsed).toBe(2500.25);
    expect(weighedItem.itemCost).toBe(5866);
    expect(weighedItem.itemRevenue).toBe(9678);

    const cnItemWithFallback = resolveItemHistoricalMetrics({
      productId: 20,
      quantity: 3,
      unitPrice: 1500,
      subtotal: 4500,
      unitCostSnapshot: null,
      fallbackUnitCostSnapshot: '1100.50',
      product: { isPesable: false, costPrice: '2000.00' },
    });

    expect(cnItemWithFallback.unitCostUsed).toBe(1100.5);
    expect(cnItemWithFallback.itemCost).toBe(3302);
    expect(cnItemWithFallback.itemRevenue).toBe(4500);
  });

  it('resolveReportDateRange incluye ventas a las 22:45 AR (01:45Z día siguiente) sin desfase de 1 día', () => {
    const resolved = resolveReportDateRange({
      startDate: '2026-11-01',
      endDate: '2026-11-18',
    });

    expect(resolved.startDateIso).toBe('2026-11-01');
    expect(resolved.endDateIso).toBe('2026-11-18');
    expect(resolved.start?.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(resolved.end?.toISOString()).toBe('2026-11-19T02:59:59.999Z');

    const lateSale = new Date('2026-11-19T01:45:00.000Z');
    expect(lateSale >= resolved.start! && lateSale <= resolved.end!).toBe(true);
    expect(getArgentinaWeekMondayIso('2026-11-16T01:30:00.000Z')).toBe('2026-11-09');
  });

  it('computeFinancialSummaryMetrics calcula Mostrador (PICKUP->LOCAL) vs Ruta (DELIVERY->RUTA), sharePct y descuenta NC APPROVED', () => {
    const result = computeFinancialSummaryMetrics({
      orders: [
        {
          billingType: 'OFFICIAL',
          totalAmount: 100000,
          deliveryMethod: 'PICKUP',
          salesChannel: 'MOSTRADOR',
          items: [{ productId: 1, quantity: 10, subtotal: 100000, unitCostSnapshot: 6000 }],
        },
        {
          billingType: 'INTERNAL',
          totalAmount: 50000,
          deliveryMethod: 'DELIVERY',
          salesChannel: 'MOSTRADOR', // pedido antiguo de ruta mal etiquetado como MOSTRADOR -> debe ir a RUTA
          items: [{ productId: 2, quantity: 5, subtotal: 50000, unitCostSnapshot: 6000 }],
        },
      ],
      creditNotes: [
        {
          billingType: 'OFFICIAL',
          totalAmount: 20000,
          order: {
            deliveryMethod: 'PICKUP',
            salesChannel: 'MOSTRADOR',
            items: [{ productId: 1, unitCostSnapshot: 6000 }],
          },
          items: [{ productId: 1, quantity: 2, subtotal: 20000, product: { isPesable: false, costPrice: 7500 } }],
        },
      ],
      expenses: [{ amount: '12500.40', category: { name: 'Combustible' } }],
      transactionsGrouped: [{ billingType: 'OFFICIAL', type: 'INCOME', _sum: { amount: 80000 } }],
      paymentMethodsGrouped: [{ billingType: 'OFFICIAL', paymentMethod: 'CASH', _sum: { amount: 80000 } }],
    });

    expect(classifyOrderModality({ deliveryMethod: 'DELIVERY', salesChannel: 'MOSTRADOR' })).toBe('RUTA');
    expect(classifyOrderModality({ deliveryMethod: 'PICKUP', salesChannel: 'PREVENTA_RUTA' })).toBe('LOCAL');
    expect(computeOrderRealBultos({ bultosCount: 4, items: [{ quantity: 20 }] })).toBe(4);

    // Oficial: 100.000 - 20.000 NC = 80.000; Costo: 60.000 - 12.000 NC = 48.000
    expect(result.sales.official).toBe(80000);
    expect(result.sales.officialCost).toBe(48000);
    expect(result.sales.internal).toBe(50000);
    expect(result.sales.internalCost).toBe(30000);

    // Mostrador (LOCAL): 80.000 / 130.000 = 62% (1 venta); Ruta: 50.000 / 130.000 = 38% (1 pedido)
    expect(result.summary.netSales).toBe(130000);
    expect(result.summary.totalCost).toBe(78000);
    expect(result.summary.grossProfit).toBe(52000);
    expect(result.summary.totalExpenses).toBe(12500);
    expect(result.summary.netProfit).toBe(39500);
    expect(result.summary.creditNotesTotal).toBe(20000);
    expect(result.modalityBreakdown.local).toMatchObject({ sales: 80000, count: 1, sharePct: 62 });
    expect(result.modalityBreakdown.route).toMatchObject({ sales: 50000, count: 1, sharePct: 38 });
  });

  it('computeProfitabilityMetrics descuenta CreditNote APPROVED aunque el cliente no tenga pedidos nuevos en el período', () => {
    const prof = computeProfitabilityMetrics({
      orders: [
        {
          personaId: 1,
          sellerId: 7,
          billingType: 'OFFICIAL',
          persona: { id: 1, name: 'Cliente Activo', city: 'GENERAL VILLEGAS', sellerId: 7, seller: { username: 'diego' } },
          items: [
            {
              productId: 100,
              quantity: 10,
              subtotal: 100000,
              unitCostSnapshot: 7000,
              product: { id: 100, sku: 'S100', name: 'Producto A', rubroId: 1, rubro: { id: 1, name: 'Lácteos' } },
            },
          ],
        },
      ],
      creditNotes: [
        {
          personaId: 2,
          billingType: 'OFFICIAL',
          totalAmount: 10000,
          persona: { id: 2, name: 'Cliente Solo Devolucion', city: 'GENERAL VILLEGAS', sellerId: 7, seller: { username: 'diego' } },
          order: { sellerId: 7, items: [{ productId: 100, unitCostSnapshot: 7000 }] },
          items: [
            {
              productId: 100,
              quantity: 1,
              subtotal: 10000,
              product: { id: 100, sku: 'S100', name: 'Producto A', rubroId: 1, rubro: { id: 1, name: 'Lácteos' } },
            },
          ],
        },
      ],
      filters: { sellerId: 7, billingType: 'OFFICIAL', city: 'GENERAL VILLEGAS', rubroId: 1 },
    });

    expect(prof.clients).toHaveLength(2);
    const devClient = prof.clients.find((c) => c.id === 2);
    expect(devClient).toMatchObject({ totalRevenue: -10000, totalCost: -7000, grossProfit: -3000 });
    expect(prof.kpis.totalRevenue).toBe(90000);
    expect(prof.kpis.totalCost).toBe(63000);
    expect(prof.kpis.totalGrossProfit).toBe(27000);
  });

  it('Esquemas Zod aceptan fechas válidas o vacías y rechazan formatos inválidos', () => {
    expect(getFinancialReportsQuerySchema.safeParse({ query: { year: '2026', month: '11', startDate: '', endDate: '' } }).success).toBe(true);
    expect(getProfitabilityQuerySchema.safeParse({ query: { sellerId: '', billingType: 'ALL' } }).success).toBe(true);
    expect(getExecutiveReportQuerySchema.safeParse({ query: { startDate: '18-11-2026' } }).success).toBe(false);
    expect(getSellerMeetingQuerySchema.safeParse({ params: { sellerId: '12' }, query: { startDate: '' } }).success).toBe(true);
    expect(getSellerMeetingQuerySchema.safeParse({ params: { sellerId: 'abc' }, query: {} }).success).toBe(false);
    expect(getEmployeeReportQuerySchema.safeParse({ params: { userId: '5' }, query: { startDate: '2026-11-01', endDate: '2026-11-18' } }).success).toBe(true);
    expect(getEmployeeReportQuerySchema.safeParse({ params: { userId: 'xyz' }, query: {} }).success).toBe(false);
    expect(getZoneReportsQuerySchema.safeParse({ query: { cities: 'GENERAL VILLEGAS,BANDERALO', sellerId: '' } }).success).toBe(true);
  });

  it('computeEmployeeReportMetrics calcula Decimal.js, NC APPROVED, cobranzas, operación y limita Top Clientes/Productos a 5', () => {
    const orders = Array.from({ length: 7 }, (_, i) => {
      const idx = i + 1;
      const total = idx * 10000;
      return {
        personaId: idx,
        billingType: idx % 2 === 0 ? 'OFFICIAL' : 'INTERNAL',
        totalAmount: total,
        deliveryMethod: idx === 1 ? 'PICKUP' : 'DELIVERY',
        bultosCount: 2,
        persona: { name: `Cliente ${idx}`, city: 'GENERAL VILLEGAS' },
        items: [
          {
            productId: 100 + idx,
            quantity: idx,
            subtotal: total,
            unitCostSnapshot: 6000,
            product: { name: `Producto ${idx}`, isPesable: false, rubro: { name: 'Almacén' } },
          },
        ],
      };
    });

    const emp = computeEmployeeReportMetrics({
      orders,
      creditNotes: [
        {
          personaId: 7,
          billingType: 'INTERNAL',
          totalAmount: 10000,
          persona: { name: 'Cliente 7', city: 'GENERAL VILLEGAS' },
          order: { deliveryMethod: 'DELIVERY', items: [{ productId: 107, unitCostSnapshot: 6000 }] },
          items: [
            {
              productId: 107,
              quantity: 1,
              subtotal: 10000,
              product: { name: 'Producto 7', isPesable: false, rubro: { name: 'Almacén' } },
            },
          ],
        },
      ],
      collectionsGrouped: [
        { paymentMethod: 'CASH', _sum: { amount: 120000 } },
        { paymentMethod: 'BANK_TRANSFER', _sum: { amount: 80000 } },
        { paymentMethod: 'CHECK', _sum: { amount: 40000 } },
      ],
      routesCount: 4,
      routeOrdersDelivered: 18,
      fieldReceiptsCount: 6,
      fieldReceiptsAmount: '95400.60',
      cashDrawersCount: 3,
      stockMovementsCount: 15,
    });

    // Suma 10k+20k+...+70k = 280k - 10k NC = 270k
    expect(emp.summary.totalSales).toBe(270000);
    expect(emp.summary.totalOrders).toBe(7);
    expect(emp.summary.totalBultos).toBe(14);
    expect(emp.breakdown.localSales).toBe(10000);
    expect(emp.breakdown.routeSales).toBe(260000);
    expect(emp.collections).toEqual({
      totalCollected: 240000,
      byMethod: { cash: 120000, transfer: 80000, check: 40000, other: 0 },
    });
    expect(emp.operations).toEqual({
      routesCount: 4,
      routeOrdersDelivered: 18,
      fieldReceiptsCount: 6,
      fieldReceiptsAmount: 95401,
      cashDrawersCount: 3,
      stockMovementsCount: 15,
    });
    expect(emp.topClients).toHaveLength(5);
    expect(emp.topProducts).toHaveLength(5);
    expect(emp.topClients.map((c) => c.name)).toEqual([
      'Cliente 6',
      'Cliente 7',
      'Cliente 5',
      'Cliente 4',
      'Cliente 3',
    ]);
    expect(emp.topProducts.map((p) => p.name)).toEqual([
      'Producto 6',
      'Producto 7',
      'Producto 5',
      'Producto 4',
      'Producto 3',
    ]);
  });

  it('crm.controller.ts no tiene mocks Coca Cola/Quilmes y admin.routes.ts expone /reports/pdf/employee/:userId sin rutas muertas', () => {
    const crmContent = fs.readFileSync(path.resolve(__dirname, '../controllers/crm.controller.ts'), 'utf8');
    expect(crmContent).not.toMatch(/Coca Cola|Quilmes/i);

    const routesContent = fs.readFileSync(path.resolve(__dirname, '../routes/admin.routes.ts'), 'utf8');
    expect(routesContent).toContain('/reports/pdf/employee/:userId');
    expect(routesContent).not.toContain('/reports/weekly');
    expect(routesContent).not.toContain('/reports/sales-channels');
    expect(routesContent).not.toContain('/reports/local-sales');
  });
});
