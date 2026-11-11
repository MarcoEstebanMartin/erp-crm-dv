import path from 'path';
import { pathToFileURL } from 'url';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { env, validateEnvConfig } from '../../config/env.config';
import { StoreAuthService } from '../store/store-auth.service';
import { toggleWeekSchema } from '../../validators/weeklySchedule.validator';
import weeklyScheduleRoutes from '../../routes/weeklySchedule.routes';
import { sanitizeServerErrorMessage } from '../../middlewares/errorHandler.middleware';
import { sessionCache } from '../../utils/session-cache.util';

describe('Paso A2 — Perímetro ERP Interno, Anti-Takeover PIN, Cronograma, ErrorHandler y Visitas Offline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionCache.clear();
  });

  it('Desactiva ENABLE_EMBEDDED_STORE por defecto en producción salvo habilitación explícita', () => {
    const prodDefault = validateEnvConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'prod_secret_1234567890',
      CORS_ORIGIN: 'https://sistema.donvenancio.com.ar',
    });
    expect(prodDefault.ENABLE_EMBEDDED_STORE).toBe(false);

    const prodExplicit = validateEnvConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'prod_secret_1234567890',
      CORS_ORIGIN: 'https://sistema.donvenancio.com.ar',
      ENABLE_EMBEDDED_STORE: 'true',
    });
    expect(prodExplicit.ENABLE_EMBEDDED_STORE).toBe(true);
  });

  it('Bloquea búsqueda libre por nombre y evita secuestro de cuenta en cliente sin PIN inicial', async () => {
    const nameAttempt = await StoreAuthService.authenticateClient({ search: 'Juan Perez' });
    expect(nameAttempt.httpStatus).toBe(400);

    vi.spyOn(prisma.persona, 'findMany').mockResolvedValue([
      {
        id: 50,
        name: 'Kiosco El Centro',
        cuit: '20-30111222-3',
        webPin: null,
        isActive: true,
        isClient: true,
      } as any,
    ]);
    const updateSpy = vi.spyOn(prisma.persona, 'update');

    const takeoverAttempt = await StoreAuthService.authenticateClient({
      cuitOrCode: '20301112223',
      pin: '9999',
    });

    expect(takeoverAttempt.httpStatus).toBe(403);
    expect((takeoverAttempt.payload as any).code).toBe('PIN_NOT_INITIALIZED');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('Exige rol autorizado y esquema Zod en POST /api/weekly-schedule/toggle-week', async () => {
    expect(toggleWeekSchema.safeParse({ body: { weekType: 'SEMANA_99' } }).success).toBe(false);
    expect(toggleWeekSchema.safeParse({ body: { weekType: 'SEMANA_2' } }).success).toBe(true);

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 44,
      isActive: true,
      role: Role.DEPOSITO,
    } as any);
    const depositoToken = jwt.sign(
      { id: 44, username: 'dep1', role: Role.DEPOSITO },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/weekly-schedule', weeklyScheduleRoutes);

    const server = testApp.listen(0);
    try {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const res = await fetch(`http://127.0.0.1:${port}/api/weekly-schedule/toggle-week`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${depositoToken}`,
        },
        body: JSON.stringify({ weekType: 'SEMANA_2' }),
      });
      expect(res.status).toBe(403);
    } finally {
      server.close();
    }
  });

  it('Oculta trazas técnicas de Prisma/SQL en producción sin tapar mensajes legibles de negocio', () => {
    const prismaLeak = new Error(
      'Invalid `prisma.order.findMany()` invocation: column "Order.secret_col" does not exist in database',
    );
    prismaLeak.name = 'PrismaClientKnownRequestError';

    expect(sanitizeServerErrorMessage(prismaLeak, 'production')).toBe(
      'Error interno del servidor al procesar la operación.',
    );

    const businessError = new Error('Stock insuficiente para "Queso Cremoso" (Disponible: 2).');
    expect(sanitizeServerErrorMessage(businessError, 'production')).toBe(
      'Stock insuficiente para "Queso Cremoso" (Disponible: 2).',
    );
  });

  it('Conserva visitas offline rechazadas (syncState=REJECTED) tras 3 fallos 4xx en lugar de borrarlas', async () => {
    const utilsDir = path.resolve(__dirname, '../../../../frontend/src/utils');
    const catalogDb: any = await import(pathToFileURL(path.join(utilsDir, 'offlineCatalogDb.ts')).href);
    const syncManager: any = await import(pathToFileURL(path.join(utilsDir, 'offlineSyncManager.ts')).href);

    catalogDb.__resetOfflineDbMemoryForTests();

    await syncManager.enqueueOfflineVisit({
      routeId: 3,
      personaId: 888,
      clientName: 'Cliente Dado de Baja',
      status: 'NO_BUY',
      noBuyReason: 'Cerrado',
      notes: 'Persiana baja',
      latitude: -34.6,
      longitude: -58.4,
    });

    const executor = {
      sendOrder: vi.fn(async () => ({ ok: true })),
      sendVisit: vi.fn(async () => {
        throw Object.assign(new Error('Persona no encontrada en ruta'), { status: 404 });
      }),
    };

    await syncManager.flushOfflineQueues(executor);
    await syncManager.flushOfflineQueues(executor);
    await syncManager.flushOfflineQueues(executor);

    const snap = await syncManager.getOfflineQueueSnapshot();
    expect(snap.visits).toHaveLength(1);
    expect(snap.visits[0].syncState).toBe('REJECTED');
    expect(snap.visits[0].attempts).toBe(3);

    // En el 4to flush no reintenta infinitamente pero tampoco pierde el registro
    await syncManager.flushOfflineQueues(executor);
    expect(executor.sendVisit).toHaveBeenCalledTimes(3);
  });
});
