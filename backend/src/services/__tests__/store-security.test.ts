import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.config';
import prisma from '../../utils/prisma';
import { sessionCache } from '../../utils/session-cache.util';
import { authenticateStoreClientJWT } from '../../middlewares/storeAuth.middleware';
import {
  hashClientPin,
  isHashedPin,
  verifyClientPin,
  generateMagicToken,
  signStoreClientSessionToken,
} from '../store/store-auth.service';
import { resolveServerSideStorePricing } from '../store/store-order.service';

describe('Seguridad de Tienda Mayorista (PIN Hashing, Anti-IDOR y Precios en Servidor)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionCache.clear();
  });

  it('Encripta el PIN con bcrypt y migra transparentemente PINes legados en texto plano', async () => {
    const hashed = await hashClientPin('4829');
    expect(isHashedPin(hashed)).toBe(true);
    expect(hashed).not.toBe('4829');

    const okHash = await verifyClientPin('4829', hashed);
    expect(okHash).toEqual({ valid: true, needsUpgrade: false });

    const wrongHash = await verifyClientPin('0000', hashed);
    expect(wrongHash).toEqual({ valid: false, needsUpgrade: false });

    // PIN legado en texto plano indica needsUpgrade = true solo si coincide
    const legacyMatch = await verifyClientPin('1234', '1234');
    expect(legacyMatch).toEqual({ valid: true, needsUpgrade: true });

    const legacyFail = await verifyClientPin('9999', '1234');
    expect(legacyFail).toEqual({ valid: false, needsUpgrade: false });
  });

  it('Bloquea ataque IDOR (403) cuando el Cliente #10 intenta leer la cuenta del Cliente #25', async () => {
    vi.spyOn(prisma.persona, 'findUnique').mockResolvedValue({
      id: 10,
      isActive: true,
      isClient: true,
      priceList: 'A',
    } as any);

    const token = signStoreClientSessionToken({
      id: 10,
      name: 'Autoservicio El Sol',
      cuit: '30-71234567-8',
      priceList: 'A',
    });

    const req: any = {
      headers: { authorization: `Bearer ${token}` },
      params: { personaId: '25' },
      body: {},
    };
    const statusMock = vi.fn().mockReturnThis();
    const jsonMock = vi.fn();
    const res: any = { status: statusMock, json: jsonMock };
    const next = vi.fn();

    await authenticateStoreClientJWT(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'STORE_IDOR_BLOCKED' }),
    );
  });

  it('Rechaza tokens magic_login sin canjear cuando intentan usarse directo como sesión de tienda', async () => {
    const magic = generateMagicToken(10);
    const req: any = {
      headers: { authorization: `Bearer ${magic}` },
      params: { personaId: '10' },
      body: {},
    };
    const statusMock = vi.fn().mockReturnThis();
    const jsonMock = vi.fn();
    const res: any = { status: statusMock, json: jsonMock };
    const next = vi.fn();

    await authenticateStoreClientJWT(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_TOKEN_TYPE' }),
    );
  });

  it('Permite el acceso cuando el Cliente #10 consulta exactamente su propio personaId (#10)', async () => {
    vi.spyOn(prisma.persona, 'findUnique').mockResolvedValue({
      id: 10,
      isActive: true,
      isClient: true,
      priceList: 'B',
    } as any);

    const token = jwt.sign(
      { personaId: 10, role: 'CLIENTE' },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    const req: any = {
      headers: { authorization: `Bearer ${token}` },
      params: { personaId: '10' },
      body: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await authenticateStoreClientJWT(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.storeClient).toEqual({ personaId: 10, priceList: 'B' });
  });

  it('Calcula el precio en servidor desde BD (Lista u Oferta activa) en pesos enteros sin usar datos del cliente', () => {
    const mockProduct = {
      id: 5,
      listPrice: 4500,
      listPriceB: 4200,
      listPriceC: 4000,
      rubroId: 2,
    };
    const mockClient = {
      id: 10,
      priceList: 'B',
      discount: 0,
    };

    // Sin oferta activa -> toma Lista B del cliente ($4.200)
    const normalRes = resolveServerSideStorePricing(mockProduct, mockClient, [], null);
    expect(normalRes).toEqual({
      basePrice: 4200,
      discountPct: 0,
      finalUnitPrice: 4200,
    });

    // Con oferta activa ($3.890) -> prioriza precio oficial de oferta redondeado a peso entero
    const offerRes = resolveServerSideStorePricing(mockProduct, mockClient, [], 3890.4);
    expect(offerRes).toEqual({
      basePrice: 3890,
      discountPct: 0,
      finalUnitPrice: 3890,
    });
  });
});
