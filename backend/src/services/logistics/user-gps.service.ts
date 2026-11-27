import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';

export const MAX_USER_GPS_ACCURACY_METERS = 150;
const MAX_FUTURE_DRIFT_MS = 5 * 60_000;
const MAX_PAST_AGE_MS = 7 * 24 * 3_600_000;
const MIN_GAP_BETWEEN_PINGS_MS = 5_000;

export interface UserGpsPingInput {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  source?: 'ERP_APP' | 'TRACCAR' | 'OTHER';
  recordedAt?: string | null;
}

export function normalizeUserGpsPings(
  pings: UserGpsPingInput[],
  now = new Date(),
): {
  accepted: Array<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
    source: string;
    recordedAt: Date;
  }>;
  ignored: number;
} {
  const nowMs = now.getTime();
  const candidates: Array<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
    source: string;
    recordedAt: Date;
  }> = [];

  let ignored = 0;

  for (const raw of pings) {
    const lat = Number(raw.latitude);
    const lng = Number(raw.longitude);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      (lat === 0 && lng === 0)
    ) {
      ignored += 1;
      continue;
    }

    const accuracy =
      raw.accuracy !== null && raw.accuracy !== undefined && Number.isFinite(Number(raw.accuracy))
        ? Number(raw.accuracy)
        : null;

    if (accuracy !== null && (accuracy < 0 || accuracy > MAX_USER_GPS_ACCURACY_METERS)) {
      ignored += 1;
      continue;
    }

    const speed =
      raw.speed !== null && raw.speed !== undefined && Number.isFinite(Number(raw.speed))
        ? Math.max(0, Math.min(250, Number(raw.speed)))
        : null;

    const heading =
      raw.heading !== null && raw.heading !== undefined && Number.isFinite(Number(raw.heading))
        ? Math.max(0, Math.min(360, Number(raw.heading)))
        : null;

    let recordedAt = now;
    if (raw.recordedAt) {
      const parsed = new Date(raw.recordedAt);
      const parsedMs = parsed.getTime();
      if (
        !Number.isNaN(parsedMs) &&
        parsedMs <= nowMs + MAX_FUTURE_DRIFT_MS &&
        parsedMs >= nowMs - MAX_PAST_AGE_MS
      ) {
        recordedAt = parsed;
      }
    }

    candidates.push({
      latitude: lat,
      longitude: lng,
      accuracy,
      speed,
      heading,
      source: raw.source || 'ERP_APP',
      recordedAt,
    });
  }

  candidates.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  const accepted: typeof candidates = [];
  for (const item of candidates) {
    const prev = accepted[accepted.length - 1];
    if (prev && item.recordedAt.getTime() - prev.recordedAt.getTime() < MIN_GAP_BETWEEN_PINGS_MS) {
      ignored += 1;
      continue;
    }
    accepted.push(item);
  }

  return { accepted, ignored };
}

export const userGpsService = {
  async recordUserGpsPings(userId: number, pings: UserGpsPingInput[]) {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError('Usuario inválido para registrar GPS.', 400);
    }

    const { accepted, ignored } = normalizeUserGpsPings(pings);

    if (accepted.length === 0) {
      return { accepted: 0, ignored };
    }

    await prisma.userGpsPing.createMany({
      data: accepted.map((p) => ({
        userId,
        latitude: p.latitude,
        longitude: p.longitude,
        accuracy: p.accuracy,
        speed: p.speed,
        heading: p.heading,
        source: p.source,
        recordedAt: p.recordedAt,
      })),
    });

    return {
      accepted: accepted.length,
      ignored,
    };
  },
};
