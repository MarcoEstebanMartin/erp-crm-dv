export const INITIAL_CLIENTS_BATCH = 60;
export const CLIENTS_BATCH_STEP = 80;

export const PERSONA_ROLE_TABS = [
  { id: 'client', label: 'Clientes' },
  { id: 'providers', label: 'Proveedores' },
  { id: 'seller', label: 'Vendedores' },
  { id: 'commission_agent', label: 'Comisionistas' },
  { id: 'debtors_by_city', label: 'Deudores' },
  { id: 'sale_routes', label: 'Rutas' },
] as const;

export function buildEmptyPersonaDraft(personaRoleFilter: string, showInactive: boolean) {
  return {
    id: 0, name: '', cuit: '', address: '', city: '', phone: '', email: '', creditLimit: 0, maxUnpaidInvoices: 0,
    priceList: 'A', discount: 0, isClient: personaRoleFilter === 'client', isProvider: personaRoleFilter === 'provider',
    isSeller: personaRoleFilter === 'seller', isCommissionAgent: personaRoleFilter === 'commission_agent',
    route: '', saleRouteId: null, sellerId: null, isActive: !showInactive,
  };
}

export const OFFICIAL_CITIES = [
  'GENERAL VILLEGAS', 'EMILIO V. BUNGE', 'BANDERALÓ', 'BERNARDO LARROUDÉ', 'PIEDRITAS',
  'CORONEL CHARLONE', 'BUCHARDO', 'TRES ALGARROBOS', 'CARLOS TEJEDOR', 'FLORENTINO AMEGHINO',
  'BLAQUIER', 'RIVADAVIA', 'FORTÍN OLAVARRÍA', 'INTENDENTE ALVEAR', 'RUFINO',
  'CEBALLOS', 'REALICÓ', 'VILLA SAUZE', 'SANSINENA', 'SANTA ELEODORA',
  'SANTA REGINA', 'VILLA SABOYA', 'CAÑADA SECA', 'CABA',
];

export const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
};

const OFFICIAL_CITY_NORM_MAP = new Map(OFFICIAL_CITIES.map((c) => [normalizeString(c), c]));
const OFFICIAL_CITIES_NORM_SET = new Set(OFFICIAL_CITIES.map((c) => normalizeString(c)));

export const getWhatsAppLink = (phone: string) => {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (!cleanPhone) return '';
  const formatted = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`;
  return `https://wa.me/${formatted}`;
};

export interface TokenizedClientQuery {
  tokens: string[];
  digitTokens: string[];
}

export function normalizePhoneticClientText(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/qu([ei])/g, 'k$1')
    .replace(/c(?=[aou\s]|$)/g, 'k')
    .replace(/v/g, 'b')
    .replace(/z/g, 's')
    .replace(/[cs]?c([ei])/g, 's$1')
    .replace(/y/g, 'i')
    .replace(/ss+/g, 's')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizePhoneticClientQuery(rawQuery: string): TokenizedClientQuery {
  const normalized = normalizePhoneticClientText(rawQuery);
  const tokens = normalized ? normalized.split(' ').filter(Boolean) : [];
  const digitTokens = String(rawQuery || '')
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/\D/g, ''))
    .filter((digits) => digits.length >= 3);
  return { tokens, digitTokens };
}

export function matchesClientSearchQuery(
  persona: any,
  rawQueryOrTokens: string | TokenizedClientQuery,
): boolean {
  const query =
    typeof rawQueryOrTokens === 'string'
      ? tokenizePhoneticClientQuery(rawQueryOrTokens)
      : rawQueryOrTokens;

  if (query.tokens.length === 0 && query.digitTokens.length === 0) {
    return true;
  }

  const cuitRaw = String(persona?.cuit || '');
  const cuitDigits = cuitRaw.replace(/\D/g, '');
  const cuitDashed =
    cuitDigits.length === 11
      ? `${cuitDigits.slice(0, 2)}-${cuitDigits.slice(2, 10)}-${cuitDigits.slice(10)}`
      : '';
  const phoneRaw = String(persona?.phone || '');
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  const digitsHaystack = `${cuitDigits} ${phoneDigits}`;

  const normalizedTarget = normalizePhoneticClientText(
    `${persona?.name || ''} ${cuitRaw} ${cuitDigits} ${cuitDashed} ${persona?.city || ''} ${persona?.barrio || ''} ${persona?.route || ''} ${persona?.address || ''} ${phoneRaw} ${phoneDigits} ${persona?.saleRoute?.name || ''}`,
  );

  const matchesText = query.tokens.every((token) => {
    if (normalizedTarget.includes(token)) return true;
    const tokenDigits = token.replace(/\D/g, '');
    return tokenDigits.length >= 3 && /^[\d.\-]+$/.test(token) && digitsHaystack.includes(tokenDigits);
  });

  if (!matchesText) return false;
  if (query.digitTokens.length === 0) return true;
  return query.digitTokens.every((dt) => digitsHaystack.includes(dt));
}

export function computeClientLocationAndRouteCounts(
  clients: any[],
  personaRoleFilter: string,
  showInactive: boolean,
  availableSaleRoutes: any[],
): {
  cityCounts: Record<string, number>;
  routeCounts: Record<string | number, number>;
  sellerCounts: Record<string | number, number>;
} {
  const cityCounts: Record<string, number> = { ALL: 0, OTRAS: 0 };
  const routeCounts: Record<string | number, number> = { ALL: 0, SIN_RUTA: 0 };
  const sellerCounts: Record<string | number, number> = { ALL: 0, SIN_VENDEDOR: 0 };
  const normalizedRoutes = (availableSaleRoutes || []).map((route) => ({
    id: Number(route.id),
    upperName: (route.name || '').trim().toUpperCase(),
  }));

  for (const c of clients) {
    if (personaRoleFilter === 'client') {
      if (!showInactive && c.isActive === false) continue;
      if (showInactive && c.isActive !== false) continue;
    }

    cityCounts.ALL += 1;
    routeCounts.ALL += 1;
    sellerCounts.ALL += 1;

    if (c.sellerId) {
      const sid = Number(c.sellerId);
      sellerCounts[sid] = (sellerCounts[sid] || 0) + 1;
    } else {
      sellerCounts.SIN_VENDEDOR += 1;
    }

    const normCity = normalizeString(c.city);
    const officialCity = normCity ? OFFICIAL_CITY_NORM_MAP.get(normCity) : null;
    if (officialCity) cityCounts[officialCity] = (cityCounts[officialCity] || 0) + 1;
    else cityCounts.OTRAS += 1;

    if (!c.saleRouteId && (!c.route || c.route.trim() === '')) {
      routeCounts.SIN_RUTA += 1;
      continue;
    }

    const clientRoute = (c.route || '').trim().toUpperCase();
    let matchedRoute = false;
    for (const route of normalizedRoutes) {
      if (
        Number(c.saleRouteId) === route.id ||
        Boolean(route.upperName && clientRoute && (clientRoute === route.upperName || clientRoute.includes(route.upperName)))
      ) {
        routeCounts[route.id] = (routeCounts[route.id] || 0) + 1;
        matchedRoute = true;
        break;
      }
    }
    if (!matchedRoute) routeCounts.SIN_RUTA += 1;
  }

  return { cityCounts, routeCounts, sellerCounts };
}

export interface FilterClientsInMemoryParams {
  personaRoleFilter: string;
  showInactive: boolean;
  selectedCityFilter: string;
  selectedRouteFilter: string;
  selectedSellerFilter?: string;
  searchQuery: string;
  availableSaleRoutes: any[];
}

export function filterClientsInMemory(
  clients: any[],
  params: FilterClientsInMemoryParams,
): any[] {
  const {
    personaRoleFilter,
    showInactive,
    selectedCityFilter,
    selectedRouteFilter,
    selectedSellerFilter = 'ALL',
    searchQuery,
    availableSaleRoutes,
  } = params;
  const normSelectedCity = selectedCityFilter !== 'ALL' ? normalizeString(selectedCityFilter) : '';
  const targetRoute =
    personaRoleFilter === 'client' && selectedRouteFilter !== 'ALL' && selectedRouteFilter !== 'SIN_RUTA'
      ? (availableSaleRoutes || []).find((r) => String(r.id) === String(selectedRouteFilter))
      : null;
  const targetRouteName = targetRoute?.name?.trim().toUpperCase() || '';
  const tokenizedQuery = tokenizePhoneticClientQuery(searchQuery);
  const hasSearch = tokenizedQuery.tokens.length > 0 || tokenizedQuery.digitTokens.length > 0;

  return clients.filter((c: any) => {
    if (personaRoleFilter === 'client') {
      if (!showInactive && c.isActive === false) return false;
      if (showInactive && c.isActive !== false) return false;
    }

    if (selectedCityFilter !== 'ALL') {
      const normCity = normalizeString(c.city);
      if (selectedCityFilter === 'OTRAS') {
        if (c.city && OFFICIAL_CITIES_NORM_SET.has(normCity)) return false;
      } else if (normCity !== normSelectedCity) {
        return false;
      }
    }

    if (personaRoleFilter === 'client' && selectedRouteFilter !== 'ALL') {
      if (selectedRouteFilter === 'SIN_RUTA') {
        if (c.saleRouteId || (c.route && c.route.trim() !== '')) return false;
      } else {
        const clientRoute = (c.route || '').trim().toUpperCase();
        const matchesId = Number(c.saleRouteId) === Number(selectedRouteFilter);
        const matchesName = Boolean(
          targetRouteName && clientRoute && (clientRoute === targetRouteName || clientRoute.includes(targetRouteName)),
        );
        if (!matchesId && !matchesName) return false;
      }
    }

    if (personaRoleFilter === 'client' && selectedSellerFilter !== 'ALL') {
      if (selectedSellerFilter === 'SIN_VENDEDOR') {
        if (c.sellerId) return false;
      } else if (Number(c.sellerId) !== Number(selectedSellerFilter)) {
        return false;
      }
    }

    if (hasSearch && !matchesClientSearchQuery(c, tokenizedQuery)) {
      return false;
    }

    return true;
  });
}
