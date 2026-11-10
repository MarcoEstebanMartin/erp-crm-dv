export const getTodayKey = () => {
  const today = new Date();
  return `visits_${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
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
  return [...products].sort((a, b) => {
    if (filterRubroId) {
      const rubroA = rubros.find((r) => Number(r.id) === Number(a.rubroId))?.name || 'Z';
      const rubroB = rubros.find((r) => Number(r.id) === Number(b.rubroId))?.name || 'Z';
      if (rubroA < rubroB) return -1;
      if (rubroA > rubroB) return 1;
    }
    const strA = String(a.sku || '').trim();
    const strB = String(b.sku || '').trim();
    const matchA = strA.match(/\d+/);
    const matchB = strB.match(/\d+/);
    if (matchA && matchB) {
      const diff = parseInt(matchA[0], 10) - parseInt(matchB[0], 10);
      if (diff !== 0) return diff;
    }
    return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
  });
};
