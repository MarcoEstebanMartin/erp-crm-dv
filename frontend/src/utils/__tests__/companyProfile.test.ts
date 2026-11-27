import { describe, expect, it } from 'vitest';
import {
  formatCompanyPhone,
  getCompanyProfile,
  LEGACY_COMPANY_KEYS,
  OFFICIAL_COMPANY_PROFILE,
  purgeLegacyCompanyLocalStorage,
  type StorageLike,
} from '../companyProfile';

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

describe('companyProfile — Fuente única oficial de Don Venancio', () => {
  it('Devuelve el perfil oficial por defecto cuando no existe auth_config y purga claves legadas', () => {
    const storage = createMemoryStorage({
      company_nombre_fantasia: 'Bebidas del Sur',
      company_razon_social: 'Distribuidora de Bebidas SRL',
      company_cuit: '30-71717171-9',
    });

    const profile = getCompanyProfile(storage);
    expect(profile).toEqual(OFFICIAL_COMPANY_PROFILE);
    expect(profile.razonSocial).toBe('Pablo David Martin');
    expect(profile.cuit).toBe('20-16316505-9');

    purgeLegacyCompanyLocalStorage(storage);
    for (const key of LEGACY_COMPANY_KEYS) {
      expect(storage.getItem(key)).toBeNull();
    }
  });

  it('Prioriza auth_config.company, sanea placeholders viejos y formatea el teléfono oficial', () => {
    const storage = createMemoryStorage({
      auth_config: JSON.stringify({
        ignoreStock: false,
        company: {
          razonSocial: 'Pablo David Martin',
          nombreFantasia: 'Bebidas del Sur',
          cuit: '20-16316505-9',
          direccion: 'Pringles 116 - General Villegas - Pcia. Bs.As',
          telefono: '+5493388526852',
          email: 'contacto@donvenancio.com.ar',
          puntoVenta: 4,
        },
      }),
    });

    const profile = getCompanyProfile(storage);
    expect(profile.nombreFantasia).toBe('Distribuidora Don Venancio');
    expect(profile.direccion).toBe('Pringles 116 - General Villegas - Pcia. Bs.As (6230)');
    expect(profile.iibb).toBe('C.M.N° 911-440570-8');
    expect(profile.inicioActividades).toBe('01/10/1996');
    expect(profile.puntoVenta).toBe(4);
    expect(formatCompanyPhone(profile.telefono)).toBe('+54 9 3388 52-6852');
    expect(formatCompanyPhone('03388-421000')).toBe('03388-421000');
  });
});
