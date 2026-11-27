import { useEffect, useRef } from 'react';
import { api } from '../utils/api';

export const USER_GPS_INTERVAL_MS = 30_000;
export const USER_GPS_HEARTBEAT_MULTIPLIER = 6; // 3 min stationary heartbeat
export const USER_GPS_MAX_ACCURACY_METERS = 150;
export const USER_GPS_MIN_MOVEMENT_DEG = 0.00018; // ~20 metros
export const USER_GPS_QUEUE_STORAGE_KEY = 'dv_user_gps_queue_v1';
export const USER_GPS_MAX_QUEUED_PINGS = 200;
const USER_GPS_BATCH_LIMIT = 50;

export interface UserGpsPingPayload {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  source: 'ERP_APP';
  recordedAt: string;
}

export interface TrackableUserLike {
  id?: number;
  role?: string | null;
  permissions?: {
    canDeliver?: boolean;
    canSell?: boolean;
  } | null;
}

/**
 * Emite GPS automático para personal de calle:
 * - Todos los VENDEDOR
 * - Cualquier usuario con permiso canDeliver (choferes / reparto)
 * Evita registrar PCs de oficina (ADMIN, FACTURACION, DEPOSITO puro).
 */
export function shouldTrackUserGps(user: TrackableUserLike | null | undefined): boolean {
  if (!user || !user.id) return false;
  if (user.role === 'VENDEDOR') return true;
  if (user.role === 'DEPOSITO' && Boolean(user.permissions?.canDeliver)) return true;
  return false;
}

export function shouldAcceptUserGpsReading(params: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  lastCoords: { latitude: number; longitude: number } | null;
  lastAcceptedAt: number;
  now: number;
  intervalMs: number;
  force?: boolean;
}): boolean {
  const { latitude, longitude, accuracy, lastCoords, lastAcceptedAt, now, intervalMs, force } = params;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;

  if (
    accuracy !== null &&
    accuracy !== undefined &&
    Number.isFinite(accuracy) &&
    accuracy > USER_GPS_MAX_ACCURACY_METERS
  ) {
    return false;
  }

  if (force || !lastCoords || lastAcceptedAt <= 0) {
    return true;
  }

  const dLat = Math.abs(latitude - lastCoords.latitude);
  const dLng = Math.abs(longitude - lastCoords.longitude);
  const movedEnough = dLat >= USER_GPS_MIN_MOVEMENT_DEG || dLng >= USER_GPS_MIN_MOVEMENT_DEG;

  if (movedEnough) return true;

  // Heartbeat estacionario cada ~3 min para medir duración real de paradas
  return now - lastAcceptedAt >= intervalMs * USER_GPS_HEARTBEAT_MULTIPLIER;
}

export function readQueuedUserGpsPings(storage?: Pick<Storage, 'getItem'> | null): UserGpsPingPayload[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(USER_GPS_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is UserGpsPingPayload =>
        item &&
        typeof item.latitude === 'number' &&
        typeof item.longitude === 'number' &&
        typeof item.recordedAt === 'string',
    );
  } catch {
    return [];
  }
}

export function writeQueuedUserGpsPings(
  pings: UserGpsPingPayload[],
  storage?: Pick<Storage, 'setItem' | 'removeItem'> | null,
): void {
  if (!storage) return;
  try {
    if (pings.length === 0) {
      storage.removeItem(USER_GPS_QUEUE_STORAGE_KEY);
      return;
    }
    const trimmed = pings.slice(-USER_GPS_MAX_QUEUED_PINGS);
    storage.setItem(USER_GPS_QUEUE_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignorar errores de cuota de almacenamiento
  }
}

export function useUserGpsTracker(user: TrackableUserLike | null | undefined): void {
  const enabled = shouldTrackUserGps(user);
  const userId = user?.id ?? null;

  const lastCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastAcceptedAtRef = useRef<number>(0);
  const isFlushingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled || !userId) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    const storage = typeof window !== 'undefined' ? window.localStorage : null;

    const flushQueue = async () => {
      if (isFlushingRef.current) return;
      const queued = readQueuedUserGpsPings(storage);
      if (queued.length === 0) return;

      isFlushingRef.current = true;
      try {
        const batch = queued.slice(0, USER_GPS_BATCH_LIMIT);
        await api.recordUserGpsPings(batch);
        const remaining = readQueuedUserGpsPings(storage).slice(batch.length);
        writeQueuedUserGpsPings(remaining, storage);
      } catch {
        // Sin señal: los pings quedan en cola para el próximo reintento
      } finally {
        isFlushingRef.current = false;
      }
    };

    const enqueueAndFlush = (ping: UserGpsPingPayload) => {
      const current = readQueuedUserGpsPings(storage);
      writeQueuedUserGpsPings([...current, ping], storage);
      void flushQueue();
    };

    const capturePosition = (force = false) => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy, speed, heading } = position.coords;
          const now = Date.now();

          if (
            !shouldAcceptUserGpsReading({
              latitude,
              longitude,
              accuracy,
              lastCoords: lastCoordsRef.current,
              lastAcceptedAt: lastAcceptedAtRef.current,
              now,
              intervalMs: USER_GPS_INTERVAL_MS,
              force,
            })
          ) {
            void flushQueue();
            return;
          }

          lastCoordsRef.current = { latitude, longitude };
          lastAcceptedAtRef.current = now;

          const speedKmH =
            speed !== null && speed !== undefined && Number.isFinite(speed)
              ? Math.max(0, Math.round(speed * 3.6))
              : null;

          const headingDeg =
            heading !== null && heading !== undefined && Number.isFinite(heading)
              ? Math.round(heading)
              : null;

          enqueueAndFlush({
            latitude,
            longitude,
            accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
            speed: speedKmH,
            heading: headingDeg,
            source: 'ERP_APP',
            recordedAt: new Date(now).toISOString(),
          });
        },
        () => {
          // Silencioso: no interrumpir la operación del vendedor/chofer
        },
        {
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 15_000,
        },
      );
    };

    // 1. Captura inmediata al abrir la app o iniciar sesión
    capturePosition(true);

    // 2. Muestreo periódico mientras la app está abierta
    const timer = window.setInterval(() => capturePosition(false), USER_GPS_INTERVAL_MS);

    // 3. Captura inmediata al desbloquear el celular o volver a la app
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        capturePosition(true);
      }
    };
    const handleWindowFocus = () => capturePosition(false);
    const handleOnline = () => {
      void flushQueue();
      capturePosition(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled, userId]);
}
