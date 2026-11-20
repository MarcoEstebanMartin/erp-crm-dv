import type { FC, FormEvent } from 'react';
import { X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';

interface FuelCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  submitting: boolean;
  modalError: string | null;
  vehicles: any[];
  form: {
    vehicleId: string;
    odometer: string;
    liters: string;
    ticketNumber: string;
    isFullTank: boolean;
    notes: string;
    date: string;
  };
  setForm: (next: any) => void;
  onVehicleChange: (vIdStr: string) => void;
}

export const FuelCreateModal: FC<FuelCreateModalProps> = ({
  isOpen, onClose, onSubmit, submitting, modalError, vehicles, form, setForm, onVehicleChange,
}) => {
  const selectedVehicle = vehicles.find((v) => String(v.id) === String(form.vehicleId));

  return (
    <NativeModalDialog isOpen={isOpen} onClose={onClose} ariaLabelledBy="fuel-create-modal-title" style={{ maxWidth: '460px', width: '94vw', padding: 0 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 id="fuel-create-modal-title" style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Cargar Ticket</h3>
        <button type="button" className="btn btn-ghost" onClick={onClose} style={{ padding: '4px' }} aria-label="Cerrar">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.83rem' }}>
        {modalError && <div role="alert" className="alert alert-danger" style={{ margin: 0 }}>{modalError}</div>}

        <div>
          <label htmlFor="fuel-vehicle" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Vehículo</label>
          <select id="fuel-vehicle" className="select" value={form.vehicleId} onChange={(e) => onVehicleChange(e.target.value)} required>
            <option value="">Seleccionar...</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.brand} {v.model} ({v.plate}) · {v.fuelType === 'NAFTA' ? 'Nafta' : 'Diesel'}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label htmlFor="fuel-date" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Fecha</label>
            <input id="fuel-date" type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="fuel-odo" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Odómetro (km)</label>
            <input id="fuel-odo" type="number" className="input tabular-nums" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} placeholder="0" required min="0" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label htmlFor="fuel-liters" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Litros</label>
            <input id="fuel-liters" type="number" step="0.01" className="input tabular-nums" value={form.liters} onChange={(e) => setForm({ ...form, liters: e.target.value })} placeholder="99.27" required min="0.1" />
          </div>
          <div>
            <label htmlFor="fuel-ticket" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>N° Ticket</label>
            <input id="fuel-ticket" type="text" className="input tabular-nums" value={form.ticketNumber} onChange={(e) => setForm({ ...form, ticketNumber: e.target.value })} placeholder="00038-00055217" autoCorrect="off" spellCheck={false} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label htmlFor="fuel-full-tank" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', margin: 0 }}>
            <input type="checkbox" id="fuel-full-tank" checked={form.isFullTank} onChange={(e) => setForm({ ...form, isFullTank: e.target.checked })} style={{ cursor: 'pointer' }} />
            Tanque lleno
          </label>
          {selectedVehicle && (
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '2px 8px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
              {selectedVehicle.fuelType === 'NAFTA' ? 'Nafta' : 'Diesel'}
            </span>
          )}
        </div>

        <div>
          <label htmlFor="fuel-notes" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Notas</label>
          <input id="fuel-notes" type="text" className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opcional" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </NativeModalDialog>
  );
};
