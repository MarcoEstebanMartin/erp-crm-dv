export const getTodayKey = () => {
  const today = new Date();
  return `visits_${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
};

export const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const tokenizeSearchQuery = (query: string): string[] =>
  normalizeSearchText(query).trim().split(/\s+/).filter(Boolean);

export interface IndexedSearchItem<T> {
  item: T;
  searchKey: string;
}

/**
 * Pre-normaliza los campos de búsqueda una sola vez para filtrar en O(N) sin regex ni NFD por tecla.
 */
export const buildSearchIndex = <T,>(
  items: T[],
  getFields: (item: T) => (string | null | undefined)[],
): IndexedSearchItem<T>[] =>
  items.map((item) => ({
    item,
    searchKey: normalizeSearchText(getFields(item).filter(Boolean).join(' ')),
  }));

export const filterIndexedItems = <T,>(
  indexed: IndexedSearchItem<T>[],
  query: string,
): T[] => {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return indexed.map((entry) => entry.item);
  const results: T[] = [];
  for (let i = 0; i < indexed.length; i++) {
    const entry = indexed[i];
    let matches = true;
    for (let j = 0; j < tokens.length; j++) {
      if (!entry.searchKey.includes(tokens[j])) {
        matches = false;
        break;
      }
    }
    if (matches) results.push(entry.item);
  }
  return results;
};

/**
 * Coincide si todas las palabras buscadas aparecen en cualquier orden dentro de los campos dados.
 */
export const matchesSearchTokens = (
  fields: (string | null | undefined)[],
  query: string,
): boolean => {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return true;
  const haystack = normalizeSearchText(fields.filter(Boolean).join(' '));
  return tokens.every((token) => haystack.includes(token));
};

export const cleanCityName = (city: string | null | undefined): string => {
  if (!city) return 'OTRAS';
  const upper = city.toUpperCase().trim();

  if (upper.startsWith('(') || upper === '-' || upper === '0' || upper.length <= 3 || !/[A-Z]/.test(upper)) {
    const KNOWN = ['BUNGE', 'VILLEGAS', 'PIEDRITAS', 'ALVEAR', 'LARROUDE', 'TEJEDOR', 'SAUZE', 'CHARLONE', 'BUCHARDO', 'REALICO', 'AMEGHINO'];
    for (const k of KNOWN) {
      if (upper.includes(k)) {
        if (k === 'BUNGE') return 'EMILIO V. BUNGE';
        if (k === 'VILLEGAS') return 'GENERAL VILLEGAS';
        if (k === 'ALVEAR') return 'INTENDENTE ALVEAR';
        if (k === 'SAUZE') return 'VILLA SAUZE';
        if (k === 'CHARLONE') return 'CORONEL CHARLONE';
        return k;
      }
    }
    return 'OTRAS';
  }

  const MAIN_MAPPINGS: Record<string, string> = {
    BUNGE: 'EMILIO V. BUNGE',
    VILLEGAS: 'GENERAL VILLEGAS',
    ALVEAR: 'INTENDENTE ALVEAR',
    SAUZE: 'VILLA SAUZE',
    CHARLONE: 'CORONEL CHARLONE',
    BUCHARDO: 'BUCHARDO',
    AMERICA: 'AMERICA',
    LARROUDE: 'BERNARDO LARROUDE',
  };

  for (const key in MAIN_MAPPINGS) {
    if (upper.includes(key)) return MAIN_MAPPINGS[key];
  }
  return upper;
};

export const getWhatsAppLink = (phone: string) => {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (!cleanPhone) return '';
  const formatted = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`;
  return `https://wa.me/${formatted}`;
};

export const getVendedorItemPrice = (product: any, client: any) => {
  if (!client) return Math.round(Number(product.listPrice));
  let price = Number(product.listPrice);
  if (client.priceList === 'B') {
    price = Number(product.listPriceB) > 0 ? Number(product.listPriceB) : Number(product.listPrice);
  } else if (client.priceList === 'C') {
    price = Number(product.listPriceC) > 0 ? Number(product.listPriceC) : Number(product.listPrice);
  }

  let discount = Number(client.discount || 0);
  const isQuesoRemottiOrMelincue =
    product.rubro?.name === 'REMOTTI' ||
    product.description?.toUpperCase() === 'REMOTTI' ||
    product.name?.toUpperCase().includes('REMOTTI') ||
    product.description?.toUpperCase() === 'MELINCUE' ||
    product.name?.toUpperCase().includes('MELINCUE');

  const isFanberlian = client.name?.toUpperCase().includes('FANBERLIAN');
  if (isFanberlian) discount = isQuesoRemottiOrMelincue ? 3 : 4;
  else if (client.priceList === 'ESPECIAL_QUESOS') discount = isQuesoRemottiOrMelincue ? 3 : 0;
  else if (client.priceList === 'B') {
    const isMelincue = product.description?.toUpperCase() === 'MELINCUE' || product.name?.toUpperCase().includes('MELINCUE');
    discount = isMelincue ? 3 : 0;
  }

  return Math.round(price * (1 - discount / 100));
};

export const sortVendedorCatalog = (products: any[], rubros: any[], filterRubroId: string) => {
  const rubroNames = filterRubroId
    ? new Map<number, string>(rubros.map((r) => [Number(r.id), r.name || 'Z']))
    : null;

  const keyed = products.map((p) => {
    const skuStr = String(p.sku || '').trim();
    const match = skuStr.match(/\d+/);
    return {
      p,
      skuStr,
      skuNum: match ? parseInt(match[0], 10) : null,
      rubroName: rubroNames ? (rubroNames.get(Number(p.rubroId)) || 'Z') : '',
    };
  });

  keyed.sort((a, b) => {
    if (rubroNames) {
      if (a.rubroName < b.rubroName) return -1;
      if (a.rubroName > b.rubroName) return 1;
    }
    if (a.skuNum !== null && b.skuNum !== null && a.skuNum !== b.skuNum) {
      return a.skuNum - b.skuNum;
    }
    return a.skuStr.localeCompare(b.skuStr, undefined, { numeric: true, sensitivity: 'base' });
  });

  return keyed.map((k) => k.p);
};
