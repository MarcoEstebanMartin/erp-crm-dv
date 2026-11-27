import { describe, expect, it } from 'vitest';
import {
  analyzeGpsTrack,
  formatDurationEs,
  parseArgentinaTimeRange,
} from './gps-track.engine';

describe('gps-track.engine', () => {
  describe('formatDurationEs', () => {
    it('formatea segundos, minutos y horas en español limpio', () => {
      expect(formatDurationEs(45)).toBe('45 s');
      expect(formatDurationEs(3043)).toBe('50 min 43 s');
      expect(formatDurationEs(600)).toBe('10 min');
      expect(formatDurationEs(3600)).toBe('1 h');
      expect(formatDurationEs(4500)).toBe('1 h 15 min');
    });
  });

  describe('parseArgentinaTimeRange', () => {
    it('convierte rango horario local ART (UTC-3) a ventana UTC exacta', () => {
      const range = parseArgentinaTimeRange('2026-11-27', '09:15', '18:30');
      expect(range.fromTime).toBe('09:15');
      expect(range.toTime).toBe('18:30');
      expect(range.startUtc.toISOString()).toBe('2026-11-27T12:15:00.000Z');
      expect(range.endUtc.toISOString()).toBe('2026-11-27T21:30:59.999Z');
    });

    it('cae al día completo si el rango está invertido o mal formado', () => {
      const range = parseArgentinaTimeRange('2026-11-27', '18:00', '09:00');
      expect(range.fromTime).toBe('00:00');
      expect(range.toTime).toBe('23:59');
    });
  });

  describe('analyzeGpsTrack', () => {
    it('detecta una parada real con duración exacta y la cruza con el cliente más cercano', () => {
      // Simula recorrido en General Villegas con una parada de 50 min 43 s frente a un cliente
      const baseMs = new Date('2026-11-27T12:15:01.000Z').getTime(); // 09:15:01 ART
      const pings = [
        // Parada 1: quieto 50 min 43 s en (-35.0330, -63.0120)
        { latitude: -35.0330, longitude: -63.0120, speed: 0, recordedAt: new Date(baseMs) },
        { latitude: -35.03305, longitude: -63.01205, speed: 0, recordedAt: new Date(baseMs + 10 * 60_000) },
        { latitude: -35.03302, longitude: -63.01202, speed: 0, recordedAt: new Date(baseMs + 3043 * 1000) },
        // Sale circulando hacia el norte (~1.1 km)
        { latitude: -35.0280, longitude: -63.0120, speed: 35, recordedAt: new Date(baseMs + 3200 * 1000) },
        { latitude: -35.0230, longitude: -63.0120, speed: 42, recordedAt: new Date(baseMs + 3400 * 1000) },
      ];

      const result = analyzeGpsTrack({
        pings,
        clients: [
          {
            id: 77,
            name: 'Autoservicio Castelli',
            address: 'Castelli 1360',
            latitude: -35.0331,
            longitude: -63.0121,
          },
          {
            id: 88,
            name: 'Cliente Lejano',
            address: 'Ruta 188',
            latitude: -35.0500,
            longitude: -63.0500,
          },
        ],
      });

      expect(result.pointCount).toBe(5);
      expect(result.stops).toHaveLength(1);
      expect(result.stops[0].stopNumber).toBe(1);
      expect(result.stops[0].durationSec).toBe(3043);
      expect(result.stops[0].durationLabel).toBe('50 min 43 s');
      expect(result.stops[0].nearestClient?.clientId).toBe(77);
      expect(result.stops[0].nearestClient?.name).toBe('Autoservicio Castelli');
      expect(result.maxSpeedKmh).toBe(42);
      expect(result.totalDistanceKm).toBeGreaterThanOrEqual(1.0);
      expect(result.totalDistanceKm).toBeLessThanOrEqual(1.3);
      expect(result.stoppedDurationSec).toBe(3043);
      expect(result.movingDurationSec).toBe(357);
    });

    it('ignora picos de teletransportación imposibles (> 160 km/h) para no inflar kilómetros', () => {
      const baseMs = new Date('2026-11-27T12:00:00.000Z').getTime();
      const result = analyzeGpsTrack({
        pings: [
          { latitude: -35.0330, longitude: -63.0120, recordedAt: new Date(baseMs) },
          // Rebote falso de 100 km en 10 segundos
          { latitude: -34.1000, longitude: -63.0120, recordedAt: new Date(baseMs + 10_000) },
          // Vuelve a la calle normal (~220 m en 30 s)
          { latitude: -35.0310, longitude: -63.0120, recordedAt: new Date(baseMs + 30_000) },
        ],
      });

      expect(result.pointCount).toBe(2);
      expect(result.totalDistanceKm).toBe(0.2);
    });

    it('devuelve análisis vacío si no hay puntos válidos', () => {
      const result = analyzeGpsTrack({
        pings: [{ latitude: 0, longitude: 0, recordedAt: new Date() }],
      });

      expect(result.pointCount).toBe(0);
      expect(result.stops).toHaveLength(0);
      expect(result.trail).toHaveLength(0);
      expect(result.totalDistanceKm).toBe(0);
    });
  });
});
