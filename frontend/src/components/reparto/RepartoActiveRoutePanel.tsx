import { useState, type FC, type Dispatch, type SetStateAction } from 'react';
import { Navigation, CheckCircle, Play, Map, Printer, Pencil, ChevronUp, ChevronDown, Banknote, Route } from 'lucide-react';
import { printDeliveryRouteCustodyGuide } from '../../utils/printHelpers';
import { api } from '../../utils/api';
import { printCompletedRouteReprintTicket } from '../../utils/print/printHandoverTicket80mm';
import { RouteMap } from './LeafletRouteMap';
import { computeTripDisplayMetrics, getStopOutstandingBalance } from './repartoRouteHelpers';

interface RepartoActiveRoutePanelProps {
  selectedRoute: any | null;
  activeRouteTspDetails: { locations: any[]; points: [number, number][] };
  selectedRouteStreetPoints: [number, number][];
  liveGpsInfo: any;
  gpsHistory: [number, number][];
  expandedStops: Record<string, boolean>;
  setExpandedStops: Dispatch<SetStateAction<Record<string, boolean>>>;
  handleEditRoute?: (route: any) => void;
  handleReorderStop?: (routeId: number, currentOrderIds: number[], index: number, direction: -1 | 1) => void;
  handleChangeStatus: (routeId: number, nextStatus: string) => void;
  handleOpenSettleModal: (route: any) => void;
  handleOpenCollectForStop?: (stop: any) => void;
  handleUpdateClientCoords: (clientId: number, lat: number, lng: number) => void;
}

export const RepartoActiveRoutePanel: FC<RepartoActiveRoutePanelProps> = ({
  selectedRoute, activeRouteTspDetails, selectedRouteStreetPoints, liveGpsInfo,
  gpsHistory, expandedStops, setExpandedStops, handleEditRoute, handleReorderStop,
  handleChangeStatus, handleOpenSettleModal, handleOpenCollectForStop,
  handleUpdateClientCoords,
}) => {
  const [showGpsTrail, setShowGpsTrail] = useState(false);

  if (!selectedRoute) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <Navigation size={28} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />
        <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Seleccione un viaje</span>
      </div>
    );
  }

  const metrics = computeTripDisplayMetrics(selectedRoute.orders || []);
  const orderedIds = activeRouteTspDetails.locations.map((s: any) => Number(s.id));
  const isPendingRoute = selectedRoute.status === 'PENDING';
  const isInTransitRoute = selectedRoute.status === 'IN_TRANSIT';

  const receiptsByClientId: Record<number, { codes: string[]; total: number }> = {};
  for (const r of selectedRoute.fieldReceipts || []) {
    if (r.status === 'VOIDED') continue;
    const pid = Number(r.personaId);
    if (!receiptsByClientId[pid]) receiptsByClientId[pid] = { codes: [], total: 0 };
    receiptsByClientId[pid].codes.push(r.receiptNumber || r.provisionalCode || `#${r.id}`);
    receiptsByClientId[pid].total += Math.round(Number(r.totalAmount || 0));
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h3 className="tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px 0' }}>
            Viaje #{selectedRoute.id}
          </h3>
          <div className="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{selectedRoute.driverName}</strong>
            {selectedRoute.companionName && <> · <strong style={{ color: 'var(--text-primary)' }}>{selectedRoute.companionName}</strong></>}
            {' '}· <strong style={{ color: 'var(--text-primary)' }}>{selectedRoute.vehiclePlate}</strong>
            {selectedRoute.vehicleDescription ? ` (${selectedRoute.vehicleDescription})` : ''}
          </div>
          <div className="tabular-nums" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#111827', marginTop: '4px' }}>
            {metrics.ordersCount} {metrics.ordersCount === 1 ? 'pedido' : 'pedidos'} · {metrics.totalBultos} {metrics.totalBultos === 1 ? 'bulto' : 'bultos'} · {metrics.totalAmountLabel}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isPendingRoute && handleEditRoute && (
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => handleEditRoute(selectedRoute)}>
              <Pencil size={12} aria-hidden="true" /> Editar
            </button>
          )}
          {isPendingRoute && (
            <button type="button" className="btn btn-primary" style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => handleChangeStatus(selectedRoute.id, 'IN_TRANSIT')}>
              <Play size={12} aria-hidden="true" /> Iniciar
            </button>
          )}
          {selectedRoute.status === 'IN_TRANSIT' && (
            <button type="button" className="btn btn-primary" style={{ fontSize: '0.78rem', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => handleOpenSettleModal(selectedRoute)}>
              <CheckCircle size={12} aria-hidden="true" /> Cerrar Viaje
            </button>
          )}
          {selectedRoute.status === 'COMPLETED' && (
            <button
              type="button"
              className="btn btn-secondary no-print"
              style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              onClick={() => printCompletedRouteReprintTicket(selectedRoute, api.getCurrentUser()?.username || 'Caja / Administración')}
            >
              <Printer size={12} aria-hidden="true" /> Ticket 80mm
            </button>
          )}
          <button type="button" className="btn btn-secondary no-print" style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => printDeliveryRouteCustodyGuide(selectedRoute)}>
            <Printer size={12} aria-hidden="true" /> Guía
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <Map size={14} aria-hidden="true" />
            <span>Recorrido</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {gpsHistory.length > 1 && (
              <button
                type="button"
                aria-pressed={showGpsTrail}
                onClick={() => setShowGpsTrail((prev) => !prev)}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.74rem',
                  padding: '3px 9px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  ...(showGpsTrail
                    ? { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981', color: '#059669' }
                    : {}),
                }}
              >
                <Route size={12} aria-hidden="true" />
                Rastro GPS
              </button>
            )}
            {liveGpsInfo?.lastGpsUpdate && (
              <div className="tabular-nums" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontSize: '0.75rem', fontWeight: 600 }}>
                <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                GPS: {liveGpsInfo.currentSpeed !== null && liveGpsInfo.currentSpeed !== undefined ? `${liveGpsInfo.currentSpeed} km/h` : 'En parada'} · {new Date(liveGpsInfo.lastGpsUpdate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
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
          gpsTrail={showGpsTrail ? gpsHistory : undefined}
        />
      </div>

      <div>
        <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '8px' }}>Paradas</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {activeRouteTspDetails.locations.map((stop: any, idx: number) => {
            const stopKey = `${selectedRoute.id}-${idx}`;
            const isExpanded = !!expandedStops[stopKey];
            const clientReceipt = receiptsByClientId[Number(stop.clientId)];
            const outstandingBalance = getStopOutstandingBalance(stop);
            const showCollectButton = isInTransitRoute && Boolean(handleOpenCollectForStop) && outstandingBalance > 0;
            return (
              <div key={stop.id ?? idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedStops((prev) => ({ ...prev, [stopKey]: !isExpanded }))}
                    style={{ flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#F8F8FA', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                  >
                    <div className="tabular-nums" style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--accent-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem', flexShrink: 0 }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stop.name}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{stop.address}</div>
                      {clientReceipt && (
                        <div className="tabular-nums" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', padding: '2px 7px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.72rem', fontWeight: 700, border: '1px solid #86efac' }}>
                          <CheckCircle size={11} aria-hidden="true" />
                          <span>{clientReceipt.codes.join(', ')} · ${clientReceipt.total.toLocaleString('es-AR')}</span>
                        </div>
                      )}
                      {!clientReceipt && outstandingBalance <= 0 && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', padding: '2px 7px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.72rem', fontWeight: 700 }}>
                          <span>Sin saldo</span>
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="tabular-nums" style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{stop.invoice}</div>
                      {Number(stop.totalAmount) > 0 && (
                        <div className="tabular-nums" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          ${Math.round(Number(stop.totalAmount)).toLocaleString('es-AR')}
                        </div>
                      )}
                    </div>
                  </button>
                  {showCollectButton && handleOpenCollectForStop && (
                    <button
                      type="button"
                      className={clientReceipt ? 'btn btn-secondary' : 'btn btn-primary'}
                      style={{
                        fontSize: '0.76rem',
                        padding: '6px 10px',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                        ...(clientReceipt
                          ? {}
                          : { backgroundColor: '#15803d', borderColor: '#15803d' }),
                      }}
                      onClick={() => handleOpenCollectForStop(stop)}
                    >
                      <Banknote size={13} aria-hidden="true" />
                      {clientReceipt ? '+ Recibo' : 'Cobrar'}
                    </button>
                  )}
                  {isPendingRoute && handleReorderStop && orderedIds.length > 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button type="button" className="btn btn-secondary" style={{ padding: '2px 5px', height: '22px' }} disabled={idx === 0} aria-label={`Subir parada ${idx + 1}`} onClick={() => handleReorderStop(selectedRoute.id, orderedIds, idx, -1)}>
                        <ChevronUp size={13} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn btn-secondary" style={{ padding: '2px 5px', height: '22px' }} disabled={idx === orderedIds.length - 1} aria-label={`Bajar parada ${idx + 1}`} onClick={() => handleReorderStop(selectedRoute.id, orderedIds, idx, 1)}>
                        <ChevronDown size={13} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

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
