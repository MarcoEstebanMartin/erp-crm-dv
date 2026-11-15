import type { FC, Dispatch, SetStateAction } from 'react';
import { Navigation, CheckCircle, Play, Map, Printer, Lock, Clock } from 'lucide-react';
import { printDeliveryRouteCustodyGuide } from '../../utils/printHelpers';
import { RouteMap } from './LeafletRouteMap';

interface RepartoActiveRoutePanelProps {
  selectedRoute: any | null;
  activeRouteTspDetails: { locations: any[]; points: [number, number][] };
  selectedRouteStreetPoints: [number, number][];
  liveGpsInfo: any;
  gpsHistory: [number, number][];
  expandedStops: Record<string, boolean>;
  setExpandedStops: Dispatch<SetStateAction<Record<string, boolean>>>;
  handleTransferCustody: (route: any) => void;
  handleChangeStatus: (routeId: number, nextStatus: string) => void;
  handleOpenSettleModal: (route: any) => void;
  handleUpdateClientCoords: (clientId: number, lat: number, lng: number) => void;
}

export const RepartoActiveRoutePanel: FC<RepartoActiveRoutePanelProps> = ({
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
  handleUpdateClientCoords,
}) => {
  if (!selectedRoute) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <Navigation size={28} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />
        <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Seleccione una hoja de ruta</span>
      </div>
    );
  }

  const totalBultos = selectedRoute.orders?.reduce((sum: number, o: any) => sum + Math.max(1, Number(o.bultosCount || 1)), 0) || 0;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h3 className="tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px 0' }}>Hoja de Ruta #{selectedRoute.id}</h3>
          <div className="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Chofer: <strong style={{ color: 'var(--text-primary)' }}>{selectedRoute.driverName}</strong>
            {selectedRoute.companionName && <> · Acompañante: <strong style={{ color: 'var(--text-primary)' }}>{selectedRoute.companionName}</strong></>}
            {' '}· Patente: <strong style={{ color: 'var(--text-primary)' }}>{selectedRoute.vehiclePlate}</strong>
          </div>
          {selectedRoute.custodyStatus === 'LOADED_IN_TRANSIT' ? (
            <div className="tabular-nums" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', backgroundColor: '#dcfce7', padding: '3px 8px', borderRadius: '4px', marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px', border: '1px solid #86efac' }}>
              <Lock size={12} aria-hidden="true" />
              Custodia: {selectedRoute.driverName} ({totalBultos} Bultos){selectedRoute.signedByDriverAt ? ` · ${new Date(selectedRoute.signedByDriverAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </div>
          ) : (
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', backgroundColor: '#fef3c7', padding: '3px 8px', borderRadius: '4px', marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px', border: '1px solid #fde68a' }}>
              <Clock size={12} aria-hidden="true" />
              Pendiente Transferencia
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {selectedRoute.custodyStatus !== 'LOADED_IN_TRANSIT' && (
            <button type="button" className="btn btn-warning" style={{ fontSize: '0.78rem', backgroundColor: '#FEF3C7', borderColor: '#F59E0B', color: '#B45309', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => handleTransferCustody(selectedRoute)}>
              <Lock size={12} aria-hidden="true" /> Transferir Custodia
            </button>
          )}
          {selectedRoute.status === 'PENDING' && (
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => handleChangeStatus(selectedRoute.id, 'IN_TRANSIT')}>
              <Play size={12} aria-hidden="true" /> Iniciar Viaje
            </button>
          )}
          {selectedRoute.status === 'IN_TRANSIT' && (
            <button type="button" className="btn btn-primary" style={{ fontSize: '0.78rem', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => handleOpenSettleModal(selectedRoute)}>
              <CheckCircle size={12} aria-hidden="true" /> Rendir Viaje
            </button>
          )}
          <button type="button" className="btn btn-secondary no-print" style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => printDeliveryRouteCustodyGuide(selectedRoute)}>
            <Printer size={12} aria-hidden="true" /> Guía de Carga
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <Map size={14} aria-hidden="true" />
            <span>Recorrido y GPS</span>
          </div>
          {liveGpsInfo?.lastGpsUpdate && (
            <div className="tabular-nums" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontSize: '0.75rem', fontWeight: 600 }}>
              <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
              GPS: {liveGpsInfo.currentSpeed !== null && liveGpsInfo.currentSpeed !== undefined ? `${liveGpsInfo.currentSpeed} km/h` : 'En parada'} · {new Date(liveGpsInfo.lastGpsUpdate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
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
            vehiclePlate: liveGpsInfo.vehiclePlate || selectedRoute?.vehiclePlate,
          } : null}
          gpsTrail={gpsHistory}
        />
      </div>

      <div>
        <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '8px' }}>Paradas</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {activeRouteTspDetails.locations.map((stop: any, idx: number) => {
            const stopKey = `${selectedRoute.id}-${idx}`;
            const isExpanded = !!expandedStops[stopKey];
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedStops((prev) => ({ ...prev, [stopKey]: !isExpanded }))}
                  style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#F8F8FA', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                >
                  <div className="tabular-nums" style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--accent-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem', flexShrink: 0 }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stop.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{stop.address}</div>
                  </div>
                  <div className="tabular-nums" style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{stop.invoice}</div>
                </button>

                {isExpanded && (
                  <div style={{ marginLeft: '34px', padding: '10px 12px', borderLeft: '2px solid var(--color-corp-red)', backgroundColor: '#fff', borderRadius: '0 4px 4px 0', fontSize: '0.78rem', borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', fontSize: '0.74rem' }}>Artículos del Pedido</div>
                    {!stop.items || stop.items.length === 0 ? (
                      <div style={{ color: 'var(--text-secondary)' }}>Sin artículos registrados.</div>
                    ) : (
                      <div className="table-container" role="region" aria-label={`Artículos parada ${idx + 1}`} tabIndex={0}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                              <th scope="col" style={{ padding: '4px 0', fontWeight: 600 }}>Producto</th>
                              <th scope="col" style={{ padding: '4px 0', textAlign: 'center', fontWeight: 600, width: '60px' }}>Cant.</th>
                              <th scope="col" style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, width: '80px' }}>P. Unit</th>
                              <th scope="col" style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, width: '85px' }}>Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stop.items.map((item: any) => (
                              <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem' }}>
                                <td style={{ padding: '4px 0', color: 'var(--text-primary)' }}>{item.product?.name || `Producto #${item.productId}`}</td>
                                <td className="tabular-nums" style={{ padding: '4px 0', textAlign: 'center', fontWeight: 500, fontFamily: 'monospace' }}>{item.quantity}</td>
                                <td className="tabular-nums" style={{ padding: '4px 0', textAlign: 'right', fontFamily: 'monospace' }}>{Number(item.unitPrice).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                                <td className="tabular-nums" style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>{Number(item.subtotal).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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
