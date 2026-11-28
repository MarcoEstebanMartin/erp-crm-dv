import { roundToIntegerPeso, toDecimal } from '../core/money';

export const CANONICAL_CATALOG_CATEGORY_ORDER: readonly string[] = [
  'COMBOS',
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
];

export type CatalogBadgeType = 'OFERTON' | 'DESTACADO' | null;
export type CatalogResumenMode = 'all' | 'ofertones' | 'destacados';

export interface CatalogProductInput {
  id: number;
  sku: string;
  name: string;
  price: number;
  costPrice?: number | null;
  oldPrice?: number | null;
  showOldPrice?: boolean;
  category: string;
  badge?: CatalogBadgeType | string | null;
  minQty?: string | null;
  minOrderQuantity?: number | null;
  varieties?: string | null;
  imageUrl?: string | null;
  stock?: number;
  isActive?: boolean;
  catalogVisible?: boolean;
}

export interface CatalogComboProductSide {
  productId?: number | null;
  sku?: string | null;
  name: string;
  price: number;
  uxb?: string | null;
  condition: string;
  imageUrl?: string | null;
  isFree?: boolean;
  freeLabel?: string | null;
}

export interface CatalogComboInput {
  id: string;
  comboNum: string;
  title: string;
  category?: string;
  product1: CatalogComboProductSide;
  product2: CatalogComboProductSide;
}

export interface CatalogRenderConfig {
  title?: string;
  subtitle?: string;
  categoryOrder?: string[];
  onlyOfertonInResumen?: boolean;
  resumenMode?: CatalogResumenMode;
}

export interface MinQtyBadgeData {
  top: string;
  center: string;
  bottom: string;
}

export function normalizeCatalogBadge(raw?: string | null): CatalogBadgeType {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return null;
  if (s.includes('OFERTÓN') || s.includes('OFERTON')) return 'OFERTON';
  if (s.includes('DESTACADO')) return 'DESTACADO';
  return null;
}

export function normalizeCatalogCategory(raw?: string | null): string {
  if (!raw) return 'Almacén';
  const s = String(raw).trim();
  const u = s.toUpperCase();
  if (u.includes('COMBO')) return 'COMBOS';
  if (u.includes('FERNET')) return 'Fernet';
  if (u.includes('ESPUMANTE') || u.includes('SIDRA')) return 'Espumantes y Sidras';
  if (u.includes('MELINCUE') || u.includes('MELINCUÉ')) return 'Melincué';
  if (u.includes('CREMIGAL')) return 'Cremigal';
  if (u.includes('SANCOR')) return 'Sancor';
  if (u.includes('LIMPIEZA') || u.includes('NO COMESTIBLE')) return 'Limpieza';
  if (u.includes('ACEITE') || u.includes('VINAGRE')) return 'Aceites y Vinagres';
  if (u.includes('ADEREZO')) return 'Aderezos';
  if (u.includes('APERITIVO')) return 'Aperitivos';
  if (u.includes('TINTO')) return 'Vinos Tintos';
  if (u.includes('BLANCO')) return 'Vinos Blancos';
  if (u.includes('ESPIRITUOSA')) return 'Bebidas Alcohólicas Espirituosas';
  if (u.includes('ALMAC')) return 'Almacén';
  if (u.includes('PESCAD')) return 'Pescadería';
  if (u.includes('BEBIDA')) {
    return u.includes('ALCOH') ? 'Bebidas Alcohólicas Espirituosas' : 'Bebidas';
  }
  if (u.includes('ESTUCHER') || u.includes('REGALER')) return 'Estuchería y Regalería';
  if (u.includes('PASTA')) return 'Pastas Secas';
  if (u.includes('REFRIGERAD')) return 'Melincué';
  if (u.includes('FIAMBRE')) return 'Fiambres';
  if (u.includes('CONSERVA')) return 'Conservas';
  if (u.includes('YERBA')) return 'Yerbas';
  if (u.includes('PAPEL')) return 'Papeles';
  return s;
}

export function formatCatalogPrice(price: number | string | null | undefined): string {
  const dec = toDecimal(price ?? 0);
  const rounded = roundToIntegerPeso(dec).toNumber();
  const formatted = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return rounded < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function computeMarginPercent(
  listPrice: number | string | null | undefined,
  costPrice: number | string | null | undefined,
): number | null {
  const list = toDecimal(listPrice ?? 0);
  const cost = toDecimal(costPrice ?? 0);
  if (cost.lte(0) || list.lte(0)) return null;
  return list.minus(cost).div(cost).mul(100).toDecimalPlaces(1).toNumber();
}

export function cleanVarietiesText(raw?: string | null): string {
  if (!raw) return '';
  let text = String(raw).trim();
  text = text.replace(/^(?:SABORES|VARIEDADES|SABOR|VARIEDAD)\s*[:-]\s*/i, '').trim();
  if ((text.startsWith('(') && text.endsWith(')')) || (text.startsWith('[') && text.endsWith(']'))) {
    text = text.slice(1, -1).trim();
  }
  return text
    .replace(/•/g, '-')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function parseMinQtyBadge(
  rawVal?: string | null,
  fallbackMinOrderQty?: number | null,
): MinQtyBadgeData | null {
  let s = String(rawVal || '').trim().toUpperCase();
  if (!s && fallbackMinOrderQty && fallbackMinOrderQty > 1) {
    s = `${Math.floor(fallbackMinOrderQty)} UNID.`;
  }
  if (
    !s ||
    ['0', '1', 'SIN MÍNIMO', 'SIN MINIMO', 'NO', 'NONE', 'FALSE', 'SIN MÍN.', 'SIN MIN.', 'SIN CARTEL'].includes(s)
  ) {
    return null;
  }

  const numMatch = s.match(/\b(\d+)\b/);
  if (numMatch) {
    const num = numMatch[1];
    if (Number(num) <= 0) return null;
    let unit = 'UNID.';
    if (s.includes('PACK')) unit = 'PACK';
    else if (s.includes('BTO') || s.includes('BULTO')) unit = 'BULTO';
    else if (s.includes('CAJA')) unit = 'CAJA';
    else if (s.includes('DOC')) unit = 'DOC.';
    return { top: 'MÍNIMO', center: num, bottom: unit };
  }

  if (s.includes('BULTO')) return { top: 'VENTA', center: 'POR', bottom: 'BULTO' };
  if (s.includes('CAJA')) return { top: 'VENTA', center: 'POR', bottom: 'CAJA' };
  if (s.includes('PACK')) return { top: 'VENTA', center: 'POR', bottom: 'PACK' };
  return { top: 'MÍNIMO', center: s.slice(0, 6), bottom: 'UNID.' };
}

const KNOWN_MULTI_WORD_BRANDS = [
  'LA CASONA',
  'LA RESIDENCIA',
  'LA GIOCONDA',
  'MOLINO ROJO',
  'LA HUERTA',
  'LA VIRGINIA',
  'LA VIRG',
  'EL POCILLO',
  'EL DIQUE',
  'EL RECORD',
  'EL BAUTISMO',
  'DOS ANCLAS',
  'DOS ESTRELLAS',
  'SAN VICENTE',
  'SAN TELMO',
  'SANTA JULIA',
  'SIERRA DE LOS PADRES',
  'VALLE DEL SOL',
  'VIÑA DE BALBO',
  'VASCO VIEJO',
  'LOS HAROLDOS',
  'LOS ARBOLES',
  'FINCA LAS MORAS',
  'FOND DE CAVE',
  'ALMA MORA',
  'DON DAVID',
  'LAS PERDICES',
  'LATITUD 33',
  'CHATEAU MENDOZA',
  'SAENZS BRIONES',
  'LA FARRUCA',
  'SPIRITO BLUE',
  'WHITE HORSE',
  'SOL MAYOR',
  'PUGLISI MERLUZA',
  'DR.LEMON',
  'MOSQUI-TRAP',
  'SI-DIET',
];

export function splitBrandAndDescription(
  fullName: string,
  category?: string | null,
): { brand: string; description: string } {
  const clean = String(fullName || '')
    .trim()
    .replace(/\bMELINCUE\b/gi, 'MELINCUÉ')
    .toUpperCase();
  if (!clean) return { brand: '', description: '' };

  const normCat = normalizeCatalogCategory(category);
  if (normCat === 'Melincué' || normCat === 'Cremigal' || normCat === 'Sancor') {
    const brandUpper = normCat.toUpperCase();
    const stripped = clean
      .replace(new RegExp(`^${brandUpper}\\s+`, 'i'), '')
      .replace(new RegExp(`\\s+${brandUpper}$`, 'i'), '')
      .trim();
    return { brand: brandUpper, description: stripped || clean };
  }

  for (const b of KNOWN_MULTI_WORD_BRANDS) {
    if (clean.startsWith(`${b} `)) {
      return { brand: b, description: clean.slice(b.length).trim() };
    }
    if (clean.endsWith(` ${b}`)) {
      return { brand: b, description: clean.slice(0, -b.length).trim() };
    }
  }

  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return { brand: parts[0], description: parts.slice(1).join(' ') };
  }
  return { brand: '', description: clean };
}

export function formatCurrentEditionSubtitle(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `EDICION ${dd}/${mm}`;
}

function formatCatalogDownloadDatePart(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
  }).formatToParts(date);
  const dd = parts.find((p) => p.type === 'day')?.value ?? String(date.getDate()).padStart(2, '0');
  const mm =
    parts.find((p) => p.type === 'month')?.value ?? String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}`;
}

export function formatCatalogDownloadFilename(date: Date = new Date()): string {
  return `Catálogo de ofertas - ${formatCatalogDownloadDatePart(date)}.pdf`;
}

export function formatResumenDownloadFilename(
  mode: CatalogResumenMode = 'all',
  date: Date = new Date(),
): string {
  const ddmm = formatCatalogDownloadDatePart(date);
  if (mode === 'ofertones') return `Ofertones ${ddmm}.pdf`;
  if (mode === 'destacados') return `Destacados ${ddmm}.pdf`;
  return `Ofertones y Destacados ${ddmm}.pdf`;
}

export function isRefrigeratedCategory(catName: string): boolean {
  const u = String(catName || '').toUpperCase();
  return ['MELINCU', 'CREMIGAL', 'SANCOR', 'CASONA', 'FIAMBRE', 'REFRIGERAD', 'LACTEO', 'LÁCTEO'].some((k) =>
    u.includes(k),
  );
}

export interface CatalogSection {
  name: string;
  products: CatalogProductInput[];
  combos: CatalogComboInput[];
}

export function groupCatalogSections(
  products: CatalogProductInput[],
  combos: CatalogComboInput[] = [],
  customCategoryOrder?: string[] | null,
): CatalogSection[] {
  const order =
    customCategoryOrder && customCategoryOrder.length > 0
      ? customCategoryOrder.map((c) => normalizeCatalogCategory(c))
      : [...CANONICAL_CATALOG_CATEGORY_ORDER];

  const buckets = new Map<string, CatalogSection>();
  const ensureBucket = (name: string): CatalogSection => {
    let sec = buckets.get(name);
    if (!sec) {
      sec = { name, products: [], combos: [] };
      buckets.set(name, sec);
    }
    return sec;
  };

  for (const c of combos) {
    const cat = normalizeCatalogCategory(c.category || 'COMBOS');
    ensureBucket(cat).combos.push(c);
  }

  for (const p of products) {
    const cat = normalizeCatalogCategory(p.category);
    ensureBucket(cat).products.push(p);
  }

  const orderedNames: string[] = [];
  if (buckets.has('COMBOS')) orderedNames.push('COMBOS');
  for (const name of order) {
    if (name !== 'COMBOS' && buckets.has(name) && !orderedNames.includes(name)) {
      orderedNames.push(name);
    }
  }
  for (const name of buckets.keys()) {
    if (!orderedNames.includes(name)) {
      orderedNames.push(name);
    }
  }

  return orderedNames
    .map((name) => buckets.get(name)!)
    .filter((s) => s.products.length > 0 || s.combos.length > 0);
}

export interface ResumenSection {
  name: 'REFRIGERADOS' | 'VARIOS';
  items: CatalogProductInput[];
}

export function buildResumenSections(
  products: CatalogProductInput[],
  customCategoryOrder?: string[] | null,
  modeOrOnlyOferton: CatalogResumenMode | boolean = 'all',
): ResumenSection[] {
  const mode: CatalogResumenMode =
    typeof modeOrOnlyOferton === 'boolean'
      ? modeOrOnlyOferton
        ? 'ofertones'
        : 'all'
      : modeOrOnlyOferton;

  const highlighted = products.filter((p) => {
    const b = normalizeCatalogBadge(p.badge);
    if (!b) return false;
    if (mode === 'ofertones') return b === 'OFERTON';
    if (mode === 'destacados') return b === 'DESTACADO';
    return true;
  });

  const orderedSections = groupCatalogSections(highlighted, [], customCategoryOrder);
  const refrigerados: CatalogProductInput[] = [];
  const varios: CatalogProductInput[] = [];

  for (const sec of orderedSections) {
    if (isRefrigeratedCategory(sec.name)) {
      refrigerados.push(...sec.products);
    } else {
      varios.push(...sec.products);
    }
  }

  const result: ResumenSection[] = [];
  if (refrigerados.length > 0) result.push({ name: 'REFRIGERADOS', items: refrigerados });
  if (varios.length > 0) result.push({ name: 'VARIOS', items: varios });
  return result;
}

export function formatResumenMinQty(
  rawVal?: string | null,
  fallbackMinOrderQty?: number | null,
): string {
  const parsed = parseMinQtyBadge(rawVal, fallbackMinOrderQty);
  if (!parsed) return '';
  const unit = parsed.bottom === 'UNID.' ? 'u.' : parsed.bottom.toLowerCase();
  if (parsed.top === 'VENTA') return `x ${unit}`;
  return `Mín. ${parsed.center} ${unit}`;
}
