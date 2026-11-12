import express from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../utils/prisma';
import { env } from '../../config/env.config';
import { clearIdempotencyStore } from '../../middlewares/idempotency.middleware';
import { sessionCache } from '../../utils/session-cache.util';
import { calculateProductStockValuation } from '../../engines/stock.engine';
import { sanitizeProductForRole } from '../../utils/product-sanitizer.util';
import { adjustStockBatchSchema, adjustStockSchema } from '../../validators/product.validator';
import { productService } from '../product.service';
import { productStockSubService } from '../catalog/product-stock.service';
import { productWmsSubService } from '../catalog/product-wms.service';
import { lotService } from '../lot.service';
import productRoutes from '../../routes/product.routes';

const SENTINEL = new Date('2036-12-31T00:00:00Z');

describe('Paso 3 — Blindaje Contable Decimal.js, RBAC, Idempotencia e Inventario Rápido Atómico', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearIdempotencyStore();
    sessionCache.clear();
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 1 } as any);
  });

  it('1. Cierra fuga de costos en stockValuation para roles no autorizados y valúa sobre stock físico real (Σlotes)', async () => {
    const realValuation = calculateProductStockValuation({
      physicalUnits: 100,
      isWeighable: true,
      approxWeightKg: 4.2,
      costPrice: 6680,
      priceList4: 8350,
      minStockAlert: 10,
    });

    const rawProduct = {
      id: 1735,
      sku: '0001',
      name: 'MELINCUÉ BARRA TYBO X KG',
      costPrice: 6680,
      listPrice: 8350,
      profitMargin: 25,
      stock: 80, // 80 disponibles (20 reservadas en PENDING)
      stockValuation: realValuation,
    };

    for (const restrictedRole of [Role.VENDEDOR, Role.DEPOSITO, 'CHOFER']) {
      const safe = sanitizeProductForRole(rawProduct, restrictedRole);
      expect(safe.costPrice).toBe(0);
      expect(safe.profitMargin).toBeNull();
      expect(safe.stockValuation).toEqual({
        physicalUnits: 100,
        estimatedTotalKg: 420,
        effectiveMultiplier: 4.2,
        stockValueCost: 0,
        stockValueSale: 3507000,
        latentProfit: 0,
        latentMarginPct: 0,
        stockHealth: 'OK',
      });
    }

    for (const privilegedRole of [Role.ADMIN, Role.FACTURACION]) {
      const full = sanitizeProductForRole(rawProduct, privilegedRole);
      expect(full.costPrice).toBe(6680);
      expect(full.stockValuation.stockValueCost).toBe(2805600);
      expect(full.stockValuation.latentProfit).toBe(701400);
      expect(full.stockValuation.latentMarginPct).toBe(25);
    }

    // getProducts calcula physicalUnits desde la suma física de lotes aunque haya reservas comerciales descontadas en Product.stock
    vi.spyOn(prisma.product, 'findMany').mockResolvedValue([
      {
        id: 1735,
        sku: '0001',
        name: 'MELINCUÉ BARRA TYBO X KG',
        stock: 80,
        minStock: 10,
        isPesable: true,
        approximateWeight: 4.2,
        costPrice: 6680,
        listPrice: 8350,
        lots: [
          { id: 868, stock: 80, location: 'S/U', expirationDate: SENTINEL },
          { id: 1115, stock: 20, location: 'D1-R01-C04-C', expirationDate: SENTINEL },
        ],
      } as any,
    ]);

    const enriched = await productService.getProducts();
    expect(enriched[0].stockValuation.physicalUnits).toBe(100);
    expect(enriched[0].stockValuation.stockValueCost).toBe(2805600);
  });

  it('2. adjustStockBatch con targetStock + reservas concurrentes mantiene 0 drift (Product.stock === Σlotes - reservas)', async () => {
    expect(
      adjustStockBatchSchema.safeParse({
        body: { items: [{ productId: 1735, targetStock: 0 }] },
      }).success,
    ).toBe(true);
    expect(
      adjustStockBatchSchema.safeParse({
        body: { items: [{ productId: 1735 }] },
      }).success,
    ).toBe(false);

    // Estado en DB al adquirir FOR UPDATE: 100 físicas (15 en S/U + 85 en rack), 20 reservadas en pedidos PENDING => Product.stock = 80
    // El operario contó físicamente 70 hormas reales en el depósito (faltante de 30 u.: drena las 15 de S/U y 15 del rack)
    const lotsInDb = [
      { id: 868, productId: 1735, lotNumber: 'S/L', stock: 15, location: 'S/U', expirationDate: SENTINEL },
      { id: 1115, productId: 1735, lotNumber: 'S/L', stock: 85, location: 'D1-R01-C04-C', expirationDate: SENTINEL },
    ];
    let persistedProductStock = 80;
    const movements: any[] = [];

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockResolvedValue([{ id: 1735 }]),
        orderItem: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 20 } }),
          groupBy: vi.fn().mockResolvedValue([{ productId: 1735, _sum: { quantity: 20 } }]),
        },
        product: {
          findUnique: vi.fn().mockResolvedValue({ id: 1735, name: 'Tybo', stock: persistedProductStock, defaultLocation: 'D1-R01-C04-C' }),
          findMany: vi.fn().mockResolvedValue([{ id: 1735, name: 'Tybo', stock: persistedProductStock, defaultLocation: 'D1-R01-C04-C' }]),
          update: vi.fn().mockImplementation(async ({ data }) => {
            persistedProductStock = data.stock;
            return { id: 1735, stock: persistedProductStock };
          }),
        },
        productLot: {
          findMany: vi.fn().mockImplementation(async () => lotsInDb.map((l) => ({ ...l }))),
          update: vi.fn().mockImplementation(async ({ where, data }) => {
            const found = lotsInDb.find((l) => l.id === where.id)!;
            found.stock = data.stock;
            return { ...found };
          }),
        },
        stockMovement: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            const mov = { id: movements.length + 1, ...data };
            movements.push(mov);
            return mov;
          }),
        },
      }),
    );

    const res = await productStockSubService.adjustStockBatch(
      [{ productId: 1735, targetStock: 70, reason: 'Recuento físico de cámara' }],
      1,
    );

    const finalLotsSum = lotsInDb.reduce((acc, l) => acc + l.stock, 0);
    expect(finalLotsSum).toBe(70); // 0 en S/U + 70 en rack
    expect(lotsInDb[0].stock).toBe(0);
    expect(lotsInDb[1].stock).toBe(70);
    expect(persistedProductStock).toBe(50); // 70 físicas - 20 reservadas = 50 disponibles (0 drift)
    expect(res.adjustments[0]).toMatchObject({
      productId: 1735,
      previousStock: 80,
      newStock: 50,
      previousPhysical: 100,
      newPhysical: 70,
      reservedQty: 20,
      appliedDelta: -30,
    });
    expect(movements.map((m) => [m.productLotId, m.quantity, m.type])).toEqual([
      [868, -15, 'OUT'],
      [1115, -15, 'OUT'],
    ]);
  });

  it('2b. adjustStockBatch con targetStock + lotId en producto multi-lote ajusta solo ese lote sin destruir hermanos', async () => {
    const multiLots = [
      { id: 868, productId: 1735, lotNumber: 'S/L', stock: 80, location: 'S/U', expirationDate: SENTINEL },
      { id: 1115, productId: 1735, lotNumber: 'S/L', stock: 20, location: 'D1-R01-C04-C', expirationDate: SENTINEL },
    ];
    let commercialStock = 95; // 100 físicas - 5 reservadas en PENDING
    const movements: any[] = [];

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockResolvedValue([{ id: 1735 }]),
        orderItem: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 5 } }),
          groupBy: vi.fn().mockResolvedValue([{ productId: 1735, _sum: { quantity: 5 } }]),
        },
        product: {
          findUnique: vi.fn().mockImplementation(async () => ({ id: 1735, name: 'Tybo', stock: commercialStock, defaultLocation: 'D1-R01-C04-C' })),
          update: vi.fn().mockImplementation(async ({ data }) => {
            commercialStock = data.stock;
            return { id: 1735, stock: commercialStock };
          }),
        },
        productLot: {
          findMany: vi.fn().mockImplementation(async () => multiLots.map((l) => ({ ...l }))),
          findUnique: vi.fn().mockImplementation(async ({ where }) => multiLots.find((l) => l.id === where.id) || null),
          update: vi.fn().mockImplementation(async ({ where, data }) => {
            const found = multiLots.find((l) => l.id === where.id)!;
            found.stock = data.stock;
            return { ...found };
          }),
        },
        stockMovement: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            const mov = { id: movements.length + 1, ...data };
            movements.push(mov);
            return mov;
          }),
        },
      }),
    );

    // 1) Editar solo Lote B (id 1115) de 20 a 25 u. => Lote A queda en 80, Lote B sube a 25 (+5), Σlotes = 105, Product.stock = 100
    const singleLotRes = await productStockSubService.adjustStockBatch(
      [{ productId: 1735, lotId: 1115, targetStock: 25, reason: 'Conteo rápido en rack' }],
      1,
    );
    expect(multiLots[0].stock).toBe(80);
    expect(multiLots[1].stock).toBe(25);
    expect(commercialStock).toBe(100); // 105 - 5 reservas
    expect(singleLotRes.adjustments[0]).toMatchObject({ appliedDelta: 5, newPhysical: 105, newStock: 100 });
    expect(movements[0]).toMatchObject({ productLotId: 1115, quantity: 5, type: 'IN' });

    // 2) Editar ambos lotes en el mismo batch: Lote A -> 75 (-5) y Lote B -> 22 (-3) => Σlotes = 97, Product.stock = 92
    await productStockSubService.adjustStockBatch(
      [
        { productId: 1735, lotId: 868, targetStock: 75, reason: 'Conteo multi-lote' },
        { productId: 1735, lotId: 1115, targetStock: 22, reason: 'Conteo multi-lote' },
      ],
      1,
    );
    expect(multiLots[0].stock).toBe(75);
    expect(multiLots[1].stock).toBe(22);
    expect(commercialStock).toBe(92); // 97 - 5 reservas
  });

  it('3. Elimina palabras mágicas en reason, soporta mode="VACATE_LOT" explícito y jamás crea lotes fantasma en negativos', async () => {
    expect(adjustStockSchema.safeParse({ params: { id: '1' }, body: { mode: 'VACATE_LOT', lotId: 50 } }).success).toBe(true);
    expect(adjustStockSchema.safeParse({ params: { id: '1' }, body: { mode: 'VACATE_LOT' } }).success).toBe(false);

    const lotState = { id: 50, productId: 1, lotNumber: 'L-2501', stock: 20, location: 'D1-R01-C02-A', expirationDate: SENTINEL };
    let prodStock = 20;
    const movements: any[] = [];
    const lotCreates = vi.fn();

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockResolvedValue([{ id: 1 }]),
        orderItem: { aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 0 } }) },
        product: {
          findUnique: vi.fn().mockImplementation(async () => ({ id: 1, name: 'Cremoso', stock: prodStock, defaultLocation: 'D1-R01-C02-A' })),
          update: vi.fn().mockImplementation(async ({ data }) => {
            prodStock = data.stock;
            return { id: 1, stock: prodStock };
          }),
        },
        productLot: {
          findMany: vi.fn().mockImplementation(async () => [{ ...lotState }]),
          findUnique: vi.fn().mockImplementation(async () => ({ ...lotState })),
          create: lotCreates,
          update: vi.fn().mockImplementation(async ({ data }) => {
            lotState.stock = data.stock;
            return { ...lotState };
          }),
        },
        stockMovement: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            const m = { id: movements.length + 1, ...data };
            movements.push(m);
            return m;
          }),
        },
      }),
    );
    vi.spyOn(prisma.product, 'findUnique').mockResolvedValue({ id: 1, stock: 19, lots: [] } as any);

    // A) "Retiro por rotura" con quantityChange: -1 resta SOLO 1 unidad (jamás vacía las 20 por palabra mágica)
    await productStockSubService.adjustStock(
      1,
      { quantityChange: -1, lotId: 50, reason: 'Retiro por rotura en cámara' },
      1,
    );
    expect(lotState.stock).toBe(19);
    expect(prodStock).toBe(19);
    expect(movements[0].quantity).toBe(-1);

    // B) mode: 'VACATE_LOT' explícito vacía las 19 restantes a 0
    await productStockSubService.adjustStock(
      1,
      { mode: 'VACATE_LOT', lotId: 50, reason: 'Decomiso bromatológico total' },
      1,
    );
    expect(lotState.stock).toBe(0);
    expect(prodStock).toBe(0);
    expect(movements[1].quantity).toBe(-19);

    // C) Intento de resta adicional cuando ya no hay lotes positivos jamás crea lote fantasma
    prodStock = 5; // incluso si hubiese descalce heredado sin lotes positivos
    await expect(
      productStockSubService.adjustStock(1, { quantityChange: -2, reason: 'Merma' }, 1),
    ).rejects.toThrow(/No hay lotes con unidades físicas/);
    expect(lotCreates).not.toHaveBeenCalled();
  });

  it('4. LotService.deleteLot bloquea bajo FOR UPDATE y valida stock === 0 + cero historial antes de borrar', async () => {
    const lockOrder: string[] = [];

    // Caso 1: bajo el lock descubre que el lote recibió stock concurrentemente -> aborta
    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockImplementation(async () => {
          lockOrder.push('LOCK');
          return [{ id: 1735 }];
        }),
        productLot: {
          findUnique: vi
            .fn()
            .mockResolvedValueOnce({ id: 90, productId: 1735, lotNumber: 'L-RACE', stock: 0, location: 'S/U' })
            .mockResolvedValueOnce({ id: 90, productId: 1735, lotNumber: 'L-RACE', stock: 4, location: 'S/U' }),
          delete: vi.fn(),
        },
      }),
    );
    await expect(lotService.deleteLot(90, 1)).rejects.toThrow(/tiene stock disponible \(4 u\.\)/);
    expect(lockOrder).toEqual(['LOCK']);

    // Caso 2: lote en 0 pero con historial en Kardex -> rechaza con mensaje de negocio sin disparar error FK 500
    const deleteSpy = vi.fn();
    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockResolvedValue([{ id: 1735 }]),
        productLot: {
          findUnique: vi.fn().mockResolvedValue({ id: 91, productId: 1735, lotNumber: 'L-HIST', stock: 0, location: 'S/U' }),
          delete: deleteSpy,
        },
        stockMovement: { count: vi.fn().mockResolvedValue(2) },
        orderItemLot: { count: vi.fn().mockResolvedValue(0) },
      }),
    );
    await expect(lotService.deleteLot(91, 1)).rejects.toThrow(/historial de ventas o movimientos/);
    expect(deleteSpy).not.toHaveBeenCalled();

    // Caso 3: lote en 0 y sin referencias -> borra dentro de la transacción
    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockResolvedValue([{ id: 1735 }]),
        productLot: {
          findUnique: vi.fn().mockResolvedValue({ id: 92, productId: 1735, lotNumber: 'L-VACIO', stock: 0, location: 'S/U' }),
          delete: deleteSpy.mockResolvedValue({ id: 92 }),
        },
        stockMovement: { count: vi.fn().mockResolvedValue(0) },
        orderItemLot: { count: vi.fn().mockResolvedValue(0) },
      }),
    );
    await expect(lotService.deleteLot(92, 1)).resolves.toBe(true);
    expect(deleteSpy).toHaveBeenCalledWith({ where: { id: 92 } });
  });

  it('5. WMS assignWmsLocation registra StockMovement auditable al normalizar remanente sin lote en S/U', async () => {
    const movements: any[] = [];
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockResolvedValue([{ id: 1735 }]),
        product: {
          findUnique: vi.fn().mockResolvedValue({ id: 1735, stock: 100, defaultLocation: null }),
          update: vi.fn().mockImplementation(async ({ data }) => ({ id: 1735, stock: 100, ...data })),
        },
        orderItem: { aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 0 } }) },
        productLot: {
          findMany: vi.fn().mockResolvedValue([]), // 100 u. legadas aún sin fila ProductLot
          create: vi
            .fn()
            .mockImplementationOnce(async ({ data }) => ({ id: 868, ...data })) // 80 u. en S/U
            .mockImplementationOnce(async ({ data }) => ({ id: 1115, ...data })), // 20 u. en rack
          update: vi.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })),
        },
        stockMovement: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            movements.push(data);
            return { id: movements.length, ...data };
          }),
        },
      }),
    );

    await productWmsSubService.assignWmsLocation(
      { productId: 1735, locationCode: 'D1-R01-C04-C', quantity: 20 },
      1,
    );

    expect(movements).toHaveLength(2);
    expect(movements[0]).toMatchObject({ productLotId: 868, quantity: 80, type: 'ADJUSTMENT' });
    expect(movements[1]).toMatchObject({ productLotId: 1115, quantity: 20, type: 'ADJUSTMENT' });
  });

  it('6. Restringe Kardex/vencimientos a ADMIN/FACTURACION/DEPOSITO y protege mutaciones con idempotencyGuard', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockImplementation((async ({ where }: any) => ({
      id: where.id,
      isActive: true,
      role: where.id === 1 ? Role.ADMIN : where.id === 2 ? Role.DEPOSITO : Role.VENDEDOR,
    })) as any);

    const sellerToken = jwt.sign({ id: 3, username: 'vend', role: Role.VENDEDOR }, env.JWT_SECRET, { expiresIn: '1h' });
    const adminToken = jwt.sign({ id: 1, username: 'admin', role: Role.ADMIN }, env.JWT_SECRET, { expiresIn: '1h' });

    const revertSpy = vi.spyOn(productService, 'revertPrices').mockResolvedValue({ revertedCount: 4 } as any);

    const app = express();
    app.use(express.json());
    app.use('/api/products', productRoutes);
    const server = app.listen(0);

    try {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const base = `http://127.0.0.1:${port}/api/products`;

      for (const path of ['/stock/movements', '/1735/movements', '/stock/expiring-lots']) {
        const res = await fetch(`${base}${path}`, {
          headers: { Authorization: `Bearer ${sellerToken}` },
        });
        expect(res.status).toBe(403);
      }

      // Idempotencia en POST /revert-prices: dos envíos con la misma Idempotency-Key ejecutan el servicio 1 sola vez
      const headers = {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'revert-prices-step3-key-001',
      };
      const first = await fetch(`${base}/revert-prices`, { method: 'POST', headers, body: '{}' });
      const second = await fetch(`${base}/revert-prices`, { method: 'POST', headers, body: '{}' });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.headers.get('x-idempotency-replayed')).toBe('true');
      expect(revertSpy).toHaveBeenCalledTimes(1);
    } finally {
      server.close();
    }
  });
});
