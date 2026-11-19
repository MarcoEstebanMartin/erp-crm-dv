import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Plus, X, ChevronRight, Truck, CheckCircle, AlertTriangle } from 'lucide-react';
import { useRepartoController } from './reparto/useRepartoController';
import { RepartoActiveRoutePanel } from './reparto/RepartoActiveRoutePanel';
import { RepartoCreateRouteModal } from './reparto/RepartoCreateRouteModal';
import { RepartoSettleRouteModal } from './reparto/RepartoSettleRouteModal';
import { PrintRouteSheet } from './reparto/RepartoPrintRouteSheet';
import { FieldCollectModal } from './field-receipts/FieldCollectModal';

type TripsTab = 'active' | 'history';

export default function RepartoDashboard() {
  const c = useRepartoController();
  const hasModalErrorScope = c.showCreateModal || c.showSettleModal;
  const [tripsTab, setTripsTab] = useState<TripsTab>('active');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeRoutes = useMemo(
    () => c.visibleRoutes.filter((r) => r.status !== 'COMPLETED'),
    [c.visibleRoutes],
  );
  const historyRoutes = useMemo(
    () => c.visibleRoutes.filter((r) => r.status === 'COMPLETED'),
    [c.visibleRoutes],
  );
  const displayedRoutes = tripsTab === 'active' ? activeRoutes : historyRoutes;

  const tripTabs: Array<{ id: TripsTab; label: string; count: number }> = [
    { id: 'active', label: 'Activos', count: activeRoutes.length },
    { id: 'history', label: 'Historial', count: historyRoutes.length },
  ];

  const handleTripTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tripTabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tripTabs.length) % tripTabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = tripTabs.length - 1;
    else return;
    e.preventDefault();
    setTripsTab(tripTabs[nextIdx].id);
    tabRefs.current[nextIdx]?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {c.successMsg && (
        <div role="status" className="no-print" style={{ backgroundColor: 'var(--color-success-bg)', borderLeft: '4px solid var(--color-success)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={16} aria-hidden="true" />{c.successMsg}</span>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => c.setSuccessMsg(null)} aria-label="Cerrar notificación">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {c.errorMsg && !hasModalErrorScope && (
        <div role="alert" className="no-print" style={{ backgroundColor: '#FFF2F2', borderLeft: '4px solid var(--color-danger)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16} aria-hidden="true" />{c.errorMsg}</span>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => c.setErrorMsg(null)} aria-label="Cerrar alerta">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {!c.isAdminOrOffice && c.visibleRoutes.length === 0 && (
        <div className="card no-print" style={{ padding: '32px 20px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <Truck size={28} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Sin viajes asignados</h3>
        </div>
      )}

      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: c.isAdminOrOffice ? 'repeat(auto-fit, minmax(360px, 1fr))' : '1fr', gap: '20px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          {c.isAdminOrOffice && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <div className="card" style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Viajes activos
                </span>
                <span className="tabular-nums" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#681da8' }}>
                  {c.logisticsStats.inTransitCount} {c.logisticsStats.inTransitCount === 1 ? 'viaje activo' : 'viajes activos'}
                </span>
              </div>

              <div className="card" style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Para reparto
                </span>
                <span className="tabular-nums" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#3c4043' }}>
                  {c.logisticsStats.pendingOrdersCount} {c.logisticsStats.pendingOrdersCount === 1 ? 'pedido' : 'pedidos'}
                </span>
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
              <h3 className="card-title" style={{ margin: 0 }}>
                {c.isAdminOrOffice ? 'Viajes' : 'Mi Viaje'}
              </h3>
              {c.isAdminOrOffice && (
                <button type="button" className="btn btn-primary" onClick={c.handleOpenCreateModal}>
                  <Plus size={16} aria-hidden="true" /> Nuevo Viaje
                </button>
              )}
            </div>

            <div role="tablist" aria-label="Filtro de viajes" className="linear-tablist" style={{ marginBottom: '12px' }}>
              {tripTabs.map((tab, idx) => {
                const isActive = tripsTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => { tabRefs.current[idx] = el; }}
                    id={`reparto-trips-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                    className="linear-tab"
                    onClick={() => setTripsTab(tab.id)}
                    onKeyDown={(e) => handleTripTabKeyDown(e, idx)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>{tab.label}</span>
                    <span className="tabular-nums" style={{ fontSize: '0.72rem', opacity: 0.8 }}>({tab.count})</span>
                  </button>
                );
              })}
            </div>

            <div className="table-container table-container--sticky" role="tabpanel" aria-labelledby={`reparto-trips-tab-${tripsTab}`} tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Viaje</th>
                    <th scope="col">Chofer / Vehículo</th>
                    <th scope="col">Pedidos</th>
                    <th scope="col">Estado</th>
                    <th scope="col"><span className="visually-hidden">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRoutes.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center' }}>
                        {tripsTab === 'active' ? 'Sin viajes activos' : 'Sin viajes en historial'}
                      </td>
                    </tr>
                  ) : (
                    displayedRoutes.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => c.setSelectedRoute(r)}
                        style={{ cursor: 'pointer', backgroundColor: c.selectedRoute?.id === r.id ? 'var(--bg-app)' : 'transparent' }}
                      >
                        <td className="tabular-nums" style={{ fontWeight: 600 }}>
                          <div>#{r.id}</div>
                          {r.routeName && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{r.routeName}</div>}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>
                            {r.driverName}
                            {r.companionName && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '6px' }}>
                                (+{r.companionName})
                              </span>
                            )}
                          </div>
                          <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {r.vehiclePlate}{r.vehicleDescription ? ` (${r.vehicleDescription})` : ''}
                          </div>
                        </td>
                        <td>
                          <span className="badge tabular-nums" style={{ backgroundColor: '#E2E2E2' }}>{r.orders?.length || 0}</span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: '12px',
                            backgroundColor: r.status === 'COMPLETED' ? 'var(--color-success-bg)' : r.status === 'IN_TRANSIT' ? 'var(--color-info-bg)' : 'var(--color-warning-bg)',
                            color: r.status === 'COMPLETED' ? 'var(--color-success)' : r.status === 'IN_TRANSIT' ? 'var(--color-info)' : 'var(--color-warning)',
                          }}>
                            {r.status === 'PENDING' ? 'Pendiente' : r.status === 'IN_TRANSIT' ? 'En viaje' : 'Completado'}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button type="button" className="btn btn-ghost" onClick={() => c.setSelectedRoute(r)} style={{ padding: '4px', minWidth: 'auto', height: 'auto' }} aria-label={`Ver viaje ${r.id}`} title="Ver detalle">
                              <ChevronRight size={16} aria-hidden="true" />
                            </button>
                            {r.status === 'PENDING' && (
                              <button type="button" className="btn btn-ghost" onClick={() => c.handleDeleteRoute(r.id)} style={{ padding: '4px', minWidth: 'auto', height: 'auto', color: '#ef4444' }} aria-label={`Eliminar viaje ${r.id}`} title="Eliminar viaje">
                                <X size={16} aria-hidden="true" />
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
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          <RepartoActiveRoutePanel
            selectedRoute={c.selectedRoute}
            activeRouteTspDetails={c.activeRouteTspDetails}
            selectedRouteStreetPoints={c.selectedRouteStreetPoints}
            liveGpsInfo={c.liveGpsInfo}
            gpsHistory={c.gpsHistory}
            expandedStops={c.expandedStops}
            setExpandedStops={c.setExpandedStops}
            handleEditRoute={c.handleOpenEditModal}
            handleReorderStop={c.handleReorderStop}
            handleTransferCustody={c.handleTransferCustody}
            handleChangeStatus={c.handleChangeStatus}
            handleOpenSettleModal={c.handleOpenSettleModal}
            handleOpenCollectForStop={c.handleOpenCollectForStop}
            handleUpdateClientCoords={c.handleUpdateClientCoords}
          />
        </div>
      </div>

      <FieldCollectModal
        client={c.collectStopTarget?.client ?? null}
        collectorUserId={Number(c.currentUser?.id || 0)}
        bankAccounts={c.bankAccounts}
        deliveryRouteId={c.collectStopTarget?.deliveryRouteId ?? null}
        suggestedAmount={c.collectStopTarget?.suggestedAmount ?? null}
        onClose={() => c.setCollectStopTarget(null)}
        onSuccess={c.handleCollectSuccess}
      />

      <RepartoCreateRouteModal
        show={c.showCreateModal}
        editingRouteId={c.editingRouteId}
        onClose={() => { c.setErrorMsg(null); c.setShowCreateModal(false); }}
        onSubmit={c.handleCreateRouteSubmit}
        routeName={c.routeName} setRouteName={c.setRouteName}
        driverName={c.driverName} setDriverName={c.setDriverName}
        driverEmployeeId={c.driverEmployeeId} setDriverEmployeeId={c.setDriverEmployeeId}
        companionName={c.companionName} setCompanionName={c.setCompanionName}
        vehiclePlate={c.vehiclePlate} setVehiclePlate={c.setVehiclePlate}
        vehicleDescription={c.vehicleDescription} setVehicleDescription={c.setVehicleDescription}
        setVehicleId={c.setVehicleId}
        selectedVehicleKey={c.selectedVehicleKey} setSelectedVehicleKey={c.setSelectedVehicleKey}
        driverOptions={c.driverOptions} fleetVehicles={c.fleetVehicles}
        selectedCityFilter={c.selectedCityFilter} setSelectedCityFilter={c.setSelectedCityFilter}
        selectedZoneFilter={c.selectedZoneFilter} setSelectedZoneFilter={c.setSelectedZoneFilter}
        uniqueCities={c.uniqueCities} uniqueZones={c.uniqueZones}
        modalOrderPool={c.modalOrderPool}
        filteredPendingOrders={c.filteredPendingOrders}
        selectedOrderIds={c.selectedOrderIds} handleToggleOrder={c.handleToggleOrder}
        handleSelectCityOrders={c.handleSelectCityOrders}
        currentTspRoute={c.currentTspRoute} createRouteStreetPoints={c.createRouteStreetPoints}
        mapPoints={c.mapPoints} handleUpdateClientCoords={c.handleUpdateClientCoords}
        errorMsg={c.errorMsg}
      />

      <RepartoSettleRouteModal
        show={c.showSettleModal}
        settleRoute={c.settleRoute}
        settlements={c.settlements}
        setSettlements={c.setSettlements}
        bankAccounts={c.bankAccounts}
        errorMsg={c.errorMsg}
        onClose={() => { c.setErrorMsg(null); c.setShowSettleModal(false); }}
        onSubmit={c.handleSettleSubmit}
      />

      <PrintRouteSheet route={c.selectedRoute} locations={c.activeRouteTspDetails.locations} />
    </div>
  );
}
