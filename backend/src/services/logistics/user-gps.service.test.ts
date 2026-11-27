import { describe, expect, it } from 'vitest';
import { MAX_USER_GPS_ACCURACY_METERS, normalizeUserGpsPings } from './user-gps.service';

describe('normalizeUserGpsPings', () => {
  const now = new Date('2026-11-27T14:00:00.000Z');

  it('acepta puntos válidos y ordena cronológicamente por recordedAt', () => {
    const result = normalizeUserGpsPings(
      [
        {
          latitude: -35.0335,
          longitude: -63.0125,
          accuracy: 15,
          speed: 24,
          heading: 90,
          recordedAt: '2026-11-27T13:59:00.000Z',
        },
        {
          latitude: -35.033,
          longitude: -63.012,
          accuracy: 12,
          speed: 18,
          heading: 85,
          recordedAt: '2026-11-27T13:58:00.000Z',
        },
      ],
      now,
    );

    expect(result.ignored).toBe(0);
    expect(result.accepted).toHaveLength(2);
    expect(result.accepted[0].recordedAt.toISOString()).toBe('2026-11-27T13:58:00.000Z');
    expect(result.accepted[1].recordedAt.toISOString()).toBe('2026-11-27T13:59:00.000Z');
  });

  it('descarta coordenadas (0, 0) y lecturas con baja precisión (> 150 m)', () => {
    const result = normalizeUserGpsPings(
      [
        { latitude: 0, longitude: 0, accuracy: 10 },
        { latitude: -35.033, longitude: -63.012, accuracy: MAX_USER_GPS_ACCURACY_METERS + 1 },
        { latitude: -35.033, longitude: -63.012, accuracy: 25 },
      ],
      now,
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.ignored).toBe(2);
  });

  it('deduplica puntos con menos de 5 segundos de diferencia en el mismo lote', () => {
    const result = normalizeUserGpsPings(
      [
        {
          latitude: -35.033,
          longitude: -63.012,
          accuracy: 10,
          recordedAt: '2026-11-27T13:59:00.000Z',
        },
        {
          latitude: -35.0331,
          longitude: -63.0121,
          accuracy: 10,
          recordedAt: '2026-11-27T13:59:02.000Z',
        },
        {
          latitude: -35.0332,
          longitude: -63.0122,
          accuracy: 10,
          recordedAt: '2026-11-27T13:59:30.000Z',
        },
      ],
      now,
    );

    expect(result.accepted).toHaveLength(2);
    expect(result.ignored).toBe(1);
  });

  it('reemplaza fechas inválidas o fuera de rango por la hora actual del servidor', () => {
    const result = normalizeUserGpsPings(
      [
        {
          latitude: -35.033,
          longitude: -63.012,
          accuracy: 10,
          recordedAt: '2030-01-01T00:00:00.000Z',
        },
      ],
      now,
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].recordedAt.toISOString()).toBe(now.toISOString());
  });
});
