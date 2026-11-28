import {
  ARGENTINA_DAYS_ES,
  type ArgentinaDateWindow,
  type LiveMapDistanceStatus,
} from './live-map.types';

export const PROXIMITY_OK_METERS = 150;
const ARGENTINA_OFFSET_HOURS = -3;

export function isValidCoord(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function classifyDistanceStatus(
  eventLat: number | null | undefined,
  eventLng: number | null | undefined,
  clientLat: number | null | undefined,
  clientLng: number | null | undefined,
  thresholdMeters = PROXIMITY_OK_METERS,
): { distanceMeters: number | null; status: LiveMapDistanceStatus } {
  if (!isValidCoord(eventLat, eventLng)) {
    return { distanceMeters: null, status: 'EVENT_NO_GPS' };
  }
  if (!isValidCoord(clientLat, clientLng)) {
    return { distanceMeters: null, status: 'CLIENT_NO_GPS' };
  }
  const distanceMeters = haversineDistanceMeters(
    eventLat as number,
    eventLng as number,
    clientLat as number,
    clientLng as number,
  );
  return {
    distanceMeters,
    status: distanceMeters <= thresholdMeters ? 'OK' : 'FAR',
  };
}

function getArgentinaTodayKey(now: Date): string {
  const shifted = new Date(now.getTime() + ARGENTINA_OFFSET_HOURS * 3_600_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseArgentinaDateWindow(dateStr?: string, now = new Date()): ArgentinaDateWindow {
  const todayKey = getArgentinaTodayKey(now);
  const dateKey = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : todayKey;
  const [year, month, day] = dateKey.split('-').map((n) => parseInt(n, 10));

  // Argentina is UTC-3 year-round (no DST): 00:00 ART = 03:00 UTC
  const startUtc = new Date(Date.UTC(year, month - 1, day, -ARGENTINA_OFFSET_HOURS, 0, 0, 0));
  const endUtc = new Date(Date.UTC(year, month - 1, day, 23 - ARGENTINA_OFFSET_HOURS, 59, 59, 999));
  const dayOfWeekEs = ARGENTINA_DAYS_ES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  return {
    dateKey,
    startUtc,
    endUtc,
    dayOfWeekEs,
    isToday: dateKey === todayKey,
  };
}
