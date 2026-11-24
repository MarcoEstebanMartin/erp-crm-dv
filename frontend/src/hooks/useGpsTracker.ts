import { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';

export const MAX_ACCEPTED_GPS_ACCURACY_METERS = 150;

export function shouldEmitRouteGps(params: {
  userRole?: string | null;
  routeStatus?: string | null;
  custodyStatus?: string | null;
}): boolean {
  if (params.userRole !== 'REPARTO') return false;
  return params.routeStatus === 'IN_TRANSIT' || params.custodyStatus === 'LOADED_IN_TRANSIT';
}

export function shouldAcceptGpsReading(params: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  lastCoords: { latitude: number; longitude: number } | null;
  lastPingAt: number;
  now: number;
  intervalMs: number;
}): boolean {
  if (!Number.isFinite(params.latitude) || !Number.isFinite(params.longitude)) {
    return false;
  }
  if (
    params.accuracy !== null &&
    params.accuracy !== undefined &&
    Number.isFinite(params.accuracy) &&
    params.accuracy > MAX_ACCEPTED_GPS_ACCURACY_METERS
  ) {
    return false;
  }
  if (params.lastCoords) {
    const dLat = Math.abs(params.latitude - params.lastCoords.latitude);
    const dLng = Math.abs(params.longitude - params.lastCoords.longitude);
    if (
      dLat < 0.00025 &&
      dLng < 0.00025 &&
      params.lastPingAt > 0 &&
      params.now - params.lastPingAt < params.intervalMs * 3
    ) {
      return false;
    }
  }
  return true;
}

interface UseGpsTrackerOptions {
  activeRouteId: number | null | undefined;
  isActive: boolean;
  intervalMs?: number; // Frecuencia de envío en milisegundos (por defecto 60.000 ms = 60s)
}

interface UseGpsTrackerResult {
  isTracking: boolean;
  lastPingTime: Date | null;
  lastCoords: { latitude: number; longitude: number; speed: number | null } | null;
  gpsError: string | null;
}

export function useGpsTracker({
  activeRouteId,
  isActive,
  intervalMs = 60000
}: UseGpsTrackerOptions): UseGpsTrackerResult {
  const [isTracking, setIsTracking] = useState(false);
  const [lastPingTime, setLastPingTime] = useState<Date | null>(null);
  const [lastCoords, setLastCoords] = useState<{ latitude: number; longitude: number; speed: number | null } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const lastCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastPingAtRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive || !activeRouteId) {
      setIsTracking(false);
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsError('El navegador o dispositivo no soporta geolocalización.');
      setIsTracking(false);
      return;
    }

    setIsTracking(true);
    setGpsError(null);

    const sendGpsPing = (position: GeolocationPosition) => {
      const { latitude, longitude, speed, heading, accuracy } = position.coords;

      if (
        !shouldAcceptGpsReading({
          latitude,
          longitude,
          accuracy,
          lastCoords: lastCoordsRef.current,
          lastPingAt: lastPingAtRef.current,
          now: Date.now(),
          intervalMs,
        })
      ) {
        return;
      }

      const speedKmH = speed !== null && speed !== undefined ? Math.round(speed * 3.6) : null;

      api.recordRouteGpsPing(activeRouteId, {
        latitude,
        longitude,
        speed: speedKmH,
        heading: heading || null
      })
      .then(() => {
        const now = new Date();
        lastPingAtRef.current = now.getTime();
        setLastPingTime(now);
        setLastCoords({ latitude, longitude, speed: speedKmH });
        lastCoordsRef.current = { latitude, longitude };
        setGpsError(null);
      })
      .catch((err: any) => {
        // Registro silencioso en consola para no interrumpir al chofer
        console.warn('[GPS Tracker] Error al sincronizar ubicación:', err?.message || err);
      });
    };

    const handlePositionError = (error: GeolocationPositionError) => {
      let msg = 'Error desconocido de GPS.';
      if (error.code === error.PERMISSION_DENIED) {
        msg = 'Permiso de GPS denegado por el usuario o navegador.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        msg = 'Señal de GPS no disponible temporalmente.';
      } else if (error.code === error.TIMEOUT) {
        msg = 'Tiempo de espera de GPS agotado.';
      }
      setGpsError(msg);
      console.warn('[GPS Tracker]', msg);
    };

    const pollOnce = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      navigator.geolocation.getCurrentPosition(sendGpsPing, handlePositionError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      });
    };

    pollOnce();
    const timer = setInterval(pollOnce, intervalMs);

    return () => {
      clearInterval(timer);
      setIsTracking(false);
    };
  }, [activeRouteId, isActive, intervalMs]);

  return {
    isTracking,
    lastPingTime,
    lastCoords,
    gpsError
  };
}
