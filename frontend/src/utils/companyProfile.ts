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

export interface StorageLike {
  getItem(key: string): string | null;
  removeItem?(key: string): void;
}

export const OFFICIAL_COMPANY_PROFILE: CompanyProfile = {
  razonSocial: 'Pablo David Martin',
  nombreFantasia: 'Distribuidora Don Venancio',
  cuit: '20-16316505-9',
  direccion: 'Pringles 116 - General Villegas - Pcia. Bs.As (6230)',
  telefono: '+5493388526852',
  email: 'contacto@donvenancio.com.ar',
  puntoVenta: 1,
  iibb: '',
  inicioActividades: '',
};

export const LEGACY_COMPANY_KEYS = [
  'company_razon_social',
  'company_nombre_fantasia',
  'company_cuit',
  'company_direccion',
  'company_telefono',
  'company_email',
  'company_pos',
  'company_default_iva',
  'company_iibb',
  'company_inicio_actividades',
] as const;

const LEGACY_PLACEHOLDERS = new Set([
  'bebidas del sur',
  'distribuidora de bebidas srl',
  '30-71717171-9',
  '30717171719',
  '30-71490283-9',
  '30714902839',
  'ventas@bebidasdelsur.com',
  'administracion@distribuidoradv.com.ar',
  'contacto@distribuidoradv.com',
  'av. san martín 1234, ciudad autónoma de buenos aires',
  'av. san martin 1234, ciudad autonoma de buenos aires',
  'calle falsa 1234, quilmes',
  'ruta 5 - km 320, general villegas, buenos aires',
  '011-4567-8900',
  '0800-333-1212',
  '(03388) 15-429304',
  'dv distribuidora',
  'distribuidora dv',
  'mayorista de alimentos & bebidas',
  'pringles 116 - general villegas - pcia. bs.as',
]);

function resolveStorage(storage?: StorageLike): StorageLike | undefined {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

function pickField(rawValue: unknown, fallback: string, required: boolean): string {
  if (typeof rawValue !== 'string') return fallback;
  const trimmed = rawValue.trim();
  if (LEGACY_PLACEHOLDERS.has(trimmed.toLowerCase())) return fallback;
  if (required && trimmed.length === 0) return fallback;
  return trimmed;
}

/**
 * Elimina claves legadas de empresa guardadas en localStorage por versiones anteriores.
 */
export function purgeLegacyCompanyLocalStorage(storage?: StorageLike): void {
  const target = resolveStorage(storage);
  if (!target?.removeItem) return;
  for (const key of LEGACY_COMPANY_KEYS) {
    target.removeItem(key);
  }
}

/**
 * Obtiene el perfil oficial de la empresa desde auth_config, con fallback seguro a Don Venancio.
 */
export function getCompanyProfile(storage?: StorageLike): CompanyProfile {
  const target = resolveStorage(storage);
  if (!target) return { ...OFFICIAL_COMPANY_PROFILE };

  try {
    const rawConfig = target.getItem('auth_config');
    if (!rawConfig) return { ...OFFICIAL_COMPANY_PROFILE };

    const parsed = JSON.parse(rawConfig);
    const company = parsed?.company;
    if (!company || typeof company !== 'object') {
      return { ...OFFICIAL_COMPANY_PROFILE };
    }

    const pos = Number(company.puntoVenta);
    return {
      razonSocial: pickField(company.razonSocial, OFFICIAL_COMPANY_PROFILE.razonSocial, true),
      nombreFantasia: pickField(company.nombreFantasia, OFFICIAL_COMPANY_PROFILE.nombreFantasia, true),
      cuit: pickField(company.cuit, OFFICIAL_COMPANY_PROFILE.cuit, true),
      direccion: pickField(company.direccion, OFFICIAL_COMPANY_PROFILE.direccion, false),
      telefono: pickField(company.telefono, OFFICIAL_COMPANY_PROFILE.telefono, false),
      email: pickField(company.email, OFFICIAL_COMPANY_PROFILE.email, false),
      puntoVenta: Number.isInteger(pos) && pos >= 1 && pos <= 99999 ? pos : OFFICIAL_COMPANY_PROFILE.puntoVenta,
      iibb: pickField(company.iibb, OFFICIAL_COMPANY_PROFILE.iibb, false),
      inicioActividades: pickField(company.inicioActividades, OFFICIAL_COMPANY_PROFILE.inicioActividades, false),
    };
  } catch {
    return { ...OFFICIAL_COMPANY_PROFILE };
  }
}

/**
 * Formatea el teléfono oficial de Don Venancio para lectura humana en comprobantes e interfaz.
 */
export function formatCompanyPhone(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/\D/g, '');
  if (digits === '5493388526852') {
    return '+54 9 3388 52-6852';
  }
  return trimmed;
}
