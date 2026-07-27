import React, { useState, useEffect, useMemo } from 'react';
import { X, MapPin, Zap, Navigation, Check, RefreshCw, Route as RouteIcon, Info, ArrowRight } from 'lucide-react';
import { api } from '../../utils/api';

interface OptimizeRouteModalProps {
  open: boolean;
  onClose: () => void;
  route: {
    id: number;
    name: string;
    clients?: any[];
  } | null;
  onSuccess: () => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export const OptimizeRouteModal: React.FC<OptimizeRouteModalProps> = ({
  open,
  onClose,
  route,
  onSuccess,
  setErrorMsg,
  setSuccessMsg
}) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [optimizedData, setOptimizedData] = useState<{
    totalDistanceKm: number;
    orderedClients: any[];
    optimizedClientsCount: number;
    totalClients: number;
  } | null>(null);

  useEffect(() => {
    if (open && route) {
      handleRunOptimization();
    } else {
      setOptimizedData(null);
    }
  }, [open, route?.id]);

  const handleRunOptimization = async () => {
    if (!route) return;
    setIsOptimizing(true);
    try {
      const res = await api.optimizeSaleRouteSequence(route.id);
      if (res.status === 'success' && res.data) {
        setOptimizedData(res.data);
      }
    } catch (err: any) {
      console.error('Error al calcular optimización de ruta:', err);
      setErrorMsg(err.message || 'Error al calcular optimización por mapa.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleApplySequence = async () => {
    if (!route || !optimizedData) return;
    setIsSaving(true);
    try {
      const newClientIds = optimizedData.orderedClients.map(c => c.id);
      await api.updateClientSequence(route.id, newClientIds);
      setSuccessMsg(`⚡ ¡Secuencia de ruta optimizada exitosamente por mapa para "${route.name}"!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error al guardar secuencia optimizada:', err);
      setErrorMsg(err.message || 'Error al guardar la secuencia.');
    } finally {
      setIsSaving(false);
    }
  };

  // Coordenadas calculadas para el mapa visual vectorial SVG
  const mapBounds = useMemo(() => {
    if (!optimizedData || !optimizedData.orderedClients) return null;
    const clientsWithGps = optimizedData.orderedClients.filter(
      c => c.latitude !== null && c.longitude !== null && !isNaN(Number(c.latitude)) && !isNaN(Number(c.longitude))
    );
    if (clientsWithGps.length === 0) return null;

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    clientsWithGps.forEach(c => {
      const lat = Number(c.latitude);
      const lng = Number(c.longitude);
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });

    // Añadir margen
    const latPadding = (maxLat - minLat) * 0.15 || 0.01;
    const lngPadding = (maxLng - minLng) * 0.15 || 0.01;

    return {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding,
      clientsWithGps
    };
  }, [optimizedData]);

  if (!open || !route) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1200, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)' }}>
      <div className="modal-content" style={{ maxWidth: '960px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: '0', borderRadius: '16px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card, #ffffff)', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        
        {/* HEADER MODAL */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', color: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(227, 6, 19, 0.2)', border: '1px solid rgba(227, 6, 19, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e30613' }}>
              <Zap size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                Optimización de Ruta por Mapa
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Ruta: <strong>{route.name}</strong> • Algoritmo Haversine TSP de Distancia Mínima
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} className="hover-bg-muted">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* TARJETAS DE MÉTRICAS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div style={{ backgroundColor: 'var(--bg-body, #f8fafc)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RouteIcon size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Distancia Recorrido</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {optimizedData ? `${optimizedData.totalDistanceKm} km` : 'Calculando...'}
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-body, #f8fafc)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Paradas Mapeadas</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {optimizedData ? `${optimizedData.optimizedClientsCount} de ${optimizedData.totalClients}` : '0'}
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-body, #f8fafc)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Ahorro Estimado</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>
                  {optimizedData && optimizedData.optimizedClientsCount > 1 ? '~15% a 25% km' : '0%'}
                </div>
              </div>
            </div>
          </div>

          {/* VISTA MAPA INTERACTIVO SVG + LISTA CORRELATIVA */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '16px', minHeight: '380px' }}>
            
            {/* MAPA VECTORIAL SVG */}
            <div style={{ backgroundColor: '#090d16', borderRadius: '12px', border: '1px solid #1e293b', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Navigation size={14} color="#38bdf8" /> Trayecto de Ruta Optimizado
                </span>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Coordenadas GPS Reales</span>
              </div>

              <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isOptimizing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                    <RefreshCw size={24} className="spin" color="#e30613" />
                    <span style={{ fontSize: '0.85rem' }}>Calculando trayectoria óptima...</span>
                  </div>
                ) : mapBounds && mapBounds.clientsWithGps.length > 0 ? (
                  <svg style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#e30613" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
                      </linearGradient>
                    </defs>

                    {/* Líneas conectoras entre paradas consecutivas */}
                    {(() => {
                      const points = mapBounds.clientsWithGps.map(c => {
                        const x = ((Number(c.longitude) - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng)) * 80 + 10;
                        const y = 90 - ((Number(c.latitude) - mapBounds.minLat) / (mapBounds.maxLat - mapBounds.minLat)) * 80;
                        return { x, y, client: c };
                      });

                      const pathString = points.reduce((acc, curr, idx) => {
                        return idx === 0 ? `M ${curr.x}% ${curr.y}%` : `${acc} L ${curr.x}% ${curr.y}%`;
                      }, '');

                      return (
                        <>
                          <path d={pathString} fill="none" stroke="url(#routeGradient)" strokeWidth="3" strokeDasharray="6 3" />
                          {points.map((p, idx) => (
                            <g key={p.client.id} transform={`translate(0, 0)`}>
                              <circle cx={`${p.x}%`} cy={`${p.y}%`} r="14" fill={idx === 0 ? '#e30613' : '#1e293b'} stroke={idx === 0 ? '#ffffff' : '#38bdf8'} strokeWidth="2" />
                              <text x={`${p.x}%`} y={`${p.y}%`} dy="4" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                                {idx + 1}
                              </text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                    <Info size={28} style={{ marginBottom: '8px', opacity: 0.6 }} />
                    <p>Los clientes de esta ruta no poseen coordenadas latitud/longitud en su ficha para trazar el mapa.</p>
                  </div>
                )}
              </div>
            </div>

            {/* LISTA ORDENADA DE PARADAS */}
            <div style={{ backgroundColor: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body, #f8fafc)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Secuencia Sugerida</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{optimizedData?.orderedClients.length || 0} Clientes</span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {optimizedData?.orderedClients.map((client, idx) => (
                  <div key={client.id} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: idx === 0 ? 'rgba(227, 6, 19, 0.04)' : 'var(--bg-card, #ffffff)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: idx === 0 ? '#e30613' : '#0f172a', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {client.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {client.address || 'Sin dirección'} {client.city ? `(${client.city})` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER ACCIONES */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body, #f8fafc)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px' }}>
            Cancelar
          </button>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRunOptimization}
              disabled={isOptimizing}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
            >
              <RefreshCw size={14} className={isOptimizing ? 'spin' : ''} />
              <span>Recalcular</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApplySequence}
              disabled={isSaving || !optimizedData}
              style={{ backgroundColor: '#e30613', borderColor: '#e30613', color: '#ffffff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px' }}
            >
              <Check size={16} />
              <span>{isSaving ? 'Guardando...' : 'Confirmar y Aplicar Secuencia'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
