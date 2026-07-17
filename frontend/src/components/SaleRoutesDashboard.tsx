import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  MapPin, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  User, 
  Calendar, 
  TrendingUp, 
  Search, 
  X, 
  ChevronRight,
  Loader2,
  DollarSign
} from 'lucide-react';

interface Client {
  id: number;
  name: string;
  cuit: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  outstandingBalance: number | string;
  routeSequence: number | null;
  route?: string | null;
  routeVisits?: any[];
  isActive?: boolean;
}

interface SaleRoute {
  id: number;
  name: string;
  sellerId: number | null;
  dayOfWeek: string | null;
  isActive: boolean;
  seller?: {
    id: number;
    username: string;
  } | null;
  clients?: Client[];
  _count?: {
    clients: number;
  };
}

export default function SaleRoutesDashboard() {
  const [routes, setRoutes] = useState<SaleRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<SaleRoute | null>(null);
  const [sellers, setSellers] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [searchClientQuery, setSearchClientQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para modal de crear/editar ruta
  const [routeModal, setRouteModal] = useState({
    open: false,
    mode: 'create',
    data: { id: 0, name: '', sellerId: '' as string | number, dayOfWeek: '' }
  });

  const DAYS_OF_WEEK = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [routesData, sellersData, clientsData] = await Promise.all([
        api.getSaleRoutes(),
        api.getSellersList(),
        api.getPersonas('client')
      ]);

      setRoutes(routesData.routes || []);
      setSellers(sellersData || []);
      setAllClients((clientsData || []).filter((c: any) => c.isActive !== false));

      if (routesData.routes && routesData.routes.length > 0) {
        // Cargar por defecto la primera ruta
        handleSelectRoute(routesData.routes[0].id);
      } else {
        setLoading(false);
      }
    } catch (e: any) {
      console.error(e);
      setError('Error al cargar datos iniciales: ' + e.message);
      setLoading(false);
    }
  };

  const handleSelectRoute = async (routeId: number) => {
    setLoadingRoute(true);
    try {
      const res = await api.getSaleRouteById(routeId);
      setSelectedRoute(res.route);
    } catch (e: any) {
      console.error(e);
      alert('Error al cargar detalle de ruta: ' + e.message);
    } finally {
      setLoadingRoute(false);
      setLoading(false);
    }
  };

  const reloadRoutesOnly = async (selectId?: number) => {
    try {
      const routesData = await api.getSaleRoutes();
      setRoutes(routesData.routes || []);
      const targetId = selectId || selectedRoute?.id;
      if (targetId) {
        const res = await api.getSaleRouteById(targetId);
        setSelectedRoute(res.route);
      }
    } catch (e) {
      console.error('Error al recargar rutas:', e);
    }
  };

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    const { id, name, sellerId, dayOfWeek } = routeModal.data;
    if (!name.trim()) return;

    try {
      const payload = {
        name,
        sellerId: sellerId === '' ? null : Number(sellerId),
        dayOfWeek: dayOfWeek === '' ? null : dayOfWeek
      };

      if (routeModal.mode === 'create') {
        const newRoute = await api.createSaleRoute(payload);
        setRouteModal({ ...routeModal, open: false });
        await fetchInitialData(); // Recarga todo y selecciona la nueva si es la única
        if (newRoute && newRoute.route) {
          handleSelectRoute(newRoute.route.id);
        }
      } else {
        await api.updateSaleRoute(id, payload);
        setRouteModal({ ...routeModal, open: false });
        await reloadRoutesOnly(id);
      }
    } catch (e: any) {
      alert('Error al guardar ruta: ' + e.message);
    }
  };

  const handleDeleteRoute = async (routeId: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta ruta? Los clientes asociados no serán eliminados, pero quedarán sin ruta asignada.')) {
      return;
    }

    try {
      await api.deleteSaleRoute(routeId);
      setSelectedRoute(null);
      await fetchInitialData();
    } catch (e: any) {
      alert('Error al eliminar ruta: ' + e.message);
    }
  };

  const handleMoveClient = async (clientId: number, direction: 'up' | 'down') => {
    if (!selectedRoute || !selectedRoute.clients) return;

    const clients = [...selectedRoute.clients];
    const index = clients.findIndex(c => c.id === clientId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= clients.length) return;

    // Intercambiar elementos
    const temp = clients[index];
    clients[index] = clients[targetIndex];
    clients[targetIndex] = temp;

    // Actualizar optimísticamente en el estado
    setSelectedRoute({ ...selectedRoute, clients });

    try {
      const ids = clients.map(c => c.id);
      await api.updateClientSequence(selectedRoute.id, ids);
      // Recargar para confirmar con base de datos
      await reloadRoutesOnly();
    } catch (e: any) {
      alert('Error al reordenar clientes: ' + e.message);
      // Revertir recargando
      handleSelectRoute(selectedRoute.id);
    }
  };

  const handleRemoveClientFromRoute = async (clientId: number) => {
    if (!selectedRoute) return;
    if (!confirm('¿Quitar a este cliente de la ruta?')) return;

    try {
      await api.updatePersona(clientId, { saleRouteId: null, routeSequence: null });
      // Recargar clientes disponibles y la ruta actual
      const clientsData = await api.getPersonas('client');
      setAllClients((clientsData || []).filter((c: any) => c.isActive !== false));
      await reloadRoutesOnly();
    } catch (e: any) {
      alert('Error al quitar cliente: ' + e.message);
    }
  };

  const handleAddClientToRoute = async (clientId: number) => {
    if (!selectedRoute) return;

    try {
      await api.addClientToRoute(selectedRoute.id, clientId);
      // Recargar clientes disponibles y la ruta actual
      const clientsData = await api.getPersonas('client');
      setAllClients((clientsData || []).filter((c: any) => c.isActive !== false));
      await reloadRoutesOnly();
    } catch (e: any) {
      alert('Error al agregar cliente a la ruta: ' + e.message);
    }
  };

  // Filtrar clientes no asignados a esta ruta para el buscador de la derecha
  const availableClients = allClients.filter(c => {
    // No debe pertenecer a la ruta actual
    const inCurrentRoute = selectedRoute?.clients?.some(sc => sc.id === c.id) || false;
    if (inCurrentRoute) return false;

    // Búsqueda por query
    if (!searchClientQuery) return true;
    return c.name.toLowerCase().includes(searchClientQuery.toLowerCase()) || 
           (c.city && c.city.toLowerCase().includes(searchClientQuery.toLowerCase())) ||
           (c.cuit && c.cuit.includes(searchClientQuery));
  });

  // Calcular estadísticas de la ruta seleccionada
  const getRouteStats = () => {
    if (!selectedRoute || !selectedRoute.clients) return { totalDeuda: 0, visitados: 0, total: 0 };
    
    const totalDeuda = selectedRoute.clients.reduce((acc, c) => acc + Number(c.outstandingBalance || 0), 0);
    const visitados = selectedRoute.clients.filter(c => c.routeVisits && c.routeVisits.length > 0).length;
    const total = selectedRoute.clients.length;

    return { totalDeuda, visitados, total };
  };

  const stats = getRouteStats();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--text-secondary)' }} />
        <span style={{ fontSize: '14px', color: '#666', fontWeight: 500 }}>Cargando rutas de venta...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: 'calc(100vh - 120px)' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>Rutas de Venta (Vendedores)</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Configura el recorrido secuencial de visitas de los vendedores en la calle.</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => setRouteModal({ open: true, mode: 'create', data: { id: 0, name: '', sellerId: '', dayOfWeek: '' } })}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          <span>Nueva Ruta</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={16} /></button>
        </div>
      )}

      {/* Grid Principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', gap: '16px', flex: 1, minHeight: 0 }}>
        
        {/* Columna Izquierda: Listado de Rutas */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#fff' }}>
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-light)', fontWeight: 600, fontSize: '0.85rem' }}>
            Rutas Activas ({routes.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
            {routes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No hay rutas creadas.
              </div>
            ) : (
              routes.map(r => {
                const isSelected = selectedRoute?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectRoute(r.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(0,0,0,0.04)' : 'transparent',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--border-color)' : 'transparent',
                      transition: 'all 0.2s ease',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                    className="route-item-hover"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <span style={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.name}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        👤 {r.seller?.username || 'Sin vendedor'}
                      </span>
                      {r.dayOfWeek && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--accent-color)', textTransform: 'uppercase' }}>
                          📅 {r.dayOfWeek}
                        </span>
                      )}
                    </div>
                    <ChevronRight size={14} style={{ color: isSelected ? 'var(--text-primary)' : 'var(--border-color)', flexShrink: 0 }} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Columna Central: Detalle de Ruta */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#fff' }}>
          {loadingRoute ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px' }}>
              <Loader2 className="animate-spin" size={24} style={{ color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: '13px', color: '#666' }}>Cargando detalles de ruta...</span>
            </div>
          ) : selectedRoute ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {/* Info de Ruta */}
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{selectedRoute.name}</h3>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <User size={13} /> Vendedor: <strong>{selectedRoute.seller?.username || 'No asignado'}</strong>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Calendar size={13} /> Día: <strong>{selectedRoute.dayOfWeek || 'Flexible'}</strong>
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setRouteModal({ 
                      open: true, 
                      mode: 'edit', 
                      data: { 
                        id: selectedRoute.id, 
                        name: selectedRoute.name, 
                        sellerId: selectedRoute.sellerId || '', 
                        dayOfWeek: selectedRoute.dayOfWeek || '' 
                      } 
                    })}
                  >
                    Editar Info
                  </button>
                  <button 
                    className="btn btn-sm"
                    onClick={() => handleDeleteRoute(selectedRoute.id)}
                    style={{ color: 'var(--color-corp-red)', border: '1px solid rgba(var(--color-corp-red-rgb),0.2)', backgroundColor: 'rgba(var(--color-corp-red-rgb),0.02)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Grid de Estadísticas Rápidas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ padding: '12px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Clientes Totales</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>{stats.total}</div>
                </div>
                <div style={{ padding: '12px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Deuda Total</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: stats.totalDeuda > 0 ? 'var(--color-corp-red)' : 'var(--text-primary)', marginTop: '2px' }}>
                    ${Math.round(stats.totalDeuda).toLocaleString('es-AR')}
                  </div>
                </div>
                <div style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Visitas Hoy</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <TrendingUp size={16} />
                    <span>{stats.visitados} / {stats.total}</span>
                    {stats.total > 0 && (
                      <span style={{ fontSize: '0.72rem', color: '#666', fontWeight: 500 }}>({Math.round((stats.visitados / stats.total) * 100)}%)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Listado de Clientes en la Ruta (Secuenciado) */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {!selectedRoute.clients || selectedRoute.clients.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 12px', color: 'var(--text-secondary)' }}>
                    <MapPin size={28} style={{ marginBottom: '8px', opacity: 0.5 }} />
                    <span style={{ fontSize: '0.85rem' }}>No hay clientes asignados a esta ruta.</span>
                    <span style={{ fontSize: '0.75rem', marginTop: '4px' }}>Búscalos y agrégalos desde el panel de la derecha.</span>
                  </div>
                ) : (
                  <div className="table-container" style={{ margin: 0, boxShadow: 'none', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                    <table style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-light)' }}>
                          <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                          <th>Cliente</th>
                          <th>Zona de Reparto (Chofer)</th>
                          <th>Dirección / Ciudad</th>
                          <th style={{ width: '90px', textAlign: 'right' }}>Deuda</th>
                          <th style={{ width: '120px', textAlign: 'center' }}>Secuencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRoute.clients.map((c, index) => {
                          const isFirst = index === 0;
                          const isLast = index === selectedRoute.clients!.length - 1;
                          const hasVisitToday = c.routeVisits && c.routeVisits.length > 0;
                          const visit = hasVisitToday ? c.routeVisits![0] : null;

                          return (
                            <tr key={c.id}>
                              <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                {index + 1}
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>CUIT: {c.cuit || 'Sin CUIT'}</span>
                                </div>
                              </td>
                              <td>
                                {c.route ? (
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                    📍 {c.route}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.72rem', color: '#999', fontStyle: 'italic' }}>Sin Zona</span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span>{c.address || 'Sin dirección'}</span>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{c.city || 'Sin ciudad'}</span>
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: Number(c.outstandingBalance) > 0 ? 'var(--color-corp-red)' : 'inherit' }}>
                                ${Math.round(Number(c.outstandingBalance)).toLocaleString('es-AR')}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                                  <button
                                    onClick={() => handleMoveClient(c.id, 'up')}
                                    disabled={isFirst}
                                    style={{
                                      padding: '3px',
                                      border: '1px solid var(--border-color)',
                                      borderRadius: '4px',
                                      backgroundColor: '#fff',
                                      cursor: isFirst ? 'not-allowed' : 'pointer',
                                      opacity: isFirst ? 0.3 : 1
                                    }}
                                    title="Subir en el recorrido"
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleMoveClient(c.id, 'down')}
                                    disabled={isLast}
                                    style={{
                                      padding: '3px',
                                      border: '1px solid var(--border-color)',
                                      borderRadius: '4px',
                                      backgroundColor: '#fff',
                                      cursor: isLast ? 'not-allowed' : 'pointer',
                                      opacity: isLast ? 0.3 : 1
                                    }}
                                    title="Bajar en el recorrido"
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveClientFromRoute(c.id)}
                                    style={{
                                      padding: '3px',
                                      border: '1px solid rgba(var(--color-corp-red-rgb),0.2)',
                                      borderRadius: '4px',
                                      backgroundColor: 'rgba(var(--color-corp-red-rgb),0.02)',
                                      color: 'var(--color-corp-red)',
                                      cursor: 'pointer',
                                      marginLeft: '4px'
                                    }}
                                    title="Quitar de la ruta"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-secondary)', padding: '24px' }}>
              <MapPin size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>No hay ninguna ruta seleccionada</span>
              <span style={{ fontSize: '0.78rem', marginTop: '4px' }}>Selecciona una ruta de venta a la izquierda o crea una nueva.</span>
            </div>
          )}
        </div>

        {/* Columna Derecha: Agregar Clientes a la Ruta */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#fff' }}>
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-light)', fontWeight: 600, fontSize: '0.85rem' }}>
            Asignar Clientes
          </div>
          
          {/* Input de Búsqueda */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search size={14} style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchClientQuery}
              onChange={(e) => setSearchClientQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '0.8rem',
                backgroundColor: 'transparent'
              }}
            />
            {searchClientQuery && (
              <X size={14} style={{ color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setSearchClientQuery('')} />
            )}
          </div>

          {/* Listado de Clientes Disponibles */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
            {!selectedRoute ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                Selecciona una ruta para poder agregar clientes.
              </div>
            ) : availableClients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                No se encontraron clientes disponibles.
              </div>
            ) : (
              availableClients.map(c => (
                <div
                  key={c.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem',
                    backgroundColor: '#fff'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, marginRight: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📍 {c.city || 'Sin ciudad'} {c.address ? `(${c.address})` : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => handleAddClientToRoute(c.id)}
                    style={{
                      padding: '4px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(0, 122, 255, 0.05)',
                      border: '1px solid rgba(0, 122, 255, 0.15)',
                      color: '#007AFF',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0
                    }}
                    title="Agregar a la ruta actual"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Modal para Crear / Editar Ruta */}
      {routeModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            width: '400px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{routeModal.mode === 'create' ? 'Nueva Ruta de Venta' : 'Editar Ruta de Venta'}</span>
              <button 
                onClick={() => setRouteModal({ ...routeModal, open: false })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveRoute} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Nombre de la Ruta
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Villegas - Centro Lunes"
                  value={routeModal.data.name}
                  onChange={(e) => setRouteModal({
                    ...routeModal,
                    data: { ...routeModal.data, name: e.target.value }
                  })}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Vendedor Asignado
                </label>
                <select
                  className="select"
                  value={routeModal.data.sellerId}
                  onChange={(e) => setRouteModal({
                    ...routeModal,
                    data: { ...routeModal.data, sellerId: e.target.value }
                  })}
                >
                  <option value="">-- No Asignado --</option>
                  {sellers.map(s => (
                    <option key={s.id} value={s.id}>{s.username}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Día de la Semana
                </label>
                <select
                  className="select"
                  value={routeModal.data.dayOfWeek}
                  onChange={(e) => setRouteModal({
                    ...routeModal,
                    data: { ...routeModal.data, dayOfWeek: e.target.value }
                  })}
                >
                  <option value="">-- Flexible / No Definido --</option>
                  {DAYS_OF_WEEK.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setRouteModal({ ...routeModal, open: false })}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {routeModal.mode === 'create' ? 'Crear' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
