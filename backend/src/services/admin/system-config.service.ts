import prisma from '../../utils/prisma';
import { env } from '../../config/env.config';
import { parseFiscalIdentifier } from '../../engines/arca-cuit.engine';
import { logAudit } from '../../utils/audit';

export interface CompanyProfile {
  razonSocial: string;
  nombreFantasia: string;
  cuit: string;
  direccion: string;
  telefono: string;
  email: string;
  puntoVenta: number;
  iibb: string;
  inicioActividades: string;
}

export interface SystemConfigSnapshot {
  ignoreStock: boolean;
  afipProduction: boolean;
  company: CompanyProfile;
}

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  razonSocial: 'Pablo David Martin',
  nombreFantasia: 'Distribuidora Don Venancio',
  cuit: '20-16316505-9',
  direccion: 'Pringles 116 - General Villegas - Pcia. Bs.As',
  telefono: '+5493388526852',
  email: 'contacto@donvenancio.com.ar',
  puntoVenta: 1,
  iibb: '',
  inicioActividades: '',
};

const COMPANY_PROFILE_KEY = 'company_profile';
const IGNORE_STOCK_KEY = 'ignore_stock_check';
const CONFIG_CACHE_TTL_MS = 30_000;

const LEGACY_PLACEHOLDERS = new Set([
  'bebidas del sur',
  'distribuidora de bebidas srl',
  '30-71717171-9',
  '30717171719',
  'ventas@bebidasdelsur.com',
  'av. san martín 1234, ciudad autónoma de buenos aires',
  'av. san martin 1234, ciudad autonoma de buenos aires',
  '011-4567-8900',
  'dv distribuidora',
  'mayorista de alimentos & bebidas',
]);

let cachedSnapshot: { data: SystemConfigSnapshot; expiresAt: number } | null = null;

function isLegacyPlaceholder(value: string): boolean {
  return LEGACY_PLACEHOLDERS.has(value.trim().toLowerCase());
}

function canQuerySystemSetting(method: 'findMany' | 'findUnique'): boolean {
  const model = (prisma as any)?.systemSetting;
  if (!model || typeof model[method] !== 'function') return false;
  if (process.env.NODE_ENV === 'test' && !('mock' in model[method])) {
    return false;
  }
  return true;
}

function sanitizeOptionalString(rawValue: unknown, fallback: string): string {
  if (typeof rawValue !== 'string') return fallback;
  const trimmed = rawValue.trim();
  if (isLegacyPlaceholder(trimmed)) return fallback;
  return trimmed;
}

function sanitizeRequiredString(rawValue: unknown, fallback: string): string {
  const sanitized = sanitizeOptionalString(rawValue, fallback);
  return sanitized.length > 0 ? sanitized : fallback;
}

function normalizeCompanyProfile(raw: unknown): CompanyProfile {
  let parsed: Record<string, unknown> | null = null;
  if (typeof raw === 'string') {
    try {
      const json = JSON.parse(raw);
      if (json && typeof json === 'object') parsed = json as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  } else if (raw && typeof raw === 'object') {
    parsed = raw as Record<string, unknown>;
  }

  if (!parsed) {
    return { ...DEFAULT_COMPANY_PROFILE };
  }

  const posNum = Number(parsed.puntoVenta);
  const puntoVenta =
    Number.isInteger(posNum) && posNum >= 1 && posNum <= 99999
      ? posNum
      : DEFAULT_COMPANY_PROFILE.puntoVenta;

  return {
    razonSocial: sanitizeRequiredString(parsed.razonSocial, DEFAULT_COMPANY_PROFILE.razonSocial),
    nombreFantasia: sanitizeRequiredString(parsed.nombreFantasia, DEFAULT_COMPANY_PROFILE.nombreFantasia),
    cuit: sanitizeRequiredString(parsed.cuit, DEFAULT_COMPANY_PROFILE.cuit),
    direccion: sanitizeOptionalString(parsed.direccion, DEFAULT_COMPANY_PROFILE.direccion),
    telefono: sanitizeOptionalString(parsed.telefono, DEFAULT_COMPANY_PROFILE.telefono),
    email: sanitizeOptionalString(parsed.email, DEFAULT_COMPANY_PROFILE.email),
    puntoVenta,
    iibb: sanitizeOptionalString(parsed.iibb, DEFAULT_COMPANY_PROFILE.iibb),
    inicioActividades: sanitizeOptionalString(parsed.inicioActividades, DEFAULT_COMPANY_PROFILE.inicioActividades),
  };
}

/**
 * Valida un CUIT argentino (Módulo 11 ARCA) y lo normaliza como XX-XXXXXXXX-X.
 */
export function formatCuitHyphenated(raw: string): string {
  const parsed = parseFiscalIdentifier(raw);
  if (!parsed.isValid || parsed.kind !== 'CUIT' || !parsed.normalizedCuit) {
    throw new Error(parsed.errorMessage || 'El CUIT ingresado no es válido en ARCA.');
  }
  const digits = parsed.normalizedCuit;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

export function resetSystemConfigCacheForTests(): void {
  cachedSnapshot = null;
}

/**
 * Lee el snapshot operativo y fiscal de la empresa desde PostgreSQL (con caché de 30s).
 */
export async function getSystemConfigSnapshot(options?: {
  bypassCache?: boolean;
}): Promise<SystemConfigSnapshot> {
  if (!options?.bypassCache && cachedSnapshot && Date.now() < cachedSnapshot.expiresAt) {
    return cachedSnapshot.data;
  }

  const envIgnoreStock =
    process.env.IGNORE_STOCK_CHECK !== undefined
      ? process.env.IGNORE_STOCK_CHECK === 'true'
      : env.IGNORE_STOCK_CHECK;
  const afipProduction = process.env.AFIP_PRODUCTION === 'true' || env.AFIP_PRODUCTION;

  let company: CompanyProfile = { ...DEFAULT_COMPANY_PROFILE };
  let ignoreStock = envIgnoreStock;

  if (!canQuerySystemSetting('findMany')) {
    return { ignoreStock, afipProduction, company };
  }

  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: [COMPANY_PROFILE_KEY, IGNORE_STOCK_KEY] } },
    });

    const companyRow = rows.find((r) => r.key === COMPANY_PROFILE_KEY);
    if (companyRow) {
      company = normalizeCompanyProfile(companyRow.value);
    }

    const stockRow = rows.find((r) => r.key === IGNORE_STOCK_KEY);
    if (stockRow) {
      ignoreStock = stockRow.value === 'true';
      process.env.IGNORE_STOCK_CHECK = ignoreStock ? 'true' : 'false';
    }

    const snapshot: SystemConfigSnapshot = { ignoreStock, afipProduction, company };
    cachedSnapshot = { data: snapshot, expiresAt: Date.now() + CONFIG_CACHE_TTL_MS };
    return snapshot;
  } catch (err) {
    console.warn('⚠️ No se pudo leer SystemSetting desde DB, usando perfil oficial por defecto:', err);
    return { ignoreStock, afipProduction, company };
  }
}

export interface UpdateSystemConfigInput {
  ignoreStockCheck?: boolean;
  company?: Partial<CompanyProfile>;
}

/**
 * Persiste cambios de configuración general e identidad fiscal en PostgreSQL dentro de una transacción.
 */
export async function updateSystemConfig(
  input: UpdateSystemConfigInput,
  actorUserId?: number,
  ipAddress?: string | null,
): Promise<SystemConfigSnapshot> {
  const previous = await getSystemConfigSnapshot({ bypassCache: true });
  const nextCompany: CompanyProfile = { ...previous.company };

  if (input.company) {
    const c = input.company;
    if (c.razonSocial !== undefined) {
      const val = c.razonSocial.trim();
      if (val.length < 2) throw new Error('La razón social es requerida.');
      nextCompany.razonSocial = val;
    }
    if (c.nombreFantasia !== undefined) {
      const val = c.nombreFantasia.trim();
      if (val.length < 2) throw new Error('El nombre de fantasía es requerido.');
      nextCompany.nombreFantasia = val;
    }
    if (c.cuit !== undefined) {
      nextCompany.cuit = formatCuitHyphenated(c.cuit);
    }
    if (c.direccion !== undefined) nextCompany.direccion = c.direccion.trim();
    if (c.telefono !== undefined) nextCompany.telefono = c.telefono.trim();
    if (c.email !== undefined) nextCompany.email = c.email.trim();
    if (c.iibb !== undefined) nextCompany.iibb = c.iibb.trim();
    if (c.inicioActividades !== undefined) nextCompany.inicioActividades = c.inicioActividades.trim();
    if (c.puntoVenta !== undefined) {
      const pv = Number(c.puntoVenta);
      if (!Number.isInteger(pv) || pv < 1 || pv > 99999) {
        throw new Error('El Punto de Venta ARCA debe ser un entero entre 1 y 99999.');
      }
      nextCompany.puntoVenta = pv;
    }
  }

  const nextIgnoreStock =
    input.ignoreStockCheck !== undefined ? Boolean(input.ignoreStockCheck) : previous.ignoreStock;

  await prisma.$transaction(async (tx) => {
    if (input.company) {
      await tx.systemSetting.upsert({
        where: { key: COMPANY_PROFILE_KEY },
        update: { value: JSON.stringify(nextCompany) },
        create: { key: COMPANY_PROFILE_KEY, value: JSON.stringify(nextCompany) },
      });
    }
    if (input.ignoreStockCheck !== undefined) {
      await tx.systemSetting.upsert({
        where: { key: IGNORE_STOCK_KEY },
        update: { value: nextIgnoreStock ? 'true' : 'false' },
        create: { key: IGNORE_STOCK_KEY, value: nextIgnoreStock ? 'true' : 'false' },
      });
    }
  });

  if (input.ignoreStockCheck !== undefined) {
    process.env.IGNORE_STOCK_CHECK = nextIgnoreStock ? 'true' : 'false';
  }

  const nextSnapshot: SystemConfigSnapshot = {
    ignoreStock: nextIgnoreStock,
    afipProduction: previous.afipProduction,
    company: nextCompany,
  };
  cachedSnapshot = { data: nextSnapshot, expiresAt: Date.now() + CONFIG_CACHE_TTL_MS };

  if (actorUserId) {
    await logAudit({
      userId: actorUserId,
      action: 'UPDATE_CONFIG',
      entityType: 'SystemSetting',
      entityId: 1,
      oldValues: previous,
      newValues: nextSnapshot,
      ipAddress: ipAddress ?? null,
    });
  }

  return nextSnapshot;
}

/**
 * Siembra el perfil oficial de la empresa si aún no existe y sincroniza IGNORE_STOCK_CHECK al arrancar.
 */
export async function hydrateSystemConfigOnBoot(): Promise<void> {
  if (!canQuerySystemSetting('findUnique')) return;
  try {
    const existing = await prisma.systemSetting.findUnique({
      where: { key: COMPANY_PROFILE_KEY },
    });
    if (!existing) {
      await prisma.systemSetting.upsert({
        where: { key: COMPANY_PROFILE_KEY },
        update: {},
        create: { key: COMPANY_PROFILE_KEY, value: JSON.stringify(DEFAULT_COMPANY_PROFILE) },
      });
    }
    await getSystemConfigSnapshot({ bypassCache: true });
  } catch (err) {
    console.warn('⚠️ No se pudo hidratar SystemSetting al iniciar:', err);
  }
}
