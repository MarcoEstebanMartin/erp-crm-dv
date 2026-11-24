import { describe, expect, it } from 'vitest';
import {
  buildCommercialOpportunitiesReport,
  computeClientRecommendations,
  computeClientsAtRisk,
  computeExpiringLots,
  computeStagnantStock,
  OpportunityLotInput,
  OpportunityOrderInput,
  OpportunityProductInput,
} from './commercial-opportunities.engine';

const REF_DATE = new Date('2026-11-24T12:00:00.000Z');

function daysAgo(days: number): Date {
  return new Date(REF_DATE.getTime() - days * 86_400_000);
}

function daysFromNow(days: number): Date {
  return new Date(REF_DATE.getTime() + days * 86_400_000);
}

describe('commercial-opportunities.engine', () => {
  describe('computeClientsAtRisk', () => {
    it('detecta clientes atrasados en su ciclo habitual y excluye clientes de 1 solo pedido o al día', () => {
      const orders: OpportunityOrderInput[] = [
        // Cliente 1: compraba cada 7 días, lleva 20 días sin comprar -> OVERDUE_AND_DROP
        { id: 1, clientId: 1, clientName: 'Almacén Don Pepe', sellerName: 'Gemini Ventas', createdAt: daysAgo(41), totalAmount: 100000, items: [] },
        { id: 2, clientId: 1, clientName: 'Almacén Don Pepe', sellerName: 'Gemini Ventas', createdAt: daysAgo(34), totalAmount: 100000, items: [] },
        { id: 3, clientId: 1, clientName: 'Almacén Don Pepe', sellerName: 'Gemini Ventas', createdAt: daysAgo(27), totalAmount: 100000, items: [] },
        { id: 4, clientId: 1, clientName: 'Almacén Don Pepe', sellerName: 'Gemini Ventas', createdAt: daysAgo(20), totalAmount: 100000, items: [] },

        // Cliente 2: activo y al día (compró ayer)
        { id: 5, clientId: 2, clientName: 'Autoservicio Sur', sellerName: 'Gemini Ventas', createdAt: daysAgo(15), totalAmount: 80000, items: [] },
        { id: 6, clientId: 2, clientName: 'Autoservicio Sur', sellerName: 'Gemini Ventas', createdAt: daysAgo(8), totalAmount: 80000, items: [] },
        { id: 7, clientId: 2, clientName: 'Autoservicio Sur', sellerName: 'Gemini Ventas', createdAt: daysAgo(1), totalAmount: 90000, items: [] },

        // Cliente 3: 1 solo pedido histórico (no debe marcarse)
        { id: 8, clientId: 3, clientName: 'Kiosco Ocasional', sellerName: null, createdAt: daysAgo(45), totalAmount: 50000, items: [] },
      ];

      const risk = computeClientsAtRisk(orders, REF_DATE);
      expect(risk).toHaveLength(1);
      expect(risk[0].clientId).toBe(1);
      expect(risk[0].avgCycleDays).toBe(7);
      expect(risk[0].daysSinceLastOrder).toBe(20);
      expect(risk[0].reason).toBe('OVERDUE_AND_DROP');
      expect(risk[0].monthlyAvgAmount).toBeGreaterThan(0);
    });

    it('detecta caída de facturación mayor al 30% aunque no supere el ciclo', () => {
      const orders: OpportunityOrderInput[] = [
        { id: 10, clientId: 10, clientName: 'Mercado Central', sellerName: 'Gemini Ventas', createdAt: daysAgo(70), totalAmount: 200000, items: [] },
        { id: 11, clientId: 10, clientName: 'Mercado Central', sellerName: 'Gemini Ventas', createdAt: daysAgo(40), totalAmount: 200000, items: [] },
        { id: 12, clientId: 10, clientName: 'Mercado Central', sellerName: 'Gemini Ventas', createdAt: daysAgo(10), totalAmount: 40000, items: [] },
      ];

      const risk = computeClientsAtRisk(orders, REF_DATE);
      expect(risk).toHaveLength(1);
      expect(risk[0].reason).toBe('REVENUE_DROP');
      expect(risk[0].variationPct).toBeLessThanOrEqual(-30);
    });
  });

  describe('computeStagnantStock', () => {
    it('calcula capital parado exacto en pesos enteros y ordena de mayor a menor', () => {
      const products: OpportunityProductInput[] = [
        { id: 1, sku: 'SKU-1', name: 'Salame Milán', rubroName: 'Fiambres', stock: 10.5, costPrice: 3500.5, listPrice: 5200.4, lastSoldAt: daysAgo(45) },
        { id: 2, sku: 'SKU-2', name: 'Queso Cremoso', rubroName: 'Lácteos', stock: 20, costPrice: 4000, listPrice: 6000, lastSoldAt: daysAgo(5) },
        { id: 3, sku: 'SKU-3', name: 'Aceitunas x5kg', rubroName: 'Encurtidos', stock: 8, costPrice: 12000, listPrice: 17500, lastSoldAt: null },
        { id: 4, sku: 'SKU-4', name: 'Sin Stock', rubroName: 'Varios', stock: 0, costPrice: 5000, listPrice: 7000, lastSoldAt: daysAgo(90) },
      ];

      const stagnant = computeStagnantStock(products, REF_DATE, 30);
      expect(stagnant).toHaveLength(2);
      // Aceitunas: 8 * 12000 = 96000; Salame: 10.5 * 3500.5 = 36755.25 -> 36755
      expect(stagnant[0].productId).toBe(3);
      expect(stagnant[0].capitalTiedUp).toBe(96000);
      expect(stagnant[0].daysWithoutSale).toBeNull();
      expect(stagnant[1].productId).toBe(1);
      expect(stagnant[1].capitalTiedUp).toBe(36755);
      expect(stagnant[1].listPrice).toBe(5200);
    });
  });

  describe('computeExpiringLots', () => {
    it('clasifica lotes vencidos, críticos y próximos y calcula capital en riesgo', () => {
      const lots: OpportunityLotInput[] = [
        { id: 1, productId: 1, sku: 'S1', productName: 'Yogur', lotNumber: 'L-VENC', expirationDate: daysAgo(2), stock: 10, costPrice: 1500 },
        { id: 2, productId: 2, sku: 'S2', productName: 'Manteca', lotNumber: 'L-CRIT', expirationDate: daysFromNow(5), stock: 12, costPrice: 2500 },
        { id: 3, productId: 3, sku: 'S3', productName: 'Jamón', lotNumber: 'L-SOON', expirationDate: daysFromNow(20), stock: 4, costPrice: 8000 },
        { id: 4, productId: 4, sku: 'S4', productName: 'Fideos', lotNumber: 'L-OK', expirationDate: daysFromNow(90), stock: 50, costPrice: 900 },
        { id: 5, productId: 5, sku: 'S5', productName: 'Vacío', lotNumber: 'L-ZERO', expirationDate: daysFromNow(3), stock: 0, costPrice: 5000 },
      ];

      const expiring = computeExpiringLots(lots, REF_DATE, 30);
      expect(expiring).toHaveLength(3);
      expect(expiring[0]).toMatchObject({ lotId: 1, status: 'EXPIRED', capitalAtRisk: 15000 });
      expect(expiring[1]).toMatchObject({ lotId: 2, status: 'CRITICAL', capitalAtRisk: 30000 });
      expect(expiring[2]).toMatchObject({ lotId: 3, status: 'SOON', capitalAtRisk: 32000 });
    });
  });

  describe('computeClientRecommendations', () => {
    it('detecta productos que dejó de llevar y oportunidades reales de venta cruzada con stock', () => {
      const products: OpportunityProductInput[] = [
        { id: 101, sku: 'P1', name: 'Jamón Cocido', rubroName: 'Fiambres', stock: 30, costPrice: 5000, listPrice: 7500, lastSoldAt: daysAgo(1) },
        { id: 102, sku: 'P2', name: 'Queso Tybo', rubroName: 'Lácteos', stock: 25, costPrice: 4500, listPrice: 6800, lastSoldAt: daysAgo(1) },
        { id: 103, sku: 'P3', name: 'Salame Picado Fino', rubroName: 'Fiambres', stock: 15, costPrice: 6000, listPrice: 9000, lastSoldAt: daysAgo(2) },
        { id: 104, sku: 'P4', name: 'Sin Stock', rubroName: 'Fiambres', stock: 0, costPrice: 3000, listPrice: 4500, lastSoldAt: daysAgo(2) },
      ];

      const orders: OpportunityOrderInput[] = [
        // Cliente objetivo (1): compraba P1 y P3 al principio, en los últimos 2 pedidos dejó de llevar P3, nunca llevó P2
        { id: 1, clientId: 1, clientName: 'Despensa Norte', sellerName: 'Gemini Ventas', createdAt: daysAgo(50), totalAmount: 50000, items: [{ productId: 101, quantity: 2 }, { productId: 103, quantity: 1 }] },
        { id: 2, clientId: 1, clientName: 'Despensa Norte', sellerName: 'Gemini Ventas', createdAt: daysAgo(35), totalAmount: 50000, items: [{ productId: 101, quantity: 2 }, { productId: 103, quantity: 1 }] },
        { id: 3, clientId: 1, clientName: 'Despensa Norte', sellerName: 'Gemini Ventas', createdAt: daysAgo(10), totalAmount: 40000, items: [{ productId: 101, quantity: 2 }] },
        { id: 4, clientId: 1, clientName: 'Despensa Norte', sellerName: 'Gemini Ventas', createdAt: daysAgo(2), totalAmount: 40000, items: [{ productId: 101, quantity: 2 }] },

        // Clientes pares (2 y 3): llevan P1 + P2 (+ P4 sin stock que NO debe sugerirse)
        { id: 5, clientId: 2, clientName: 'Par A', sellerName: 'Gemini Ventas', createdAt: daysAgo(12), totalAmount: 60000, items: [{ productId: 101, quantity: 1 }, { productId: 102, quantity: 2 }, { productId: 104, quantity: 1 }] },
        { id: 6, clientId: 2, clientName: 'Par A', sellerName: 'Gemini Ventas', createdAt: daysAgo(4), totalAmount: 60000, items: [{ productId: 101, quantity: 1 }, { productId: 102, quantity: 2 }] },
        { id: 7, clientId: 3, clientName: 'Par B', sellerName: 'Gemini Ventas', createdAt: daysAgo(14), totalAmount: 60000, items: [{ productId: 101, quantity: 1 }, { productId: 102, quantity: 1 }, { productId: 104, quantity: 1 }] },
        { id: 8, clientId: 3, clientName: 'Par B', sellerName: 'Gemini Ventas', createdAt: daysAgo(5), totalAmount: 60000, items: [{ productId: 101, quantity: 1 }, { productId: 102, quantity: 1 }] },
      ];

      const recs = computeClientRecommendations(orders, products, REF_DATE);
      const target = recs.find((r) => r.clientId === 1);
      expect(target).toBeDefined();
      expect(target!.stoppedBuying).toHaveLength(1);
      expect(target!.stoppedBuying[0]).toMatchObject({ productId: 103, timesBought: 2 });

      expect(target!.crossSell).toHaveLength(1);
      expect(target!.crossSell[0]).toMatchObject({
        productId: 102,
        peerClientsCount: 2,
        affinityPct: 100,
      });
    });
  });

  describe('buildCommercialOpportunitiesReport', () => {
    it('consolida los 4 bloques y sus totales en summary con precisión exacta', () => {
      const report = buildCommercialOpportunitiesReport({
        orders: [
          { id: 1, clientId: 1, clientName: 'Cliente A', sellerName: 'Gemini Ventas', createdAt: daysAgo(40), totalAmount: 100000, items: [{ productId: 1, quantity: 1 }] },
          { id: 2, clientId: 1, clientName: 'Cliente A', sellerName: 'Gemini Ventas', createdAt: daysAgo(25), totalAmount: 100000, items: [{ productId: 1, quantity: 1 }] },
        ],
        products: [
          { id: 1, sku: 'S1', name: 'Prod 1', rubroName: 'R1', stock: 5, costPrice: 10000, listPrice: 15000, lastSoldAt: daysAgo(40) },
        ],
        lots: [
          { id: 1, productId: 1, sku: 'S1', productName: 'Prod 1', lotNumber: 'L1', expirationDate: daysFromNow(10), stock: 2, costPrice: 10000 },
        ],
        referenceDate: REF_DATE,
      });

      expect(report.summary.clientsAtRiskCount).toBe(1);
      expect(report.summary.stagnantProductsCount).toBe(1);
      expect(report.summary.stagnantCapitalTotal).toBe(50000);
      expect(report.summary.expiringLotsCount).toBe(1);
      expect(report.summary.expiringCapitalTotal).toBe(20000);
    });
  });
});
