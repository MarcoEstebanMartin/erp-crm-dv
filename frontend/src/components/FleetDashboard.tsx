import { Car, Plus, AlertTriangle, AlertCircle, Layers, X } from 'lucide-react';
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

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.9fr', gap: '20px', alignItems: 'start' }}>
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-card, #fff)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
            <span className="tabular-nums" style={{ fontWeight: 600, fontSize: '0.86rem' }}>Flota ({c.vehicles.length})</span>
            <button type="button" className="btn btn-secondary" onClick={c.openCreateVehicle} style={{ padding: '4px 9px', fontSize: '0.76rem' }}>
              <Plus size={13} aria-hidden="true" /> Nuevo
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
              {c.vehicles.map((v, idx) => {
                const isSelected = c.selectedVehicleId === v.id;
                const hasCritical = v.expirations.some((e) => isExpiryClose(e.expirationDate));
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => c.setSelectedVehicleId(v.id)}
                    style={{
                      width: '100%', textAlign: 'left', border: 'none',
                      borderBottom: idx < c.vehicles.length - 1 ? '1px solid #f1f5f9' : 'none',
                      borderLeft: isSelected ? '2px solid #111827' : '2px solid transparent',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 14px', cursor: 'pointer',
                      backgroundColor: isSelected ? '#f8fafc' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, lineHeight: 1.25 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="tabular-nums" style={{ fontWeight: isSelected ? 700 : 600, fontSize: '0.82rem', color: isSelected ? '#0f172a' : '#334155' }}>{v.plate}</span>
                        {hasCritical && <AlertTriangle size={12} color="var(--color-corp-red)" aria-hidden="true" />}
                        {v.status !== 'ACTIVE' && <FleetStatusBadge status={v.status} />}
                      </div>
                      <span className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {v.brand} {v.model} ({v.year})
                      </span>
                    </div>
                    <span className="tabular-nums" style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: '10px' }}>
                      {v.currentOdometer.toLocaleString('es-AR')} km
                    </span>
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
