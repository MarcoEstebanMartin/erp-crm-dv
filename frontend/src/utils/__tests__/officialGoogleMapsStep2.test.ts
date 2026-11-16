import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { DEPOT_VILLEGAS, buildGoogleMapsMultiStopRouteUrl } from '../geoUtils';
import {
  resolveGoogleMapsApiKey,
  setRuntimeGoogleMapsApiKey,
  subscribeGoogleMapsApiKey,
} from '../googleMapsLoader';
import { escapeMapHtml } from '../officialGoogleMapHelpers';
import { VILLEGAS_DEPOT, getClientCoords } from '../../components/reparto/repartoGeoHelpers';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(TEST_DIR, '../..');

describe('Paso 2 — Mapa Único Oficial Google Maps API y GPS Exacto en Clientes', () => {
  afterEach(() => {
    setRuntimeGoogleMapsApiKey(null);
  });

  it('usa las coordenadas oficiales de Pringles 116 (General Villegas) en DEPOT_VILLEGAS y VILLEGAS_DEPOT', () => {
    expect(DEPOT_VILLEGAS.lat).toBeCloseTo(-35.0322, 4);
    expect(DEPOT_VILLEGAS.lng).toBeCloseTo(-63.0134, 4);
    expect(DEPOT_VILLEGAS.label).toContain('Pringles 116');
    expect(VILLEGAS_DEPOT).toEqual([DEPOT_VILLEGAS.lat, DEPOT_VILLEGAS.lng]);
  });

  it('resuelve la API key oficial en orden explícita / env / runtime / localStorage y notifica suscriptores', () => {
    let calls = 0;
    const unsubscribe = subscribeGoogleMapsApiKey(() => {
      calls += 1;
    });
    setRuntimeGoogleMapsApiKey('AIzaRuntimeFallbackKey12345');
    expect(calls).toBe(1);
    expect(resolveGoogleMapsApiKey('AIzaExplicitKey999')).toBe('AIzaExplicitKey999');

    const resolvedDefault = resolveGoogleMapsApiKey();
    expect(resolvedDefault.length).toBeGreaterThan(0);
    unsubscribe();
  });

  it('getClientCoords marca hasExactGps=true con GPS real y hasExactGps=false en respaldo por localidad sin placeholders', () => {
    const exact = getClientCoords(1, 'Autoservicio Sol', {
      id: 1,
      name: 'Autoservicio Sol',
      address: 'San Martín 450',
      city: 'General Villegas',
      latitude: -35.0331,
      longitude: -63.0112,
    });
    expect(exact).toEqual({
      lat: -35.0331,
      lng: -63.0112,
      address: 'San Martín 450, General Villegas',
      hasExactGps: true,
    });

    const fallback = getClientCoords(2, 'Despensa Bunge', {
      id: 2,
      name: 'Despensa Bunge',
      address: '',
      city: 'Emilio V. Bunge',
      latitude: null,
      longitude: null,
    });
    expect(fallback.hasExactGps).toBe(false);
    expect(fallback.address).toBe('Emilio V. Bunge');
    expect(fallback.lat).toBeCloseTo(-34.764, 2);

    const oldMockId1 = getClientCoords(1, 'Sin GPS', { id: 1, address: '', city: 'General Villegas' });
    expect(oldMockId1.hasExactGps).toBe(false);
    expect(oldMockId1.address).not.toContain('Moreno 142');
  });

  it('elimina referencias a Leaflet CDN, tiles mt1.google.com y router OSRM en los módulos de mapa', () => {
    const mapFiles = [
      'components/common/InteractiveRouteMap.tsx',
      'components/reparto/LeafletRouteMap.tsx',
      'components/reparto/GoogleRouteMap.tsx',
      'components/reparto/repartoGeoHelpers.ts',
    ];

    for (const rel of mapFiles) {
      const content = fs.readFileSync(path.join(SRC_DIR, rel), 'utf8');
      expect(content, `${rel} no debe incluir unpkg.com/leaflet`).not.toContain('unpkg.com/leaflet');
      expect(content, `${rel} no debe incluir mt1.google.com`).not.toContain('mt1.google.com');
      expect(content, `${rel} no debe incluir router.project-osrm.org`).not.toContain('router.project-osrm.org');
    }

    const roundTripUrl = buildGoogleMapsMultiStopRouteUrl(
      [
        { lat: -35.031, lng: -63.011 },
        { lat: -34.764, lng: -63.031 },
      ],
      { roundTrip: true },
    );
    expect(roundTripUrl).toContain('destination=-35.0322%2C-63.0134');
    expect(roundTripUrl).toContain('waypoints=-35.031%2C-63.011%7C-34.764%2C-63.031');
    expect(escapeMapHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });
});
