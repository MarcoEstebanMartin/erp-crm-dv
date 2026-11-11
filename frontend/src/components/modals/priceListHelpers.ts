export type PriceListGroupBy = 'category' | 'rubro';

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

export const CATEGORY_MAP: Record<string, { category: string; subcategory?: string; brand?: string }> = {
  MELINCUE: { category: 'REMOTTI', subcategory: 'MELINCUÉ' },
  CHOCOLATADAS: { category: 'LÁCTEOS', subcategory: 'CHOCOLATADAS' },
  'LECHES EN POLVO': { category: 'LÁCTEOS', subcategory: 'LECHES EN POLVO' },
  'LECHES LIQUIDAS': { category: 'LÁCTEOS', subcategory: 'LECHES LÍQUIDAS' },
  YOGURT: { category: 'LÁCTEOS', subcategory: 'YOGURT' },
  CREMAS: { category: 'LÁCTEOS', subcategory: 'CREMAS' },
  'DULCES DE LECHE': { category: 'LÁCTEOS', subcategory: 'DULCES DE LECHE' },
  MANTECAS: { category: 'LÁCTEOS', subcategory: 'MANTECAS' },
  MIEL: { category: 'ALMACÉN', subcategory: 'MIEL' },
  QUESOS: { category: 'REFRIGERADOS', subcategory: 'QUESOS' },
  'QUESOS UNTABLES': { category: 'REFRIGERADOS', subcategory: 'QUESOS UNTABLES' },
  'ACEITES Y VINAGRES': { category: 'ADEREZOS Y ACEITES', subcategory: 'ACEITES Y VINAGRES' },
  ADEREZOS: { category: 'ADEREZOS Y ACEITES', subcategory: 'ADEREZOS' },
  HIGIENICOS: { category: 'PAPELES', subcategory: 'HIGIÉNICOS' },
  'ROLLOS DE COCINA': { category: 'PAPELES', subcategory: 'ROLLOS DE COCINA' },
};

const CANONICAL_DISPLAY_NAMES: Record<string, string> = {
  REFRIGERADOS: 'REFRIGERADOS',
  FIAMBRES: 'FIAMBRES',
  'ADEREZOS Y ACEITES': 'ADEREZOS Y ACEITES',
  CONSERVAS: 'CONSERVAS',
  PESCADERIA: 'PESCADERÍA',
  'PASTAS SECAS': 'PASTAS SECAS',
  ALMACEN: 'ALMACÉN',
  YERBAS: 'YERBAS',
  BEBIDAS: 'BEBIDAS',
  'BEBIDAS ALCOHOLICAS': 'BEBIDAS ALCOHÓLICAS',
  VINOS: 'VINOS',
  PAPELES: 'PAPELES',
  'ESTUCHERIA Y REGALERIA': 'ESTUCHERÍA Y REGALERÍA',
  'NO COMESTIBLES': 'NO COMESTIBLES',
  REMOTTI: 'REMOTTI',
  LACTEOS: 'LÁCTEOS',
  LECHES: 'LECHES',
  'SANCOR Y CREMIGAL': 'SANCOR Y CREMIGAL',
  'QUESOS RALLADOS': 'QUESOS RALLADOS',
  SODECAR: 'SODECAR',
  'A.G.D Y NIZA': 'A.G.D Y NIZA',
  ARROZ: 'ARROZ',
  AZUCAR: 'AZÚCAR',
  EDULCORANTES: 'EDULCORANTES',
  CAFE: 'CAFÉ',
  REGALERIA: 'REGALERÍA',
  VARIOS: 'VARIOS',
};

export const COMMERCIAL_CATEGORY_PRIORITY = [
  'REFRIGERADOS',
  'FIAMBRES',
  'ADEREZOS Y ACEITES',
  'CONSERVAS',
  'PESCADERIA',
  'PASTAS SECAS',
  'ALMACEN',
  'YERBAS',
  'BEBIDAS',
  'BEBIDAS ALCOHOLICAS',
  'VINOS',
  'PAPELES',
  'ESTUCHERIA Y REGALERIA',
  'NO COMESTIBLES',
];

export const RUBRO_PRIORITY = [
  'REMOTTI',
  'LACTEOS',
  'LECHES',
  'SANCOR Y CREMIGAL',
  'QUESOS RALLADOS',
  'SODECAR',
  'A.G.D Y NIZA',
  'CONSERVAS',
  'PESCADERIA',
  'PASTAS SECAS',
  'ARROZ',
  'AZUCAR',
  'EDULCORANTES',
  'CAFE',
  'YERBAS',
  'BEBIDAS',
  'PAPELES',
  'REGALERIA',
  'NO COMESTIBLES',
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
  const haystack = normalizeGroupKey(
    `${prod.name || ''} ${extractRubroName(prod.rubro)} ${prod.commercialCategory || ''} ${prod.description || ''}`,
  );
  return haystack.includes('REMOTTI') || haystack.includes('MELINCUE');
};

export const isQueso = (prod: PriceListProduct) => {
  if (isQuesoRemotti(prod)) return true;
  const haystack = normalizeGroupKey(
    `${prod.name || ''} ${extractRubroName(prod.rubro)} ${prod.commercialCategory || ''} ${prod.description || ''}`,
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
  groupBy: PriceListGroupBy = 'category',
): CategoryGroup[] => {
  const groups = new Map<string, CategoryGroup>();
  const priorityList = groupBy === 'rubro' ? RUBRO_PRIORITY : COMMERCIAL_CATEGORY_PRIORITY;

  const activeProducts = (products || []).filter((p) => p && p.isActive !== false);

  activeProducts.forEach((prod) => {
    const commercialRaw = (prod.commercialCategory || '').trim();
    const rubroRaw = extractRubroName(prod.rubro);
    const descRaw = (prod.description || '').trim();
    const legacyMapping = descRaw ? CATEGORY_MAP[normalizeGroupKey(descRaw)] || CATEGORY_MAP[descRaw] : undefined;

    let rawHeader = '';
    let subKey: string | undefined;
    let brandKey: string | undefined;

    if (groupBy === 'category') {
      if (commercialRaw) rawHeader = commercialRaw;
      else if (rubroRaw) rawHeader = rubroRaw;
      else if (legacyMapping) {
        rawHeader = legacyMapping.category;
        subKey = legacyMapping.subcategory;
        brandKey = legacyMapping.brand;
      } else if (descRaw) rawHeader = descRaw;
    } else {
      if (rubroRaw) rawHeader = rubroRaw;
      else if (legacyMapping) {
        rawHeader = legacyMapping.category;
        subKey = legacyMapping.subcategory;
        brandKey = legacyMapping.brand;
      } else if (commercialRaw) rawHeader = commercialRaw;
      else if (descRaw) rawHeader = descRaw;
    }

    const normKey = normalizeGroupKey(rawHeader) || 'VARIOS';
    const displayName = CANONICAL_DISPLAY_NAMES[normKey] || cleanCategoryName(rawHeader).toUpperCase() || 'VARIOS';

    let catGroup = groups.get(normKey);
    if (!catGroup) {
      catGroup = { key: normKey, name: displayName, directProducts: [], subcategories: {}, sortedSubcategories: [], totalCount: 0 };
      groups.set(normKey, catGroup);
    }
    catGroup.totalCount += 1;

    if (subKey) {
      if (!catGroup.subcategories[subKey]) {
        catGroup.subcategories[subKey] = { name: subKey, products: [], brands: {} };
      }
      const subGroup = catGroup.subcategories[subKey];
      if (brandKey) {
        if (!subGroup.brands[brandKey]) subGroup.brands[brandKey] = [];
        subGroup.brands[brandKey].push(prod);
      } else {
        subGroup.products.push(prod);
      }
    } else {
      catGroup.directProducts.push(prod);
    }
  });

  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    if (a.key === 'VARIOS' && b.key !== 'VARIOS') return 1;
    if (b.key === 'VARIOS' && a.key !== 'VARIOS') return -1;
    const rankA = priorityList.indexOf(a.key);
    const rankB = priorityList.indexOf(b.key);
    if (rankA !== -1 && rankB !== -1) return rankA - rankB;
    if (rankA !== -1) return -1;
    if (rankB !== -1) return 1;
    return compareEs(a.name, b.name);
  });

  return sortedGroups.map((catGroup) => {
    const sortedSubcategories = Object.keys(catGroup.subcategories)
      .sort(compareEs)
      .map((subKey) => {
        const subGroup = catGroup.subcategories[subKey];
        const sortedBrands = Object.keys(subGroup.brands)
          .sort(compareEs)
          .map((bKey) => ({
            name: bKey,
            products: [...subGroup.brands[bKey]].sort((x, y) => compareEs(x.name, y.name)),
          }));
        return {
          ...subGroup,
          products: [...subGroup.products].sort((x, y) => compareEs(x.name, y.name)),
          sortedBrands,
        };
      });

    return {
      ...catGroup,
      directProducts: [...catGroup.directProducts].sort((x, y) => compareEs(x.name, y.name)),
      sortedSubcategories,
    };
  });
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
