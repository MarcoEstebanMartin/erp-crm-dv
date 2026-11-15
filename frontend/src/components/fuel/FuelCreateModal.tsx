import type { FC, FormEvent } from 'react';
import { Fuel, X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';

interface FuelCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  submitting: boolean;
  modalError: string | null;
  vehicles: any[];
  bankAccounts: any[];
  form: {
    vehicleId: string;
    odometer: string;
    liters: string;
    totalCost: string;
    pricePerLiter: string;
    isFullTank: boolean;
    notes: string;
    date: string;
    affectFinance: boolean;
    paymentMethod: string;
    bankAccountId: string;
    billingType: string;
  };
  setForm: (next: any) => void;
  onVehicleChange: (vIdStr: string) => void;
  onCostOrLitersChange: (field: 'liters' | 'totalCost', value: string) => void;
}

export const FuelCreateModal: FC<FuelCreateModalProps> = ({
  isOpen, onClose, onSubmit, submitting, modalError, vehicles, bankAccounts,
  form, setForm, onVehicleChange, onCostOrLitersChange,
}) => (
  <NativeModalDialog isOpen={isOpen} onClose={onClose} ariaLabelledBy="fuel-create-modal-title" style={{ maxWidth: '500px', width: '95vw', padding: 0 }}>
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-app, #F9FAFB)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ padding: '6px', backgroundColor: '#111827', borderRadius: '6px', display: 'flex' }}>
          <Fuel size={16} color="#10B981" aria-hidden="true" />
        </div>
        <h3 id="fuel-create-modal-title" style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Registrar Carga</h3>
      </div>
      <button type="button" className="btn btn-ghost" onClick={onClose} style={{ padding: '4px' }} aria-label="Cerrar">
        <X size={18} aria-hidden="true" />
      </button>
    </div>

    <form onSubmit={onSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.83rem' }}>
      {modalError && <div role="alert" className="alert alert-danger" style={{ margin: 0 }}>{modalError}</div>}

      <div>
        <label htmlFor="fuel-vehicle" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Vehículo *</label>
        <select id="fuel-vehicle" className="select" value={form.vehicleId} onChange={(e) => onVehicleChange(e.target.value)} required>
          <option value="">Seleccionar vehículo...</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate}) — {v.currentOdometer} km</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label htmlFor="fuel-date" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Fecha *</label>
          <input id="fuel-date" type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        </div>
        <div>
          <label htmlFor="fuel-odo" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Odómetro (km) *</label>
          <input id="fuel-odo" type="number" className="input tabular-nums" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} placeholder="0" required min="0" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        <div>
          <label htmlFor="fuel-liters" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Litros (L) *</label>
          <input id="fuel-liters" type="number" step="0.01" className="input tabular-nums" value={form.liters} onChange={(e) => onCostOrLitersChange('liters', e.target.value)} placeholder="0.0" required min="0.1" />
        </div>
        <div>
          <label htmlFor="fuel-cost" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Total ($) *</label>
          <input id="fuel-cost" type="number" step="0.01" className="input tabular-nums" value={form.totalCost} onChange={(e) => onCostOrLitersChange('totalCost', e.target.value)} placeholder="0.00" required min="1" />
        </div>
        <div>
          <label htmlFor="fuel-ppl" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Precio / L ($)</label>
          <input id="fuel-ppl" type="number" step="0.01" className="input tabular-nums" value={form.pricePerLiter} readOnly placeholder="Auto" style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)' }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input type="checkbox" id="fuel-full-tank" checked={form.isFullTank} onChange={(e) => setForm({ ...form, isFullTank: e.target.checked })} style={{ cursor: 'pointer' }} />
        <label htmlFor="fuel-full-tank" style={{ fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', margin: 0 }}>Tanque lleno</label>
      </div>

      <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" id="fuel-affect-finance" checked={form.affectFinance} onChange={(e) => setForm({ ...form, affectFinance: e.target.checked })} style={{ cursor: 'pointer' }} />
          <label htmlFor="fuel-affect-finance" style={{ fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', margin: 0 }}>Descontar de Caja o Banco</label>
        </div>

        {form.affectFinance && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label htmlFor="fuel-method" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '2px' }}>Método</label>
              <select id="fuel-method" className="select" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia / Débito</option>
              </select>
            </div>
            {form.paymentMethod === 'TRANSFER' && (
              <div>
                <label htmlFor="fuel-bank" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '2px' }}>Cuenta Bancaria</label>
                <select id="fuel-bank" className="select" value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}>
                  {bankAccounts.map((b) => (<option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="fuel-notes" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Notas (opcional)</label>
        <input id="fuel-notes" type="text" className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Estación o detalle" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar Carga'}</button>
      </div>
    </form>
  </NativeModalDialog>
);
