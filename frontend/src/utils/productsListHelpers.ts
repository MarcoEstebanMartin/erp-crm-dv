export interface ProductListFilterParams {
  selectedCategory: string;
  selectedRubro: string;
  selectedSubrubro: string;
  catalogTab?: 'products' | 'inactive_products';
  activeFilter: string;
  searchQuery: string;
}

export interface ProductFilterOptions {
  availableCategories: string[];
  availableRubros: string[];
  availableSubrubros: string[];
}

export const INITIAL_PRODUCTS_BATCH = 50;
export const PRODUCTS_BATCH_STEP = 60;

export const CATEGORY_EMOJIS: Record<string, string> = {
  Melincué: '🧀',
  Cremigal: '🥛',
  Sancor: '🧈',
  Fiambres: '🥓',
  Refrigerados: '❄️',
  Conservas: '🥫',
  Pescadería: '🐟',
  Pescaderia: '🐟',
  'Pastas Secas': '🍝',
  'Aceites y Vinagres': '🫒',
  Aderezos: '🌻',
  'Aderezos y Aceites': '🌻',
  Almacén: '🛒',
  Almacen: '🛒',
  Yerbas: '🌿',
  Bebidas: '🥤',
  Aperitivos: '🍸',
  Fernet: '🥃',
  'Vinos Tintos': '🍷',
  'Vinos Blancos': '🥂',
  'Espumantes y Sidras': '🍾',
  'Bebidas Alcohólicas Espirituosas': '🥃',
  'Bebidas Alcoholicas': '🍺',
  'Bebidas Alcohólicas': '🍺',
  Vinos: '🍷',
  'Estucheria y Regalerìa': '🎁',
  'Estuchería y Regalería': '🎁',
  Papeles: '🧻',
  Limpieza: '🧼',
  'No comestibles': '📦',
  Varios: '🏷️',
};

export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function extractProductLabel(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    return String(obj.name || obj.nombre || '').trim();
  }
  return '';
}

export function getProductCategoryInfo(p: any): { name: string; icon: string } {
  const catName = p?.commercialCategory || extractProductLabel(p?.rubro) || 'Varios';
  let icon = CATEGORY_EMOJIS[catName];
  if (!icon) {
    const upper = String(catName).toUpperCase();
    icon =
      upper.includes('QUESO') || upper.includes('REMOTTI')
        ? '🧀'
        : upper.includes('FIAMBRE') || upper.includes('SODECAR')
          ? '🥓'
          : upper.includes('BEBIDA')
            ? '🥤'
            : '🏷️';
  }
  return { name: catName, icon };
}

export function resolveProductImageUrl(
  imageUrl: string | null | undefined,
  version: string = '3.5',
): string {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http')) return imageUrl;
  if (imageUrl.startsWith('/')) return `${imageUrl}?v=${version}`;
  return `/uploads/products/${imageUrl}?v=${version}`;
}

export function sanitizeProductArray(products: unknown): any[] {
  return Array.isArray(products) ? products.filter((p) => p && typeof p === 'object') : [];
}

export function extractProductFilterOptions(
  safeProducts: any[],
  selectedRubro: string,
): ProductFilterOptions {
  const categories = new Set<string>();
  const rubros = new Set<string>();
  const subrubros = new Set<string>();

  for (const p of safeProducts) {
    const catName = getProductCategoryInfo(p).name;
    if (catName) categories.add(catName);

    const rubroLabel = extractProductLabel(p.rubro);
    if (rubroLabel) rubros.add(rubroLabel);

    if (selectedRubro && rubroLabel === selectedRubro) {
      const subLabel = extractProductLabel(p.description);
      if (subLabel) subrubros.add(subLabel);
    }
  }

  return {
    availableCategories: Array.from(categories).sort(),
    availableRubros: Array.from(rubros).sort(),
    availableSubrubros: Array.from(subrubros).sort(),
  };
}

export function filterAndSortProducts(
  safeProducts: any[],
  params: ProductListFilterParams,
): any[] {
  const selectedCatLower = params.selectedCategory.toLowerCase();
  const normalizedQuery = params.searchQuery ? normalizeSearchText(params.searchQuery) : '';

  const matched = safeProducts.filter((p: any) => {
    if (selectedCatLower && getProductCategoryInfo(p).name.toLowerCase() !== selectedCatLower) {
      return false;
    }
    if (params.selectedRubro && extractProductLabel(p.rubro) !== params.selectedRubro) {
      return false;
    }
    if (params.selectedSubrubro && extractProductLabel(p.description) !== params.selectedSubrubro) {
      return false;
    }

    if (params.catalogTab === 'products') {
      if (p.isActive === false) return false;
    } else if (params.catalogTab === 'inactive_products') {
      if (p.isActive !== false) return false;
    } else if (params.activeFilter === 'active') {
      if (p.isActive === false) return false;
    } else if (params.activeFilter === 'inactive') {
      if (p.isActive !== false) return false;
    }

    if (!normalizedQuery) return true;
    return (
      normalizeSearchText(p.name).includes(normalizedQuery) ||
      normalizeSearchText(p.sku).includes(normalizedQuery) ||
      normalizeSearchText(p.barcode).includes(normalizedQuery)
    );
  });

  // Pre-calcula clave numérica de SKU una sola vez O(N) en lugar de ejecutar RegExp en cada comparación O(N log N)
  const decorated = matched.map((product) => {
    const skuText = String(product.sku || '').trim();
    const numMatch = skuText.match(/\d+/);
    return {
      product,
      skuText,
      skuNum: numMatch ? parseInt(numMatch[0], 10) : null,
    };
  });

  decorated.sort((a, b) => {
    if (a.skuNum !== null && b.skuNum !== null && a.skuNum !== b.skuNum) {
      return a.skuNum - b.skuNum;
    }
    return a.skuText.localeCompare(b.skuText, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

  return decorated.map((entry) => entry.product);
}
