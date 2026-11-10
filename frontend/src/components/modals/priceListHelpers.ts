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
}

export interface SubcategoryGroup {
  name: string;
  products: PriceListProduct[];
  brands: { [brand: string]: PriceListProduct[] };
  sortedBrands?: { name: string; products: PriceListProduct[] }[];
}

export interface CategoryGroup {
  name: string;
  directProducts: PriceListProduct[];
  subcategories: { [sub: string]: SubcategoryGroup };
  sortedSubcategories?: (SubcategoryGroup & { sortedBrands: { name: string; products: PriceListProduct[] }[] })[];
}

export const CATEGORY_MAP: Record<string, { category: string; subcategory?: string; brand?: string }> = {
  MELINCUE: { category: '1 - REMOTTI', subcategory: 'MELINCUE' },
  CHOCOLATADAS: { category: '1.1 - LECHES', subcategory: 'CHOCOLATADAS' },
  'LECHES EN POLVO': { category: '1.1 - LECHES', subcategory: 'LECHES EN POLVO' },
  'LECHES LIQUIDAS': { category: '1.1 - LECHES', subcategory: 'LECHES LIQUIDAS' },
  YOGURT: { category: '1.1 - LECHES', subcategory: 'YOGURT' },
  CREMAS: { category: '1.2 - SANCOR y CREMIGAL', subcategory: 'CREMAS' },
  'DULCES DE LECHE': { category: '1.2 - SANCOR y CREMIGAL', subcategory: 'DULCES DE LECHE' },
  MANTECAS: { category: '1.2 - SANCOR y CREMIGAL', subcategory: 'MANTECAS' },
  MIEL: { category: '1.2 - SANCOR y CREMIGAL', subcategory: 'MIEL' },
  QUESOS: { category: '1.2 - SANCOR y CREMIGAL', subcategory: 'QUESOS' },
  'QUESOS UNTABLES': { category: '1.2 - SANCOR y CREMIGAL', subcategory: 'QUESOS UNTABLES' },
  '1.21 - QUESOS RALLADOS': { category: '1.21 - QUESOS RALLADOS' },
  '1.4 - SODECAR': { category: '1.4 - SODECAR' },
  '1.5 - CONSERVAS': { category: '1.5 - CONSERVAS' },
  'ACEITES Y VINAGRES': { category: '1.6 - A.G.D Y NIZA', subcategory: 'ACEITES Y VINAGRES' },
  ADEREZOS: { category: '1.6 - A.G.D Y NIZA', subcategory: 'ADEREZOS' },
  '1.7 - CAFE': { category: '1.7 - CAFE' },
  '1.8 - ARROZ': { category: '1.8 - ARROZ' },
  '1.9 - YERBAS': { category: '1.9 - YERBAS' },
  '2 - AZUCAR': { category: '2 - AZUCAR' },
  '2.1 - EDULCORANTES': { category: '2.1 - EDULCORANTES' },
  '2.3 - PESCADERIA': { category: '2.3 - PESCADERIA' },
  '2.4 - PASTAS SECAS': { category: '2.4 - PASTAS SECAS' },
  HIGIENICOS: { category: '2.5 - PAPELES', subcategory: 'HIGIENICOS' },
  'ROLLOS DE COCINA': { category: '2.5 - PAPELES', subcategory: 'ROLLOS DE COCINA' },
  '2.6 - REGALERIA': { category: '2.6 - REGALERIA' },
  'AGUAS SABORIZADAS Y JUGOS': { category: '2.7 - BEBIDAS', subcategory: 'AGUAS SABORIZADAS Y JUGOS' },
  'AGUAS Y SODAS': { category: '2.7 - BEBIDAS', subcategory: 'AGUAS Y SODAS' },
  'APERITIVOS Y BEBIDAS ESPECIALES': { category: '2.7 - BEBIDAS', subcategory: 'APERITIVOS Y BEBIDAS ESPECIALES' },
  CEPAS: { category: '2.7 - BEBIDAS', subcategory: 'CEPAS' },
  'ESPUMANTES Y SIDRAS': { category: '2.7 - BEBIDAS', subcategory: 'ESPUMANTES Y SIDRAS' },
  FERNET: { category: '2.7 - BEBIDAS', subcategory: 'FERNET' },
  GASEOSAS: { category: '2.7 - BEBIDAS', subcategory: 'GASEOSAS' },
  LICORES: { category: '2.7 - BEBIDAS', subcategory: 'LICORES' },
  'R.P.B': { category: '2.7 - BEBIDAS', subcategory: 'R.P.B' },
  'R.P .B': { category: '2.7 - BEBIDAS', subcategory: 'R.P.B' },
  WHISKIES: { category: '2.7 - BEBIDAS', subcategory: 'WHISKIES' },
  'BODEGAS BIANCHI': { category: '2.7 - BEBIDAS', subcategory: 'VINOS FINOS', brand: 'BODEGAS BIANCHI' },
  'BODEGAS CATENA': { category: '2.7 - BEBIDAS', subcategory: 'VINOS FINOS', brand: 'BODEGAS CATENA' },
  'BODEGAS CHANDON': { category: '2.7 - BEBIDAS', subcategory: 'VINOS FINOS', brand: 'BODEGAS CHANDON' },
  'BODEGAS LA RURAL': { category: '2.7 - BEBIDAS', subcategory: 'VINOS FINOS', brand: 'BODEGAS LA RURAL' },
  'BODEGAS LOPEZ': { category: '2.7 - BEBIDAS', subcategory: 'VINOS FINOS', brand: 'BODEGAS LOPEZ' },
  'BODEGAS LOS HAROLDOS': { category: '2.7 - BEBIDAS', subcategory: 'VINOS FINOS', brand: 'BODEGAS LOS HAROLDOS' },
  'BODEGAS LOS HARoldOS': { category: '2.7 - BEBIDAS', subcategory: 'VINOS FINOS', brand: 'BODEGAS LOS HAROLDOS' },
  'BODEGAS ZUCCARDI': { category: '2.7 - BEBIDAS', subcategory: 'VINOS FINOS', brand: 'BODEGAS ZUCCARDI' },
  'GRUPO PEÑAFLOR': { category: '2.7 - BEBIDAS', subcategory: 'VINOS FINOS', brand: 'GRUPO PEÑAFLOR' },
  'GRUPO PEAFLOR': { category: '2.7 - BEBIDAS', subcategory: 'VINOS FINOS', brand: 'GRUPO PEÑAFLOR' },
  'NIETOS SENETINER': { category: '2.7 - BEBIDAS', subcategory: 'VINOS FINOS', brand: 'NIETOS SENETINER' },
  '2.8 - NO COMESTIBLES': { category: '2.8 - NO COMESTIBLES' },
};

export const CATEGORY_ORDER = [
  '1 - REMOTTI', '1.1 - LECHES', '1.2 - SANCOR y CREMIGAL', '1.21 - QUESOS RALLADOS',
  '1.4 - SODECAR', '1.5 - CONSERVAS', '1.6 - A.G.D Y NIZA', '1.7 - CAFE',
  '1.8 - ARROZ', '1.9 - YERBAS', '2 - AZUCAR', '2.1 - EDULCORANTES',
  '2.3 - PESCADERIA', '2.4 - PASTAS SECAS', '2.5 - PAPELES', '2.6 - REGALERIA',
  '2.7 - BEBIDAS', '2.8 - NO COMESTIBLES', 'VARIOS',
];

export const cleanCategoryName = (name: string) => name.replace(/^\d+(\.\d+)?\s*-\s*/, '');

export const isQuesoRemotti = (prod: PriceListProduct) => {
  const desc = (prod.description || '').toUpperCase();
  const name = (prod.name || '').toUpperCase();
  const mapping = CATEGORY_MAP[(prod.description || '').trim()];
  const category = mapping ? mapping.category : desc;
  return category.includes('REMOTTI') || desc.includes('REMOTTI') || desc.includes('MELINCUE') || name.includes('MELINCUE') || name.includes('REMOTTI');
};

export const isQueso = (prod: PriceListProduct) => {
  if (isQuesoRemotti(prod)) return true;
  const desc = (prod.description || '').toUpperCase();
  const name = (prod.name || '').toUpperCase();
  const mapping = CATEGORY_MAP[(prod.description || '').trim()];
  const category = mapping ? mapping.category : desc;
  const subcategory = mapping?.subcategory || '';
  return category.includes('QUESO') || subcategory.includes('QUESO') || desc.includes('QUESO') || name.includes('QUESO');
};

export const getFontScaleConfig = (fontScale: 'small' | 'medium' | 'large') => {
  if (fontScale === 'small') {
    return { viewSize: '0.66rem', viewHeaderSize: '0.74rem', viewSubheaderSize: '0.7rem', viewBrandSize: '0.66rem', viewPadding: '2.5px 5px', printSize: '7.5pt', printHeaderSize: '8.2pt', printSubheaderSize: '7.8pt', printBrandSize: '7.5pt', printPadding: '2px 4px' };
  }
  if (fontScale === 'large') {
    return { viewSize: '0.86rem', viewHeaderSize: '0.96rem', viewSubheaderSize: '0.9rem', viewBrandSize: '0.86rem', viewPadding: '5px 10px', printSize: '10.5pt', printHeaderSize: '11.5pt', printSubheaderSize: '11pt', printBrandSize: '10.5pt', printPadding: '4.5px 7px' };
  }
  return { viewSize: '0.76rem', viewHeaderSize: '0.84rem', viewSubheaderSize: '0.78rem', viewBrandSize: '0.74rem', viewPadding: '3.5px 6px', printSize: '9pt', printHeaderSize: '10pt', printSubheaderSize: '9.5pt', printBrandSize: '9pt', printPadding: '3.5px 6px' };
};

export const groupPriceListProducts = (products: PriceListProduct[]) => {
  const groups: Record<string, CategoryGroup> = {};
  CATEGORY_ORDER.forEach((cat) => { groups[cat] = { name: cat, directProducts: [], subcategories: {} }; });

  products.forEach((prod) => {
    const desc = (prod.description || '').trim();
    const mapping = CATEGORY_MAP[desc];
    let catKey = 'VARIOS', subKey: string | undefined, brandKey: string | undefined;

    if (mapping) {
      catKey = mapping.category; subKey = mapping.subcategory; brandKey = mapping.brand;
    } else if (desc) {
      if (/^\d+(\.\d+)?\s*-\s*/.test(desc)) {
        catKey = desc;
        if (!groups[catKey]) groups[catKey] = { name: catKey, directProducts: [], subcategories: {} };
      } else { catKey = 'VARIOS'; subKey = desc; }
    }

    const catGroup = groups[catKey] || groups['VARIOS'];
    if (subKey) {
      if (!catGroup.subcategories[subKey]) catGroup.subcategories[subKey] = { name: subKey, products: [], brands: {} };
      const subGroup = catGroup.subcategories[subKey];
      if (brandKey) {
        if (!subGroup.brands[brandKey]) subGroup.brands[brandKey] = [];
        subGroup.brands[brandKey].push(prod);
      } else subGroup.products.push(prod);
    } else catGroup.directProducts.push(prod);
  });

  return CATEGORY_ORDER.map((catKey) => {
    const catGroup = groups[catKey];
    const hasDirect = catGroup.directProducts.length > 0;
    const subKeys = Object.keys(catGroup.subcategories);
    if (!hasDirect && subKeys.length === 0) return null;

    const sortedSubcategories = subKeys.sort().map((subKey) => {
      const subGroup = catGroup.subcategories[subKey];
      const sortedBrands = Object.keys(subGroup.brands).sort().map((bKey) => ({
        name: bKey,
        products: subGroup.brands[bKey].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      return { ...subGroup, products: subGroup.products.sort((a, b) => a.name.localeCompare(b.name)), sortedBrands };
    });

    return {
      ...catGroup,
      directProducts: catGroup.directProducts.sort((a, b) => a.name.localeCompare(b.name)),
      sortedSubcategories,
    };
  }).filter(Boolean);
};

export const formatPriceListArs = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(value));
