import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PersonaNoteCategory, Role } from '@prisma/client';
import { env } from '../../config/env.config';
import { sessionCache } from '../../utils/session-cache.util';
import { STAFF_COOKIE_NAME } from '../../utils/cookie-auth.util';
import personaRoutes from '../../routes/persona.routes';
import { personaNotesSubService } from '../personas/persona-notes.service';
import { personaService } from '../persona.service';
import prisma from '../../utils/prisma';
import * as auditUtil from '../../utils/audit';

function makeStaffCookie(id: number, role: Role): string {
  const pwdVer = `ver_trust_${role.toLowerCase()}`;
  sessionCache.setStaffSession(id, {
    id,
    role,
    isActive: true,
    pwdVer,
  });
  const token = jwt.sign(
    { id, username: `gemini_${role.toLowerCase()}`, role, pwdVer },
    env.JWT_SECRET,
    { expiresIn: '1h' },
  );
  return `${STAFF_COOKIE_NAME}=${token}`;
}

async function sendRequest(
  baseUrl: string,
  method: string,
  path: string,
  cookie: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

describe('Etiquetas de Confianza y Bitácora Interna de Clientes (ADMIN / FACTURACION)', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/personas', personaRoutes);
    await new Promise<void>((resolve) => {
      server = testApp.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('RBAC estricto: VENDEDOR y DEPOSITO reciben 403 en etiquetas y notas; ADMIN y FACTURACION acceden', async () => {
    const vendedorCookie = makeStaffCookie(9101, Role.VENDEDOR);
    const depositoCookie = makeStaffCookie(9102, Role.DEPOSITO);
    const facturacionCookie = makeStaffCookie(9103, Role.FACTURACION);
    const adminCookie = makeStaffCookie(9104, Role.ADMIN);

    vi.spyOn(personaNotesSubService, 'getNotes').mockResolvedValue([]);
    vi.spyOn(personaNotesSubService, 'updateTrustTags').mockResolvedValue({
      id: 1,
      trustTags: ['CONFIABLE'],
    });
    vi.spyOn(personaNotesSubService, 'createNote').mockResolvedValue({
      id: 10,
      personaId: 1,
      authorId: 9103,
      category: PersonaNoteCategory.COBRANZA,
      content: 'Pagó al día',
      isPinned: false,
      createdAt: new Date(),
      author: { id: 9103, username: 'gemini_facturacion', role: Role.FACTURACION },
    });
    vi.spyOn(personaNotesSubService, 'togglePinNote').mockResolvedValue({
      id: 10,
      personaId: 1,
      authorId: 9104,
      category: PersonaNoteCategory.COBRANZA,
      content: 'Pagó al día',
      isPinned: true,
      createdAt: new Date(),
      author: { id: 9104, username: 'gemini_admin', role: Role.ADMIN },
    });
    vi.spyOn(personaNotesSubService, 'deleteNote').mockResolvedValue({ deletedId: 10 });

    for (const blockedCookie of [vendedorCookie, depositoCookie]) {
      expect((await sendRequest(baseUrl, 'GET', '/api/personas/1/notes', blockedCookie)).status).toBe(403);
      expect(
        (await sendRequest(baseUrl, 'POST', '/api/personas/1/notes', blockedCookie, { content: 'Test' })).status,
      ).toBe(403);
      expect(
        (await sendRequest(baseUrl, 'PATCH', '/api/personas/1/trust-tags', blockedCookie, {
          trustTags: ['CONFIABLE'],
        })).status,
      ).toBe(403);
      expect(
        (await sendRequest(baseUrl, 'PATCH', '/api/personas/1/notes/10/pin', blockedCookie)).status,
      ).toBe(403);
      expect(
        (await sendRequest(baseUrl, 'DELETE', '/api/personas/1/notes/10', blockedCookie)).status,
      ).toBe(403);
    }

    expect((await sendRequest(baseUrl, 'GET', '/api/personas/1/notes', facturacionCookie)).status).toBe(200);
    expect(
      (await sendRequest(baseUrl, 'POST', '/api/personas/1/notes', facturacionCookie, {
        content: 'Pagó al día',
        category: 'COBRANZA',
      })).status,
    ).toBe(201);
    expect(
      (await sendRequest(baseUrl, 'PATCH', '/api/personas/1/trust-tags', adminCookie, {
        trustTags: ['CONFIABLE'],
      })).status,
    ).toBe(200);
    expect((await sendRequest(baseUrl, 'PATCH', '/api/personas/1/notes/10/pin', adminCookie)).status).toBe(200);
    expect((await sendRequest(baseUrl, 'DELETE', '/api/personas/1/notes/10', adminCookie)).status).toBe(200);
  });

  it('Validación Zod: rechaza etiquetas libres fuera de la lista fija y notas vacías', async () => {
    const adminCookie = makeStaffCookie(9104, Role.ADMIN);

    const invalidTagRes = await sendRequest(baseUrl, 'PATCH', '/api/personas/1/trust-tags', adminCookie, {
      trustTags: ['ETIQUETA_INVENTADA'],
    });
    expect(invalidTagRes.status).toBe(400);

    const emptyNoteRes = await sendRequest(baseUrl, 'POST', '/api/personas/1/notes', adminCookie, {
      content: '   ',
      category: 'INCIDENTE',
    });
    expect(emptyNoteRes.status).toBe(400);
  });

  it('Visibilidad: PersonaService oculta trustTags y notes a VENDEDOR pero los expone a ADMIN/FACTURACION', async () => {
    const fakePersona = {
      id: 55,
      name: 'Kiosco Centro',
      isClient: true,
      sellerId: 9101,
      trustTags: ['SOLO_CONTADO'],
      notes: [{ id: 1, content: 'Local dudoso', isPinned: true }],
    };

    vi.spyOn(prisma.persona, 'findMany').mockResolvedValue([fakePersona] as any);
    vi.spyOn(prisma.persona, 'findUnique').mockResolvedValue(fakePersona as any);

    const vendorList = await personaService.getPersonas(9101, Role.VENDEDOR);
    expect((vendorList[0] as any).trustTags).toBeUndefined();

    const vendorSingle = await personaService.getPersonaById(55, 9101, Role.VENDEDOR);
    expect((vendorSingle as any).trustTags).toBeUndefined();

    const adminList = await personaService.getPersonas(9104, Role.ADMIN);
    expect((adminList[0] as any).trustTags).toEqual(['SOLO_CONTADO']);
    expect((adminList[0] as any).notes).toHaveLength(1);
  });

  it('PersonaNotesSubService deduplica trustTags y recorta espacios al crear notas', async () => {
    vi.spyOn(prisma.persona, 'findUnique').mockResolvedValue({
      id: 7,
      name: 'Despensa Sur',
      trustTags: [],
    } as any);
    const updateSpy = vi.spyOn(prisma.persona, 'update').mockResolvedValue({
      id: 7,
      trustTags: ['OBSERVADO', 'ATRASO_FRECUENTE'],
    } as any);
    const createSpy = vi.spyOn(prisma.personaNote, 'create').mockResolvedValue({
      id: 22,
      personaId: 7,
      authorId: 9104,
      category: PersonaNoteCategory.INCIDENTE,
      content: 'Se enojó por demora',
      isPinned: true,
      createdAt: new Date(),
      author: { id: 9104, username: 'gemini_admin', role: Role.ADMIN },
    } as any);
    vi.spyOn(auditUtil, 'logAudit').mockResolvedValue(undefined as any);

    const tagsRes = await personaNotesSubService.updateTrustTags(
      7,
      ['OBSERVADO', 'ATRASO_FRECUENTE', 'OBSERVADO'],
      9104,
    );
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { trustTags: ['OBSERVADO', 'ATRASO_FRECUENTE'] },
      }),
    );
    expect(tagsRes.trustTags).toEqual(['OBSERVADO', 'ATRASO_FRECUENTE']);

    await personaNotesSubService.createNote(7, 9104, {
      content: '  Se enojó por demora  ',
      category: PersonaNoteCategory.INCIDENTE,
      isPinned: true,
    });
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ content: 'Se enojó por demora', isPinned: true }),
      }),
    );
  });
});
