import { Plus, X, ChevronRight } from 'lucide-react';
import { useRepartoController } from './reparto/useRepartoController';
import { RepartoActiveRoutePanel } from './reparto/RepartoActiveRoutePanel';
import { RepartoCreateRouteModal } from './reparto/RepartoCreateRouteModal';
import { RepartoSettleRouteModal } from './reparto/RepartoSettleRouteModal';
import { PrintRouteSheet } from './reparto/RepartoPrintRouteSheet';

export default function RepartoDashboard() {
  const c = useRepartoController();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {c.successMsg && (
        <div className="no-print" style={{ backgroundColor: 'var(--color-success-bg)', borderLeft: '4px solid var(--color-success)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{c.successMsg}</span>
          <button className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => c.setSuccessMsg(null)}>✕</button>
        </div>
      )}

      {c.errorMsg && (
        <div className="no-print" style={{ backgroundColor: '#FFF2F2', borderLeft: '4px solid var(--color-danger)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{c.errorMsg}</span>
          <button className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => c.setErrorMsg(null)}>✕</button>
        </div>
      )}

      {c.isAdminOrOffice && (
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '8px' }}>
          <div className="card" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
              VIAJES ACTIVOS (EN CALLE)
            </span>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#681da8' }}>
              {c.logisticsStats.inTransitCount} {c.logisticsStats.inTransitCount === 1 ? 'viaje activo' : 'viajes activos'}
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
              {c.logisticsStats.pendingOrdersCount} {c.logisticsStats.pendingOrdersCount === 1 ? 'pedido en espera' : 'pedidos en espera'}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
              Disponibles para armar hojas de ruta
            </span>
          </div>
        </div>
      )}

      {!c.isAdminOrOffice && c.visibleRoutes.length === 0 && (
        <div className="card no-print" style={{ padding: '32px 20px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)', margin: '10px 0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🚚</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Sin Viajes Asignados
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '450px', margin: '0 auto' }}>
            Hola <strong>{c.currentUser?.username}</strong>, no tenés ninguna hoja de reparto asignada a tu nombre para el día de hoy. Cuando la administración te asigne un viaje, aparecerá aquí automáticamente.
          </p>
        </div>
      )}

      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: c.isAdminOrOffice ? '1fr 1fr' : '1fr', gap: '20px', alignItems: 'start' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="card-title" style={{ margin: '0' }}>
                {c.isAdminOrOffice ? '🚚 Hojas de Ruta de Reparto' : '🚚 Mi Hoja de Ruta Asignada'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {c.isAdminOrOffice ? 'Historial logístico de despachos.' : 'Viajes de entrega asignados a tu nombre.'}
              </p>
            </div>
            {c.isAdminOrOffice && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  c.setDriverName('');
                  c.setVehiclePlate('');
                  c.setVehicleDescription('');
                  c.setSelectedVehicleKey('');
                  c.setSelectedOrderIds([]);
                  c.setShowCreateModal(true);
                }}
              >
                <Plus size={16} /> Crear Hoja de Ruta
              </button>
            )}
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
                {c.visibleRoutes.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center' }}>No hay hojas de ruta asignadas.</td></tr>
                ) : (
                  c.visibleRoutes.map(r => (
                    <tr
                      key={r.id}
                      onClick={() => c.setSelectedRoute(r)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: c.selectedRoute?.id === r.id ? 'var(--bg-app)' : 'transparent',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <td style={{ fontWeight: 600 }}>#{r.id}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {r.driverName}
                          {r.companionName && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '6px' }}>
                              (Acomp: {r.companionName})
                            </span>
                          )}
                        </div>
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
                          backgroundColor: r.status === 'COMPLETED' ? 'var(--color-success-bg)' : r.status === 'IN_TRANSIT' ? 'var(--color-info-bg)' : 'var(--color-warning-bg)',
                          color: r.status === 'COMPLETED' ? 'var(--color-success)' : r.status === 'IN_TRANSIT' ? 'var(--color-info)' : 'var(--color-warning)'
                        }}>
                          {r.status === 'PENDING' ? 'Pendiente' : r.status === 'IN_TRANSIT' ? 'En Viaje' : 'Completado'}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            className="btn btn-ghost"
                            onClick={() => c.setSelectedRoute(r)}
                            style={{ padding: '4px', minWidth: 'auto', height: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Ver detalle"
                          >
                            <ChevronRight size={16} />
                          </button>
                          {r.status === 'PENDING' && (
                            <button
                              className="btn btn-ghost"
                              onClick={() => c.handleDeleteRoute(r.id)}
                              style={{ padding: '4px', minWidth: 'auto', height: 'auto', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
        onClose={() => c.setShowCreateModal(false)}
        onSubmit={c.handleCreateRouteSubmit}
        driverName={c.driverName}
        setDriverName={c.setDriverName}
        companionName={c.companionName}
        setCompanionName={c.setCompanionName}
        vehiclePlate={c.vehiclePlate}
        setVehiclePlate={c.setVehiclePlate}
        vehicleDescription={c.vehicleDescription}
        setVehicleDescription={c.setVehicleDescription}
        selectedVehicleKey={c.selectedVehicleKey}
        setSelectedVehicleKey={c.setSelectedVehicleKey}
        loadedDrivers={c.loadedDrivers}
        loadedVehicles={c.loadedVehicles}
        selectedCityFilter={c.selectedCityFilter}
        setSelectedCityFilter={c.setSelectedCityFilter}
        selectedZoneFilter={c.selectedZoneFilter}
        setSelectedZoneFilter={c.setSelectedZoneFilter}
        uniqueCities={c.uniqueCities}
        uniqueZones={c.uniqueZones}
        filteredPendingOrders={c.filteredPendingOrders}
        selectedOrderIds={c.selectedOrderIds}
        handleToggleOrder={c.handleToggleOrder}
        currentTspRoute={c.currentTspRoute}
        createRouteStreetPoints={c.createRouteStreetPoints}
        mapPoints={c.mapPoints}
        handleUpdateClientCoords={c.handleUpdateClientCoords}
      />

      <RepartoSettleRouteModal
        show={c.showSettleModal}
        settleRoute={c.settleRoute}
        settlements={c.settlements}
        setSettlements={c.setSettlements}
        bankAccounts={c.bankAccounts}
        errorMsg={c.errorMsg}
        onClose={() => c.setShowSettleModal(false)}
        onSubmit={c.handleSettleSubmit}
      />

      <PrintRouteSheet route={c.selectedRoute} locations={c.activeRouteTspDetails.locations} />
    </div>
  );
}
