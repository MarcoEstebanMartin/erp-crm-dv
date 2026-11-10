export interface GeoPoint {
  lat: number;
  lng: number;
}

export type CheckInProximityStatus = 'ON_SITE' | 'NEARBY' | 'REMOTE' | 'UNKNOWN';

export const DEPOT_VILLEGAS_COORDS: GeoPoint = {
  lat: -35.0328,
  lng: -63.0125,
};

export const OFFICIAL_CITY_COORDS: Record<string, GeoPoint> = {
  'GENERAL VILLEGAS': { lat: -35.0328, lng: -63.0125 },
  'EMILIO V. BUNGE': { lat: -34.7975, lng: -62.9564 },
  'BANDERALÓ': { lat: -35.0189, lng: -63.3636 },
  'BANDERALO': { lat: -35.0189, lng: -63.3636 },
  'BERNARDO LARROUDÉ': { lat: -35.0222, lng: -63.5825 },
  'BERNARDO LARROUDE': { lat: -35.0222, lng: -63.5825 },
  'PIEDRITAS': { lat: -34.7658, lng: -62.9903 },
  'CORONEL CHARLONE': { lat: -34.6231, lng: -63.3792 },
  'BUCHARDO': { lat: -34.7239, lng: -63.5078 },
  'TRES ALGARROBOS': { lat: -35.1956, lng: -62.7717 },
  'CARLOS TEJEDOR': { lat: -35.3917, lng: -62.4194 },
  'FLORENTINO AMEGHINO': { lat: -34.8439, lng: -62.4667 },
  'AMEGHINO': { lat: -34.8439, lng: -62.4667 },
  'BLAQUIER': { lat: -34.7069, lng: -62.4875 },
  'RIVADAVIA': { lat: -35.4889, lng: -62.9742 },
  'AMERICA': { lat: -35.4889, lng: -62.9742 },
  'AMÉRICA': { lat: -35.4889, lng: -62.9742 },
  'FORTÍN OLAVARRÍA': { lat: -35.7025, lng: -63.0236 },
  'FORTIN OLAVARRIA': { lat: -35.7025, lng: -63.0236 },
  'INTENDENTE ALVEAR': { lat: -35.2333, lng: -63.5833 },
  'RUFINO': { lat: -34.2681, lng: -62.7125 },
  'CEBALLOS': { lat: -35.175, lng: -63.6819 },
  'REALICÓ': { lat: -35.0369, lng: -64.2464 },
  'REALICO': { lat: -35.0369, lng: -64.2464 },
  'VILLA SAUZE': { lat: -35.205, lng: -63.3683 },
  'SANSINENA': { lat: -35.2833, lng: -63.2083 },
  'SANTA ELEODORA': { lat: -34.7736, lng: -62.7058 },
  'SANTA REGINA': { lat: -34.5444, lng: -63.1681 },
  'VILLA SABOYA': { lat: -34.5667, lng: -63.45 },
  'CAÑADA SECA': { lat: -34.4058, lng: -63.1519 },
  'GENERAL PINTO': { lat: -34.7644, lng: -61.8908 },
  'LINCOLN': { lat: -34.8667, lng: -61.5292 },
  'PEHUAJO': { lat: -35.8117, lng: -61.8986 },
  'PEHUAJÓ': { lat: -35.8117, lng: -61.8986 },
  'TRENQUE LAUQUEN': { lat: -35.9714, lng: -62.7336 },
  '30 DE AGOSTO': { lat: -36.2783, lng: -62.5453 },
  'LABOULAYE': { lat: -34.1267, lng: -63.3911 },
  'GENERAL PICO': { lat: -35.6566, lng: -63.7568 },
  'CABA': { lat: -34.6037, lng: -58.3816 },
};

/**
 * Calcula la distancia en metros enteros entre dos coordenadas GPS usando la fórmula de Haversine.
 */
export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Clasifica la proximidad de un vendedor respecto al local del cliente.
 */
export function classifyCheckInProximity(distanceMeters: number | null): CheckInProximityStatus {
  if (distanceMeters === null || !Number.isFinite(distanceMeters)) return 'UNKNOWN';
  if (distanceMeters <= 250) return 'ON_SITE';
  if (distanceMeters <= 2000) return 'NEARBY';
  return 'REMOTE';
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Resuelve las coordenadas de un cliente:
 * 1. Si tiene `lat` y `lng` exactos guardados en su ficha (`isExactPin: true`), los devuelve.
 * 2. Si tiene dirección calle/altura (ej: "PARRA 160" o "MORENO 856"), la proyecta sobre el damero urbano
 *    real de la localidad.
 * 3. Si dice "Sin dirección", lo ubica sobre la cuadrícula céntrica de su localidad.
 */
export function resolveCustomerCoordinates(customer: {
  legacyId: number;
  city: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}): { lat: number; lng: number; isExactPin: boolean } {
  if (
    typeof customer.lat === 'number' &&
    typeof customer.lng === 'number' &&
    Number.isFinite(customer.lat) &&
    Number.isFinite(customer.lng)
  ) {
    return {
      lat: Number(customer.lat.toFixed(6)),
      lng: Number(customer.lng.toFixed(6)),
      isExactPin: true,
    };
  }

  const cityKey = (customer.city || 'GENERAL VILLEGAS').trim().toUpperCase();
  const base = OFFICIAL_CITY_COORDS[cityKey] ?? DEPOT_VILLEGAS_COORDS;
  const rawAddr = (customer.address || '').trim().toUpperCase();
  const hasStreet = rawAddr.length > 3 && !rawAddr.includes('SIN DIRECC');

  if (hasStreet) {
    const numMatch = rawAddr.match(/(\d{1,4})/);
    const streetNum = numMatch ? Number(numMatch[1]) : (customer.legacyId % 900) + 100;
    const streetName = rawAddr.replace(/\d+/g, '').trim();
    const streetHash = hashString(streetName || String(customer.legacyId));

    const blockOffsetA = ((streetHash % 15) - 7) * 0.00105;
    const blockOffsetB =
      ((Math.floor(streetNum / 100) % 14) - 6) * 0.00105 + (streetNum % 100) * 0.000009;
    const isHorizontal = streetHash % 2 === 0;

    const dLat = isHorizontal ? blockOffsetA : blockOffsetB;
    const dLng = isHorizontal ? blockOffsetB * 1.18 : blockOffsetA * 1.18;

    return {
      lat: Number((base.lat + dLat).toFixed(6)),
      lng: Number((base.lng + dLng).toFixed(6)),
      isExactPin: false,
    };
  }

  const idx = Math.abs(customer.legacyId || 1);
  const gridRow = ((idx % 9) - 4) * 0.0011;
  const gridCol = ((Math.floor(idx / 9) % 9) - 4) * 0.0013;

  return {
    lat: Number((base.lat + gridRow).toFixed(6)),
    lng: Number((base.lng + gridCol).toFixed(6)),
    isExactPin: false,
  };
}
