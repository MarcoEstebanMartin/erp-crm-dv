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
  ChevronRight
} from 'lucide-react';

// Coordenadas fijas simuladas para clientes en General Villegas
const VILLEGAS_DEPOT: [number, number] = [-35.030, -63.010]; // Moreno 200, Villegas (Base/Depósito)

const CLIENT_COORDS: { [key: number]: { lat: number; lng: number; address: string } } = {
  1: { lat: -35.032, lng: -63.008, address: 'Moreno 142, General Villegas' },
  2: { lat: -35.028, lng: -63.015, address: 'Rivadavia 350, General Villegas' },
  3: { lat: -35.035, lng: -63.012, address: 'Castelli 580, General Villegas' },
};

function getClientCoords(clientId: number, clientName: string) {
  if (CLIENT_COORDS[clientId]) return CLIENT_COORDS[clientId];
  // Generar coordenadas deterministas cerca del depósito
  const hash = clientName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const lat = -35.030 + ((hash % 100 - 50) * 0.0003);
  const lng = -63.010 + (((hash * 7) % 100 - 50) * 0.0003);
  return { lat, lng, address: `Acceso Villegas S/N, Gral Villegas` };
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
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(map);
      
      const defaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
      });

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
        L.marker([loc.lat, loc.lng], { icon: defaultIcon })
          .addTo(map)
          .bindPopup(`<b>${idx + 1}º Parada: ${loc.name}</b><br/>Comprobante: ${loc.invoice}<br/>Dirección: ${loc.address}`);
      });
      
      // Trazar línea de ruta
      if (routePoints.length > 1) {
        L.polyline(routePoints, { color: '#E30613', weight: 4, opacity: 0.75, dashArray: '5, 10' }).addTo(map);
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

export default function RepartoDashboard() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);

  // Formulario de nueva ruta
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleDescription, setVehicleDescription] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);

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
      // Órdenes preparadas (armadas por depósito) que no tienen hoja de ruta asignada
      const available = allOrders.filter((o: any) => o.status === 'PREPARED' && !o.deliveryRouteId);
      setPendingOrders(available);
    } catch (err: any) {
      setErrorMsg('Error al cargar datos logísticos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutesAndOrders();
  }, []);

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
      const coords = getClientCoords(persona.id, persona.name);
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
  }, [selectedOrderIds, pendingOrders]);

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
      const coords = getClientCoords(p.id, p.name);
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
  }, [selectedRoute]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Feedback alerts */}
      {successMsg && (
        <div style={{
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
        <div style={{
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
        
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
                      <td>
                        <ChevronRight size={16} />
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
                      onClick={() => handleChangeStatus(selectedRoute.id, 'COMPLETED')}
                    >
                      <CheckCircle size={12} />
                      Completar Ruta
                    </button>
                  )}
                </div>
              </div>

              {/* Mapa Interactivo Leaflet */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <Map size={14} />
                  <span>Mapa de Recorrido Óptimo (General Villegas)</span>
                </div>
                <LeafletRouteMap 
                  locations={activeRouteTspDetails.locations} 
                  routePoints={activeRouteTspDetails.points} 
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
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '6px' }}>
                      Pedidos Armados Disponibles ({pendingOrders.length})
                    </label>
                    <div style={{ 
                      maxHeight: '180px', 
                      overflowY: 'auto', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '6px',
                      padding: '6px'
                    }}>
                      {pendingOrders.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '10px', textAlign: 'center' }}>
                          No hay pedidos preparados en depósito esperando reparto.
                        </div>
                      ) : (
                        pendingOrders.map(o => (
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
                              <div style={{ fontWeight: 600 }}>{o.persona?.name}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Comprobante: {o.invoiceNumber}</div>
                            </div>
                            <div style={{ fontWeight: 600 }}>${Number(o.totalAmount).toLocaleString()}</div>
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
                      <LeafletRouteMap locations={currentTspRoute} routePoints={mapPoints} />
                      
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

    </div>
  );
}
