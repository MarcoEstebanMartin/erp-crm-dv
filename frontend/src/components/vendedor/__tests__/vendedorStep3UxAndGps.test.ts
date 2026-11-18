import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  captureCurrentGpsSilently,
  getFreshCachedGps,
  __resetGpsCacheForTests,
} from '../../../utils/geoUtils';

describe('Vendedor Paso 3 — Caché GPS Instantáneo sin Bloqueo', () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    __resetGpsCacheForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
    Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
  });

  it('reutiliza el GPS cacheado en 0ms sin volver a consultar geolocation', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: -35.032211, longitude: -63.013422, accuracy: 12 },
      } as GeolocationPosition);
    });

    Object.defineProperty(globalThis, 'window', {
      value: { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: { geolocation: { getCurrentPosition } },
      configurable: true,
    });

    const first = await captureCurrentGpsSilently(500);
    expect(first).toEqual({ lat: -35.032211, lng: -63.013422, accuracyMeters: 12 });
    expect(getFreshCachedGps()).toEqual(first);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    const second = await captureCurrentGpsSilently(350);
    expect(second).toEqual(first);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('resuelve null rápido si geolocation no responde antes del timeout', async () => {
    const getCurrentPosition = vi.fn();

    Object.defineProperty(globalThis, 'window', {
      value: { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: { geolocation: { getCurrentPosition } },
      configurable: true,
    });

    const result = await captureCurrentGpsSilently(30);
    expect(result).toBeNull();
  });
});
