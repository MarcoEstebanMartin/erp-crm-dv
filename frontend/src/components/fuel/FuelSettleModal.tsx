import type { FC, FormEvent } from 'react';
import { X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';

interface FuelSettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  submitting: boolean;
  modalError: string | null;
  pendingLogs: any[];
  selectedIds: number[];
  onToggleLog: (id: number) => void;
  onSelectAll: (ids: number[]) => void;
  bankAccounts: any[];
  form: {
    dieselPricePerLiter: string;
    dieselTotalCost: string;
    naftaPricePerLiter: string;
    naftaTotalCost: string;
    settledDate: string;
    affectFinance: boolean;
    paymentMethod: string;
    bankAccountId: string;
    billingType: string;
    notes: string;
  };
  setForm: (next: any) => void;
}

export const FuelSettleModal: FC<FuelSettleModalProps> = ({
  isOpen, onClose, onSubmit, submitting, modalError, pendingLogs,
  selectedIds, onToggleLog, onSelectAll, bankAccounts, form, setForm,
}) => {
  const selectedLogs = pendingLogs.filter((l) => selectedIds.includes(l.id));
  const dieselLiters = selectedLogs
    .filter((l) => l.fuelType === 'DIESEL')
    .reduce((acc, l) => acc + Number(l.liters), 0);
  const naftaLiters = selectedLogs
    .filter((l) => l.fuelType === 'NAFTA')
    .reduce((acc, l) => acc + Number(l.liters), 0);

  const updateFuelRate = (fuel: 'diesel' | 'nafta', mode: 'price' | 'total', value: string) => {
    const liters = fuel === 'diesel' ? dieselLiters : naftaLiters;
    const priceKey = fuel === 'diesel' ? 'dieselPricePerLiter' : 'naftaPricePerLiter';
    const totalKey = fuel === 'diesel' ? 'dieselTotalCost' : 'naftaTotalCost';
    const num = parseFloat(value);

    if (mode === 'price') {
      const calcTotal = liters > 0 && num > 0 ? String(Math.round(liters * num)) : '';
      setForm({ ...form, [priceKey]: value, [totalKey]: calcTotal });
    } else {
      const calcPrice = liters > 0 && num > 0 ? (num / liters).toFixed(2) : '';
      setForm({ ...form, [totalKey]: value, [priceKey]: calcPrice });
    }
  };

  const dieselEstimated = form.dieselTotalCost
    ? Math.round(Number(form.dieselTotalCost))
    : dieselLiters > 0 && Number(form.dieselPricePerLiter) > 0
      ? Math.round(dieselLiters * Number(form.dieselPricePerLiter))
      : 0;

  const naftaEstimated = form.naftaTotalCost
    ? Math.round(Number(form.naftaTotalCost))
    : naftaLiters > 0 && Number(form.naftaPricePerLiter) > 0
      ? Math.round(naftaLiters * Number(form.naftaPricePerLiter))
      : 0;

  const grandTotal = dieselEstimated + naftaEstimated;
  const allSelected = pendingLogs.length > 0 && selectedIds.length === pendingLogs.length;

  return (
    <NativeModalDialog isOpen={isOpen} onClose={onClose} ariaLabelledBy="fuel-settle-modal-title" style={{ maxWidth: '620px', width: '95vw', padding: 0 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 id="fuel-settle-modal-title" style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Liquidar Cuenta Corriente</h3>
        <button type="button" className="btn btn-ghost" onClick={onClose} style={{ padding: '4px' }} aria-label="Cerrar">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.83rem' }}>
        {modalError && <div role="alert" className="alert alert-danger" style={{ margin: 0 }}>{modalError}</div>}

        <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden', maxHeight: '220px', overflowY: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th scope="col" style={{ width: '32px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos"
                    checked={allSelected}
                    onChange={(e) => onSelectAll(e.target.checked ? pendingLogs.map((l) => l.id) : [])}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th scope="col">Fecha</th>
                <th scope="col">Vehículo</th>
                <th scope="col">Ticket</th>
                <th scope="col">Tipo</th>
                <th scope="col" style={{ textAlign: 'right' }}>Litros</th>
              </tr>
            </thead>
            <tbody>
              {pendingLogs.map((log) => (
                <tr key={log.id} onClick={() => onToggleLog(log.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Ticket ${log.ticketNumber || log.id}`}
                      checked={selectedIds.includes(log.id)}
                      onChange={() => onToggleLog(log.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td className="tabular-nums" style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {new Date(log.date).toLocaleDateString('es-AR')}
                  </td>
                  <td style={{ fontWeight: 600 }}>{log.vehicle?.plate}</td>
                  <td className="tabular-nums" style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {log.ticketNumber || '—'}
                  </td>
                  <td>{log.fuelType === 'NAFTA' ? 'Nafta' : 'Diesel'}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600 }}>
                    {Number(log.liters).toFixed(2)} L
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {dieselLiters > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: '10px', alignItems: 'end', padding: '10px 12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>Diesel</div>
                <div className="tabular-nums" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{dieselLiters.toFixed(2)} L</div>
              </div>
              <div>
                <label htmlFor="settle-diesel-ppl" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '3px' }}>Precio / L ($)</label>
                <input
                  id="settle-diesel-ppl"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input tabular-nums"
                  value={form.dieselPricePerLiter}
                  onChange={(e) => updateFuelRate('diesel', 'price', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label htmlFor="settle-diesel-total" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '3px' }}>Total Diesel ($)</label>
                <input
                  id="settle-diesel-total"
                  type="number"
                  step="1"
                  min="1"
                  className="input tabular-nums"
                  value={form.dieselTotalCost}
                  onChange={(e) => updateFuelRate('diesel', 'total', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {naftaLiters > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: '10px', alignItems: 'end', padding: '10px 12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>Nafta</div>
                <div className="tabular-nums" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{naftaLiters.toFixed(2)} L</div>
              </div>
              <div>
                <label htmlFor="settle-nafta-ppl" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '3px' }}>Precio / L ($)</label>
                <input
                  id="settle-nafta-ppl"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input tabular-nums"
                  value={form.naftaPricePerLiter}
                  onChange={(e) => updateFuelRate('nafta', 'price', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label htmlFor="settle-nafta-total" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '3px' }}>Total Nafta ($)</label>
                <input
                  id="settle-nafta-total"
                  type="number"
                  step="1"
                  min="1"
                  className="input tabular-nums"
                  value={form.naftaTotalCost}
                  onChange={(e) => updateFuelRate('nafta', 'total', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
          <div>
            <label htmlFor="settle-date" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Fecha pago</label>
            <input id="settle-date" type="date" className="input" value={form.settledDate} onChange={(e) => setForm({ ...form, settledDate: e.target.value })} required />
          </div>
          <div style={{ textAlign: 'right', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total</div>
            <div className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 800 }}>
              ${grandTotal.toLocaleString('es-AR')}
            </div>
          </div>
        </div>

        <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label htmlFor="settle-affect-finance" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', margin: 0 }}>
            <input
              type="checkbox"
              id="settle-affect-finance"
              checked={form.affectFinance}
              onChange={(e) => setForm({ ...form, affectFinance: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
            Registrar pago en Banco / Caja
          </label>

          {form.affectFinance && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label htmlFor="settle-method" style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>Medio</label>
                <select id="settle-method" className="select" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CASH">Efectivo</option>
                </select>
              </div>
              {form.paymentMethod === 'TRANSFER' && (
                <div>
                  <label htmlFor="settle-bank" style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>Cuenta</label>
                  <select id="settle-bank" className="select" value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={submitting || selectedIds.length === 0}>
            {submitting ? 'Liquidando...' : `Confirmar (${selectedIds.length})`}
          </button>
        </div>
      </form>
    </NativeModalDialog>
  );
};
