export interface GpsCaptureResult {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
}

export const DEPOT_VILLEGAS = {
  lat: -35.0328,
  lng: -63.0125,
  label: 'Depósito Don Venancio (General Villegas)',
};

export function captureCurrentGpsSilently(timeoutMs = 3500): Promise<GpsCaptureResult | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      resolve(null);
      return;
    }

    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracyMeters: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
        });
      },
      () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}

export async function geocodeAddressArgentina(
  address: string,
  city: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const cleanAddr = address.replace(/sin direcci[oó]n/i, '').trim();
  const q = [cleanAddr, city.trim(), 'Argentina'].filter(Boolean).join(', ');
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ar&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!data.length || !data[0]) return null;
    const lat = Number(parseFloat(data[0].lat).toFixed(6));
    const lng = Number(parseFloat(data[0].lon).toFixed(6));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, displayName: data[0].display_name };
  } catch {
    return null;
  }
}

export function buildGoogleMapsSingleUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function buildGoogleMapsMultiStopRouteUrl(
  stops: Array<{ lat: number; lng: number; title?: string }>,
): string {
  if (stops.length === 0) {
    return buildGoogleMapsSingleUrl(DEPOT_VILLEGAS.lat, DEPOT_VILLEGAS.lng);
  }
  const uniqueStops: Array<{ lat: number; lng: number }> = [];
  const seen = new Set<string>();
  for (const s of stops) {
    const key = `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueStops.push(s);
    }
    if (uniqueStops.length >= 10) break;
  }

  const origin = `${DEPOT_VILLEGAS.lat},${DEPOT_VILLEGAS.lng}`;
  const last = uniqueStops[uniqueStops.length - 1]!;
  const destination = `${last.lat},${last.lng}`;
  const waypoints = uniqueStops
    .slice(0, -1)
    .map((s) => `${s.lat},${s.lng}`)
    .join('|');

  const params = new URLSearchParams({ api: '1', origin, destination, travelmode: 'driving' });
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
