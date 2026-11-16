let runtimeGoogleMapsApiKey = '';
let loadingPromise: Promise<any> | null = null;
let loadingApiKey = '';
const apiKeyListeners = new Set<() => void>();

export interface GoogleGeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  locationType: string;
}

export function setRuntimeGoogleMapsApiKey(key?: string | null): void {
  const nextKey = typeof key === 'string' ? key.trim() : '';
  if (nextKey === runtimeGoogleMapsApiKey) return;
  runtimeGoogleMapsApiKey = nextKey;
  apiKeyListeners.forEach((listener) => listener());
}

export function subscribeGoogleMapsApiKey(listener: () => void): () => void {
  apiKeyListeners.add(listener);
  return () => {
    apiKeyListeners.delete(listener);
  };
}

export function resolveGoogleMapsApiKey(explicitKey?: string): string {
  const explicit = typeof explicitKey === 'string' ? explicitKey.trim() : '';
  if (explicit) return explicit;

  const viteEnvKey = (((import.meta as any)?.env?.VITE_GOOGLE_MAPS_API_KEY as string) || '').trim();
  if (viteEnvKey) return viteEnvKey;

  if (runtimeGoogleMapsApiKey) return runtimeGoogleMapsApiKey;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const rawCfg = window.localStorage.getItem('auth_config');
      if (rawCfg) {
        const parsed = JSON.parse(rawCfg);
        const cfgKey = typeof parsed?.googleMapsApiKey === 'string' ? parsed.googleMapsApiKey.trim() : '';
        if (cfgKey) return cfgKey;
      }
    } catch {
      // Ignora JSON inválido en localStorage
    }
  }

  return '';
}

export function loadOfficialGoogleMaps(explicitKey?: string): Promise<any> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google Maps requiere entorno de navegador.'));
  }

  const g = (window as any).google;
  if (g?.maps) {
    return Promise.resolve(g.maps);
  }

  const apiKey = resolveGoogleMapsApiKey(explicitKey);
  if (!apiKey) {
    return Promise.reject(new Error('Clave de Google Maps API no configurada.'));
  }

  if (loadingPromise && loadingApiKey === apiKey) {
    return loadingPromise;
  }

  loadingApiKey = apiKey;
  loadingPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('official-google-maps-sdk') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => {
        const maps = (window as any).google?.maps;
        if (maps) resolve(maps);
        else {
          loadingPromise = null;
          reject(new Error('Google Maps API no se inicializó correctamente.'));
        }
      });
      existing.addEventListener('error', () => {
        loadingPromise = null;
        reject(new Error('No se pudo cargar Google Maps API.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.id = 'official-google-maps-sdk';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,geometry&language=es&region=AR`;
    script.onload = () => {
      const maps = (window as any).google?.maps;
      if (maps) {
        resolve(maps);
      } else {
        loadingPromise = null;
        reject(new Error('Google Maps API no se inicializó correctamente.'));
      }
    };
    script.onerror = () => {
      loadingPromise = null;
      script.remove();
      reject(new Error('No se pudo cargar Google Maps API.'));
    };
    document.head.appendChild(script);
  });

  return loadingPromise;
}

export async function geocodeAddressWithGoogle(
  query: string,
  explicitKey?: string,
): Promise<GoogleGeocodeResult | null> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  const maps = await loadOfficialGoogleMaps(explicitKey);
  if (!maps?.Geocoder) return null;

  return new Promise((resolve) => {
    const geocoder = new maps.Geocoder();
    geocoder.geocode(
      {
        address: cleanQuery,
        region: 'AR',
        componentRestrictions: { country: 'AR' },
      },
      (results: any, status: any) => {
        if (status === 'OK' && Array.isArray(results) && results[0]?.geometry?.location) {
          const loc = results[0].geometry.location;
          resolve({
            lat: Number(Number(loc.lat()).toFixed(6)),
            lng: Number(Number(loc.lng()).toFixed(6)),
            formattedAddress: results[0].formatted_address || cleanQuery,
            locationType: results[0].geometry?.location_type || 'APPROXIMATE',
          });
          return;
        }
        resolve(null);
      },
    );
  });
}
