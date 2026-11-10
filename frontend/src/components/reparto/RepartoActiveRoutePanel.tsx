import React from 'react';
import { Navigation, CheckCircle, Play, Map, Printer } from 'lucide-react';
import { printDeliveryRouteCustodyGuide } from '../../utils/printHelpers';
import { RouteMap } from './LeafletRouteMap';

interface RepartoActiveRoutePanelProps {
  selectedRoute: any | null;
  activeRouteTspDetails: { locations: any[]; points: [number, number][] };
  selectedRouteStreetPoints: [number, number][];
  liveGpsInfo: any;
  gpsHistory: [number, number][];
  expandedStops: { [key: string]: boolean };
  setExpandedStops: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  handleTransferCustody: (route: any) => void;
  handleChangeStatus: (routeId: number, nextStatus: string) => void;
  handleOpenSettleModal: (route: any) => void;
  handleUpdateClientCoords: (clientId: number, lat: number, lng: number) => void;
}

export const RepartoActiveRoutePanel: React.FC<RepartoActiveRoutePanelProps> = ({
  selectedRoute,
  activeRouteTspDetails,
  selectedRouteStreetPoints,
  liveGpsInfo,
  gpsHistory,
  expandedStops,
  setExpandedStops,
  handleTransferCustody,
  handleChangeStatus,
  handleOpenSettleModal,
  handleUpdateClientCoords
}) => {
  if (!selectedRoute) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <Navigation size={32} style={{ color: 'var(--text-secondary)', marginBottom: '12px' }} />
        <h4>Seleccione una hoja de ruta</h4>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Haga clic en una hoja de ruta del listado para ver su detalle y mapa óptimo.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Hoja de Ruta #{selectedRoute.id}</h3>
          <p style={{ fontSize: '0.8rem' }}>
            Chofer: <strong>{selectedRoute.driverName}</strong>
            {selectedRoute.companionName && <> | Acompañante: <strong>{selectedRoute.companionName}</strong></>}
            {' '}| Patente: <strong>{selectedRoute.vehiclePlate}</strong>
          </p>
          {selectedRoute.custodyStatus === 'LOADED_IN_TRANSIT' ? (
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d', backgroundColor: '#dcfce7', padding: '3px 8px', borderRadius: '4px', marginTop: '4px', display: 'inline-block', border: '1px solid #86efac' }}>
              🔒 Custodia Transferida a {selectedRoute.driverName} ({selectedRoute.orders?.reduce((sum: number, o: any) => sum + Math.max(1, Number(o.bultosCount || 1)), 0) || 0} Bultos) {selectedRoute.signedByDriverAt ? '• ' + new Date(selectedRoute.signedByDriverAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''}
            </div>
          ) : (
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', backgroundColor: '#fef3c7', padding: '3px 8px', borderRadius: '4px', marginTop: '4px', display: 'inline-block', border: '1px solid #fde68a' }}>
              ⏳ Carga en Preparación / Pendiente Transferencia a Chofer
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {selectedRoute.custodyStatus !== 'LOADED_IN_TRANSIT' && (
            <button
              className="btn btn-warning"
              style={{ fontSize: '0.78rem', backgroundColor: '#FEF3C7', borderColor: '#F59E0B', color: '#B45309', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={() => handleTransferCustody(selectedRoute)}
              title="Transferir la responsabilidad del stock cargado al chofer"
            >
              🔒 Transferir Custodia Chofer
            </button>
          )}
          {selectedRoute.status === 'PENDING' && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={() => handleChangeStatus(selectedRoute.id, 'IN_TRANSIT')}
            >
              <Play size={12} /> Iniciar Viaje
            </button>
          )}
          {selectedRoute.status === 'IN_TRANSIT' && (
            <button
              className="btn btn-primary"
              style={{ fontSize: '0.78rem', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={() => handleOpenSettleModal(selectedRoute)}
            >
              <CheckCircle size={12} /> Rendir y Completar Viaje
            </button>
          )}
          <button
            className="btn btn-secondary no-print"
            style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => printDeliveryRouteCustodyGuide(selectedRoute)}
            title="Imprimir Guía Oficial de Carga y Acta de Transferencia de Custodia para Chofer"
          >
            <Printer size={12} /> Guía de Carga y Custodia
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <Map size={14} />
            <span>Mapa de Recorrido Óptimo y Posición GPS en Vivo</span>
          </div>
          {liveGpsInfo?.lastGpsUpdate && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontSize: '0.75rem', fontWeight: 600 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.3)' }} />
              GPS Chofer: {liveGpsInfo.currentSpeed !== null && liveGpsInfo.currentSpeed !== undefined ? `${liveGpsInfo.currentSpeed} km/h` : 'En parada'} • Última señal {new Date(liveGpsInfo.lastGpsUpdate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <RouteMap
          locations={activeRouteTspDetails.locations}
          routePoints={selectedRouteStreetPoints.length > 0 ? selectedRouteStreetPoints : activeRouteTspDetails.points}
          onUpdateClientCoords={handleUpdateClientCoords}
          gpsLocation={liveGpsInfo?.currentLat && liveGpsInfo?.currentLng ? {
            lat: liveGpsInfo.currentLat,
            lng: liveGpsInfo.currentLng,
            speed: liveGpsInfo.currentSpeed,
            lastUpdate: liveGpsInfo.lastGpsUpdate,
            vehiclePlate: liveGpsInfo.vehiclePlate || selectedRoute?.vehiclePlate
          } : null}
          gpsTrail={gpsHistory}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '8px', padding: '8px', backgroundColor: 'var(--bg-light, #fafafa)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <div><strong>📍 Consejo:</strong> Si un punto en el mapa está mal ubicado, podés arrastrar su marcador para corregirlo permanentemente en el sistema.</div>
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '8px' }}>Secuencia de Paradas (TSP)</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {activeRouteTspDetails.locations.map((stop: any, idx: number) => {
            const stopKey = `${selectedRoute.id}-${idx}`;
            const isExpanded = !!expandedStops[stopKey];
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div
                  onClick={() => setExpandedStops(prev => ({ ...prev, [stopKey]: !isExpanded }))}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#F8F8FA', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer', userSelect: 'none', border: '1px solid var(--border-color)', transition: 'border-color 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = '#ccc'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--accent-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem' }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {stop.name}
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 400 }}>(ver mercadería)</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{stop.address}</div>
                  </div>
                  <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{stop.invoice}</div>
                </div>

                {isExpanded && (
                  <div style={{ marginLeft: '34px', padding: '10px 12px', borderLeft: '2px solid var(--color-primary, var(--color-corp-red))', backgroundColor: '#fff', borderRadius: '0 4px 4px 0', fontSize: '0.78rem', borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Mercadería del Pedido:
                    </div>
                    {!stop.items || stop.items.length === 0 ? (
                      <div style={{ color: 'var(--text-secondary)' }}>No hay artículos registrados para este pedido.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                            <th style={{ padding: '4px 0', fontWeight: 600 }}>Producto</th>
                            <th style={{ padding: '4px 0', textAlign: 'center', fontWeight: 600, width: '60px' }}>Cant.</th>
                            <th style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, width: '80px' }}>P. Unit</th>
                            <th style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, width: '85px' }}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stop.items.map((item: any) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem' }}>
                              <td style={{ padding: '4px 0', color: 'var(--text-primary)' }}>{item.product?.name || `Producto #${item.productId}`}</td>
                              <td style={{ padding: '4px 0', textAlign: 'center', fontWeight: 500, fontFamily: 'monospace' }}>{item.quantity}</td>
                              <td style={{ padding: '4px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                                {Number(item.unitPrice).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                              </td>
                              <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                                {Number(item.subtotal).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
