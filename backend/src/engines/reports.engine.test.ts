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
import { computeLocalSalesReport } from './reports-local-sales.engine';
import {
  getArgentinaWeekMondayIso,
  resolveReportDateRange,
} from '../services/admin/admin-report.helpers';
import {
  getExecutiveReportQuerySchema,
  getFinancialReportsQuerySchema,
  getLocalSalesQuerySchema,
  getProfitabilityQuerySchema,
  getSellerMeetingQuerySchema,
  getZoneReportsQuerySchema,
  weeklyQuerySchema,
} from '../validators/reports.validator';

describe('Paso 1 Reportes — Motores Decimal.js, Fechas AR (-03:00), Notas de Crédito y Zod', () => {
  it('resolveItemHistoricalMetrics respeta unitCostSnapshot, fallbackUnitCostSnapshot, pesables kg (3 dec.) y ROUND_HALF_UP', () => {
    const weighedItem = resolveItemHistoricalMetrics({
      productId: 10,
      quantity: 1,
      weight: '2.3456', // -> 2.346 kg
      unitPrice: 4125.5,
      subtotal: null,
      unitCostSnapshot: '2500.25',
      product: { isPesable: true, costPrice: '9999.00' }, // debe ignorar costPrice actual
    });

    // 2.346 * 2500.25 = 5865.5865 -> $5866 entero; 2.346 * 4125.5 = 9678.423 -> $9678 entero
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
      fallbackUnitCostSnapshot: '1100.50', // 3 * 1100.50 = 3301.5 -> $3302 (ROUND_HALF_UP)
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

    // Venta emitida el 18/11/2026 a las 22:45 hs de Argentina (= 19/11/2026 01:45:00Z)
    const lateSale = new Date('2026-11-19T01:45:00.000Z');
    expect(lateSale >= resolved.start! && lateSale <= resolved.end!).toBe(true);

    // Lunes de semana en hora argentina para un domingo 22:30 hs AR (= lunes 01:30Z UTC)
    expect(getArgentinaWeekMondayIso('2026-11-16T01:30:00.000Z')).toBe('2026-11-09');
  });

  it('computeFinancialSummaryMetrics descuenta CreditNote APPROVED por sucursal (A/X) y modalidad (LOCAL/RUTA) sin centavos', () => {
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
          salesChannel: 'PREVENTA_RUTA',
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

    // Oficial: 100.000 - 20.000 NC = 80.000; Costo: 60.000 - 12.000 NC = 48.000
    expect(result.sales.official).toBe(80000);
    expect(result.sales.officialCost).toBe(48000);
    expect(result.sales.internal).toBe(50000);
    expect(result.sales.internalCost).toBe(30000);

    // Total neto ventas = 130.000; CMV = 78.000; Utilidad Bruta = 52.000; Gastos = 12.500; Neto = 39.500
    expect(result.summary.netSales).toBe(130000);
    expect(result.summary.totalCost).toBe(78000);
    expect(result.summary.grossProfit).toBe(52000);
    expect(result.summary.totalExpenses).toBe(12500);
    expect(result.summary.netProfit).toBe(39500);
    expect(result.summary.creditNotesTotal).toBe(20000);
    expect(result.modalityBreakdown.local.sales).toBe(80000);
    expect(result.modalityBreakdown.route.sales).toBe(50000);
  });

  it('computeLocalSalesReport clasifica PICKUP->LOCAL y DELIVERY->RUTA aun con salesChannel MOSTRADOR viejo y cuadra CASH + CTA_CORRIENTE', () => {
    const localReport = computeLocalSalesReport({
      orders: [
        {
          id: 101,
          movementId: 1001,
          createdAt: '2026-11-18T14:00:00.000Z',
          deliveredAt: '2026-11-18T14:05:00.000Z',
          billingType: 'INTERNAL',
          invoiceType: 'PRESUPUESTO',
          invoiceNumber: 'INT-00101',
          salesChannel: 'MOSTRADOR',
          deliveryMethod: 'PICKUP',
          totalAmount: 15000,
          bultosCount: 3,
          personaId: 50,
          persona: { id: 50, name: 'Despensa Sur', city: 'GENERAL VILLEGAS' },
          seller: { id: 1, username: 'esteban' },
          items: [
            {
              productId: 1,
              quantity: 3,
              subtotal: 15000,
              unitCostSnapshot: 3000,
              product: { id: 1, sku: '0001', name: 'Queso Cremoso', isPesable: false },
            },
          ],
          transactions: [{ id: 1, type: 'INCOME', paymentMethod: 'CASH', amount: 10000 }],
        },
        {
          id: 102,
          movementId: 1002,
          createdAt: '2026-11-18T15:00:00.000Z',
          billingType: 'INTERNAL',
          salesChannel: 'MOSTRADOR', // pedido antiguo de ruta mal etiquetado como MOSTRADOR
          deliveryMethod: 'DELIVERY',
          deliveryRouteId: 7,
          totalAmount: 40000,
          personaId: 51,
          persona: { id: 51, name: 'Autoservicio Ruta', city: 'BANDERALO' },
          items: [
            {
              productId: 2,
              quantity: 4,
              subtotal: 40000,
              unitCostSnapshot: 7000,
              product: { id: 2, sku: '0002', name: 'Leche Entera', isPesable: false },
            },
          ],
          transactions: [],
        },
      ],
      creditNotes: [
        {
          id: 901,
          totalAmount: 2000,
          personaId: 50,
          order: {
            id: 101,
            deliveryMethod: 'PICKUP',
            salesChannel: 'MOSTRADOR',
            items: [{ productId: 1, unitCostSnapshot: 3000 }],
          },
          items: [
            {
              productId: 1,
              quantity: 1,
              subtotal: 2000,
              product: { id: 1, sku: '0001', name: 'Queso Cremoso', isPesable: false },
            },
          ],
        },
      ],
    });

    expect(classifyOrderModality({ deliveryMethod: 'DELIVERY', salesChannel: 'MOSTRADOR' })).toBe('RUTA');
    expect(classifyOrderModality({ deliveryMethod: 'PICKUP', salesChannel: 'PREVENTA_RUTA' })).toBe('LOCAL');
    expect(computeOrderRealBultos({ bultosCount: 4, items: [{ quantity: 20 }] })).toBe(4);

    // Local neto: 15.000 - 2.000 NC = 13.000 (CASH 10.000 + CTA_CORRIENTE (5.000 - 2.000 = 3.000) === 13.000)
    expect(localReport.mostrador.totalSales).toBe(13000);
    expect(localReport.mostrador.totalOrders).toBe(1);
    expect(localReport.routeSummary.totalSales).toBe(40000);
    expect(localReport.routeSummary.totalOrders).toBe(1);
    expect(localReport.channels.some((c) => c.channel === 'TELEFONICO')).toBe(false);

    const cash = localReport.mostrador.paymentMethods.find((p) => p.method === 'CASH')?.amount ?? 0;
    const ctaCte = localReport.mostrador.paymentMethods.find((p) => p.method === 'CTA_CORRIENTE')?.amount ?? 0;
    expect(cash).toBe(10000);
    expect(ctaCte).toBe(3000);
    expect(cash + ctaCte).toBe(localReport.mostrador.totalSales);

    expect(localReport.mostrador.localOrders).toHaveLength(1);
    expect(localReport.mostrador.localOrders[0]).toMatchObject({
      id: 101,
      paymentMethod: 'MIXTO',
      bultosCount: 3,
      clientName: 'Despensa Sur',
    });
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
          personaId: 2, // cliente SIN pedidos nuevos en el período
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
    expect(getLocalSalesQuerySchema.safeParse({ query: { startDate: '2026-11-01', endDate: '2026-11-18' } }).success).toBe(true);
    expect(getProfitabilityQuerySchema.safeParse({ query: { sellerId: '', billingType: 'ALL' } }).success).toBe(true);
    expect(getExecutiveReportQuerySchema.safeParse({ query: { startDate: '18-11-2026' } }).success).toBe(false);
    expect(getSellerMeetingQuerySchema.safeParse({ params: { sellerId: '12' }, query: { startDate: '' } }).success).toBe(true);
    expect(getSellerMeetingQuerySchema.safeParse({ params: { sellerId: 'abc' }, query: {} }).success).toBe(false);
    expect(getZoneReportsQuerySchema.safeParse({ query: { cities: 'GENERAL VILLEGAS,BANDERALO', sellerId: '' } }).success).toBe(true);
    expect(weeklyQuerySchema.safeParse({ query: { weekStart: '2026-11-16' } }).success).toBe(true);
    expect(weeklyQuerySchema.safeParse({ query: { weekStart: 'invalid' } }).success).toBe(false);
  });

  it('crm.controller.ts no contiene datos mockeados de Coca Cola ni Quilmes', () => {
    const crmPath = path.resolve(__dirname, '../controllers/crm.controller.ts');
    const content = fs.readFileSync(crmPath, 'utf8');
    expect(content).not.toMatch(/Coca Cola|Quilmes/i);
  });
});
