import { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';

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
      const { latitude, longitude, speed, heading } = position.coords;

      // Desplazamiento mínimo (evitar spam si el vehículo está estacionado)
      if (lastCoordsRef.current) {
        const dLat = Math.abs(latitude - lastCoordsRef.current.latitude);
        const dLng = Math.abs(longitude - lastCoordsRef.current.longitude);
        // Si el cambio es menor a ~10 metros (0.0001 deg) y no es el primer ping, omitir salvo que haya pasado tiempo
        if (dLat < 0.0001 && dLng < 0.0001 && lastPingTime && (Date.now() - lastPingTime.getTime() < intervalMs * 2)) {
          return;
        }
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

    // Solicitar posición inicial inmediatamente
    navigator.geolocation.getCurrentPosition(sendGpsPing, handlePositionError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000
    });

    // Configurar intervalo de sondeo continuo en segundo plano
    const timer = setInterval(() => {
      navigator.geolocation.getCurrentPosition(sendGpsPing, handlePositionError, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000
      });
    }, intervalMs);

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
