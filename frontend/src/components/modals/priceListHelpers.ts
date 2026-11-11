export interface PriceListProduct {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  barcode: string | null;
  costPrice: number;
  listPrice: number;
  listPriceB: number;
  listPriceC: number;
  stock: number;
  isActive?: boolean;
  commercialCategory?: string | null;
  rubro?: { id?: number; name?: string | null } | string | null;
}

export interface SubcategoryGroup {
  name: string;
  products: PriceListProduct[];
  brands: { [brand: string]: PriceListProduct[] };
  sortedBrands?: { name: string; products: PriceListProduct[] }[];
}

export interface CategoryGroup {
  key: string;
  name: string;
  directProducts: PriceListProduct[];
  subcategories: { [sub: string]: SubcategoryGroup };
  sortedSubcategories: (SubcategoryGroup & { sortedBrands: { name: string; products: PriceListProduct[] }[] })[];
  totalCount: number;
}

const CANONICAL_DISPLAY_NAMES: Record<string, string> = {
  MELINCUE: 'MELINCUÉ',
  CREMIGAL: 'CREMIGAL',
  SANCOR: 'SANCOR',
  FIAMBRES: 'FIAMBRES',
  CONSERVAS: 'CONSERVAS',
  PESCADERIA: 'PESCADERÍA',
  'PASTAS SECAS': 'PASTAS SECAS',
  'ACEITES Y VINAGRES': 'ACEITES Y VINAGRES',
  ADEREZOS: 'ADEREZOS',
  ALMACEN: 'ALMACÉN',
  YERBAS: 'YERBAS',
  BEBIDAS: 'BEBIDAS',
  APERITIVOS: 'APERITIVOS',
  FERNET: 'FERNET',
  'VINOS TINTOS': 'VINOS TINTOS',
  'VINOS BLANCOS': 'VINOS BLANCOS',
  'ESPUMANTES Y SIDRAS': 'ESPUMANTES Y SIDRAS',
  'BEBIDAS ALCOHOLICAS ESPIRITUOSAS': 'BEBIDAS ALCOHÓLICAS ESPIRITUOSAS',
  'ESTUCHERIA Y REGALERIA': 'ESTUCHERÍA Y REGALERÍA',
  PAPELES: 'PAPELES',
  LIMPIEZA: 'LIMPIEZA',
  REFRIGERADOS: 'REFRIGERADOS',
  'ADEREZOS Y ACEITES': 'ADEREZOS Y ACEITES',
  'BEBIDAS ALCOHOLICAS': 'BEBIDAS ALCOHÓLICAS',
  'NO COMESTIBLES': 'NO COMESTIBLES',
  VARIOS: 'VARIOS',
};

/**
 * Orden exacto de las 21 categorías oficiales del catálogo de Producción (`chatbot-dv`).
 */
export const DEFAULT_PRODUCTION_CATEGORY_ORDER = [
  'MELINCUE',
  'CREMIGAL',
  'SANCOR',
  'FIAMBRES',
  'CONSERVAS',
  'PESCADERIA',
  'PASTAS SECAS',
  'ACEITES Y VINAGRES',
  'ADEREZOS',
  'ALMACEN',
  'YERBAS',
  'BEBIDAS',
  'APERITIVOS',
  'FERNET',
  'VINOS TINTOS',
  'VINOS BLANCOS',
  'ESPUMANTES Y SIDRAS',
  'BEBIDAS ALCOHOLICAS ESPIRITUOSAS',
  'ESTUCHERIA Y REGALERIA',
  'PAPELES',
  'LIMPIEZA',
];

export const cleanCategoryName = (name: string) => name.replace(/^\d+(\.\d+)?\s*-\s*/, '').trim();

export const normalizeGroupKey = (value: string): string =>
  cleanCategoryName(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .trim();

export const extractRubroName = (rubro: PriceListProduct['rubro']): string => {
  if (!rubro) return '';
  if (typeof rubro === 'string') return rubro.trim();
  return String(rubro.name || '').trim();
};

const compareEs = (a: string, b: string) =>
  a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true });

export const isQuesoRemotti = (prod: PriceListProduct) => {
  const catKey = normalizeGroupKey(prod.commercialCategory || '');
  const nameKey = normalizeGroupKey(prod.name || '');
  const rubroKey = normalizeGroupKey(extractRubroName(prod.rubro));
  return (
    catKey === 'MELINCUE' ||
    nameKey.includes('MELINCUE') ||
    nameKey.includes('REMOTTI') ||
    rubroKey === 'REMOTTI'
  );
};

export const isQueso = (prod: PriceListProduct) => {
  if (isQuesoRemotti(prod)) return true;
  const haystack = normalizeGroupKey(
    `${prod.name || ''} ${prod.description || ''} ${prod.commercialCategory || ''}`,
  );
  return haystack.includes('QUESO');
};

export const getFontScaleConfig = (fontScale: 'small' | 'medium' | 'large') => {
  if (fontScale === 'small') {
    return { viewSize: '0.66rem', viewHeaderSize: '0.74rem', viewSubheaderSize: '0.7rem', viewBrandSize: '0.66rem', viewPadding: '2.5px 5px', printSize: '7.5pt', printHeaderSize: '8.2pt', printSubheaderSize: '7.8pt', printBrandSize: '7.5pt', printPadding: '2px 4px' };
  }
  if (fontScale === 'large') {
    return { viewSize: '0.86rem', viewHeaderSize: '0.96rem', viewSubheaderSize: '0.9rem', viewBrandSize: '0.86rem', viewPadding: '5px 10px', printSize: '10.5pt', printHeaderSize: '11.5pt', printSubheaderSize: '11pt', printBrandSize: '10.5pt', printPadding: '4.5px 7px' };
  }
  return { viewSize: '0.76rem', viewHeaderSize: '0.84rem', viewSubheaderSize: '0.78rem', viewBrandSize: '0.74rem', printSize: '9pt', viewPadding: '3.5px 6px', printHeaderSize: '10pt', printSubheaderSize: '9.5pt', printBrandSize: '9pt', printPadding: '3.5px 6px' };
};

export const groupPriceListProducts = (
  products: PriceListProduct[],
  customCategoryOrder?: string[],
): CategoryGroup[] => {
  const groups = new Map<string, CategoryGroup>();
  const priorityKeys: string[] = [];
  const pushPriority = (raw: string) => {
    const k = normalizeGroupKey(raw);
    if (k && !priorityKeys.includes(k)) priorityKeys.push(k);
  };

  if (Array.isArray(customCategoryOrder)) {
    customCategoryOrder.forEach(pushPriority);
  }
  DEFAULT_PRODUCTION_CATEGORY_ORDER.forEach(pushPriority);

  const activeProducts = (products || []).filter((p) => p && p.isActive !== false);

  activeProducts.forEach((prod) => {
    const rawHeader =
      (prod.commercialCategory || '').trim() ||
      extractRubroName(prod.rubro) ||
      'VARIOS';
    const normKey = normalizeGroupKey(rawHeader) || 'VARIOS';
    const displayName =
      CANONICAL_DISPLAY_NAMES[normKey] || cleanCategoryName(rawHeader).toUpperCase() || 'VARIOS';

    let catGroup = groups.get(normKey);
    if (!catGroup) {
      catGroup = {
        key: normKey,
        name: displayName,
        directProducts: [],
        subcategories: {},
        sortedSubcategories: [],
        totalCount: 0,
      };
      groups.set(normKey, catGroup);
    }
    catGroup.totalCount += 1;
    catGroup.directProducts.push(prod);
  });

  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    if (a.key === 'VARIOS' && b.key !== 'VARIOS') return 1;
    if (b.key === 'VARIOS' && a.key !== 'VARIOS') return -1;
    const rankA = priorityKeys.indexOf(a.key);
    const rankB = priorityKeys.indexOf(b.key);
    if (rankA !== -1 && rankB !== -1) return rankA - rankB;
    if (rankA !== -1) return -1;
    if (rankB !== -1) return 1;
    return compareEs(a.name, b.name);
  });

  return sortedGroups.map((catGroup) => ({
    ...catGroup,
    directProducts: [...catGroup.directProducts].sort((x, y) => compareEs(x.name, y.name)),
  }));
};

export const roundIntegerPeso = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value + 0.5 + 1e-9);
};

export const formatPriceListArs = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(roundIntegerPeso(value));
