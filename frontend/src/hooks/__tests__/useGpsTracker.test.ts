import { describe, expect, it } from 'vitest';
import {
  MAX_ACCEPTED_GPS_ACCURACY_METERS,
  shouldAcceptGpsReading,
  shouldEmitRouteGps,
} from '../useGpsTracker';

describe('useGpsTracker helpers', () => {
  describe('shouldEmitRouteGps', () => {
    it('bloquea emisión GPS para perfiles de oficina/admin aunque el viaje esté en tránsito', () => {
      expect(shouldEmitRouteGps({ userRole: 'ADMIN', routeStatus: 'IN_TRANSIT' })).toBe(false);
      expect(shouldEmitRouteGps({ userRole: 'FACTURACION', routeStatus: 'IN_TRANSIT' })).toBe(false);
      expect(shouldEmitRouteGps({ userRole: 'DEPOSITO', custodyStatus: 'LOADED_IN_TRANSIT' })).toBe(false);
      expect(shouldEmitRouteGps({ userRole: 'VENDEDOR', routeStatus: 'IN_TRANSIT' })).toBe(false);
      expect(shouldEmitRouteGps({ userRole: null, routeStatus: 'IN_TRANSIT' })).toBe(false);
    });

    it('permite emisión GPS únicamente para rol REPARTO con viaje en tránsito', () => {
      expect(shouldEmitRouteGps({ userRole: 'REPARTO', routeStatus: 'IN_TRANSIT' })).toBe(true);
      expect(shouldEmitRouteGps({ userRole: 'REPARTO', custodyStatus: 'LOADED_IN_TRANSIT' })).toBe(true);
      expect(shouldEmitRouteGps({ userRole: 'REPARTO', routeStatus: 'PENDING' })).toBe(false);
      expect(shouldEmitRouteGps({ userRole: 'REPARTO', routeStatus: 'COMPLETED' })).toBe(false);
    });
  });

  describe('shouldAcceptGpsReading', () => {
    it('descarta lecturas imprecisas (ej. geolocalización por IP de PC > 150 m)', () => {
      expect(
        shouldAcceptGpsReading({
          latitude: -35.033,
          longitude: -63.012,
          accuracy: MAX_ACCEPTED_GPS_ACCURACY_METERS + 1,
          lastCoords: null,
          lastPingAt: 0,
          now: 100000,
          intervalMs: 60000,
        }),
      ).toBe(false);
    });

    it('acepta lecturas precisas de celular (<= 150 m)', () => {
      expect(
        shouldAcceptGpsReading({
          latitude: -35.033,
          longitude: -63.012,
          accuracy: 18,
          lastCoords: null,
          lastPingAt: 0,
          now: 100000,
          intervalMs: 60000,
        }),
      ).toBe(true);
    });

    it('evita pings redundantes si el vehículo no se movió y pasó menos de 3 intervalos', () => {
      expect(
        shouldAcceptGpsReading({
          latitude: -35.03301,
          longitude: -63.01201,
          accuracy: 15,
          lastCoords: { latitude: -35.033, longitude: -63.012 },
          lastPingAt: 100000,
          now: 160000,
          intervalMs: 60000,
        }),
      ).toBe(false);
    });

    it('acepta ping estacionario si pasaron más de 3 intervalos (heartbeat)', () => {
      expect(
        shouldAcceptGpsReading({
          latitude: -35.03301,
          longitude: -63.01201,
          accuracy: 15,
          lastCoords: { latitude: -35.033, longitude: -63.012 },
          lastPingAt: 100000,
          now: 300000,
          intervalMs: 60000,
        }),
      ).toBe(true);
    });
  });
});
