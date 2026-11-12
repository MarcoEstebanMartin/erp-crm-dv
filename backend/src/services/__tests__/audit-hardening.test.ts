import crypto from 'crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role } from '@prisma/client';
import prisma from '../../utils/prisma';
import { adjustStockSchema } from '../../validators/product.validator';
import { productStockSubService } from '../catalog/product-stock.service';
import { productReconciliationSubService } from '../catalog/product-reconciliation.service';
import { sanitizeProductListForRole } from '../../utils/product-sanitizer.util';
import { AiChatbotService } from '../aiChatbot.service';
import { verifyMetaWebhookSignature } from '../../controllers/crm_whatsapp_webhook.controller';
import { getSellerProfileStats } from '../../controllers/persona.controller';
import { getBankAccounts, getTransactionById } from '../../controllers/finance.controller';
import { bankAccountService } from '../finance/bank-account.service';
import { transactionAdminService } from '../finance/transaction-admin.service';

describe('Blindaje Quirúrgico — Auditoría Cruzada de Stock, Costos, Chatbot, Webhook y RBAC', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Rechaza decimales en adjustStockSchema y graba el delta real aplicado en StockMovement', async () => {
    const decimalCheck = adjustStockSchema.safeParse({
      params: { id: '12' },
      body: { quantityChange: -2.5, reason: 'Rotura' },
    });
    expect(decimalCheck.success).toBe(false);

    const createdMovements: any[] = [];
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      const txMock = {
        product: {
          findUnique: vi.fn().mockResolvedValue({ id: 12, stock: 3, defaultLocation: null }),
          update: vi.fn().mockImplementation(async ({ data }) => ({ id: 12, stock: data.stock })),
        },
        productLot: {
          findUnique: vi.fn().mockResolvedValue({
            id: 99,
            productId: 12,
            lotNumber: 'L-01',
            stock: 3,
            location: 'A1',
          }),
          // Simula FK histórica: no puede borrarse físicamente y queda en stock 0
          delete: vi.fn().mockRejectedValue(new Error('FK constraint')),
          update: vi.fn().mockResolvedValue({ id: 99, stock: 0, location: 'S/U' }),
        },
        stockMovement: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            createdMovements.push(data);
            return { id: 501, ...data };
          }),
        },
      };
      return cb(txMock);
    });
    vi.spyOn(prisma.product, 'findUnique').mockResolvedValue({ id: 12, stock: 0, lots: [] } as any);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 1 } as any);

    await productStockSubService.adjustStock(
      12,
      { quantityChange: -10, lotId: 99, reason: 'Retiro por merma' },
      1,
    );

    expect(createdMovements).toHaveLength(1);
    // Pidió -10 pero solo había 3 físicas: el movimiento auditable debe registrar -3 (no -10) y conservar lotId 99
    expect(createdMovements[0].quantity).toBe(-3);
    expect(createdMovements[0].productLotId).toBe(99);
  });

  it('Conciliación con desvío negativo descuenta de lotes positivos sin dejar lote S/L negativo', async () => {
    vi.spyOn(productReconciliationSubService, 'reconcileStockAudit').mockResolvedValue([
      {
        id: 20,
        sku: 'FER-01',
        name: 'Fernet 750ml',
        stockActual: 10,
        stockLotes: 15,
        reservas: 0,
        stockTeorico: 15,
        discrepancia: -5,
      },
    ]);

    const lotUpdates: any[] = [];
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      const txMock = {
        productLot: {
          findMany: vi.fn().mockResolvedValue([
            { id: 1, productId: 20, lotNumber: 'LOTE-VIEJO', stock: 15, expirationDate: new Date() },
          ]),
          update: vi.fn().mockImplementation(async (args) => {
            lotUpdates.push(args);
            return args;
          }),
        },
        stockMovement: { create: vi.fn().mockResolvedValue({ id: 1 }) },
      };
      return cb(txMock);
    });
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 1 } as any);

    const res = await productReconciliationSubService.executeStockReconciliation(1);
    expect(res.count).toBe(1);
    expect(lotUpdates[0].data.stock).toBe(10); // 15 - 5 = 10 (>= 0, jamás negativo)
  });

  it('Oculta costPrice, profitMargin y valuación de costo a VENDEDOR/DEPOSITO pero los mantiene en ADMIN', () => {
    const rawCatalog = [
      {
        id: 1,
        sku: 'QUESO-01',
        name: 'Cremoso',
        costPrice: 4200.5,
        listPrice: 5600,
        profitMargin: 33.32,
        provider: { id: 8, name: 'Lácteos Sur', cuit: '30112233445', phone: '112233' },
        stockValuation: {
          physicalUnits: 100,
          estimatedTotalKg: 0,
          effectiveMultiplier: 1,
          stockValueCost: 420050,
          stockValueSale: 560000,
          latentProfit: 139950,
          latentMarginPct: 33.32,
          stockHealth: 'OK',
        },
      },
    ];

    const sellerView = sanitizeProductListForRole(rawCatalog, Role.VENDEDOR);
    expect(sellerView[0].costPrice).toBe(0);
    expect(sellerView[0].profitMargin).toBeNull();
    expect(sellerView[0].stockValuation.stockValueCost).toBe(0);
    expect(sellerView[0].stockValuation.latentProfit).toBe(0);
    expect(sellerView[0].stockValuation.latentMarginPct).toBe(0);
    expect(sellerView[0].stockValuation.stockValueSale).toBe(560000);
    expect((sellerView[0].provider as any).cuit).toBeUndefined();

    const adminView = sanitizeProductListForRole(rawCatalog, Role.ADMIN);
    expect(adminView[0].costPrice).toBe(4200.5);
    expect(adminView[0].profitMargin).toBe(33.32);
    expect(adminView[0].stockValuation.stockValueCost).toBe(420050);
  });

  it('Chatbot público solo recibe el precio de su lista y booleano disponible (sin Lista B/C ni stock exacto)', async () => {
    vi.spyOn(prisma.product, 'findMany').mockResolvedValue([
      {
        id: 7,
        sku: 'JAM-01',
        name: 'Jamón Cocido',
        commercialCategory: 'Fiambres',
        listPrice: 9000,
        listPriceB: 8200,
        listPriceC: 7400,
        unitsPerBox: 2,
        stock: 148,
        isPesable: true,
      } as any,
    ]);

    const bot = new AiChatbotService();
    const publicCatalog = await bot.getFormattedCatalog('LISTA_A');
    expect(publicCatalog[0]).toEqual({
      id: 7,
      sku: 'JAM-01',
      name: 'Jamón Cocido',
      cat: 'Fiambres',
      precio: 9000,
      unidCaja: 2,
      disponible: true,
      unid: 'KG',
    });
    expect((publicCatalog[0] as any).precioB).toBeUndefined();
    expect((publicCatalog[0] as any).precioC).toBeUndefined();
    expect((publicCatalog[0] as any).stock).toBeUndefined();
  });

  it('Webhook WhatsApp falla cerrado en producción sin secreto, no crashea con firmas cortas y valida rawBody', () => {
    const raw = Buffer.from('{"object":"whatsapp_business_account"}', 'utf8');

    const missingInProd = verifyMetaWebhookSignature(raw, undefined, '', 'production');
    expect(missingInProd.ok).toBe(false);
    if (!missingInProd.ok) expect(missingInProd.statusCode).toBe(503);

    const malformedShortSig = verifyMetaWebhookSignature(raw, 'sha256=abc', 'my_secret', 'production');
    expect(malformedShortSig.ok).toBe(false);
    if (!malformedShortSig.ok) expect(malformedShortSig.statusCode).toBe(403);

    const validSig =
      'sha256=' + crypto.createHmac('sha256', 'my_secret').update(raw).digest('hex');
    expect(verifyMetaWebhookSignature(raw, validSig, 'my_secret', 'production').ok).toBe(true);
  });

  it('Bloquea IDOR en perfil de vendedor ajeno, oculta saldos bancarios a vendedores y protege transacciones ajenas', async () => {
    // 1. Vendedor 5 intenta espiar perfil del Vendedor 9 -> 403
    const resSeller: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await getSellerProfileStats(
      { user: { id: 5, role: Role.VENDEDOR }, params: { id: '9' } } as any,
      resSeller,
    );
    expect(resSeller.status).toHaveBeenCalledWith(403);

    // 2. Vendedor pide cuentas bancarias -> recibe cuentas para imputar transferencia pero balance en 0
    vi.spyOn(bankAccountService, 'getBankAccounts').mockResolvedValue([
      { id: 1, name: 'Banco Galicia', accountNumber: '007-123', balance: 18500000 } as any,
    ]);
    const resBanks: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await getBankAccounts({ user: { id: 5, role: Role.VENDEDOR } } as any, resBanks);
    expect(resBanks.json).toHaveBeenCalledWith({
      status: 'success',
      data: { accounts: [{ id: 1, name: 'Banco Galicia', accountNumber: '007-123', balance: 0 }] },
    });

    // 3. Vendedor 5 intenta leer transacción interna del usuario 1 -> 403
    vi.spyOn(transactionAdminService, 'getTransactionById').mockResolvedValue({
      id: 88,
      userId: 1,
      amount: 500000,
    } as any);
    const resTx: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await getTransactionById(
      { user: { id: 5, role: Role.VENDEDOR }, params: { id: '88' } } as any,
      resTx,
    );
    expect(resTx.status).toHaveBeenCalledWith(403);
  });
});
