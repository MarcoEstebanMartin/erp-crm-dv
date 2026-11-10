import { useState, useEffect, useRef } from 'react';
import { VILLEGAS_DEPOT, loadGoogleMapsScript } from './repartoGeoHelpers';

export function GoogleRouteMap({
  locations,
  routePoints,
  onUpdateClientCoords
}: {
  locations: any[];
  routePoints: [number, number][];
  onUpdateClientCoords?: (clientId: number, lat: number, lng: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const apiKey = (import.meta.env as any)?.VITE_GOOGLE_MAPS_API_KEY || '';
  const [metrics, setMetrics] = useState<{ distance: string; duration: string } | null>(null);

  useEffect(() => {
    if (!apiKey) return;

    loadGoogleMapsScript(apiKey, () => {
      if (!mapRef.current) return;
      const google = (window as any).google;

      const map = new google.maps.Map(mapRef.current, {
        center: { lat: VILLEGAS_DEPOT[0], lng: VILLEGAS_DEPOT[1] },
        zoom: 14,
        disableDefaultUI: false,
        zoomControl: true
      });

      google.maps.event.addListener(map, 'zoom_changed', () => {
        if (map.getZoom() > 16) map.setZoom(14);
      });

      const bounds = new google.maps.LatLngBounds();
      const infoWindow = new google.maps.InfoWindow();

      const depotMarker = new google.maps.Marker({
        position: { lat: VILLEGAS_DEPOT[0], lng: VILLEGAS_DEPOT[1] },
        map,
        title: 'DEPÓSITO CENTRAL DV',
        icon: {
          url: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
          scaledSize: new google.maps.Size(25, 41),
        }
      });
      bounds.extend(depotMarker.getPosition());

      depotMarker.addListener('click', () => {
        infoWindow.setContent('<b>DEPÓSITO CENTRAL DV</b><br/>Moreno 200, Gral Villegas');
        infoWindow.open(map, depotMarker);
      });

      locations.forEach((loc, idx) => {
        const marker = new google.maps.Marker({
          position: { lat: loc.lat, lng: loc.lng },
          map,
          label: { text: String(idx + 1), color: '#FFFFFF', fontWeight: 'bold', fontSize: '11px' },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#1D1D1F',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 12,
            labelOrigin: new google.maps.Point(0, 0)
          },
          title: `${idx + 1}º Parada: ${loc.name}`,
          draggable: true
        });

        bounds.extend(marker.getPosition());

        marker.addListener('click', () => {
          infoWindow.setContent(`<b>${idx + 1}º Parada: ${loc.name}</b><br/>Comprobante: ${loc.invoice}<br/>Dirección: ${loc.address}`);
          infoWindow.open(map, marker);
        });

        if (onUpdateClientCoords && loc.clientId) {
          marker.addListener('dragend', (e: any) => {
            onUpdateClientCoords(loc.clientId, e.latLng.lat(), e.latLng.lng());
          });
        }
      });

      const drawFallbackRoute = () => {
        if (routePoints.length > 1) {
          const pathCoords = routePoints.map(p => ({ lat: p[0], lng: p[1] }));
          const routePath = new google.maps.Polyline({
            path: pathCoords,
            geodesic: true,
            strokeColor: 'var(--color-corp-red)',
            strokeOpacity: 0.85,
            strokeWeight: 4,
          });
          routePath.setMap(map);
          map.fitBounds(bounds);
        }
      };

      if (locations.length > 0) {
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: { strokeColor: 'var(--color-corp-red)', strokeOpacity: 0.85, strokeWeight: 4 }
        });

        const originLatLng = new google.maps.LatLng(VILLEGAS_DEPOT[0], VILLEGAS_DEPOT[1]);
        const validLocations = locations.filter(l => typeof l.lat === 'number' && typeof l.lng === 'number');

        if (validLocations.length > 0 && validLocations.length <= 25) {
          const waypoints = validLocations.map(loc => ({
            location: new google.maps.LatLng(loc.lat, loc.lng),
            stopover: true
          }));

          directionsService.route(
            {
              origin: originLatLng,
              destination: originLatLng,
              waypoints,
              travelMode: google.maps.TravelMode.DRIVING,
              optimizeWaypoints: false
            },
            (result: any, status: any) => {
              if (status === google.maps.DirectionsStatus.OK && result) {
                directionsRenderer.setDirections(result);
                let totalMeters = 0;
                let totalSeconds = 0;
                const route = result.routes[0];
                if (route && route.legs) {
                  route.legs.forEach((leg: any) => {
                    totalMeters += leg.distance?.value || 0;
                    totalSeconds += leg.duration?.value || 0;
                  });
                }
                const km = (totalMeters / 1000).toFixed(1);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.round((totalSeconds % 3600) / 60);
                setMetrics({
                  distance: `${km} km`,
                  duration: hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`
                });
              } else {
                console.warn('Google Directions falló, usando traza local:', status);
                drawFallbackRoute();
              }
            }
          );
        } else {
          drawFallbackRoute();
        }
      } else {
        drawFallbackRoute();
      }
    });
  }, [locations, routePoints, apiKey]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {metrics && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '8px 12px',
          backgroundColor: 'var(--bg-light, #fafafa)',
          border: '1px solid var(--border-color, #e5e5e5)',
          borderRadius: '6px',
          fontSize: '0.8rem',
          color: 'var(--text-primary, #1d1d1f)',
          fontWeight: 500
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            🛣️ <strong>Recorrido vial:</strong> {metrics.distance}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            ⏱️ <strong>Tiempo estimado:</strong> {metrics.duration}
          </span>
        </div>
      )}
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '420px',
          borderRadius: '8px',
          border: '1px solid var(--border-color, #e5e5e5)',
          backgroundColor: '#e5e5e5',
          zIndex: 1
        }}
      />
    </div>
  );
}
