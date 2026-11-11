import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildCandidateCuitsFromDni,
  parseFiscalIdentifier,
} from '../../engines/arca-cuit.engine';

vi.mock('../../utils/prisma', () => ({
  default: {
    persona: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from '../../utils/prisma';
import {
  ArcaValidationError,
  clearPadronLookupCacheForTests,
  lookupTaxpayerByCuitOrDni,
} from '../arca-padron.service';
import { generateArcaKeyAndCsr } from '../../utils/arca-csr.util';

describe('Motor y Servicio de Consulta Fiscal ARCA / BCRA / Padrón Local', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearPadronLookupCacheForTests();
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('valida exactamente el dígito verificador Módulo 11 de CUIT y detecta errores de tipeo', () => {
    const valid = parseFiscalIdentifier('20-35385924-3');
    expect(valid.isValid).toBe(true);
    expect(valid.kind).toBe('CUIT');
    expect(valid.normalizedCuit).toBe('20353859243');

    const typo = parseFiscalIdentifier('20-35385924-9');
    expect(typo.isValid).toBe(false);
    expect(typo.expectedCheckDigit).toBe(3);
    expect(typo.errorMessage).toContain('3');
  });

  it('genera candidatos válidos de varón (20) y mujer (27) cuando se ingresa únicamente el DNI', () => {
    const candidates = buildCandidateCuitsFromDni('35.385.924');
    expect(candidates).toContain('20353859243');
    expect(candidates).toContain('27353859248');
  });

  it('resuelve nombre real y CUIT completo de 11 dígitos al buscar solo por DNI y alerta si ya existe en el ERP', async () => {
    (prisma.persona.findMany as any).mockResolvedValue([
      {
        id: 42,
        name: 'ESTEBAN DISTRIBUIDORA',
        cuit: '20353859243',
        address: 'Belgrano 550',
        city: 'General Villegas',
        isActive: true,
      },
    ]);

    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/Deudas/20353859243')) {
        return {
          ok: true,
          json: async () => ({
            status: 200,
            results: {
              identificacion: 20353859243,
              denominacion: 'MARTIN MARCO ESTEBAN',
            },
          }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const res = await lookupTaxpayerByCuitOrDni('35385924');
    expect(res.found).toBe(true);
    expect(res.cuit).toBe('20353859243');
    expect(res.name).toBe('MARTIN MARCO ESTEBAN');
    expect(res.alreadyRegistered).toBe(true);
    expect(res.existingPersona?.id).toBe(42);
    expect(res.address).toBe('Belgrano 550');
  });

  it('jamás devuelve datos falsos de relleno cuando un DNI no registra actividad pública ni local', async () => {
    (prisma.persona.findMany as any).mockResolvedValue([]);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);

    const res = await lookupTaxpayerByCuitOrDni('35385924');
    expect(res.found).toBe(false);
    expect(res.name).toBe('');
    expect(res.address).toBe('');
    expect(res.name).not.toContain('Empresa');
    expect(res.address).not.toContain('Falsa');
  });

  it('rechaza con ArcaValidationError (400) cuando el CUIT tiene dígito verificador inválido', async () => {
    await expect(lookupTaxpayerByCuitOrDni('20353859249')).rejects.toBeInstanceOf(
      ArcaValidationError,
    );
  });

  it('genera clave privada RSA 2048 y solicitud CSR PKCS#10 válida para ARCA sin OpenSSL externo', () => {
    const { keyPem, csrPem } = generateArcaKeyAndCsr('20353859243', 'DON VENANCIO');
    expect(keyPem).toContain('-----BEGIN PRIVATE KEY-----');
    expect(csrPem).toContain('-----BEGIN CERTIFICATE REQUEST-----');
    const rawDer = Buffer.from(
      csrPem
        .replace('-----BEGIN CERTIFICATE REQUEST-----', '')
        .replace('-----END CERTIFICATE REQUEST-----', '')
        .replace(/\s+/g, ''),
      'base64',
    );
    expect(rawDer[0]).toBe(0x30);
    expect(rawDer.toString('utf8')).toContain('CUIT 20353859243');
  });
});
