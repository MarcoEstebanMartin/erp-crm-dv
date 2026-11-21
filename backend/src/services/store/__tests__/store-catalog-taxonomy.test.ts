import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_STORE_CATEGORIES,
  getStoreCategoryRank,
  resolveStoreCategory,
  slugifyStoreCategory,
} from '../store-catalog-taxonomy';

describe('store-catalog-taxonomy', () => {
  it('mantiene las 21 categorías oficiales en el orden exacto de donvenancio.com.ar/tienda', () => {
    expect(OFFICIAL_STORE_CATEGORIES).toHaveLength(21);
    expect(OFFICIAL_STORE_CATEGORIES.map((c) => c.name)).toEqual([
      'Melincué',
      'Cremigal',
      'Sancor',
      'Fiambres',
      'Conservas',
      'Pescadería',
      'Pastas Secas',
      'Aceites y Vinagres',
      'Aderezos',
      'Almacén',
      'Yerbas',
      'Bebidas',
      'Aperitivos',
      'Fernet',
      'Vinos Tintos',
      'Vinos Blancos',
      'Espumantes y Sidras',
      'Bebidas Alcohólicas Espirituosas',
      'Estuchería y Regalería',
      'Papeles',
      'Limpieza',
    ]);
  });

  it('resuelve commercialCategory sin importar mayúsculas ni tildes y genera slug limpio', () => {
    const res = resolveStoreCategory({ commercialCategory: 'MELINCUE' });
    expect(res.name).toBe('Melincué');
    expect(res.id).toBe('melincue');
    expect(res.icon).toBe('🧀');
    expect(res.rank).toBe(0);

    const res2 = resolveStoreCategory({
      commercialCategory: 'bebidas alcoholicas espirituosas',
    });
    expect(res2.name).toBe('Bebidas Alcohólicas Espirituosas');
    expect(res2.id).toBe('bebidas-alcoholicas-espirituosas');
    expect(res2.icon).toBe('🥃');
    expect(res2.rank).toBe(17);
  });

  it('corrige fallbacks por rubro sin mezclar yerbas ni café en categorías erróneas', () => {
    expect(resolveStoreCategory({ rubroName: 'YERBAS' }).name).toBe('Yerbas');
    expect(resolveStoreCategory({ rubroName: 'CAFÉ' }).name).toBe('Almacén');
    expect(resolveStoreCategory({ rubroName: 'ARROZ' }).name).toBe('Almacén');
    expect(resolveStoreCategory({ rubroName: 'AZÚCAR' }).name).toBe('Almacén');
    expect(resolveStoreCategory({ rubroName: 'REMOTTI' }).name).toBe('Melincué');
    expect(resolveStoreCategory({ rubroName: 'SODECAR' }).name).toBe('Fiambres');
    expect(resolveStoreCategory({ rubroName: 'A.G.D Y NIZA' }).name).toBe('Aceites y Vinagres');
  });

  it('ordena priorizando customOrder cuando existe y luego el orden oficial', () => {
    const custom = ['Fernet', 'Vinos Tintos'];
    expect(getStoreCategoryRank('Fernet', custom)).toBe(0);
    expect(getStoreCategoryRank('Vinos Tintos', custom)).toBe(1);
    expect(getStoreCategoryRank('Melincué', custom)).toBe(2);
    expect(getStoreCategoryRank('Limpieza', custom)).toBe(22);
    expect(getStoreCategoryRank('Categoría Nueva', custom)).toBe(9999);
  });

  it('genera slugs ASCII limpios', () => {
    expect(slugifyStoreCategory('Estuchería y Regalería')).toBe('estucheria-y-regaleria');
    expect(slugifyStoreCategory('  Pescadería  ')).toBe('pescaderia');
  });
});
