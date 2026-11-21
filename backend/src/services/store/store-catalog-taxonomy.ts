export interface StoreCategoryDefinition {
  name: string;
  icon: string;
}

export interface ResolvedStoreCategory {
  id: string;
  name: string;
  icon: string;
  rank: number;
}

/**
 * Orden oficial de las 21 categorías comerciales unificadas de la tienda Don Venancio.
 */
export const OFFICIAL_STORE_CATEGORIES: readonly StoreCategoryDefinition[] = [
  { name: 'Melincué', icon: '🧀' },
  { name: 'Cremigal', icon: '🥛' },
  { name: 'Sancor', icon: '🧈' },
  { name: 'Fiambres', icon: '🥓' },
  { name: 'Conservas', icon: '🥫' },
  { name: 'Pescadería', icon: '🐟' },
  { name: 'Pastas Secas', icon: '🍝' },
  { name: 'Aceites y Vinagres', icon: '🫒' },
  { name: 'Aderezos', icon: '🧂' },
  { name: 'Almacén', icon: '🛒' },
  { name: 'Yerbas', icon: '🧉' },
  { name: 'Bebidas', icon: '🥤' },
  { name: 'Aperitivos', icon: '🍸' },
  { name: 'Fernet', icon: '🧊' },
  { name: 'Vinos Tintos', icon: '🍷' },
  { name: 'Vinos Blancos', icon: '🥂' },
  { name: 'Espumantes y Sidras', icon: '🍾' },
  { name: 'Bebidas Alcohólicas Espirituosas', icon: '🥃' },
  { name: 'Estuchería y Regalería', icon: '🎁' },
  { name: 'Papeles', icon: '🧻' },
  { name: 'Limpieza', icon: '✨' },
];

export function normalizeCategoryKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

export function slugifyStoreCategory(value: string): string {
  return normalizeCategoryKey(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const OFFICIAL_BY_KEY = new Map<string, { def: StoreCategoryDefinition; rank: number }>(
  OFFICIAL_STORE_CATEGORIES.map((def, idx) => [normalizeCategoryKey(def.name), { def, rank: idx }]),
);

const RUBRO_FALLBACK_CATEGORY: Record<string, string> = {
  REMOTTI: 'Melincué',
  MELINCUE: 'Melincué',
  CREMIGAL: 'Cremigal',
  'SANCOR Y CREMIGAL': 'Cremigal',
  YOGURT: 'Cremigal',
  LECHES: 'Cremigal',
  'QUESOS RALLADOS': 'Cremigal',
  SANCOR: 'Sancor',
  SODECAR: 'Fiambres',
  FIAMBRES: 'Fiambres',
  CONSERVAS: 'Conservas',
  PESCADERIA: 'Pescadería',
  'PASTAS SECAS': 'Pastas Secas',
  'A.G.D Y NIZA': 'Aceites y Vinagres',
  'ACEITES Y VINAGRES': 'Aceites y Vinagres',
  ADEREZOS: 'Aderezos',
  ALMACEN: 'Almacén',
  ARROZ: 'Almacén',
  AZUCAR: 'Almacén',
  CAFE: 'Almacén',
  EDULCORANTES: 'Almacén',
  SAL: 'Almacén',
  YERBAS: 'Yerbas',
  BEBIDAS: 'Bebidas',
  APERITIVOS: 'Aperitivos',
  FERNET: 'Fernet',
  'VINOS TINTOS': 'Vinos Tintos',
  'VINOS BLANCOS': 'Vinos Blancos',
  'ESPUMANTES Y SIDRAS': 'Espumantes y Sidras',
  'BEBIDAS ALCOHOLICAS': 'Bebidas Alcohólicas Espirituosas',
  'BEBIDAS ALCOHOLICAS ESPIRITUOSAS': 'Bebidas Alcohólicas Espirituosas',
  REGALERIA: 'Estuchería y Regalería',
  'ESTUCHERIA Y REGALERIA': 'Estuchería y Regalería',
  PAPELES: 'Papeles',
  LIMPIEZA: 'Limpieza',
  'NO COMESTIBLES': 'Limpieza',
};

function toDisplayTitle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'Almacén';
  if (trimmed === trimmed.toUpperCase()) {
    return trimmed
      .toLowerCase()
      .replace(/(^|\s)\S/g, (ch) => ch.toUpperCase());
  }
  return trimmed;
}

export function resolveStoreCategory(params: {
  campaignGroup?: string | null;
  commercialCategory?: string | null;
  rubroName?: string | null;
}): ResolvedStoreCategory {
  const rubroKey = normalizeCategoryKey(params.rubroName || '');
  const candidate =
    params.campaignGroup?.trim() ||
    params.commercialCategory?.trim() ||
    RUBRO_FALLBACK_CATEGORY[rubroKey] ||
    params.rubroName?.trim() ||
    'Almacén';

  const normalized = normalizeCategoryKey(candidate);
  const official = OFFICIAL_BY_KEY.get(normalized);
  if (official) {
    return {
      id: slugifyStoreCategory(official.def.name),
      name: official.def.name,
      icon: official.def.icon,
      rank: official.rank,
    };
  }

  const mappedByFallback = RUBRO_FALLBACK_CATEGORY[normalized];
  if (mappedByFallback) {
    const mappedOfficial = OFFICIAL_BY_KEY.get(normalizeCategoryKey(mappedByFallback));
    if (mappedOfficial) {
      return {
        id: slugifyStoreCategory(mappedOfficial.def.name),
        name: mappedOfficial.def.name,
        icon: mappedOfficial.def.icon,
        rank: mappedOfficial.rank,
      };
    }
  }

  const displayName = toDisplayTitle(candidate);
  return {
    id: slugifyStoreCategory(displayName) || 'otros',
    name: displayName,
    icon: '📦',
    rank: 999,
  };
}

export function getStoreCategoryRank(
  categoryName: string,
  customOrder: string[] = [],
): number {
  const norm = normalizeCategoryKey(categoryName);
  if (customOrder.length > 0) {
    const customIdx = customOrder.findIndex((c) => normalizeCategoryKey(c) === norm);
    if (customIdx !== -1) return customIdx;
  }
  const official = OFFICIAL_BY_KEY.get(norm);
  return official ? customOrder.length + official.rank : 9999;
}
