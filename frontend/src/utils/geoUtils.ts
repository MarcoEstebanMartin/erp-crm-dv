export interface GpsCaptureResult {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
}

export const DEPOT_VILLEGAS = {
  lat: -35.0322,
  lng: -63.0134,
  label: 'Depósito Don Venancio · Pringles 116, General Villegas',
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
  options?: { roundTrip?: boolean },
): string {
  if (stops.length === 0) {
    return buildGoogleMapsSingleUrl(DEPOT_VILLEGAS.lat, DEPOT_VILLEGAS.lng);
  }
  const uniqueStops: Array<{ lat: number; lng: number }> = [];
  const seen = new Set<string>();
  for (const s of stops) {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) continue;
    const key = `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueStops.push(s);
    }
    if (uniqueStops.length >= 20) break;
  }

  if (uniqueStops.length === 0) {
    return buildGoogleMapsSingleUrl(DEPOT_VILLEGAS.lat, DEPOT_VILLEGAS.lng);
  }

  const origin = `${DEPOT_VILLEGAS.lat},${DEPOT_VILLEGAS.lng}`;
  const isRoundTrip = Boolean(options?.roundTrip);
  const last = uniqueStops[uniqueStops.length - 1]!;
  const destination = isRoundTrip ? origin : `${last.lat},${last.lng}`;
  const waypointStops = isRoundTrip ? uniqueStops : uniqueStops.slice(0, -1);
  const waypoints = waypointStops.map((s) => `${s.lat},${s.lng}`).join('|');

  const params = new URLSearchParams({ api: '1', origin, destination, travelmode: 'driving' });
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
