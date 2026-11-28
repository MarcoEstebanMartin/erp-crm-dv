import { describe, it, expect, vi } from 'vitest';
import {
  CHUNK_RELOAD_COOLDOWN_MS,
  isDynamicImportError,
  tryRecoverFromChunkError,
} from '../chunkReloadGuard';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe('chunkReloadGuard', () => {
  it('detecta errores de importación dinámica de Chrome, Safari, Firefox y Vite CSS', () => {
    expect(
      isDynamicImportError(
        new TypeError(
          'Failed to fetch dynamically imported module: https://erp.donvenancio.com.ar/assets/ResumenCuentaModal-Bx3IqdTl.js',
        ),
      ),
    ).toBe(true);
    expect(isDynamicImportError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isDynamicImportError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isDynamicImportError(new Error('Unable to preload CSS for /assets/app-123.css'))).toBe(true);

    const chunkErr = new Error('Loading chunk 42 failed');
    chunkErr.name = 'ChunkLoadError';
    expect(isDynamicImportError(chunkErr)).toBe(true);
  });

  it('no confunde errores normales de ejecución con errores de chunks', () => {
    expect(isDynamicImportError(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(false);
    expect(isDynamicImportError(new Error('Network Error'))).toBe(false);
    expect(isDynamicImportError(null)).toBe(false);
    expect(isDynamicImportError(undefined)).toBe(false);
  });

  it('recarga una vez y bloquea recargas repetidas dentro del cooldown para evitar bucles', () => {
    const storage = createMemoryStorage();
    const reload = vi.fn();

    const firstAttempt = tryRecoverFromChunkError({ storage, now: 100_000, reload });
    expect(firstAttempt).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    const secondAttempt = tryRecoverFromChunkError({
      storage,
      now: 100_000 + CHUNK_RELOAD_COOLDOWN_MS - 1_000,
      reload,
    });
    expect(secondAttempt).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);

    const thirdAttempt = tryRecoverFromChunkError({
      storage,
      now: 100_000 + CHUNK_RELOAD_COOLDOWN_MS + 1,
      reload,
    });
    expect(thirdAttempt).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('no entra en bucle si sessionStorage lanza error (modo privado estricto)', () => {
    const brokenStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    };
    const reload = vi.fn();

    const result = tryRecoverFromChunkError({ storage: brokenStorage, now: 100_000, reload });
    expect(result).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
