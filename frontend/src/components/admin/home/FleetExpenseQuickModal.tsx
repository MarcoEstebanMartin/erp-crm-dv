import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../../utils/api';
import { NativeModalDialog } from '../../modals/NativeModalDialog';

interface FleetExpenseQuickModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessMsg?: (msg: string) => void;
}

const createInitialForm = () => ({
  vehicleId: '',
  type: 'FUEL',
  description: '',
  cost: '',
  odometer: '',
  date: new Date().toISOString().substring(0, 10),
  supplierId: '',
  affectFinance: false,
  paymentMethod: 'CASH',
  bankAccountId: '',
  billingType: 'INTERNAL',
});

export function FleetExpenseQuickModal({ isOpen, onClose, onSuccessMsg }: FleetExpenseQuickModalProps) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorData, setErrorData] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [gastoForm, setGastoForm] = useState(createInitialForm);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingData(true);
    setErrorData(null);
    setFormError(null);

    Promise.all([api.getVehicles(), api.getPersonas('provider'), api.getBankAccounts()])
      .then(([vehiclesData, suppliersData, bankAccountsData]) => {
        if (cancelled) return;
        setVehicles(vehiclesData || []);
        setSuppliers((suppliersData || []).filter((s: any) => s.isActive !== false));
        setBankAccounts(bankAccountsData || []);
      })
      .catch((err: any) => {
        if (!cancelled) setErrorData(err.message || 'Error al cargar datos.');
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const selectedVehicle = useMemo(
    () => (gastoForm.vehicleId ? vehicles.find((v) => v.id === Number(gastoForm.vehicleId)) || null : null),
    [gastoForm.vehicleId, vehicles],
  );

  useEffect(() => {
    if (selectedVehicle) {
      setGastoForm((prev) => ({
        ...prev,
        odometer: prev.odometer ? prev.odometer : String(selectedVehicle.currentOdometer || 0),
      }));
    }
  }, [selectedVehicle]);

  const handleSaveGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!gastoForm.vehicleId) return setFormError('Seleccioná un vehículo.');
    if (!gastoForm.cost || Number(gastoForm.cost) <= 0) return setFormError('Ingresá un monto mayor a cero.');
    if (!gastoForm.odometer || Number(gastoForm.odometer) < 0) return setFormError('Ingresá un odómetro válido.');
    if (
      gastoForm.affectFinance &&
      (gastoForm.paymentMethod === 'BANK_TRANSFER' || gastoForm.paymentMethod === 'CHECK') &&
      !gastoForm.bankAccountId
    ) {
      return setFormError('Seleccioná una cuenta bancaria.');
    }

    setSubmitting(true);
    try {
      await api.createVehicleMaintenance(Number(gastoForm.vehicleId), {
        type: gastoForm.type,
        description: gastoForm.description.trim(),
        cost: Number(gastoForm.cost),
        odometer: Number(gastoForm.odometer),
        date: gastoForm.date,
        supplierId: gastoForm.supplierId ? Number(gastoForm.supplierId) : null,
        affectFinance: gastoForm.affectFinance,
        paymentMethod: gastoForm.paymentMethod,
        bankAccountId: gastoForm.bankAccountId ? Number(gastoForm.bankAccountId) : null,
        billingType: gastoForm.billingType,
      });

      setGastoForm(createInitialForm());
      onSuccessMsg?.('Gasto de flota registrado.');
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar el gasto.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="fleet-expense-modal-title"
      style={{ width: '94vw', maxWidth: '520px', padding: '22px 24px', maxHeight: '90vh' }}
    >
      <div className="modal-header" style={{ marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
        <h2 id="fleet-expense-modal-title" style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Gasto de flota
        </h2>
        <button type="button" aria-label="Cerrar" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {loadingData ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Cargando...</div>
      ) : errorData ? (
        <div role="alert" style={{ padding: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#E30613', fontSize: '0.84rem' }}>
          {errorData}
        </div>
      ) : (
        <form onSubmit={handleSaveGasto} style={{ overflowY: 'auto' }}>
          {formError && (
            <div role="alert" style={{ marginBottom: '12px', padding: '8px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#E30613', fontSize: '0.82rem', fontWeight: 600 }}>
              {formError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="fleet-vehicle">Vehículo</label>
            <select id="fleet-vehicle" name="vehicleId" required className="select" value={gastoForm.vehicleId} onChange={(e) => setGastoForm({ ...gastoForm, vehicleId: e.target.value, odometer: '' })}>
              <option value="">Seleccionar...</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} · {v.brand} {v.model} ({v.currentOdometer} km)
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label htmlFor="fleet-type">Tipo</label>
              <select id="fleet-type" name="type" className="select" value={gastoForm.type} onChange={(e) => setGastoForm({ ...gastoForm, type: e.target.value })}>
                <option value="FUEL">Combustible</option>
                <option value="SERVICE">Service</option>
                <option value="REPAIR">Taller</option>
                <option value="CLEANING">Lavadero</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="fleet-date">Fecha</label>
              <input id="fleet-date" name="date" type="date" required className="input" value={gastoForm.date} onChange={(e) => setGastoForm({ ...gastoForm, date: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label htmlFor="fleet-odometer">Odómetro (km)</label>
              <input id="fleet-odometer" name="odometer" type="number" required className="input" value={gastoForm.odometer} onChange={(e) => setGastoForm({ ...gastoForm, odometer: e.target.value })} />
              {selectedVehicle && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                  Actual: {selectedVehicle.currentOdometer} km
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="fleet-cost">Monto ($)</label>
              <input id="fleet-cost" name="cost" type="number" step="0.01" required className="input" value={gastoForm.cost} onChange={(e) => setGastoForm({ ...gastoForm, cost: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="fleet-description">Detalle</label>
            <input id="fleet-description" name="description" type="text" required className="input" value={gastoForm.description} onChange={(e) => setGastoForm({ ...gastoForm, description: e.target.value })} />
          </div>

          <div className="form-group">
            <label htmlFor="fleet-supplier">Proveedor</label>
            <select id="fleet-supplier" name="supplierId" className="select" value={gastoForm.supplierId} onChange={(e) => setGastoForm({ ...gastoForm, supplierId: e.target.value })}>
              <option value="">Sin proveedor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px', backgroundColor: 'var(--bg-light, #f5f5f7)', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="fleet-affect-finance" name="affectFinance" checked={gastoForm.affectFinance} onChange={(e) => setGastoForm({ ...gastoForm, affectFinance: e.target.checked })} />
              <label htmlFor="fleet-affect-finance" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Imputar egreso en caja/banco
              </label>
            </div>

            {gastoForm.affectFinance && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label htmlFor="fleet-payment-method" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Medio de pago
                    </label>
                    <select id="fleet-payment-method" name="paymentMethod" className="select" value={gastoForm.paymentMethod} onChange={(e) => setGastoForm({ ...gastoForm, paymentMethod: e.target.value })}>
                      <option value="CASH">Efectivo</option>
                      <option value="BANK_TRANSFER">Transferencia</option>
                      <option value="CHECK">Cheque</option>
                      <option value="OTHER">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="fleet-billing-type" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Comprobante
                    </label>
                    <select id="fleet-billing-type" name="billingType" className="select" value={gastoForm.billingType} onChange={(e) => setGastoForm({ ...gastoForm, billingType: e.target.value })}>
                      <option value="INTERNAL">Interno</option>
                      <option value="OFFICIAL">Oficial</option>
                    </select>
                  </div>
                </div>

                {(gastoForm.paymentMethod === 'BANK_TRANSFER' || gastoForm.paymentMethod === 'CHECK') && (
                  <div>
                    <label htmlFor="fleet-bank-account" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Cuenta bancaria
                    </label>
                    <select id="fleet-bank-account" name="bankAccountId" required className="select" value={gastoForm.bankAccountId} onChange={(e) => setGastoForm({ ...gastoForm, bankAccountId: e.target.value })}>
                      <option value="">Seleccionar...</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} · {b.accountNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ marginTop: '14px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      )}
    </NativeModalDialog>
  );
}
