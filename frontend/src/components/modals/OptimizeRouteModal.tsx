import React, { useState, useEffect, useMemo } from 'react';
import { X, MapPin, Navigation, Check, RefreshCw, Route as RouteIcon } from 'lucide-react';
import { NativeModalDialog } from './NativeModalDialog';
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
  setSuccessMsg,
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
      const data = res?.data && typeof res.data === 'object' ? res.data : res;
      if (data && Array.isArray(data.orderedClients)) {
        setOptimizedData(data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al optimizar ruta.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleApplySequence = async () => {
    if (!route || !optimizedData) return;
    setIsSaving(true);
    try {
      const newClientIds = optimizedData.orderedClients.map((c) => c.id);
      await api.updateClientSequence(route.id, newClientIds);
      setSuccessMsg(`Secuencia actualizada para "${route.name}".`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la secuencia.');
    } finally {
      setIsSaving(false);
    }
  };

  const mapBounds = useMemo(() => {
    if (!optimizedData || !optimizedData.orderedClients) return null;
    const clientsWithGps = optimizedData.orderedClients.filter(
      (c) => c.latitude !== null && c.longitude !== null && !isNaN(Number(c.latitude)) && !isNaN(Number(c.longitude)),
    );
    if (clientsWithGps.length === 0) return null;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    clientsWithGps.forEach((c) => {
      const lat = Number(c.latitude);
      const lng = Number(c.longitude);
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });

    const latPadding = (maxLat - minLat) * 0.15 || 0.01;
    const lngPadding = (maxLng - minLng) * 0.15 || 0.01;

    return {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding,
      clientsWithGps,
    };
  }, [optimizedData]);

  if (!open || !route) return null;

  return (
    <NativeModalDialog
      isOpen={Boolean(open && route)}
      onClose={onClose}
      ariaLabelledBy="optimize-route-title"
      style={{
        maxWidth: '940px',
        width: '95vw',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff' }}>
        <h3 id="optimize-route-title" style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: '#0f172a' }}>
          Optimizar recorrido · {route.name}
        </h3>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="btn btn-ghost" style={{ padding: '6px' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RouteIcon size={19} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Distancia</div>
              <div className="tabular-nums" style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                {optimizedData ? `${optimizedData.totalDistanceKm} km` : 'Calculando...'}
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={19} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Paradas GPS</div>
              <div className="tabular-nums" style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                {optimizedData ? `${optimizedData.optimizedClientsCount} / ${optimizedData.totalClients}` : '0'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '16px', minHeight: '360px' }}>
          <div style={{ backgroundColor: '#090d16', borderRadius: '10px', border: '1px solid #1e293b', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', color: '#94a3b8', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Navigation size={14} color="#38bdf8" /> Recorrido
              </span>
            </div>

            <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: '290px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isOptimizing ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                  <RefreshCw size={22} className="spin" />
                  <span style={{ fontSize: '0.84rem' }}>Calculando...</span>
                </div>
              ) : mapBounds && mapBounds.clientsWithGps.length > 0 ? (
                <svg style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#e30613" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
                    </linearGradient>
                  </defs>

                  {(() => {
                    const points = mapBounds.clientsWithGps.map((c) => {
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
                          <g key={p.client.id}>
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
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>
                  Sin coordenadas GPS registradas.
                </div>
              )}
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Secuencia</span>
              <span className="tabular-nums" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{optimizedData?.orderedClients.length || 0}</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {optimizedData?.orderedClients.map((client, idx) => (
                <div key={client.id} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: idx === 0 ? '#f8fafc' : '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="tabular-nums" style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: idx === 0 ? '#e30613' : '#0f172a', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {client.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {client.address || '-'}{client.city ? ` · ${client.city}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-color)', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '8px 16px' }}>
          Cancelar
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRunOptimization}
            disabled={isOptimizing}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={isOptimizing ? 'spin' : ''} />
            <span>Recalcular</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleApplySequence}
            disabled={isSaving || !optimizedData}
            style={{ backgroundColor: '#e30613', borderColor: '#e30613', color: '#ffffff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px' }}
          >
            <Check size={15} />
            <span>{isSaving ? 'Guardando...' : 'Aplicar secuencia'}</span>
          </button>
        </div>
      </div>
    </NativeModalDialog>
  );
};
