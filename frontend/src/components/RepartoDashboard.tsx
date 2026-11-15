import { Plus, X, ChevronRight, Truck, CheckCircle, AlertTriangle } from 'lucide-react';
import { useRepartoController } from './reparto/useRepartoController';
import { RepartoActiveRoutePanel } from './reparto/RepartoActiveRoutePanel';
import { RepartoCreateRouteModal } from './reparto/RepartoCreateRouteModal';
import { RepartoSettleRouteModal } from './reparto/RepartoSettleRouteModal';
import { PrintRouteSheet } from './reparto/RepartoPrintRouteSheet';

export default function RepartoDashboard() {
  const c = useRepartoController();
  const hasModalErrorScope = c.showCreateModal || c.showSettleModal;

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

      {c.isAdminOrOffice && (
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div className="card" style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Viajes Activos
            </span>
            <span className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#681da8' }}>
              {c.logisticsStats.inTransitCount} {c.logisticsStats.inTransitCount === 1 ? 'viaje activo' : 'viajes activos'}
            </span>
          </div>

          <div className="card" style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Pedidos en Espera
            </span>
            <span className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#3c4043' }}>
              {c.logisticsStats.pendingOrdersCount} {c.logisticsStats.pendingOrdersCount === 1 ? 'pedido' : 'pedidos'}
            </span>
          </div>
        </div>
      )}

      {!c.isAdminOrOffice && c.visibleRoutes.length === 0 && (
        <div className="card no-print" style={{ padding: '32px 20px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <Truck size={28} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Sin viajes asignados</h3>
        </div>
      )}

      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: c.isAdminOrOffice ? '1fr 1fr' : '1fr', gap: '20px', alignItems: 'start' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              {c.isAdminOrOffice ? 'Hojas de Ruta' : 'Mi Hoja de Ruta'}
            </h3>
            {c.isAdminOrOffice && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  c.setErrorMsg(null);
                  c.setDriverName('');
                  c.setVehiclePlate('');
                  c.setVehicleDescription('');
                  c.setSelectedVehicleKey('');
                  c.setSelectedOrderIds([]);
                  c.setShowCreateModal(true);
                }}
              >
                <Plus size={16} aria-hidden="true" /> Nueva Ruta
              </button>
            )}
          </div>

          <div className="table-container table-container--sticky" role="region" aria-label="Hojas de ruta" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Chofer / Patente</th>
                  <th scope="col">Pedidos</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {c.visibleRoutes.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center' }}>Sin hojas de ruta asignadas.</td></tr>
                ) : (
                  c.visibleRoutes.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => c.setSelectedRoute(r)}
                      style={{ cursor: 'pointer', backgroundColor: c.selectedRoute?.id === r.id ? 'var(--bg-app)' : 'transparent' }}
                    >
                      <td className="tabular-nums" style={{ fontWeight: 600 }}>#{r.id}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {r.driverName}
                          {r.companionName && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '6px' }}>
                              (Acomp: {r.companionName})
                            </span>
                          )}
                        </div>
                        <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.vehiclePlate} ({r.vehicleDescription})</div>
                      </td>
                      <td>
                        <span className="badge tabular-nums" style={{ backgroundColor: '#E2E2E2' }}>{r.orders?.length || 0} pedidos</span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: '12px',
                          backgroundColor: r.status === 'COMPLETED' ? 'var(--color-success-bg)' : r.status === 'IN_TRANSIT' ? 'var(--color-info-bg)' : 'var(--color-warning-bg)',
                          color: r.status === 'COMPLETED' ? 'var(--color-success)' : r.status === 'IN_TRANSIT' ? 'var(--color-info)' : 'var(--color-warning)',
                        }}>
                          {r.status === 'PENDING' ? 'Pendiente' : r.status === 'IN_TRANSIT' ? 'En Viaje' : 'Completado'}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button type="button" className="btn btn-ghost" onClick={() => c.setSelectedRoute(r)} style={{ padding: '4px', minWidth: 'auto', height: 'auto' }} aria-label={`Ver ruta ${r.id}`} title="Ver detalle">
                            <ChevronRight size={16} aria-hidden="true" />
                          </button>
                          {r.status === 'PENDING' && (
                            <button type="button" className="btn btn-ghost" onClick={() => c.handleDeleteRoute(r.id)} style={{ padding: '4px', minWidth: 'auto', height: 'auto', color: '#ef4444' }} aria-label={`Eliminar ruta ${r.id}`} title="Eliminar hoja de ruta">
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <RepartoActiveRoutePanel
            selectedRoute={c.selectedRoute}
            activeRouteTspDetails={c.activeRouteTspDetails}
            selectedRouteStreetPoints={c.selectedRouteStreetPoints}
            liveGpsInfo={c.liveGpsInfo}
            gpsHistory={c.gpsHistory}
            expandedStops={c.expandedStops}
            setExpandedStops={c.setExpandedStops}
            handleTransferCustody={c.handleTransferCustody}
            handleChangeStatus={c.handleChangeStatus}
            handleOpenSettleModal={c.handleOpenSettleModal}
            handleUpdateClientCoords={c.handleUpdateClientCoords}
          />
        </div>
      </div>

      <RepartoCreateRouteModal
        show={c.showCreateModal}
        onClose={() => { c.setErrorMsg(null); c.setShowCreateModal(false); }}
        onSubmit={c.handleCreateRouteSubmit}
        driverName={c.driverName} setDriverName={c.setDriverName}
        companionName={c.companionName} setCompanionName={c.setCompanionName}
        vehiclePlate={c.vehiclePlate} setVehiclePlate={c.setVehiclePlate}
        vehicleDescription={c.vehicleDescription} setVehicleDescription={c.setVehicleDescription}
        selectedVehicleKey={c.selectedVehicleKey} setSelectedVehicleKey={c.setSelectedVehicleKey}
        loadedDrivers={c.loadedDrivers} loadedVehicles={c.loadedVehicles}
        selectedCityFilter={c.selectedCityFilter} setSelectedCityFilter={c.setSelectedCityFilter}
        selectedZoneFilter={c.selectedZoneFilter} setSelectedZoneFilter={c.setSelectedZoneFilter}
        uniqueCities={c.uniqueCities} uniqueZones={c.uniqueZones}
        filteredPendingOrders={c.filteredPendingOrders}
        selectedOrderIds={c.selectedOrderIds} handleToggleOrder={c.handleToggleOrder}
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
