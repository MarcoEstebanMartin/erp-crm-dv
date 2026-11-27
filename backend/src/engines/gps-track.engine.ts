import { toDecimal } from '../core/money';
import { haversineDistanceMeters, isValidCoord } from './live-map.engine';

export const DEFAULT_STOP_RADIUS_METERS = 60;
export const DEFAULT_MIN_STOP_DURATION_SEC = 180; // 3 minutos
export const DEFAULT_CLIENT_MATCH_RADIUS_METERS = 120;
export const DEFAULT_MIN_MOVE_METERS = 15;
export const DEFAULT_MAX_JUMP_SPEED_KMH = 160;
const ARGENTINA_OFFSET_HOURS = -3;

export interface RawGpsTrackPing {
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  recordedAt: Date | string;
}

export interface GpsTrackClientRef {
  id: number;
  name: string;
  address?: string | null;
  city?: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface GpsTrackStop {
  stopNumber: number;
  lat: number;
  lng: number;
  arrivedAt: string;
  departedAt: string;
  durationSec: number;
  durationLabel: string;
  nearestClient: {
    clientId: number;
    name: string;
    address: string | null;
    distanceMeters: number;
  } | null;
}

export interface GpsTrackAnalysis {
  pointCount: number;
  totalDistanceKm: number;
  totalDurationSec: number;
  movingDurationSec: number;
  stoppedDurationSec: number;
  maxSpeedKmh: number | null;
  startedAt: string | null;
  endedAt: string | null;
  startPoint: { lat: number; lng: number } | null;
  endPoint: { lat: number; lng: number } | null;
  trail: [number, number][];
  stops: GpsTrackStop[];
}

export interface GpsTrackAnalysisOptions {
  stopRadiusMeters?: number;
  minStopDurationSec?: number;
  clientMatchRadiusMeters?: number;
  minMoveMeters?: number;
  maxJumpSpeedKmh?: number;
}

export function formatDurationEs(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remSec = sec % 60;

  if (hours > 0) {
    return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
  }
  if (mins > 0) {
    return remSec > 0 ? `${mins} min ${remSec} s` : `${mins} min`;
  }
  return `${remSec} s`;
}

export function parseArgentinaTimeRange(
  dateKey: string,
  fromTime?: string,
  toTime?: string,
): { startUtc: Date; endUtc: Date; fromTime: string; toTime: string } {
  const [year, month, day] = dateKey.split('-').map((n) => parseInt(n, 10));
  const validTime = (val?: string) => (val && /^([01]\d|2[0-3]):([0-5]\d)$/.test(val) ? val : null);

  const safeFrom = validTime(fromTime) ?? '00:00';
  const safeTo = validTime(toTime) ?? '23:59';

  const [fromH, fromM] = safeFrom.split(':').map((n) => parseInt(n, 10));
  const [toH, toM] = safeTo.split(':').map((n) => parseInt(n, 10));

  const startUtc = new Date(Date.UTC(year, month - 1, day, fromH - ARGENTINA_OFFSET_HOURS, fromM, 0, 0));
  const endUtc = new Date(Date.UTC(year, month - 1, day, toH - ARGENTINA_OFFSET_HOURS, toM, 59, 999));

  if (endUtc.getTime() < startUtc.getTime()) {
    return {
      startUtc: new Date(Date.UTC(year, month - 1, day, -ARGENTINA_OFFSET_HOURS, 0, 0, 0)),
      endUtc: new Date(Date.UTC(year, month - 1, day, 23 - ARGENTINA_OFFSET_HOURS, 59, 59, 999)),
      fromTime: '00:00',
      toTime: '23:59',
    };
  }

  return { startUtc, endUtc, fromTime: safeFrom, toTime: safeTo };
}

function findNearestClient(
  lat: number,
  lng: number,
  clients: GpsTrackClientRef[],
  maxRadiusMeters: number,
): GpsTrackStop['nearestClient'] {
  let best: GpsTrackStop['nearestClient'] = null;

  for (const client of clients) {
    if (!isValidCoord(client.latitude, client.longitude)) continue;
    const dist = haversineDistanceMeters(lat, lng, client.latitude as number, client.longitude as number);
    if (dist <= maxRadiusMeters && (!best || dist < best.distanceMeters)) {
      best = {
        clientId: client.id,
        name: client.name,
        address: client.address ?? client.city ?? null,
        distanceMeters: dist,
      };
    }
  }

  return best;
}

export function analyzeGpsTrack(input: {
  pings: RawGpsTrackPing[];
  clients?: GpsTrackClientRef[];
  options?: GpsTrackAnalysisOptions;
}): GpsTrackAnalysis {
  const stopRadius = input.options?.stopRadiusMeters ?? DEFAULT_STOP_RADIUS_METERS;
  const minStopSec = input.options?.minStopDurationSec ?? DEFAULT_MIN_STOP_DURATION_SEC;
  const clientMatchRadius = input.options?.clientMatchRadiusMeters ?? DEFAULT_CLIENT_MATCH_RADIUS_METERS;
  const minMoveMeters = input.options?.minMoveMeters ?? DEFAULT_MIN_MOVE_METERS;
  const maxJumpSpeedKmh = input.options?.maxJumpSpeedKmh ?? DEFAULT_MAX_JUMP_SPEED_KMH;
  const clients = input.clients ?? [];

  const parsed = input.pings
    .filter((p) => isValidCoord(p.latitude, p.longitude))
    .map((p) => ({
      lat: p.latitude,
      lng: p.longitude,
      speed: typeof p.speed === 'number' && Number.isFinite(p.speed) ? p.speed : null,
      ts: p.recordedAt instanceof Date ? p.recordedAt.getTime() : new Date(p.recordedAt).getTime(),
    }))
    .filter((p) => Number.isFinite(p.ts))
    .sort((a, b) => a.ts - b.ts);

  // Filtrar picos imposibles (teletransportación por rebote de antena)
  const clean: typeof parsed = [];
  for (const pt of parsed) {
    const prev = clean[clean.length - 1];
    if (prev) {
      const dtSec = (pt.ts - prev.ts) / 1000;
      const distM = haversineDistanceMeters(prev.lat, prev.lng, pt.lat, pt.lng);
      if (dtSec > 0 && distM > 500) {
        const impliedKmh = (distM / 1000) / (dtSec / 3600);
        if (impliedKmh > maxJumpSpeedKmh) {
          continue;
        }
      }
    }
    clean.push(pt);
  }

  if (clean.length === 0) {
    return {
      pointCount: 0,
      totalDistanceKm: 0,
      totalDurationSec: 0,
      movingDurationSec: 0,
      stoppedDurationSec: 0,
      maxSpeedKmh: null,
      startedAt: null,
      endedAt: null,
      startPoint: null,
      endPoint: null,
      trail: [],
      stops: [],
    };
  }

  // Distancia total y velocidad máxima
  let totalMeters = 0;
  let maxSpeedKmh: number | null = null;

  for (let i = 0; i < clean.length; i += 1) {
    const curr = clean[i];
    if (curr.speed !== null && (maxSpeedKmh === null || curr.speed > maxSpeedKmh)) {
      maxSpeedKmh = Math.round(curr.speed);
    }
    if (i > 0) {
      const prev = clean[i - 1];
      const segMeters = haversineDistanceMeters(prev.lat, prev.lng, curr.lat, curr.lng);
      if (segMeters >= minMoveMeters) {
        totalMeters += segMeters;
      }
    }
  }

  // Detección de paradas (stay-point clustering)
  const stops: GpsTrackStop[] = [];
  let clusterStart = 0;

  while (clusterStart < clean.length) {
    let sumLat = clean[clusterStart].lat;
    let sumLng = clean[clusterStart].lng;
    let count = 1;
    let clusterEnd = clusterStart;

    for (let j = clusterStart + 1; j < clean.length; j += 1) {
      const centroidLat = sumLat / count;
      const centroidLng = sumLng / count;
      const dist = haversineDistanceMeters(centroidLat, centroidLng, clean[j].lat, clean[j].lng);

      if (dist <= stopRadius) {
        sumLat += clean[j].lat;
        sumLng += clean[j].lng;
        count += 1;
        clusterEnd = j;
      } else {
        break;
      }
    }

    const durationSec = Math.round((clean[clusterEnd].ts - clean[clusterStart].ts) / 1000);
    if (durationSec >= minStopSec) {
      const avgLat = Number((sumLat / count).toFixed(6));
      const avgLng = Number((sumLng / count).toFixed(6));
      stops.push({
        stopNumber: stops.length + 1,
        lat: avgLat,
        lng: avgLng,
        arrivedAt: new Date(clean[clusterStart].ts).toISOString(),
        departedAt: new Date(clean[clusterEnd].ts).toISOString(),
        durationSec,
        durationLabel: formatDurationEs(durationSec),
        nearestClient: findNearestClient(avgLat, avgLng, clients, clientMatchRadius),
      });
      clusterStart = clusterEnd + 1;
    } else {
      clusterStart += 1;
    }
  }

  const first = clean[0];
  const last = clean[clean.length - 1];
  const totalDurationSec = Math.max(0, Math.round((last.ts - first.ts) / 1000));
  const stoppedDurationSec = stops.reduce((acc, s) => acc + s.durationSec, 0);
  const movingDurationSec = Math.max(0, totalDurationSec - stoppedDurationSec);
  const totalDistanceKm = toDecimal(totalMeters).div(1000).toDecimalPlaces(1).toNumber();

  return {
    pointCount: clean.length,
    totalDistanceKm,
    totalDurationSec,
    movingDurationSec,
    stoppedDurationSec,
    maxSpeedKmh,
    startedAt: new Date(first.ts).toISOString(),
    endedAt: new Date(last.ts).toISOString(),
    startPoint: { lat: first.lat, lng: first.lng },
    endPoint: { lat: last.lat, lng: last.lng },
    trail: clean.map((p) => [p.lat, p.lng]),
    stops,
  };
}
