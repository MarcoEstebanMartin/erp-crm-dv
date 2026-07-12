import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../utils/api';
import { 
  Plus, 
  MapPin, 
  Navigation, 
  CheckCircle, 
  Play, 
  Map, 
  X, 
  ChevronRight,
  Printer
} from 'lucide-react';

// Coordenadas fijas simuladas para clientes en General Villegas
const VILLEGAS_DEPOT: [number, number] = [-35.030, -63.010]; // Moreno 200, Villegas (Base/Depósito)

const CLIENT_COORDS: { [key: number]: { lat: number; lng: number; address: string } } = {
  1: { lat: -35.032, lng: -63.008, address: 'Moreno 142, General Villegas' },
  2: { lat: -35.028, lng: -63.015, address: 'Rivadavia 350, General Villegas' },
  3: { lat: -35.035, lng: -63.012, address: 'Castelli 580, General Villegas' },
};

function getClientCoords(
  clientId: number,
  clientName: string,
  persona?: any,
  cache?: { [key: number]: { lat: number; lng: number; address: string } }
) {
  if (CLIENT_COORDS[clientId]) return CLIENT_COORDS[clientId];
  if (cache && cache[clientId]) return cache[clientId];

  // Generar coordenadas deterministas cerca del depósito como fallback
  const hash = clientName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const lat = -35.030 + ((hash % 100 - 50) * 0.0003);
  const lng = -63.010 + (((hash * 7) % 100 - 50) * 0.0003);

  // Formatear la dirección real si existe
  const street = persona?.address;
  const city = persona?.city;

  let realAddress = street || 'Acceso Villegas S/N';
  if (city) {
    realAddress += `, ${city}`;
  } else if (!realAddress.toLowerCase().includes('villegas')) {
    realAddress += `, Gral Villegas`;
  }

  return { lat, lng, address: realAddress };
}

// resolvedor TSP simple (Nearest Neighbor)
function solveTSP(start: [number, number], targets: { id: number; lat: number; lng: number; name: string; address: string; invoice: string }[]) {
  const unvisited = [...targets];
  const route: typeof targets = [];
  let currentPos = start;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = Math.hypot(unvisited[i].lat - currentPos[0], unvisited[i].lng - currentPos[1]);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }

    const nextNode = unvisited.splice(nearestIdx, 1)[0];
    route.push(nextNode);
    currentPos = [nextNode.lat, nextNode.lng];
  }

  return route;
}

// Función para obtener la traza de calles reales de OSRM
async function fetchOSRMRoute(points: [number, number][]): Promise<[number, number][]> {
  if (points.length < 2) return points;
  try {
    const coordinatesStr = points.map(p => `${p[1]},${p[0]}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinatesStr}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error en API OSRM');
    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes[0]) {
      const coords = data.routes[0].geometry.coordinates; // [[lng, lat], ...]
      return coords.map((c: [number, number]) => [c[1], c[0]]); // Convertir a [lat, lng]
    }
  } catch (error) {
    console.error("Error al obtener la ruta de OSRM, usando líneas rectas:", error);
  }
  return points;
}

// Cargador del Script de Google Maps
const loadGoogleMapsScript = (apiKey: string, callback: () => void) => {
  if ((window as any).google && (window as any).google.maps) {
    callback();
    return;
  }
  const id = 'google-maps-js';
  const existingScript = document.getElementById(id);
  if (existingScript) {
    const interval = setInterval(() => {
      if ((window as any).google && (window as any).google.maps) {
        clearInterval(interval);
        callback();
      }
    }, 100);
    return;
  }
  const script = document.createElement('script');
  script.id = id;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    if (callback) callback();
  };
  document.head.appendChild(script);
};

// Sub-componente para renderizar con Google Maps
function GoogleRouteMap({ locations, routePoints }: { locations: any[], routePoints: [number, number][] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const apiKey = (import.meta.env as any)?.VITE_GOOGLE_MAPS_API_KEY || '';
  const [metrics, setMetrics] = useState<{ distance: string; duration: string } | null>(null);

  useEffect(() => {
    if (!apiKey) return;

    loadGoogleMapsScript(apiKey, () => {
      if (!mapRef.current) return;
      const google = (window as any).google;

      const mapOptions = {
        center: { lat: VILLEGAS_DEPOT[0], lng: VILLEGAS_DEPOT[1] },
        zoom: 14,
        disableDefaultUI: false,
        zoomControl: true
      };

      const map = new google.maps.Map(mapRef.current, mapOptions);

      // Limitar zoom máximo automático para evitar zoom infinito (vista gris) en puntos únicos
      google.maps.event.addListener(map, 'zoom_changed', () => {
        if (map.getZoom() > 16) {
          map.setZoom(14);
        }
      });

      const bounds = new google.maps.LatLngBounds();
      const infoWindow = new google.maps.InfoWindow();

      // Marcador del depósito
      const depotMarker = new google.maps.Marker({
        position: { lat: VILLEGAS_DEPOT[0], lng: VILLEGAS_DEPOT[1] },
        map: map,
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

      // Marcadores de paradas
      locations.forEach((loc, idx) => {
        const marker = new google.maps.Marker({
          position: { lat: loc.lat, lng: loc.lng },
          map: map,
          label: {
            text: String(idx + 1),
            color: '#FFFFFF',
            fontWeight: 'bold',
            fontSize: '11px'
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#1D1D1F',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 12,
            labelOrigin: new google.maps.Point(0, 0)
          },
          title: `${idx + 1}º Parada: ${loc.name}`
        });

        bounds.extend(marker.getPosition());
        marker.addListener('click', () => {
          infoWindow.setContent(`<b>${idx + 1}º Parada: ${loc.name}</b><br/>Comprobante: ${loc.invoice}<br/>Dirección: ${loc.address}`);
          infoWindow.open(map, marker);
        });
      });

      // Función auxiliar para dibujar ruta estática en caso de fallback
      const drawFallbackRoute = () => {
        if (routePoints.length > 1) {
          const pathCoords = routePoints.map(p => ({ lat: p[0], lng: p[1] }));
          const routePath = new google.maps.Polyline({
            path: pathCoords,
            geodesic: true,
            strokeColor: '#E30613',
            strokeOpacity: 0.85,
            strokeWeight: 4,
          });
          routePath.setMap(map);
          map.fitBounds(bounds);
        }
      };

      // Trazado de ruta con Google Directions Service (si hay localizaciones válidas)
      if (locations.length > 0) {
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
          map: map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#E30613',
            strokeOpacity: 0.85,
            strokeWeight: 4,
          }
        });

        const originLatLng = new google.maps.LatLng(VILLEGAS_DEPOT[0], VILLEGAS_DEPOT[1]);
        
        // Google Directions API limita waypoints. Si excedemos, usamos el fallback.
        // También filtramos para asegurar lat/lng válidos.
        const validLocations = locations.filter(l => typeof l.lat === 'number' && typeof l.lng === 'number');

        if (validLocations.length > 0 && validLocations.length <= 25) {
          const waypoints = validLocations.map(loc => ({
            location: new google.maps.LatLng(loc.lat, loc.lng),
            stopover: true
          }));

          const request = {
            origin: originLatLng,
            destination: originLatLng,
            waypoints: waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false // Respetar orden de secuencia TSP ya ordenado en frontend
          };

          directionsService.route(request, (result: any, status: any) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              directionsRenderer.setDirections(result);
              
              // Sumar la distancia total y la duración estimada
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

              let durationStr = '';
              if (hours > 0) {
                durationStr = `${hours} h ${minutes} min`;
              } else {
                durationStr = `${minutes} min`;
              }

              setMetrics({
                distance: `${km} km`,
                duration: durationStr
              });
            } else {
              console.warn("Google Directions falló, usando traza local:", status);
              drawFallbackRoute();
            }
          });
        } else {
          // Demasiados waypoints o ninguno válido -> usar fallback local
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
      <div ref={mapRef} style={{ 
        width: '100%', 
        height: '420px', 
        borderRadius: '8px', 
        border: '1px solid var(--border-color, #e5e5e5)', 
        backgroundColor: '#e5e5e5',
        zIndex: 1
      }}></div>
    </div>
  );
}

// Sub-componente para inyectar Leaflet y renderizar el mapa
function LeafletRouteMap({ locations, routePoints }: { locations: any[], routePoints: [number, number][] }) {
  const mapRef = useRef<any>(null);
  
  useEffect(() => {
    // 1. Inyectar CSS de Leaflet
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    
    // 2. Inyectar JS de Leaflet
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        initMap();
      };
      document.head.appendChild(script);
    } else {
      const checkL = setInterval(() => {
        if ((window as any).L) {
          clearInterval(checkL);
          initMap();
        }
      }, 100);
    }
    
    function initMap() {
      const L = (window as any).L;
      if (!L) return;
      
      // Destruir mapa previo si existe
      if (mapRef.current) {
        mapRef.current.remove();
      }
      
      // Crear contenedor de mapa
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

      // Marcador del Depósito (Base)
      L.marker(VILLEGAS_DEPOT, { icon: redIcon })
        .addTo(map)
        .bindPopup('<b>DEPÓSITO CENTRAL DV</b><br/>Moreno 200, Gral Villegas');

      // Añadir marcadores de entrega
      locations.forEach((loc, idx) => {
        const numberedIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color:#1D1D1F; color:white; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:10px; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3);">${idx + 1}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        L.marker([loc.lat, loc.lng], { icon: numberedIcon })
          .addTo(map)
          .bindPopup(`<b>${idx + 1}º Parada: ${loc.name}</b><br/>Comprobante: ${loc.invoice}<br/>Dirección: ${loc.address}`);
      });
      
      // Trazar línea de ruta
      if (routePoints.length > 1) {
        L.polyline(routePoints, { color: '#E30613', weight: 4, opacity: 0.85 }).addTo(map);
        // Ajustar límites del mapa
        map.fitBounds(L.polyline(routePoints).getBounds(), { padding: [40, 40] });
      }
    }
    
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [locations, routePoints]);
  
  return (
    <div id="leaflet-map-div" style={{ 
      width: '100%', 
      height: '420px', 
      borderRadius: '8px', 
      border: '1px solid var(--border-color)', 
      backgroundColor: '#f0f0f0',
      zIndex: 1
    }}></div>
  );
}

// Wrapper unificado que decide cuál renderizar
function RouteMap({ locations, routePoints }: { locations: any[], routePoints: [number, number][] }) {
  const apiKey = (import.meta.env as any)?.VITE_GOOGLE_MAPS_API_KEY || '';
  
  if (apiKey) {
    return <GoogleRouteMap locations={locations} routePoints={routePoints} />;
  }
  return <LeafletRouteMap locations={locations} routePoints={routePoints} />;
}

// Componente de impresión de Hoja de Ruta (oculto en pantalla, visible al imprimir)
function PrintRouteSheet({ route, locations }: { route: any; locations: any[] }) {
  if (!route) return null;

  // Generar URL de Google Maps para el chofer
  const originStr = `${VILLEGAS_DEPOT[0]},${VILLEGAS_DEPOT[1]}`;
  const waypointsStr = locations.map(loc => `${loc.lat},${loc.lng}`).join('|');
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${originStr}&waypoints=${encodeURIComponent(waypointsStr)}&travelmode=driving`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(googleMapsUrl)}`;

  const totalAmount = route.orders?.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0) || 0;

  return (
    <div className="print-only" style={{ padding: '20px', color: '#000', backgroundColor: '#fff', width: '100%' }}>
      {/* Cabecera del Documento */}
      <div className="print-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1D1D1F', paddingBottom: '10px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <img 
              src="/logo.png" 
              alt="Logo DV" 
              style={{ height: '50px', width: 'auto', objectFit: 'contain', display: 'block', alignSelf: 'flex-start' }} 
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const textEl = e.currentTarget.nextSibling as HTMLElement;
                if (textEl) textEl.style.display = 'block';
              }}
            />
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: '#1D1D1F', display: 'none' }}>DISTRIBUIDORA DV</h1>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#555' }}>Logística y Distribución Mayorista de Alimentos y Bebidas</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#E30613' }}>HOJA DE RUTA #{route.id}</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#555' }}>Fecha: {new Date(route.date || route.createdAt).toLocaleDateString('es-AR')}</p>
        </div>
      </div>

      {/* Información de Chofer y Vehículo */}
      <div className="print-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div className="print-card" style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '4px', backgroundColor: '#fafafa' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', fontWeight: 700, borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>Datos de Logística</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
            <div><strong>Chofer:</strong> {route.driverName}</div>
            <div><strong>Patente:</strong> {route.vehiclePlate}</div>
            <div><strong>Vehículo:</strong> {route.vehicleDescription || 'No especificado'}</div>
            <div><strong>Estado del Viaje:</strong> {route.status === 'PENDING' ? 'Pendiente' : route.status === 'IN_TRANSIT' ? 'En Tránsito' : 'Completado'}</div>
          </div>
        </div>

        {/* QR de Navegación GPS para el Chofer */}
        <div className="print-card" style={{ border: '1px solid #ccc', padding: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#fafafa' }}>
          <img src={qrCodeUrl} alt="QR Google Maps" style={{ width: '80px', height: '80px', border: '1px solid #eee' }} />
          <div style={{ fontSize: '0.72rem', lineHeight: '1.3' }}>
            <strong style={{ display: 'block', marginBottom: '4px', color: '#1D1D1F' }}>📲 GPS GOOGLE MAPS</strong>
            Escanea el código QR para abrir el recorrido y navegar parada por parada en tiempo real.
          </div>
        </div>
      </div>

      {/* Secuencia de Paradas (Listado de Clientes) */}
      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 10px 0', borderBottom: '1px solid #1D1D1F', paddingBottom: '4px' }}>Planilla de Entregas y Rendición</h3>
      <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginTop: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th style={{ width: '40px', textAlign: 'center', border: '1px solid #1D1D1F', padding: '6px' }}>Parada</th>
            <th style={{ width: '180px', border: '1px solid #1D1D1F', padding: '6px' }}>Cliente</th>
            <th style={{ border: '1px solid #1D1D1F', padding: '6px' }}>Dirección</th>
            <th style={{ width: '100px', border: '1px solid #1D1D1F', padding: '6px' }}>Comprobante</th>
            <th style={{ width: '100px', textAlign: 'right', border: '1px solid #1D1D1F', padding: '6px' }}>Importe a Cobrar</th>
            <th style={{ width: '130px', border: '1px solid #1D1D1F', padding: '6px' }}>Cobrado Físico ($)</th>
            <th style={{ width: '110px', textAlign: 'center', border: '1px solid #1D1D1F', padding: '6px' }}>Estado Entrega</th>
            <th style={{ width: '140px', border: '1px solid #1D1D1F', padding: '6px' }}>Firma del Cliente</th>
          </tr>
        </thead>
        <tbody>
          {locations.map((stop, idx) => {
            const order = route.orders?.find((o: any) => o.id === stop.id);
            return (
              <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
                <td style={{ textAlign: 'center', fontWeight: 'bold', border: '1px solid #1D1D1F', padding: '6px' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #1D1D1F', padding: '6px' }}>
                  <div style={{ fontWeight: 'bold' }}>{stop.name}</div>
                  {order?.persona?.phone && <div style={{ fontSize: '0.7rem', color: '#555' }}>Tel: {order.persona.phone}</div>}
                  {order?.persona?.cuit && <div style={{ fontSize: '0.7rem', color: '#555' }}>CUIT: {order.persona.cuit}</div>}
                </td>
                <td style={{ border: '1px solid #1D1D1F', padding: '6px' }}>
                  <div>{stop.address}</div>
                </td>
                <td style={{ fontFamily: 'monospace', border: '1px solid #1D1D1F', padding: '6px' }}>{stop.invoice}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', border: '1px solid #1D1D1F', padding: '6px' }}>
                  ${Number(order?.totalAmount || 0).toLocaleString('es-AR')}
                </td>
                <td style={{ fontSize: '0.7rem', border: '1px solid #1D1D1F', padding: '6px' }}>
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '2px', alignItems: 'center' }}>
                    <span style={{ border: '1px solid #555', width: '9px', height: '9px', display: 'inline-block' }}></span> Efec: $__________
                  </div>
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '2px', alignItems: 'center' }}>
                    <span style={{ border: '1px solid #555', width: '9px', height: '9px', display: 'inline-block' }}></span> Transf: $________
                  </div>
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                    <span style={{ border: '1px solid #555', width: '9px', height: '9px', display: 'inline-block' }}></span> Cheq: $________
                  </div>
                </td>
                <td style={{ fontSize: '0.72rem', border: '1px solid #1D1D1F', padding: '6px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', marginBottom: '4px' }}>
                    <span style={{ border: '1px solid #000', width: '9px', height: '9px', display: 'inline-block' }}></span> Entregado
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                    <span style={{ border: '1px solid #000', width: '9px', height: '9px', display: 'inline-block' }}></span> Rechazado
                  </div>
                </td>
                <td style={{ verticalAlign: 'bottom', paddingBottom: '4px', height: '40px', border: '1px solid #1D1D1F', padding: '6px' }}>
                  <div style={{ borderBottom: '1px dotted #555', width: '100%', height: '18px' }}></div>
                  <div style={{ fontSize: '0.6rem', textAlign: 'center', color: '#555', marginTop: '2px' }}>Firma y Aclaración</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Sección de Conciliación en Retorno */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '25px', pageBreakInside: 'avoid' }}>
        <div className="print-card" style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '4px', backgroundColor: '#fafafa' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', fontWeight: 700 }}>Resumen de Valores Totales</h4>
          <table style={{ width: '100%', fontSize: '0.75rem' }}>
            <tbody>
              <tr>
                <td style={{ padding: '3px 0' }}>Total Pedidos Planificados:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{route.orders?.length || 0} entregas</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '3px 0' }}>Total a Cobrar Estimado:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.85rem' }}>${totalAmount.toLocaleString('es-AR')}</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 0', paddingTop: '6px' }}>Efectivo Rendido Físico:</td>
                <td style={{ textAlign: 'right', borderBottom: '1px solid #000' }}>$_________________</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 0' }}>Cheques Rendidos Físico:</td>
                <td style={{ textAlign: 'right', borderBottom: '1px solid #000' }}>$_________________</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 0' }}>Comprobantes de Transf.:</td>
                <td style={{ textAlign: 'right', borderBottom: '1px solid #000' }}>$_________________</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="print-card" style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '4px', backgroundColor: '#fafafa', fontSize: '0.75rem' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', fontWeight: 700 }}>Observaciones y Novedades del Viaje</h4>
          <div style={{ height: '80px', border: '1px solid #ddd', borderRadius: '3px', backgroundColor: '#fff', padding: '4px', marginTop: '6px' }}>
            {/* Espacio para escribir notas de entrega, rechazos o demoras */}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RepartoDashboard() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);

  // Estados para trazas de calles reales por OSRM
  const [createRouteStreetPoints, setCreateRouteStreetPoints] = useState<[number, number][]>([]);
  const [selectedRouteStreetPoints, setSelectedRouteStreetPoints] = useState<[number, number][]>([]);

  // Carga e integración del geocodificador de Google Maps
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [clientCoordsCache, setClientCoordsCache] = useState<{ [key: number]: { lat: number; lng: number; address: string } }>({});

  const apiKey = (import.meta.env as any)?.VITE_GOOGLE_MAPS_API_KEY || '';

  useEffect(() => {
    if (apiKey) {
      loadGoogleMapsScript(apiKey, () => {
        setGoogleLoaded(true);
      });
    }
  }, [apiKey]);

  // Efecto para geocodificar dinámicamente las direcciones de clientes que no estén en la caché
  useEffect(() => {
    if (!googleLoaded) return;

    const personasToGeocode: any[] = [];
    const processedIds = new Set<number>();

    const addPersona = (p: any) => {
      if (!p || !p.id) return;
      if (CLIENT_COORDS[p.id]) return; // Ya tiene coordenadas fijas duras
      
      const expectedAddress = p.address || '';
      const expectedCity = p.city || 'General Villegas';
      const expectedCacheString = `${expectedAddress}, ${expectedCity}`;
      
      if (clientCoordsCache[p.id] && clientCoordsCache[p.id].address === expectedCacheString) {
        return; // Ya está geocodificado con la misma dirección
      }
      if (processedIds.has(p.id)) return;
      processedIds.add(p.id);
      personasToGeocode.push(p);
    };

    pendingOrders.forEach(o => addPersona(o.persona));
    routes.forEach(r => {
      r.orders?.forEach((o: any) => addPersona(o.persona));
    });
    if (selectedRoute?.orders) {
      selectedRoute.orders.forEach((o: any) => addPersona(o.persona));
    }

    if (personasToGeocode.length === 0) return;

    const geocoder = new (window as any).google.maps.Geocoder();
    const newCacheEntries: typeof clientCoordsCache = {};

    let index = 0;
    const processNext = () => {
      if (index >= personasToGeocode.length) {
        if (Object.keys(newCacheEntries).length > 0) {
          setClientCoordsCache(prev => ({ ...prev, ...newCacheEntries }));
        }
        return;
      }

      const p = personasToGeocode[index];
      const street = p.address || '';
      const city = p.city || 'General Villegas';
      const addressString = `${street}, ${city}, Buenos Aires, Argentina`;

      geocoder.geocode({ address: addressString }, (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          newCacheEntries[p.id] = {
            lat: loc.lat(),
            lng: loc.lng(),
            address: `${street}, ${city}`
          };
        } else {
          console.warn(`Geocoding failed for client ${p.name} at address ${addressString}: ${status}`);
          // Fallback con coordenadas deterministas cerca del depósito
          const hash = p.name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
          const lat = -35.030 + ((hash % 100 - 50) * 0.0003);
          const lng = -63.010 + (((hash * 7) % 100 - 50) * 0.0003);
          newCacheEntries[p.id] = {
            lat,
            lng,
            address: street ? `${street}, ${city}` : 'Acceso Villegas S/N, Gral Villegas'
          };
        }
        
        index++;
        // Retardo para evitar sobrecargar la cuota de la API
        setTimeout(processNext, 200);
      });
    };

    processNext();
  }, [googleLoaded, pendingOrders, routes, selectedRoute]);

  // Formulario de nueva ruta
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleDescription, setVehicleDescription] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);

  // Estados para liquidación de hoja de ruta
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleRoute, setSettleRoute] = useState<any | null>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  // const [settleCashDeclared, setSettleCashDeclared] = useState('');
  // const [settleChecksDeclared, setSettleChecksDeclared] = useState('');
  // const [settleTransfersDeclared, setSettleTransfersDeclared] = useState('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  // Estado para filtrado de localidad y zona
  const [selectedCityFilter, setSelectedCityFilter] = useState('ALL');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('ALL');

  // Estados de carga y feedback
  const [_loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRoutesAndOrders = async () => {
    setLoading(true);
    try {
      const allRoutes = await api.getDeliveryRoutes();
      setRoutes(allRoutes);

      const allOrders = await api.getOrders();
      // Órdenes preparadas o facturadas (DELIVERED) que no tengan ruta asignada aún
      const available = allOrders.filter((o: any) => (o.status === 'PREPARED' || o.status === 'DELIVERED') && !o.deliveryRouteId);
      setPendingOrders(available);

      const banks = await api.getBankAccounts();
      setBankAccounts(banks);
    } catch (err: any) {
      setErrorMsg('Error al cargar datos logísticos.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoute = async (routeId: number) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta hoja de ruta? Los pedidos asociados serán liberados.')) {
      return;
    }

    setLoading(true);
    try {
      await api.deleteDeliveryRoute(routeId);
      setSuccessMsg('Hoja de ruta eliminada y pedidos liberados.');
      if (selectedRoute?.id === routeId) {
        setSelectedRoute(null);
      }
      await fetchRoutesAndOrders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar la hoja de ruta.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutesAndOrders();
  }, []);

  const uniqueCities = useMemo(() => {
    const citiesSet = new Set<string>();
    pendingOrders.forEach(o => {
      const city = o.persona?.city;
      if (city) {
        citiesSet.add(city.toUpperCase().trim());
      }
    });
    return Array.from(citiesSet).sort();
  }, [pendingOrders]);

  const uniqueZones = useMemo(() => {
    if (selectedCityFilter === 'ALL') return [];
    const zonesSet = new Set<string>();
    pendingOrders
      .filter(o => o.persona?.city?.toUpperCase().trim() === selectedCityFilter)
      .forEach(o => {
        const route = o.persona?.route;
        if (route) {
          zonesSet.add(route.toUpperCase().trim());
        }
      });
    return Array.from(zonesSet).sort();
  }, [pendingOrders, selectedCityFilter]);

  const filteredPendingOrders = useMemo(() => {
    let list = pendingOrders;
    if (selectedCityFilter !== 'ALL') {
      list = list.filter(o => o.persona?.city?.toUpperCase().trim() === selectedCityFilter);
      if (selectedZoneFilter !== 'ALL') {
        list = list.filter(o => o.persona?.route?.toUpperCase().trim() === selectedZoneFilter);
      }
    }
    return list;
  }, [pendingOrders, selectedCityFilter, selectedZoneFilter]);

  useEffect(() => {
    setSelectedZoneFilter('ALL');
  }, [selectedCityFilter]);

  const handleOpenSettleModal = (route: any) => {
    setSettleRoute(route);
    const initialSettlements = route.orders.map((o: any) => ({
      orderId: o.id,
      clientName: o.persona?.name || 'Cliente',
      invoiceNumber: o.invoiceNumber || `Pedido #${o.id}`,
      amount: Number(o.totalAmount),
      paymentMethod: 'CASH', // Por defecto efectivo
      bankAccountId: bankAccounts[0]?.id || '',
      checkNumber: '',
      checkIssuer: '',
      checkAmount: Number(o.totalAmount)
    }));
    setSettlements(initialSettlements);
    // setSettleCashDeclared('');
    // setSettleChecksDeclared('');
    // setSettleTransfersDeclared('');
    setShowSettleModal(true);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleRoute) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const expectedCash = settlements.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.amount, 0);
      const expectedTransfers = settlements.filter(s => s.paymentMethod === 'BANK_TRANSFER').reduce((sum, s) => sum + s.amount, 0);
      const expectedChecks = settlements.filter(s => s.paymentMethod === 'CHECK').reduce((sum, s) => sum + s.amount, 0);

      await api.settleDeliveryRoute(settleRoute.id, {
        settlements,
        cashDeclared: expectedCash,
        checksDeclared: expectedChecks,
        transfersDeclared: expectedTransfers
      });

      setSuccessMsg(`✨ Hoja de ruta #${settleRoute.id} liquidada y completada con éxito. Cobros registrados.`);
      setShowSettleModal(false);
      setSettleRoute(null);
      setSelectedRoute(null);
      fetchRoutesAndOrders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al liquidar la hoja de ruta.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOrder = (orderId: number) => {
    setSelectedOrderIds((prev: number[]) => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  // --- CÁLCULO DE RUTA ÓPTIMA TSP (Simulada para visualización y ordenamiento) ---
  const currentTspRoute = useMemo(() => {
    if (selectedOrderIds.length === 0) return [];
    
    // Obtener los datos y coordenadas de los pedidos seleccionados
    const targets = selectedOrderIds.map(id => {
      const order = pendingOrders.find(o => o.id === id);
      const persona = order?.persona || { name: 'Cliente', id: 0 };
      const coords = getClientCoords(persona.id, persona.name, persona, clientCoordsCache);
      return {
        id,
        lat: coords.lat,
        lng: coords.lng,
        name: persona.name,
        address: coords.address,
        invoice: order?.invoiceNumber || `Pedido #${id}`
      };
    });

    // Resolver TSP desde el depósito central
    return solveTSP(VILLEGAS_DEPOT, targets);
  }, [selectedOrderIds, pendingOrders, clientCoordsCache]);

  // Puntos del mapa (depósito -> clientes en orden óptimo -> depósito)
  const mapPoints = useMemo(() => {
    if (currentTspRoute.length === 0) return [];
    const points: [number, number][] = [VILLEGAS_DEPOT];
    currentTspRoute.forEach(node => points.push([node.lat, node.lng]));
    points.push(VILLEGAS_DEPOT); // Regreso al depósito
    return points;
  }, [currentTspRoute]);

  // --- MAPA DE LA HOJA DE RUTA ACTIVA SELECCIONADA ---
  const activeRouteTspDetails = useMemo(() => {
    if (!selectedRoute || !selectedRoute.orders) return { locations: [], points: [] };

    const targets = selectedRoute.orders.map((o: any) => {
      const p = o.persona || { name: 'Cliente', id: 0 };
      const coords = getClientCoords(p.id, p.name, p, clientCoordsCache);
      return {
        id: o.id,
        lat: coords.lat,
        lng: coords.lng,
        name: p.name,
        address: coords.address,
        invoice: o.invoiceNumber || `Pedido #${o.id}`
      };
    });

    const route = solveTSP(VILLEGAS_DEPOT, targets);
    const points: [number, number][] = [VILLEGAS_DEPOT];
    route.forEach(node => points.push([node.lat, node.lng]));
    points.push(VILLEGAS_DEPOT);

    return { locations: route, points };
  }, [selectedRoute, clientCoordsCache]);

  // --- TRAZADO VIAL OSRM REAL (Efectos asíncronos para cargar coordenadas de calles) ---
  useEffect(() => {
    if (mapPoints.length < 2) {
      setCreateRouteStreetPoints([]);
      return;
    }
    let active = true;
    fetchOSRMRoute(mapPoints).then(pts => {
      if (active) setCreateRouteStreetPoints(pts);
    });
    return () => { active = false; };
  }, [mapPoints]);

  useEffect(() => {
    if (activeRouteTspDetails.points.length < 2) {
      setSelectedRouteStreetPoints([]);
      return;
    }
    let active = true;
    fetchOSRMRoute(activeRouteTspDetails.points).then(pts => {
      if (active) setSelectedRouteStreetPoints(pts);
    });
    return () => { active = false; };
  }, [activeRouteTspDetails.points]);

  // --- GUARDAR HOJA DE RUTA ---
  const handleCreateRouteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (selectedOrderIds.length === 0) {
      setErrorMsg('Debe seleccionar al menos un pedido para el reparto.');
      return;
    }

    try {
      setLoading(true);
      // Guardar en el orden óptimo calculado por el resolvedor TSP
      const optimalOrderIds = currentTspRoute.map(node => node.id);

      await api.createDeliveryRoute({
        driverName,
        vehiclePlate,
        vehicleDescription,
        orderIds: optimalOrderIds
      });

      setSuccessMsg('✨ Hoja de ruta de reparto creada y optimizada con éxito.');
      setShowCreateModal(false);
      setDriverName('');
      setVehiclePlate('');
      setVehicleDescription('');
      setSelectedOrderIds([]);
      fetchRoutesAndOrders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la hoja de ruta.');
    } finally {
      setLoading(false);
    }
  };

  // --- TRANSICIONAR ESTADO ---
  const handleChangeStatus = async (routeId: number, nextStatus: string) => {
    try {
      setLoading(true);
      await api.updateRouteStatus(routeId, nextStatus);
      setSuccessMsg(`✨ Hoja de ruta #${routeId} actualizada a estado: ${nextStatus === 'IN_TRANSIT' ? 'En Viaje' : 'Completada (Entregada)'}`);
      
      // Sincronizar vista de detalle
      if (selectedRoute && selectedRoute.id === routeId) {
        setSelectedRoute((prev: any) => ({ ...prev, status: nextStatus }));
      }
      fetchRoutesAndOrders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cambiar estado.');
    } finally {
      setLoading(false);
    }
  };

  const logisticsStats = useMemo(() => {
    const inTransitRoutes = routes.filter(r => r.status === 'IN_TRANSIT');
    const onStreetAmount = inTransitRoutes.reduce((sum, r) => {
      const ordersSum = r.orders?.reduce((oSum: number, o: any) => oSum + Number(o.totalAmount || 0), 0) || 0;
      return sum + ordersSum;
    }, 0);

    const pendingRouteCount = routes.filter(r => r.status === 'PENDING').length;
    const totalPreparedAmount = pendingOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

    return {
      inTransitCount: inTransitRoutes.length,
      onStreetAmount,
      pendingRouteCount,
      pendingOrdersCount: pendingOrders.length,
      pendingOrdersAmount: totalPreparedAmount
    };
  }, [routes, pendingOrders]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Feedback alerts */}
      {successMsg && (
        <div className="no-print" style={{
          backgroundColor: 'var(--color-success-bg)',
          borderLeft: '4px solid var(--color-success)',
          color: 'var(--text-primary)',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '0.88rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{successMsg}</span>
          <button className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => setSuccessMsg(null)}>✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="no-print" style={{
          backgroundColor: '#FFF2F2',
          borderLeft: '4px solid var(--color-danger)',
          color: 'var(--text-primary)',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '0.88rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{errorMsg}</span>
          <button className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}

      {/* PANEL DE CONTROL DE REPARTO */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '8px' }}>
        <div className="card" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
            VIAJES ACTIVOS (EN CALLE)
          </span>
          <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#681da8' }}>
            {logisticsStats.inTransitCount} {logisticsStats.inTransitCount === 1 ? 'viaje activo' : 'viajes activos'}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
            Vehículos en distribución activa
          </span>
        </div>

        <div className="card" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
            PEDIDOS EN ESPERA DE VIAJE
          </span>
          <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#3c4043' }}>
            {logisticsStats.pendingOrdersCount} {logisticsStats.pendingOrdersCount === 1 ? 'pedido en espera' : 'pedidos en espera'}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
            Disponibles para armar hojas de ruta
          </span>
        </div>
      </div>

      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* COLUMNA IZQUIERDA: HISTORIAL DE HOJAS DE RUTA */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="card-title" style={{ margin: '0' }}>🚚 Hojas de Ruta de Reparto</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Historial logístico de despachos.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              Crear Hoja de Ruta
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Chofer / Patente</th>
                  <th>Pedidos</th>
                  <th>Estado</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {routes.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center' }}>No hay hojas de ruta registradas.</td></tr>
                ) : (
                  routes.map(r => (
                    <tr 
                      key={r.id} 
                      onClick={() => setSelectedRoute(r)}
                      style={{ 
                        cursor: 'pointer',
                        backgroundColor: selectedRoute?.id === r.id ? 'var(--bg-app)' : 'transparent',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <td style={{ fontWeight: 600 }}>#{r.id}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.driverName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.vehiclePlate} ({r.vehicleDescription})</div>
                      </td>
                      <td>
                        <span className="badge" style={{ backgroundColor: '#E2E2E2' }}>
                          {r.orders?.length || 0} pedidos
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: r.status === 'COMPLETED' ? 'var(--color-success-bg)' :
                                           r.status === 'IN_TRANSIT' ? 'var(--color-info-bg)' : 'var(--color-warning-bg)',
                          color: r.status === 'COMPLETED' ? 'var(--color-success)' :
                                 r.status === 'IN_TRANSIT' ? 'var(--color-info)' : 'var(--color-warning)'
                        }}>
                          {r.status === 'PENDING' ? 'Pendiente' :
                           r.status === 'IN_TRANSIT' ? 'En Viaje' : 'Completado'}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button 
                            className="btn btn-ghost"
                            onClick={() => setSelectedRoute(r)}
                            style={{ padding: '4px', minWidth: 'auto', height: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Ver detalle"
                          >
                            <ChevronRight size={16} />
                          </button>
                          {r.status === 'PENDING' && (
                            <button
                              className="btn btn-ghost"
                              onClick={() => handleDeleteRoute(r.id)}
                              style={{ 
                                padding: '4px', 
                                minWidth: 'auto', 
                                height: 'auto', 
                                color: '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Eliminar hoja de ruta"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* COLUMNA DERECHA: VISTA DE LA RUTA ACTIVA & MAPA DE REPARTO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {selectedRoute ? (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Hoja de Ruta #{selectedRoute.id}</h3>
                  <p style={{ fontSize: '0.8rem' }}>Chofer: <strong>{selectedRoute.driverName}</strong> | Patente: <strong>{selectedRoute.vehiclePlate}</strong></p>
                </div>
                
                {/* Controles de Estado de la Hoja de Ruta */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {selectedRoute.status === 'PENDING' && (
                    <button 
                      className="btn btn-secondary" 
                      style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => handleChangeStatus(selectedRoute.id, 'IN_TRANSIT')}
                    >
                      <Play size={12} />
                      Iniciar Viaje
                    </button>
                  )}
                  {selectedRoute.status === 'IN_TRANSIT' && (
                    <button 
                      className="btn btn-primary" 
                      style={{ fontSize: '0.78rem', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => handleOpenSettleModal(selectedRoute)}
                    >
                      <CheckCircle size={12} />
                      Rendir y Completar Viaje
                    </button>
                  )}
                  <button 
                    className="btn btn-secondary no-print" 
                    style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => window.print()}
                  >
                    <Printer size={12} />
                    Imprimir Hoja
                  </button>
                </div>
              </div>

              {/* Mapa Interactivo Leaflet */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <Map size={14} />
                  <span>Mapa de Recorrido Óptimo (General Villegas)</span>
                </div>
                <RouteMap 
                  locations={activeRouteTspDetails.locations} 
                  routePoints={selectedRouteStreetPoints.length > 0 ? selectedRouteStreetPoints : activeRouteTspDetails.points} 
                />
              </div>

              {/* Paradas del Camión en el Orden de TSP */}
              <div>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '8px' }}>Secuencia de Paradas (TSP)</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeRouteTspDetails.locations.map((stop, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px', 
                        padding: '10px 14px', 
                        backgroundColor: '#F8F8FA', 
                        borderRadius: '6px',
                        fontSize: '0.82rem'
                      }}
                    >
                      <div style={{ 
                        width: '24px', 
                        height: '24px', 
                        borderRadius: '50%', 
                        backgroundColor: 'var(--accent-color)', 
                        color: '#fff', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.78rem'
                      }}>
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{stop.name}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{stop.address}</div>
                      </div>
                      <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        {stop.invoice}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
              <Navigation size={32} style={{ color: 'var(--text-secondary)', marginBottom: '12px' }} />
              <h4>Seleccione una hoja de ruta</h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Haga clic en una hoja de ruta del listado para ver su detalle y mapa óptimo.</p>
            </div>
          )}
        </div>

      </div>

      {/* ====================================================================
          MODAL: CREAR HOJA DE RUTA & OPTIMIZAR TSP
          ==================================================================== */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Crear Hoja de Ruta & Optimizar Recorrido</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleCreateRouteSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', alignItems: 'start' }}>
                
                {/* Formulario Izquierda */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label>Nombre del Chofer</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="ej: Carlos Giménez"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Patente del Vehículo</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="ej: AF-123-ZZ"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Descripción Vehículo</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="ej: Sprinter Roja"
                      value={vehicleDescription}
                      onChange={(e) => setVehicleDescription(e.target.value)}
                    />
                  </div>

                  {/* Listado de pedidos preparados disponibles */}
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        Pedidos Disponibles ({filteredPendingOrders.length})
                      </label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <select 
                          className="input" 
                          style={{ width: '150px', padding: '2px 6px', fontSize: '0.78rem', height: '28px' }}
                          value={selectedCityFilter}
                          onChange={(e) => setSelectedCityFilter(e.target.value)}
                        >
                          <option value="ALL">Todas las localidades</option>
                          {uniqueCities.map(city => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                        {selectedCityFilter !== 'ALL' && uniqueZones.length > 0 && (
                          <select 
                            className="input" 
                            style={{ width: '120px', padding: '2px 6px', fontSize: '0.78rem', height: '28px' }}
                            value={selectedZoneFilter}
                            onChange={(e) => setSelectedZoneFilter(e.target.value)}
                          >
                            <option value="ALL">Todas las zonas</option>
                            {uniqueZones.map(zone => (
                              <option key={zone} value={zone}>{zone}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ 
                      maxHeight: '180px', 
                      overflowY: 'auto', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '6px',
                      padding: '6px'
                    }}>
                      {filteredPendingOrders.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '10px', textAlign: 'center' }}>
                          No hay pedidos disponibles para la localidad seleccionada.
                        </div>
                      ) : (
                        filteredPendingOrders.map(o => (
                          <div 
                            key={o.id} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              padding: '6px 8px', 
                              borderBottom: '1px solid #f0f0f0',
                              fontSize: '0.8rem' 
                            }}
                          >
                            <input 
                              type="checkbox"
                              checked={selectedOrderIds.includes(o.id)}
                              onChange={() => handleToggleOrder(o.id)}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                                <span>{o.persona?.name}</span>
                                {o.persona?.city && (
                                  <span style={{ fontSize: '0.68rem', color: '#681da8', backgroundColor: '#f3e8fd', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                                    {o.persona?.city}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Comprobante: {o.invoiceNumber || 'Remito de Carga'}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Vista previa del Mapa y Secuencia Derecha */}
                <div>
                  {selectedOrderIds.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={14} />
                          Ruta calculada con {selectedOrderIds.length} paradas
                        </span>
                      </div>
                      <RouteMap 
                        locations={currentTspRoute} 
                        routePoints={createRouteStreetPoints.length > 0 ? createRouteStreetPoints : mapPoints} 
                      />
                      
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '8px', backgroundColor: '#FFFEE0', borderRadius: '4px', border: '1px solid #EAE2B7' }}>
                        <strong>💡 Sugerencia TSP:</strong> La ruta se calcula minimizando distancias espaciales saliendo del Depósito Central.
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      height: '340px', 
                      border: '1px dashed var(--border-color)', 
                      borderRadius: '8px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: '20px',
                      backgroundColor: 'var(--bg-app)'
                    }}>
                      <MapPin size={36} style={{ color: 'var(--text-secondary)', marginBottom: '10px' }} />
                      <h5>Vista previa del Mapa</h5>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                        Seleccione pedidos de la lista de la izquierda para trazar el mapa de recorrido óptimo en General Villegas.
                      </p>
                    </div>
                  )}
                </div>

              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                  disabled={selectedOrderIds.length === 0}
                >
                  Generar Hoja de Ruta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: LIQUIDAR / RENDIR VIAJE (HOJA DE RUTA)
          ==================================================================== */}
      {showSettleModal && settleRoute && (() => {
        // const expectedCash = settlements.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.amount, 0);
        // const expectedTransfers = settlements.filter(s => s.paymentMethod === 'BANK_TRANSFER').reduce((sum, s) => sum + s.amount, 0);
        // const expectedChecks = settlements.filter(s => s.paymentMethod === 'CHECK').reduce((sum, s) => sum + s.amount, 0);
        // const expectedCredit = settlements.filter(s => s.paymentMethod === 'CREDITO').reduce((sum, s) => sum + s.amount, 0);

        // const cashDiff = Number(settleCashDeclared || 0) - expectedCash;
        // const checkDiff = Number(settleChecksDeclared || 0) - expectedChecks;
        // const transferDiff = Number(settleTransfersDeclared || 0) - expectedTransfers;

        return (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-content" style={{ maxWidth: '1000px', width: '90vw', padding: '24px' }}>
              <div className="modal-header">
                <h3>Liquidación y Finalización de Viaje - Viaje #{settleRoute.id}</h3>
                <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowSettleModal(false)}>✕</button>
              </div>

              <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: '#f3e8fd', borderRadius: '6px', fontSize: '0.82rem', color: '#681da8' }}>
                🚚 Chofer: <strong>{settleRoute.driverName}</strong> | Patente: <strong>{settleRoute.vehiclePlate}</strong> | Pedidos a rendir: <strong>{settleRoute.orders?.length || 0}</strong>
              </div>

              <form onSubmit={handleSettleSubmit}>
                <div style={{ display: 'block' }}>
                  
                  {/* TABLA DE DETALLE DE PEDIDOS */}
                  <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>Listado de Entregas y Cobros</h4>
                    <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                            <th style={{ padding: '8px 4px' }}>Cliente</th>
                            <th style={{ padding: '8px 4px' }}>Comprobante</th>
                            <th style={{ padding: '8px 4px', width: '160px' }}>Medio de Pago</th>
                            <th style={{ padding: '8px 4px' }}>Detalles Cobro</th>
                          </tr>
                        </thead>
                        <tbody>
                          {settlements.map((set, idx) => (
                            <tr key={set.orderId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '8px 4px', fontWeight: 600 }}>{set.clientName}</td>
                              <td style={{ padding: '8px 4px' }}>{set.invoiceNumber}</td>
                              <td style={{ padding: '8px 4px' }}>
                                <select
                                  className="input"
                                  style={{ padding: '2px 4px', fontSize: '0.78rem', height: '28px' }}
                                  value={set.paymentMethod}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSettlements(prev => prev.map((s, i) => i === idx ? { ...s, paymentMethod: val } : s));
                                  }}
                                >
                                  <option value="CASH">💵 Efectivo</option>
                                  <option value="BANK_TRANSFER">🏦 Transferencia</option>
                                  <option value="CHECK">✍️ Cheque</option>
                                  <option value="CREDITO">💳 A Cuenta (C/C)</option>
                                </select>
                              </td>
                              <td style={{ padding: '8px 4px' }}>
                                {set.paymentMethod === 'BANK_TRANSFER' && (
                                  <select
                                    className="input"
                                    style={{ padding: '2px 4px', fontSize: '0.75rem', height: '28px' }}
                                    value={set.bankAccountId}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setSettlements(prev => prev.map((s, i) => i === idx ? { ...s, bankAccountId: val } : s));
                                    }}
                                  >
                                    {bankAccounts.map(b => (
                                      <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                  </select>
                                )}
                                {set.paymentMethod === 'CHECK' && (
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <input
                                      type="text"
                                      placeholder="N° Cheque"
                                      className="input"
                                      style={{ padding: '2px 4px', fontSize: '0.72rem', height: '28px', width: '70px' }}
                                      value={set.checkNumber}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setSettlements(prev => prev.map((s, i) => i === idx ? { ...s, checkNumber: val } : s));
                                      }}
                                      required
                                    />
                                    <input
                                      type="text"
                                      placeholder="Emisor"
                                      className="input"
                                      style={{ padding: '2px 4px', fontSize: '0.72rem', height: '28px', width: '80px' }}
                                      value={set.checkIssuer}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setSettlements(prev => prev.map((s, i) => i === idx ? { ...s, checkIssuer: val } : s));
                                      }}
                                      required
                                    />
                                  </div>
                                )}
                                {set.paymentMethod === 'CASH' && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>A Caja {settleRoute?.driverName}</span>
                                )}
                                {set.paymentMethod === 'CREDITO' && (
                                  <span style={{ fontSize: '0.72rem', color: '#b78103', fontWeight: 600 }}>Deuda en C/C</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

                <div className="modal-footer" style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowSettleModal(false)}>Cancelar</button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ backgroundColor: '#E30613', borderColor: '#E30613' }}
                  >
                    Confirmar y Liquidar Viaje
                  </button>
                </div>
              </form>

            </div>
          </div>
        );
      })()}

      <PrintRouteSheet route={selectedRoute} locations={activeRouteTspDetails.locations} />
    </div>
  );
}
