import { describe, expect, it } from 'vitest';
import {
  DEPOT_VILLEGAS_COORDS,
  calculateDistanceMeters,
  classifyCheckInProximity,
  resolveCustomerCoordinates,
} from './geo';

describe('Geo & Haversine Engine (005-geolocalizacion-y-rutas)', () => {
  it('calcula 0 metros para la misma coordenada y distancia exacta entre dos puntos en General Villegas', () => {
    const same = calculateDistanceMeters(
      DEPOT_VILLEGAS_COORDS.lat,
      DEPOT_VILLEGAS_COORDS.lng,
      DEPOT_VILLEGAS_COORDS.lat,
      DEPOT_VILLEGAS_COORDS.lng,
    );
    expect(same).toBe(0);

    const oneBlock = calculateDistanceMeters(-35.0328, -63.0125, -35.0338, -63.0125);
    expect(oneBlock).toBeGreaterThanOrEqual(105);
    expect(oneBlock).toBeLessThanOrEqual(120);
  });

  it('clasifica proximidad del check-in GPS del vendedor correctamente', () => {
    expect(classifyCheckInProximity(45)).toBe('ON_SITE');
    expect(classifyCheckInProximity(250)).toBe('ON_SITE');
    expect(classifyCheckInProximity(650)).toBe('NEARBY');
    expect(classifyCheckInProximity(15400)).toBe('REMOTE');
    expect(classifyCheckInProximity(null)).toBe('UNKNOWN');
  });

  it('respeta coordenadas exactas cuando el cliente tiene pin fijado y usa fallback por localidad si no lo tiene', () => {
    const withPin = resolveCustomerCoordinates({
      legacyId: 101,
      city: 'GENERAL VILLEGAS',
      lat: -35.031234,
      lng: -63.014567,
    });
    expect(withPin.isExactPin).toBe(true);
    expect(withPin.lat).toBe(-35.031234);
    expect(withPin.lng).toBe(-63.014567);

    const withoutPin = resolveCustomerCoordinates({
      legacyId: 101,
      city: 'PIEDRITAS',
      lat: null,
      lng: null,
    });
    expect(withoutPin.isExactPin).toBe(false);
    expect(withoutPin.lat).toBeCloseTo(-34.7667, 1);
    expect(withoutPin.lng).toBeCloseTo(-62.9833, 1);
  });
});
