import { DEPOT_VILLEGAS } from '../../utils/geoUtils';
import { loadOfficialGoogleMaps } from '../../utils/googleMapsLoader';

export const VILLEGAS_DEPOT: [number, number] = [DEPOT_VILLEGAS.lat, DEPOT_VILLEGAS.lng];

export const CITY_BASE_COORDS: Record<string, { lat: number; lng: number }> = {
  'general villegas': { lat: DEPOT_VILLEGAS.lat, lng: DEPOT_VILLEGAS.lng },
  'emilio v. bunge': { lat: -34.764, lng: -63.031 },
  'emilio bunge': { lat: -34.764, lng: -63.031 },
  'piedritas': { lat: -34.887, lng: -62.880 },
  'banderaló': { lat: -35.016, lng: -63.267 },
  'banderalo': { lat: -35.016, lng: -63.267 },
  'coronel charlone': { lat: -34.685, lng: -63.250 },
  'florentino ameghino': { lat: -34.846, lng: -62.468 },
  'blaquier': { lat: -34.680, lng: -62.410 },
  'fortín olavarría': { lat: -35.702, lng: -62.903 },
  'fortin olavarría': { lat: -35.702, lng: -62.903 },
  'fortin': { lat: -35.702, lng: -62.903 },
  'intendente alvear': { lat: -35.238, lng: -63.585 },
  'bernardo larroudé': { lat: -35.027, lng: -63.565 },
  'bernardo larroude': { lat: -35.027, lng: -63.565 },
  'villa sauze': { lat: -35.150, lng: -63.380 },
  'villa saboya': { lat: -34.630, lng: -62.770 },
  'santa regina': { lat: -34.621, lng: -62.969 },
  'tres algarrobos': { lat: -35.185, lng: -62.753 },
  'carlos tejedor': { lat: -35.402, lng: -62.427 },
  'realicó': { lat: -35.037, lng: -64.244 },
  'realico': { lat: -35.037, lng: -64.244 },
  'ceballos': { lat: -35.297, lng: -63.766 },
  'santa eleodora': { lat: -34.851, lng: -62.825 },
  'cañada seca': { lat: -34.805, lng: -62.791 },
  'canada seca': { lat: -34.805, lng: -62.791 },
  'caba': { lat: -34.6037, lng: -58.3816 },
};

const KNOWN_CITIES = [
  { key: 'villegas', name: 'General Villegas' },
  { key: 'bunge', name: 'Emilio V. Bunge' },
  { key: 'piedritas', name: 'Piedritas' },
  { key: 'banderalo', name: 'Banderaló' },
  { key: 'banderaló', name: 'Banderaló' },
  { key: 'charlone', name: 'Coronel Charlone' },
  { key: 'ameghino', name: 'Florentino Ameghino' },
  { key: 'blaquier', name: 'Blaquier' },
  { key: 'fortin', name: 'Fortín Olavarría' },
  { key: 'fortín', name: 'Fortín Olavarría' },
  { key: 'alvear', name: 'Intendente Alvear' },
  { key: 'larroude', name: 'Bernardo Larroudé' },
  { key: 'larroudé', name: 'Bernardo Larroudé' },
  { key: 'sauze', name: 'Villa Sauze' },
  { key: 'saboya', name: 'Villa Saboya' },
  { key: 'regina', name: 'Santa Regina' },
  { key: 'algarrobos', name: 'Tres Algarrobos' },
  { key: 'tejedor', name: 'Carlos Tejedor' },
  { key: 'realico', name: 'Realicó' },
  { key: 'realicó', name: 'Realicó' },
  { key: 'ceballos', name: 'Ceballos' },
  { key: 'eleodora', name: 'Santa Eleodora' },
  { key: 'canada seca', name: 'Cañada Seca' },
  { key: 'cañada seca', name: 'Cañada Seca' },
  { key: 'caba', name: 'CABA' },
];

export interface ClientCoordLookupResult {
  lat: number;
  lng: number;
  address: string;
  hasExactGps: boolean;
}

export function detectRealCity(persona: any): string {
  const city = (persona?.city || '').trim().toLowerCase();
  const route = (persona?.route || '').trim().toLowerCase();
  const address = (persona?.address || '').trim().toLowerCase();

  for (const c of KNOWN_CITIES) {
    if (city.includes(c.key)) return c.name;
  }

  if (city === 'otros' || !city) {
    for (const c of KNOWN_CITIES) {
      if (route.includes(c.key)) return c.name;
    }
    for (const c of KNOWN_CITIES) {
      if (address.includes(c.key)) return c.name;
    }
  }

  return persona?.city || 'General Villegas';
}

export function getCityBaseCoords(persona: any): { lat: number; lng: number } {
  const cityName = detectRealCity(persona).toLowerCase();
  for (const key in CITY_BASE_COORDS) {
    if (cityName.includes(key) || key.includes(cityName)) {
      return CITY_BASE_COORDS[key];
    }
  }
  return { lat: DEPOT_VILLEGAS.lat, lng: DEPOT_VILLEGAS.lng };
}

export function cleanStreetAddress(address: string, cityName: string): string {
  if (!address) return '';
  let clean = address.trim();

  clean = clean.replace(/,\s*buenos\s*aires/gi, '');
  const escapedCity = cityName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const cityRegex = new RegExp(`,\\s*${escapedCity}`, 'gi');
  clean = clean.replace(cityRegex, '');

  const placeholders = [
    'zona urbana', 'zona rural', 's/n', 'sin numero', 'sin nro',
    'rural', 'acceso', 'zona quintas', 'conocido', 'acceso principal',
  ];

  const lower = clean.toLowerCase();
  for (const p of placeholders) {
    if (lower === p || lower === `${p}.`) return '';
  }

  return clean;
}

export function applyJitter(lat: number, lng: number, id: number): { lat: number; lng: number } {
  if (!id) return { lat, lng };
  const offsetIndex = id % 8;
  const angle = (offsetIndex * Math.PI) / 4;
  const radius = 0.00045;
  return {
    lat: lat + Math.sin(angle) * radius,
    lng: lng + Math.cos(angle) * radius,
  };
}

function formatDisplayAddress(persona: any, fallbackCity: string): string {
  const street = typeof persona?.address === 'string' ? persona.address.trim() : '';
  if (!street) return fallbackCity;
  if (fallbackCity && !street.toLowerCase().includes(fallbackCity.toLowerCase())) {
    return `${street}, ${fallbackCity}`;
  }
  return street;
}

export function getClientCoords(
  clientId: number,
  clientName: string,
  persona?: any,
  cache?: Record<number, { lat: number; lng: number; address: string; hasExactGps?: boolean }>,
): ClientCoordLookupResult {
  const city = detectRealCity(persona);
  const pLat = persona?.latitude !== null && persona?.latitude !== undefined ? Number(persona.latitude) : NaN;
  const pLng = persona?.longitude !== null && persona?.longitude !== undefined ? Number(persona.longitude) : NaN;

  if (Number.isFinite(pLat) && Number.isFinite(pLng) && pLat !== 0 && pLng !== 0) {
    return {
      lat: pLat,
      lng: pLng,
      address: formatDisplayAddress(persona, city),
      hasExactGps: true,
    };
  }

  if (cache && cache[clientId]) {
    return {
      lat: cache[clientId].lat,
      lng: cache[clientId].lng,
      address: cache[clientId].address || formatDisplayAddress(persona, city),
      hasExactGps: Boolean(cache[clientId].hasExactGps),
    };
  }

  const hash = (clientName || 'C').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const base = getCityBaseCoords(persona);
  const offset = applyJitter(base.lat, base.lng, clientId || hash || 1);

  return {
    lat: offset.lat,
    lng: offset.lng,
    address: formatDisplayAddress(persona, city),
    hasExactGps: false,
  };
}

export function solveTSP<T extends { lat: number; lng: number }>(start: [number, number], targets: T[]): T[] {
  const unvisited = [...targets];
  const route: T[] = [];
  let currentPos = start;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = Math.hypot(unvisited[i].lat - currentPos[0], unvisited[i].lng - currentPos[1]);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }

    const nextNode = unvisited.splice(nearestIdx, 1)[0];
    route.push(nextNode);
    currentPos = [nextNode.lat, nextNode.lng];
  }

  return route;
}

export async function fetchOSRMRoute(points: [number, number][]): Promise<[number, number][]> {
  return points;
}

export const loadGoogleMapsScript = (apiKey: string, callback: () => void) => {
  loadOfficialGoogleMaps(apiKey)
    .then(() => callback())
    .catch(() => {});
};
