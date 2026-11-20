import type { FC, FormEvent } from 'react';
import { X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { GENERAL_ADMIN_LABEL, isGeneralAdminVehicle, type Expiry, type Maintenance, type Vehicle } from './fleet.types';

interface FleetModalsProps {
  selectedVehicle?: Vehicle;
  suppliers: any[];
  bankAccounts: any[];
  modalError: string | null;
  setModalError: (v: string | null) => void;
  showVehicleModal: boolean;
  setShowVehicleModal: (v: boolean) => void;
  editingVehicle: Vehicle | null;
  vehicleForm: { plate: string; brand: string; model: string; year: number; currentOdometer: number; status: Vehicle['status']; trackFuel: boolean; fuelType: '' | 'NAFTA' | 'DIESEL'; notes: string };
  setVehicleForm: (v: any) => void;
  onSaveVehicle: (e: FormEvent) => void;
  showMaintenanceModal: boolean;
  setShowMaintenanceModal: (v: boolean) => void;
  maintenanceForm: { type: Maintenance['type']; description: string; cost: string; odometer: string; date: string; supplierId: string; affectFinance: boolean; paymentMethod: string; bankAccountId: string; billingType: string };
  setMaintenanceForm: (v: any) => void;
  onSaveMaintenance: (e: FormEvent) => void;
  showExpiryModal: boolean;
  setShowExpiryModal: (v: boolean) => void;
  editingExpiryId: number | null;
  expiryForm: { type: Expiry['type']; description: string; expirationDate: string };
  setExpiryForm: (v: any) => void;
  onSaveExpiry: (e: FormEvent) => void;
}

export const FleetModals: FC<FleetModalsProps> = (p) => {
  const closeVehicle = () => { p.setModalError(null); p.setShowVehicleModal(false); };
  const closeMaint = () => { p.setModalError(null); p.setShowMaintenanceModal(false); };
  const closeExpiry = () => { p.setModalError(null); p.setShowExpiryModal(false); };

  return (
    <>
      <NativeModalDialog isOpen={p.showVehicleModal} onClose={closeVehicle} ariaLabelledBy="fleet-vehicle-modal-title" style={{ width: '480px', maxWidth: '94vw', padding: '24px' }}>
        <div className="modal-header">
          <h2 id="fleet-vehicle-modal-title" style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{p.editingVehicle ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h2>
          <button type="button" className="btn btn-ghost" onClick={closeVehicle} style={{ padding: '4px' }} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
        </div>
        {p.modalError && <div role="alert" className="alert alert-danger" style={{ marginBottom: '12px' }}>{p.modalError}</div>}
        <form onSubmit={p.onSaveVehicle} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label htmlFor="fleet-plate">Patente</label>
              <input id="fleet-plate" type="text" className="input tabular-nums" required disabled={!!p.editingVehicle} value={p.vehicleForm.plate} onChange={(e) => p.setVehicleForm({ ...p.vehicleForm, plate: e.target.value })} placeholder="AE123XX" autoCorrect="off" autoCapitalize="characters" spellCheck={false} />
            </div>
            <div className="form-group">
              <label htmlFor="fleet-year">Año</label>
              <input id="fleet-year" type="number" className="input tabular-nums" required value={p.vehicleForm.year} onChange={(e) => p.setVehicleForm({ ...p.vehicleForm, year: Number(e.target.value) })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label htmlFor="fleet-brand">Marca</label>
              <input id="fleet-brand" type="text" className="input" required value={p.vehicleForm.brand} onChange={(e) => p.setVehicleForm({ ...p.vehicleForm, brand: e.target.value })} placeholder="Mercedes Benz" />
            </div>
            <div className="form-group">
              <label htmlFor="fleet-model">Modelo</label>
              <input id="fleet-model" type="text" className="input" required value={p.vehicleForm.model} onChange={(e) => p.setVehicleForm({ ...p.vehicleForm, model: e.target.value })} placeholder="Accelo 815" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label htmlFor="fleet-odo">Odómetro (km)</label>
              <input id="fleet-odo" type="number" className="input tabular-nums" required value={p.vehicleForm.currentOdometer} onChange={(e) => p.setVehicleForm({ ...p.vehicleForm, currentOdometer: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label htmlFor="fleet-status">Estado</label>
              <select id="fleet-status" className="select" value={p.vehicleForm.status} onChange={(e) => p.setVehicleForm({ ...p.vehicleForm, status: e.target.value as Vehicle['status'] })}>
                <option value="ACTIVE">Activo</option>
                <option value="MAINTENANCE">En Taller</option>
                <option value="OUT_OF_SERVICE">Fuera de Servicio</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}>
              <input
                id="fleet-track-fuel"
                type="checkbox"
                checked={p.vehicleForm.trackFuel}
                onChange={(e) => p.setVehicleForm({ ...p.vehicleForm, trackFuel: e.target.checked, fuelType: e.target.checked && !p.vehicleForm.fuelType ? 'DIESEL' : p.vehicleForm.fuelType })}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="fleet-track-fuel" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer' }}>Controla combustible</label>
            </div>
            <div className="form-group">
              <label htmlFor="fleet-fuel-type">Combustible</label>
              <select
                id="fleet-fuel-type"
                className="select"
                value={p.vehicleForm.fuelType}
                onChange={(e) => p.setVehicleForm({ ...p.vehicleForm, fuelType: e.target.value })}
              >
                <option value="">Sin especificar</option>
                <option value="DIESEL">Diesel</option>
                <option value="NAFTA">Nafta</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="fleet-notes">Observaciones</label>
            <textarea id="fleet-notes" className="input" value={p.vehicleForm.notes} onChange={(e) => p.setVehicleForm({ ...p.vehicleForm, notes: e.target.value })} style={{ resize: 'none', height: '60px' }} placeholder="Observaciones" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeVehicle}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </NativeModalDialog>

      <NativeModalDialog isOpen={p.showMaintenanceModal} onClose={closeMaint} ariaLabelledBy="fleet-maint-modal-title" style={{ width: '500px', maxWidth: '94vw', padding: '24px' }}>
        <div className="modal-header">
          <h2 id="fleet-maint-modal-title" style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Registrar Actividad{p.selectedVehicle ? ` — ${p.selectedVehicle.plate}` : ''}</h2>
          <button type="button" className="btn btn-ghost" onClick={closeMaint} style={{ padding: '4px' }} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
        </div>
        {p.modalError && <div role="alert" className="alert alert-danger" style={{ marginBottom: '12px' }}>{p.modalError}</div>}
        <form onSubmit={p.onSaveMaintenance} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label htmlFor="fleet-maint-type">Tipo</label>
              <select id="fleet-maint-type" className="select" value={p.maintenanceForm.type} onChange={(e) => p.setMaintenanceForm({ ...p.maintenanceForm, type: e.target.value as Maintenance['type'] })}>
                <option value="SERVICE">Service Programado</option>
                <option value="REPAIR">Reparación / Taller</option>
                <option value="FUEL">Combustible</option>
                <option value="CLEANING">Lavado</option>
                <option value="OTHER">Otros Gastos</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="fleet-maint-date">Fecha</label>
              <input id="fleet-maint-date" type="date" className="input" required value={p.maintenanceForm.date} onChange={(e) => p.setMaintenanceForm({ ...p.maintenanceForm, date: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label htmlFor="fleet-maint-odo">Kilometraje (km)</label>
              <input id="fleet-maint-odo" type="number" className="input tabular-nums" required value={p.maintenanceForm.odometer} onChange={(e) => p.setMaintenanceForm({ ...p.maintenanceForm, odometer: e.target.value })} placeholder={p.selectedVehicle ? String(p.selectedVehicle.currentOdometer) : '0'} />
            </div>
            <div className="form-group">
              <label htmlFor="fleet-maint-cost">Costo ($)</label>
              <input id="fleet-maint-cost" type="number" step="0.01" className="input tabular-nums" required value={p.maintenanceForm.cost} onChange={(e) => p.setMaintenanceForm({ ...p.maintenanceForm, cost: e.target.value })} placeholder="0.00" />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="fleet-maint-desc">Detalle</label>
            <input id="fleet-maint-desc" type="text" className="input" required value={p.maintenanceForm.description} onChange={(e) => p.setMaintenanceForm({ ...p.maintenanceForm, description: e.target.value })} placeholder="Detalle del trabajo" />
          </div>
          <div className="form-group">
            <label htmlFor="fleet-maint-supplier">Taller / Proveedor (opcional)</label>
            <select id="fleet-maint-supplier" className="select" value={p.maintenanceForm.supplierId} onChange={(e) => p.setMaintenanceForm({ ...p.maintenanceForm, supplierId: e.target.value })}>
              <option value="">Sin proveedor</option>
              {p.suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="fleet-affect-finance" checked={p.maintenanceForm.affectFinance} onChange={(e) => p.setMaintenanceForm({ ...p.maintenanceForm, affectFinance: e.target.checked })} />
              <label htmlFor="fleet-affect-finance" style={{ fontSize: '0.82rem', fontWeight: 600, margin: 0, cursor: 'pointer' }}>Registrar pago en ERP</label>
            </div>
            {p.maintenanceForm.affectFinance && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label htmlFor="fleet-maint-method" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Método de Pago</label>
                    <select id="fleet-maint-method" className="select" value={p.maintenanceForm.paymentMethod} onChange={(e) => p.setMaintenanceForm({ ...p.maintenanceForm, paymentMethod: e.target.value })}>
                      <option value="CASH">Efectivo (Caja Diaria)</option>
                      <option value="BANK_TRANSFER">Transferencia</option>
                      <option value="CHECK">Cheque</option>
                      <option value="OTHER">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="fleet-maint-billing" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Sucursal</label>
                    <select id="fleet-maint-billing" className="select" value={p.maintenanceForm.billingType} onChange={(e) => p.setMaintenanceForm({ ...p.maintenanceForm, billingType: e.target.value })}>
                      <option value="INTERNAL">Interno (Sucursal X)</option>
                      <option value="OFFICIAL">Oficial (Factura A/B)</option>
                    </select>
                  </div>
                </div>
                {(p.maintenanceForm.paymentMethod === 'BANK_TRANSFER' || p.maintenanceForm.paymentMethod === 'CHECK') && (
                  <div>
                    <label htmlFor="fleet-maint-bank" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Cuenta Bancaria</label>
                    <select id="fleet-maint-bank" className="select" required value={p.maintenanceForm.bankAccountId} onChange={(e) => p.setMaintenanceForm({ ...p.maintenanceForm, bankAccountId: e.target.value })}>
                      <option value="">Seleccionar cuenta...</option>
                      {p.bankAccounts.map((b) => (<option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeMaint}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </NativeModalDialog>

      <NativeModalDialog isOpen={p.showExpiryModal} onClose={closeExpiry} ariaLabelledBy="fleet-expiry-modal-title" style={{ width: '420px', maxWidth: '94vw', padding: '24px' }}>
        <div className="modal-header">
          <h2 id="fleet-expiry-modal-title" style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            {p.editingExpiryId
              ? 'Editar Vencimiento'
              : `Nuevo Vencimiento — ${isGeneralAdminVehicle(p.selectedVehicle) ? GENERAL_ADMIN_LABEL : p.selectedVehicle?.plate || ''}`}
          </h2>
          <button type="button" className="btn btn-ghost" onClick={closeExpiry} style={{ padding: '4px' }} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
        </div>
        {p.modalError && <div role="alert" className="alert alert-danger" style={{ marginBottom: '12px' }}>{p.modalError}</div>}
        <form onSubmit={p.onSaveExpiry} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label htmlFor="fleet-expiry-type">Tipo</label>
            <select id="fleet-expiry-type" className="select" value={p.expiryForm.type} onChange={(e) => p.setExpiryForm({ ...p.expiryForm, type: e.target.value as Expiry['type'] })}>
              <option value="INSURANCE">Seguro</option>
              <option value="VTE_ITV">VTE / ITV</option>
              <option value="PATENT">Patente</option>
              <option value="CARNET">Licencia Chofer</option>
              <option value="OTHER">Individual (por nombre)</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="fleet-expiry-date">Vencimiento</label>
            <input id="fleet-expiry-date" type="date" className="input" required value={p.expiryForm.expirationDate} onChange={(e) => p.setExpiryForm({ ...p.expiryForm, expirationDate: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="fleet-expiry-desc">Nombre / Detalle</label>
            <input id="fleet-expiry-desc" type="text" className="input" required value={p.expiryForm.description} onChange={(e) => p.setExpiryForm({ ...p.expiryForm, description: e.target.value })} placeholder="Nombre o detalle" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeExpiry}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{p.editingExpiryId ? 'Guardar Cambios' : 'Guardar'}</button>
          </div>
        </form>
      </NativeModalDialog>
    </>
  );
};
