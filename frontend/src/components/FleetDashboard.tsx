import { Car, Plus, AlertTriangle, AlertCircle, Layers, ChevronRight, X } from 'lucide-react';
import { FleetStatusBadge, getExpiryLabel, isExpiryClose, isExpiryOverdue } from './fleet/fleet.types';
import { useFleetController } from './fleet/useFleetController';
import { FleetVehicleDetailPanel } from './fleet/FleetVehicleDetailPanel';
import { FleetModals } from './fleet/FleetModals';

export default function FleetDashboard() {
  const c = useFleetController();
  const selectedVehicle = c.vehicles.find((v) => v.id === c.selectedVehicleId);
  const criticalExpirations = c.vehicles.flatMap((v) =>
    v.expirations.filter((e) => isExpiryClose(e.expirationDate)).map((e) => ({ vehicle: v, expiry: e })),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', color: 'var(--text-primary)' }}>
      {c.error && (
        <div role="alert" className="alert alert-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
          <span>{c.error}</span>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => c.setError(null)} aria-label="Cerrar alerta">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {criticalExpirations.length > 0 && (
        <div role="alert" style={{ border: '1px solid rgba(var(--color-corp-red-rgb), 0.2)', backgroundColor: 'rgba(var(--color-corp-red-rgb), 0.03)', borderRadius: '8px', padding: '12px 18px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <AlertCircle size={20} color="var(--color-corp-red)" aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-corp-red)' }}>Vencimientos Próximos o Vencidos</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px', marginTop: '4px' }}>
              {criticalExpirations.slice(0, 4).map(({ vehicle, expiry }) => {
                const isOverdue = isExpiryOverdue(expiry.expirationDate);
                return (
                  <span key={expiry.id} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Car size={14} aria-hidden="true" />
                    <strong>{vehicle.plate}</strong> ({vehicle.brand} {vehicle.model}): {getExpiryLabel(expiry.type)} —
                    <span className="tabular-nums" style={{ color: 'var(--color-corp-red)', fontWeight: 600, textDecoration: isOverdue ? 'underline' : 'none' }}>
                      {isOverdue ? 'Vencido ' : 'Vence '}{new Date(expiry.expirationDate).toLocaleDateString('es-AR')}
                    </span>
                  </span>
                );
              })}
              {criticalExpirations.length > 4 && (
                <span className="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--color-corp-red)', fontWeight: 600 }}>
                  +{criticalExpirations.length - 4} más
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px', alignItems: 'start' }}>
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-card, #fff)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
            <span className="tabular-nums" style={{ fontWeight: 600, fontSize: '0.92rem' }}>Flota Activa ({c.vehicles.length})</span>
            <button type="button" className="btn btn-secondary" onClick={c.openCreateVehicle} style={{ padding: '6px 10px', fontSize: '0.78rem' }}>
              <Plus size={14} aria-hidden="true" /> Nuevo Vehículo
            </button>
          </div>

          {c.loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cargando...</div>
          ) : c.vehicles.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Layers size={30} aria-hidden="true" style={{ opacity: 0.2 }} />
              <span style={{ fontSize: '0.85rem' }}>Sin vehículos registrados</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {c.vehicles.map((v) => {
                const isSelected = c.selectedVehicleId === v.id;
                const hasCritical = v.expirations.some((e) => isExpiryClose(e.expirationDate));
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => c.setSelectedVehicleId(v.id)}
                    style={{
                      width: '100%', textAlign: 'left', border: 'none',
                      borderBottom: '1px solid var(--border-color)',
                      borderLeft: isSelected ? '3px solid var(--color-corp-red)' : '3px solid transparent',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '14px 20px', cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(0, 0, 0, 0.02)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="tabular-nums" style={{ fontWeight: 700, fontSize: '0.9rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{v.plate}</span>
                        {hasCritical && <AlertTriangle size={13} color="var(--color-corp-red)" aria-hidden="true" />}
                        <FleetStatusBadge status={v.status} />
                      </div>
                      <span className="tabular-nums" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{v.brand} {v.model} ({v.year})</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="tabular-nums" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{v.currentOdometer.toLocaleString()} km</span>
                      <ChevronRight size={16} aria-hidden="true" style={{ opacity: 0.3 }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <FleetVehicleDetailPanel
          vehicle={selectedVehicle}
          onEditVehicle={c.openEditVehicle}
          onDeleteVehicle={c.handleDeleteVehicle}
          onAddExpiry={c.openCreateExpiry}
          onEditExpiry={c.openEditExpiry}
          onDeleteExpiry={c.handleDeleteExpiry}
          onAddMaintenance={c.openMaintenanceModal}
          onDeleteMaintenance={c.handleDeleteMaintenance}
        />
      </div>

      <FleetModals
        selectedVehicle={selectedVehicle}
        suppliers={c.suppliers}
        bankAccounts={c.bankAccounts}
        modalError={c.modalError}
        setModalError={c.setModalError}
        showVehicleModal={c.showVehicleModal}
        setShowVehicleModal={c.setShowVehicleModal}
        editingVehicle={c.editingVehicle}
        vehicleForm={c.vehicleForm}
        setVehicleForm={c.setVehicleForm}
        onSaveVehicle={c.handleSaveVehicle}
        showMaintenanceModal={c.showMaintenanceModal}
        setShowMaintenanceModal={c.setShowMaintenanceModal}
        maintenanceForm={c.maintenanceForm}
        setMaintenanceForm={c.setMaintenanceForm}
        onSaveMaintenance={c.handleSaveMaintenance}
        showExpiryModal={c.showExpiryModal}
        setShowExpiryModal={c.setShowExpiryModal}
        editingExpiryId={c.editingExpiryId}
        expiryForm={c.expiryForm}
        setExpiryForm={c.setExpiryForm}
        onSaveExpiry={c.handleSaveExpiry}
      />
    </div>
  );
}
