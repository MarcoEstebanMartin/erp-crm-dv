import { useEffect, useRef } from 'react';
import { VILLEGAS_DEPOT } from './repartoGeoHelpers';
import { GoogleRouteMap } from './GoogleRouteMap';

export function LeafletRouteMap({
  locations,
  routePoints,
  onUpdateClientCoords,
  gpsLocation,
  gpsTrail
}: {
  locations: any[];
  routePoints: [number, number][];
  onUpdateClientCoords?: (clientId: number, lat: number, lng: number) => void;
  gpsLocation?: { lat: number; lng: number; speed?: number | null; lastUpdate?: string | null; vehiclePlate?: string | null } | null;
  gpsTrail?: [number, number][];
}) {
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    let checkL: any = null;
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else {
      let attempts = 0;
      checkL = setInterval(() => {
        attempts++;
        if ((window as any).L) {
          if (checkL) clearInterval(checkL);
          initMap();
        } else if (attempts > 50) {
          if (checkL) clearInterval(checkL);
          console.error('Timeout cargando Leaflet JS');
        }
      }, 100);
    }

    function initMap() {
      const L = (window as any).L;
      if (!L) return;

      if (mapRef.current) {
        mapRef.current.remove();
      }

      const map = L.map('leaflet-map-div').setView(VILLEGAS_DEPOT, 14);
      mapRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }).addTo(map);

      const redIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
      });

      L.marker(VILLEGAS_DEPOT, { icon: redIcon })
        .addTo(map)
        .bindPopup('<b>DEPÓSITO CENTRAL DV</b><br/>Moreno 200, Gral Villegas');

      locations.forEach((loc, idx) => {
        const numberedIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color:#1D1D1F; color:white; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:10px; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3);">${idx + 1}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const leafletMarker = L.marker([loc.lat, loc.lng], {
          icon: numberedIcon,
          draggable: true
        })
          .addTo(map)
          .bindPopup(`<b>${idx + 1}º Parada: ${loc.name}</b><br/>Comprobante: ${loc.invoice}<br/>Dirección: ${loc.address}`);

        if (onUpdateClientCoords && loc.clientId) {
          leafletMarker.on('dragend', (e: any) => {
            const { lat, lng } = e.target.getLatLng();
            onUpdateClientCoords(loc.clientId, lat, lng);
          });
        }
      });

      if (routePoints.length > 1) {
        L.polyline(routePoints, { color: 'var(--color-corp-red)', weight: 4, opacity: 0.85 }).addTo(map);
        map.fitBounds(L.polyline(routePoints).getBounds(), { padding: [40, 40] });
      }

      if (gpsTrail && gpsTrail.length > 1) {
        L.polyline(gpsTrail, { color: '#059669', weight: 3, opacity: 0.8, dashArray: '6, 6' }).addTo(map);
      }

      if (gpsLocation && typeof gpsLocation.lat === 'number' && typeof gpsLocation.lng === 'number') {
        const truckIcon = L.divIcon({
          className: 'custom-truck-icon',
          html: `<div style="background-color:#E30613; color:white; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; font-size:16px; border: 2px solid white; box-shadow: 0 2px 8px rgba(227,6,19,0.5);">🚚</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const speedText = gpsLocation.speed !== null && gpsLocation.speed !== undefined ? `${gpsLocation.speed} km/h` : 'En parada';
        const timeText = gpsLocation.lastUpdate ? new Date(gpsLocation.lastUpdate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'En vivo';

        L.marker([gpsLocation.lat, gpsLocation.lng], { icon: truckIcon })
          .addTo(map)
          .bindPopup(`<b>🚚 Vehículo en Vivo: ${gpsLocation.vehiclePlate || 'Unidad de Reparto'}</b><br/>Velocidad: <strong>${speedText}</strong><br/>Última transmisión: <strong>${timeText}</strong>`);
      }
    }

    return () => {
      if (checkL) clearInterval(checkL);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [locations, routePoints, gpsLocation, gpsTrail]);

  return (
    <div
      id="leaflet-map-div"
      style={{
        width: '100%',
        height: '420px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        backgroundColor: '#f0f0f0',
        zIndex: 1
      }}
    />
  );
}

export function RouteMap({
  locations,
  routePoints,
  onUpdateClientCoords,
  gpsLocation,
  gpsTrail
}: {
  locations: any[];
  routePoints: [number, number][];
  onUpdateClientCoords?: (clientId: number, lat: number, lng: number) => void;
  gpsLocation?: { lat: number; lng: number; speed?: number | null; lastUpdate?: string | null; vehiclePlate?: string | null } | null;
  gpsTrail?: [number, number][];
}) {
  const apiKey = (import.meta.env as any)?.VITE_GOOGLE_MAPS_API_KEY || '';

  if (apiKey) {
    return <GoogleRouteMap locations={locations} routePoints={routePoints} onUpdateClientCoords={onUpdateClientCoords} />;
  }
  return (
    <LeafletRouteMap
      locations={locations}
      routePoints={routePoints}
      onUpdateClientCoords={onUpdateClientCoords}
      gpsLocation={gpsLocation}
      gpsTrail={gpsTrail}
    />
  );
}
