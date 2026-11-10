import React, { useEffect, useRef, useState } from 'react';
import { DEPOT_VILLEGAS, buildGoogleMapsSingleUrl } from '../../utils/geoUtils';

export type MapPinColor = 'emerald' | 'blue' | 'red' | 'amber' | 'slate';

export interface RouteMapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  badgeText?: string;
  color?: MapPinColor;
  stopOrder?: number;
}

interface InteractiveRouteMapProps {
  markers: RouteMapMarker[];
  heightPx?: number;
  showRouteLine?: boolean;
  centerLat?: number;
  centerLng?: number;
  defaultZoom?: number;
  draggablePin?: {
    lat: number;
    lng: number;
    label?: string;
    onMove: (lat: number, lng: number) => void;
  };
  onSelectMarker?: (markerId: string) => void;
}

declare global {
  interface Window {
    L?: any;
  }
}

const PIN_COLOR: Record<MapPinColor, string> = {
  emerald: '#10b981',
  blue: '#2563eb',
  red: '#ea4335',
  amber: '#f59e0b',
  slate: '#475569',
};

function ensureLeafletAssets(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.L) return Promise.resolve(window.L);

  return new Promise((resolve) => {
    if (!document.getElementById('leaflet-css-cdn')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css-cdn';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById('leaflet-js-cdn') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.L));
      return;
    }

    const script = document.createElement('script');
    script.id = 'leaflet-js-cdn';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
}

export function InteractiveRouteMap({
  markers,
  heightPx = 540,
  showRouteLine = false,
  centerLat = DEPOT_VILLEGAS.lat,
  centerLng = DEPOT_VILLEGAS.lng,
  defaultZoom = 14,
  draggablePin,
  onSelectMarker,
}: InteractiveRouteMapProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    ensureLeafletAssets().then((L) => {
      if (!mounted || !L || !containerRef.current) return;
      if (!mapInstanceRef.current) {
        const initLat = draggablePin?.lat ?? centerLat;
        const initLng = draggablePin?.lng ?? centerLng;
        const map = L.map(containerRef.current, {
          center: [initLat, initLng],
          zoom: draggablePin ? 16 : defaultZoom,
          zoomControl: true,
          attributionControl: false,
        });

        L.tileLayer('https://mt1.google.com/vt/lyrs=m&hl=es&x={x}&y={y}&z={z}', { maxZoom: 20 }).addTo(map);
        layerGroupRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
      }
      setReady(true);
    });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const L = window.L;
    const map = mapInstanceRef.current;
    const group = layerGroupRef.current;
    if (!ready || !L || !map || !group) return;

    group.clearLayers();

    if (draggablePin) {
      const icon = L.divIcon({
        className: 'google-clean-pin',
        html: `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));cursor:grab;"><path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#EA4335"/><circle cx="14" cy="14" r="5" fill="white"/></svg>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      });

      const marker = L.marker([draggablePin.lat, draggablePin.lng], { draggable: true, icon }).addTo(group);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        if (pos) draggablePin.onMove(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
      });
      map.setView([draggablePin.lat, draggablePin.lng], 15);
      return;
    }

    const polyPoints: Array<[number, number]> = [];
    for (const m of markers) {
      if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) continue;
      polyPoints.push([m.lat, m.lng]);
      const fill = PIN_COLOR[m.color ?? 'red'];

      const icon = L.divIcon({
        className: 'google-clean-pin',
        html: `<svg width="22" height="28" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,0.28));"><path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="${fill}"/><circle cx="14" cy="14" r="5" fill="white"/></svg>`,
        iconSize: [22, 28],
        iconAnchor: [11, 28],
        popupAnchor: [0, -26],
      });

      const gmapsUrl = buildGoogleMapsSingleUrl(m.lat, m.lng);
      const popupHtml = `
        <div style="min-width:180px;font-family:Inter,Arial,sans-serif;">
          <div style="font-weight:700;font-size:12.5px;color:#0f172a;">${m.title}</div>
          ${m.subtitle ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${m.subtitle}</div>` : ''}
          <div style="margin-top:6px;">
            <a href="${gmapsUrl}" target="_blank" rel="noreferrer" style="font-size:11px;font-weight:600;color:#2563eb;text-decoration:none;">Abrir en Google Maps ↗</a>
          </div>
        </div>
      `;

      const leafletMarker = L.marker([m.lat, m.lng], { icon }).bindPopup(popupHtml).addTo(group);
      if (onSelectMarker) leafletMarker.on('click', () => onSelectMarker(m.id));
    }

    if (showRouteLine && polyPoints.length > 1) {
      L.polyline(polyPoints, { color: '#2563eb', weight: 3, opacity: 0.75 }).addTo(group);
    }

    map.setView([centerLat, centerLng], defaultZoom);
  }, [ready, markers, showRouteLine, centerLat, centerLng, defaultZoom, draggablePin]);

  return (
    <div style={{ overflow: 'hidden', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: '#ffffff' }}>
      <div ref={containerRef} style={{ width: '100%', height: `${heightPx}px` }} />
    </div>
  );
}
export default InteractiveRouteMap;
