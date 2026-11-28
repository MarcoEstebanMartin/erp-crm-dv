const CHUNK_RELOAD_STORAGE_KEY = 'dv_erp_chunk_reload_at';
export const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
  /unable to preload css/i,
  /chunkloaderror/i,
];

interface ReloadStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ChunkReloadOptions {
  storage?: ReloadStorage | null;
  now?: number;
  reload?: () => void;
}

/**
 * Detecta errores provocados por intentar descargar un chunk JS/CSS
 * de un despliegue anterior tras una actualización en producción.
 */
export function isDynamicImportError(error: unknown): boolean {
  if (!error) return false;
  const parts: string[] = [];
  if (typeof error === 'string') {
    parts.push(error);
  } else if (typeof error === 'object') {
    const err = error as { name?: unknown; message?: unknown };
    if (typeof err.name === 'string') parts.push(err.name);
    if (typeof err.message === 'string') parts.push(err.message);
  }
  const text = parts.join(' ');
  return DYNAMIC_IMPORT_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

function getDefaultStorage(): ReloadStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Ejecuta una recarga única del navegador para descargar el index.html y los chunks
 * actuales. Aplica un bloqueo temporal en sessionStorage para evitar bucles infinitos
 * si la falla se debe a pérdida real de conexión.
 */
export function tryRecoverFromChunkError(options: ChunkReloadOptions = {}): boolean {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage();
  const now = options.now ?? Date.now();
  const reload =
    options.reload ??
    (() => {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    });

  if (storage) {
    try {
      const rawLastReload = storage.getItem(CHUNK_RELOAD_STORAGE_KEY);
      const lastReload = rawLastReload ? Number(rawLastReload) : Number.NaN;
      if (Number.isFinite(lastReload) && now - lastReload < CHUNK_RELOAD_COOLDOWN_MS) {
        return false;
      }
      storage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
    } catch {
      // Si sessionStorage está restringido (modo privado estricto), evitamos bucle
      return false;
    }
  }

  reload();
  return true;
}

/**
 * Registra el listener oficial de Vite (`vite:preloadError`) para recuperarse
 * silenciosamente cuando un despliegue reemplaza chunks con hash viejo.
 */
export function installChunkReloadListener(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', (event) => {
    const recovered = tryRecoverFromChunkError();
    if (recovered) {
      event.preventDefault();
    }
  });
}
