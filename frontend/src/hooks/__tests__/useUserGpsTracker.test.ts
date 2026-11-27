import { describe, expect, it } from 'vitest';
import {
  USER_GPS_HEARTBEAT_MULTIPLIER,
  USER_GPS_INTERVAL_MS,
  USER_GPS_MAX_ACCURACY_METERS,
  USER_GPS_QUEUE_STORAGE_KEY,
  readQueuedUserGpsPings,
  shouldAcceptUserGpsReading,
  shouldTrackUserGps,
  writeQueuedUserGpsPings,
} from '../useUserGpsTracker';

describe('useUserGpsTracker helpers', () => {
  describe('shouldTrackUserGps', () => {
    it('habilita tracking para VENDEDOR y DEPOSITO con canDeliver', () => {
      expect(shouldTrackUserGps({ id: 1, role: 'VENDEDOR' })).toBe(true);
      expect(shouldTrackUserGps({ id: 2, role: 'DEPOSITO', permissions: { canDeliver: true } })).toBe(true);
    });

    it('bloquea tracking para perfiles de oficina o depósito sin reparto', () => {
      expect(shouldTrackUserGps({ id: 1, role: 'ADMIN' })).toBe(false);
      expect(shouldTrackUserGps({ id: 2, role: 'FACTURACION' })).toBe(false);
      expect(shouldTrackUserGps({ id: 3, role: 'DEPOSITO', permissions: { canDeliver: false } })).toBe(false);
      expect(shouldTrackUserGps(null)).toBe(false);
    });
  });

  describe('shouldAcceptUserGpsReading', () => {
    it('acepta la primera lectura precisa y rechaza lecturas imprecisas (> 150 m)', () => {
      expect(
        shouldAcceptUserGpsReading({
          latitude: -35.033,
          longitude: -63.012,
          accuracy: 20,
          lastCoords: null,
          lastAcceptedAt: 0,
          now: 100_000,
          intervalMs: USER_GPS_INTERVAL_MS,
        }),
      ).toBe(true);

      expect(
        shouldAcceptUserGpsReading({
          latitude: -35.033,
          longitude: -63.012,
          accuracy: USER_GPS_MAX_ACCURACY_METERS + 5,
          lastCoords: null,
          lastAcceptedAt: 0,
          now: 100_000,
          intervalMs: USER_GPS_INTERVAL_MS,
        }),
      ).toBe(false);
    });

    it('acepta cuando se movió >= 20 m y omite estacionario hasta cumplir el heartbeat de 3 min', () => {
      // Quieto hace 30 s -> omitir
      expect(
        shouldAcceptUserGpsReading({
          latitude: -35.03301,
          longitude: -63.01201,
          accuracy: 15,
          lastCoords: { latitude: -35.033, longitude: -63.012 },
          lastAcceptedAt: 100_000,
          now: 130_000,
          intervalMs: USER_GPS_INTERVAL_MS,
        }),
      ).toBe(false);

      // Se movió > 25 m -> aceptar
      expect(
        shouldAcceptUserGpsReading({
          latitude: -35.0333,
          longitude: -63.012,
          accuracy: 15,
          lastCoords: { latitude: -35.033, longitude: -63.012 },
          lastAcceptedAt: 100_000,
          now: 130_000,
          intervalMs: USER_GPS_INTERVAL_MS,
        }),
      ).toBe(true);

      // Quieto pero pasaron 3 min -> heartbeat de parada aceptado
      expect(
        shouldAcceptUserGpsReading({
          latitude: -35.03301,
          longitude: -63.01201,
          accuracy: 15,
          lastCoords: { latitude: -35.033, longitude: -63.012 },
          lastAcceptedAt: 100_000,
          now: 100_000 + USER_GPS_INTERVAL_MS * USER_GPS_HEARTBEAT_MULTIPLIER,
          intervalMs: USER_GPS_INTERVAL_MS,
        }),
      ).toBe(true);
    });

    it('acepta lectura estacionaria cuando force=true (al reabrir la app)', () => {
      expect(
        shouldAcceptUserGpsReading({
          latitude: -35.03301,
          longitude: -63.01201,
          accuracy: 15,
          lastCoords: { latitude: -35.033, longitude: -63.012 },
          lastAcceptedAt: 100_000,
          now: 110_000,
          intervalMs: USER_GPS_INTERVAL_MS,
          force: true,
        }),
      ).toBe(true);
    });
  });

  describe('cola offline de pings', () => {
    it('guarda, lee y limpia pings en almacenamiento local', () => {
      const map = new Map<string, string>();
      const fakeStorage = {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => {
          map.set(k, v);
        },
        removeItem: (k: string) => {
          map.delete(k);
        },
      };

      writeQueuedUserGpsPings(
        [
          {
            latitude: -35.033,
            longitude: -63.012,
            accuracy: 12,
            speed: 30,
            heading: 180,
            source: 'ERP_APP',
            recordedAt: '2026-11-27T14:00:00.000Z',
          },
        ],
        fakeStorage,
      );

      expect(map.has(USER_GPS_QUEUE_STORAGE_KEY)).toBe(true);
      const read = readQueuedUserGpsPings(fakeStorage);
      expect(read).toHaveLength(1);
      expect(read[0].latitude).toBe(-35.033);

      writeQueuedUserGpsPings([], fakeStorage);
      expect(map.has(USER_GPS_QUEUE_STORAGE_KEY)).toBe(false);
    });
  });
});
