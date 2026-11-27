import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../utils/prisma';
import {
  DEFAULT_COMPANY_PROFILE,
  getSystemConfigSnapshot,
  resetSystemConfigCacheForTests,
  updateSystemConfig,
} from '../admin/system-config.service';
import { updateSystemConfigSchema } from '../../validators/admin.validator';

describe('SystemConfigService — Identidad Fiscal y Reglas Operativas en PostgreSQL', () => {
  const originalIgnoreStock = process.env.IGNORE_STOCK_CHECK;
  const originalAfipMock = process.env.AFIP_MOCK;
  const originalAfipProd = process.env.AFIP_PRODUCTION;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetSystemConfigCacheForTests();
    process.env.IGNORE_STOCK_CHECK = 'false';
    process.env.AFIP_MOCK = 'false';
    process.env.AFIP_PRODUCTION = 'true';
  });

  afterEach(() => {
    resetSystemConfigCacheForTests();
    if (originalIgnoreStock === undefined) delete process.env.IGNORE_STOCK_CHECK;
    else process.env.IGNORE_STOCK_CHECK = originalIgnoreStock;
    if (originalAfipMock === undefined) delete process.env.AFIP_MOCK;
    else process.env.AFIP_MOCK = originalAfipMock;
    if (originalAfipProd === undefined) delete process.env.AFIP_PRODUCTION;
    else process.env.AFIP_PRODUCTION = originalAfipProd;
  });

  it('Devuelve los datos oficiales de Don Venancio sin registros previos y sanea placeholders viejos', async () => {
    const findManySpy = vi
      .spyOn(prisma.systemSetting, 'findMany')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          key: 'company_profile',
          value: JSON.stringify({
            razonSocial: 'Distribuidora de Bebidas SRL',
            nombreFantasia: 'Bebidas del Sur',
            cuit: '30-71717171-9',
            direccion: 'Av. San Martín 1234, Ciudad Autónoma de Buenos Aires',
            telefono: '011-4567-8900',
            email: 'ventas@bebidasdelsur.com',
            puntoVenta: 3,
          }),
          updatedAt: new Date(),
        },
        {
          key: 'ignore_stock_check',
          value: 'true',
          updatedAt: new Date(),
        },
      ]);

    const emptySnapshot = await getSystemConfigSnapshot();
    expect(emptySnapshot.company).toEqual(DEFAULT_COMPANY_PROFILE);
    expect(emptySnapshot.company.razonSocial).toBe('Pablo David Martin');
    expect(emptySnapshot.company.cuit).toBe('20-16316505-9');
    expect(emptySnapshot.ignoreStock).toBe(false);

    const sanitized = await getSystemConfigSnapshot({ bypassCache: true });
    expect(findManySpy).toHaveBeenCalledTimes(2);
    expect(sanitized.company.razonSocial).toBe('Pablo David Martin');
    expect(sanitized.company.nombreFantasia).toBe('Distribuidora Don Venancio');
    expect(sanitized.company.cuit).toBe('20-16316505-9');
    expect(sanitized.company.direccion).toBe('Pringles 116 - General Villegas - Pcia. Bs.As (6230)');
    expect(sanitized.company.iibb).toBe('C.M.N° 911-440570-8');
    expect(sanitized.company.inicioActividades).toBe('01/10/1996');
    expect(sanitized.company.telefono).toBe('+5493388526852');
    expect(sanitized.company.email).toBe('contacto@donvenancio.com.ar');
    expect(sanitized.company.puntoVenta).toBe(3);
    expect(sanitized.ignoreStock).toBe(true);
    expect(process.env.IGNORE_STOCK_CHECK).toBe('true');
  });

  it('Persiste cambios en transacción, formatea CUIT válido, sincroniza IGNORE_STOCK_CHECK y rechaza CUIT inválido', async () => {
    const upsertedRows: Array<{ key: string; value: string }> = [];

    vi.spyOn(prisma.systemSetting, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      const txMock = {
        systemSetting: {
          upsert: vi.fn().mockImplementation(async ({ where, create }: any) => {
            upsertedRows.push({ key: where.key, value: create.value });
            return { key: where.key, value: create.value, updatedAt: new Date() };
          }),
        },
      };
      return cb(txMock);
    });
    const auditSpy = vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 1 } as any);

    await expect(
      updateSystemConfig({ company: { cuit: '20-16316505-0' } }, 1, '127.0.0.1'),
    ).rejects.toThrow(/dígito verificador/i);
    expect(upsertedRows).toHaveLength(0);

    const updated = await updateSystemConfig(
      {
        ignoreStockCheck: true,
        company: {
          cuit: '20163165059',
          razonSocial: '  Pablo David Martin  ',
          puntoVenta: 5,
        },
      },
      1,
      '127.0.0.1',
    );

    expect(updated.ignoreStock).toBe(true);
    expect(process.env.IGNORE_STOCK_CHECK).toBe('true');
    expect(updated.company.cuit).toBe('20-16316505-9');
    expect(updated.company.razonSocial).toBe('Pablo David Martin');
    expect(updated.company.puntoVenta).toBe(5);
    expect(upsertedRows.map((r) => r.key)).toEqual(['company_profile', 'ignore_stock_check']);
    expect(auditSpy).toHaveBeenCalledTimes(1);

    const schemaCheck = updateSystemConfigSchema.safeParse({
      body: {
        ignoreStockCheck: false,
        afipMockMode: true,
        company: {
          razonSocial: 'Pablo David Martin',
          cuit: '20-16316505-9',
          email: 'contacto@donvenancio.com.ar',
          puntoVenta: 1,
        },
      },
    });
    expect(schemaCheck.success).toBe(true);
  });

  it('Lee y persiste afip_mock_mode desactivando afipProduction efectivo mientras dure el simulacro', async () => {
    const upsertedRows: Array<{ key: string; value: string }> = [];

    vi.spyOn(prisma.systemSetting, 'findMany').mockResolvedValueOnce([
      {
        key: 'afip_mock_mode',
        value: 'true',
        updatedAt: new Date(),
      },
    ]);

    const snapshot = await getSystemConfigSnapshot();
    expect(snapshot.afipMockMode).toBe(true);
    expect(snapshot.afipProduction).toBe(false);
    expect(process.env.AFIP_MOCK).toBe('true');

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      const txMock = {
        systemSetting: {
          upsert: vi.fn().mockImplementation(async ({ where, create }: any) => {
            upsertedRows.push({ key: where.key, value: create.value });
            return { key: where.key, value: create.value, updatedAt: new Date() };
          }),
        },
      };
      return cb(txMock);
    });
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 2 } as any);

    const toggledOff = await updateSystemConfig({ afipMockMode: false }, 1, '127.0.0.1');
    expect(toggledOff.afipMockMode).toBe(false);
    expect(toggledOff.afipProduction).toBe(true);
    expect(process.env.AFIP_MOCK).toBe('false');
    expect(upsertedRows).toEqual([{ key: 'afip_mock_mode', value: 'false' }]);
  });
});
