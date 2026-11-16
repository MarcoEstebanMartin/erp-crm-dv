import { buildGoogleMapsSingleUrl } from './geoUtils';

export type OfficialMapPinColor = 'emerald' | 'blue' | 'red' | 'amber' | 'slate';

export interface OfficialMapStop {
  id?: number;
  clientId?: number;
  lat: number;
  lng: number;
  name: string;
  address?: string;
  invoice?: string;
  hasExactGps?: boolean;
}

export interface OfficialMapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  badgeText?: string;
  color?: OfficialMapPinColor;
  stopOrder?: number;
}

export interface LiveVehicleGpsPoint {
  lat: number;
  lng: number;
  speed?: number | null;
  lastUpdate?: string | null;
  vehiclePlate?: string | null;
}

export const MAP_PIN_HEX: Record<OfficialMapPinColor, string> = {
  emerald: '#10b981',
  blue: '#2563eb',
  red: '#ea4335',
  amber: '#d97706',
  slate: '#475569',
};

export function escapeMapHtml(raw: string | undefined | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDirectionsSummary(routeResult: any): { distance: string; duration: string } {
  let totalMeters = 0;
  let totalSeconds = 0;
  const route = routeResult?.routes?.[0];
  if (Array.isArray(route?.legs)) {
    for (const leg of route.legs) {
      totalMeters += leg.distance?.value || 0;
      totalSeconds += leg.duration?.value || 0;
    }
  }
  const km = (totalMeters / 1000).toFixed(1);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  return {
    distance: `${km} km`,
    duration: hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`,
  };
}

export function buildStopInfoHtml(stop: OfficialMapStop, stopIndex: number): string {
  const approxNotice =
    stop.hasExactGps === false
      ? '<div style="margin-top:4px;font-size:11px;color:#b45309;font-weight:600;">Ubicación aproximada (arrastrá el pin para fijar puerta exacta)</div>'
      : '';
  return `
    <div style="min-width:190px;font-family:Inter,Arial,sans-serif;line-height:1.35;">
      <div style="font-weight:700;font-size:12.5px;color:#111827;">${stopIndex + 1}º Parada: ${escapeMapHtml(stop.name)}</div>
      ${stop.invoice ? `<div style="font-size:11px;color:#374151;margin-top:2px;">Comprobante: ${escapeMapHtml(stop.invoice)}</div>` : ''}
      ${stop.address ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${escapeMapHtml(stop.address)}</div>` : ''}
      ${approxNotice}
    </div>
  `;
}

export function buildMarkerInfoHtml(m: OfficialMapMarker): string {
  const gmapsUrl = buildGoogleMapsSingleUrl(m.lat, m.lng);
  return `
    <div style="min-width:185px;font-family:Inter,Arial,sans-serif;line-height:1.35;">
      <div style="font-weight:700;font-size:12.5px;color:#111827;">${escapeMapHtml(m.title)}</div>
      ${m.subtitle ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${escapeMapHtml(m.subtitle)}</div>` : ''}
      <div style="margin-top:6px;">
        <a href="${gmapsUrl}" target="_blank" rel="noreferrer" style="font-size:11px;font-weight:600;color:#2563eb;text-decoration:none;">Abrir en Google Maps</a>
      </div>
    </div>
  `;
}
