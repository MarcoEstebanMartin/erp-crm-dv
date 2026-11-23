import React, { useEffect, useMemo, useState } from 'react';
import { Truck, Wallet, X } from 'lucide-react';
import { api } from '../../../utils/api';
import { NativeModalDialog } from '../../modals/NativeModalDialog';
import { QuickExpensePaymentFields, type CashSourceOption } from './QuickExpensePaymentFields';
import {
  FLEET_SUBTYPE_HINTS,
  QuickExpenseFleetFields,
  matchCategoryId,
  type ExpenseMode,
  type FleetSubType,
} from './QuickExpenseFleetFields';

interface FleetExpenseQuickModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessMsg?: (msg: string) => void;
}

const createInitialForm = () => ({
  mode: 'GENERAL' as ExpenseMode,
  amount: '',
  date: new Date().toISOString().substring(0, 10),
  categoryId: '',
  description: '',
  vehicleId: '',
  fleetType: 'FUEL' as FleetSubType,
  odometer: '',
  supplierId: '',
  affectFinance: true,
  paymentMethod: 'CASH',
  cashSource: 'CAJA_GRANDE' as CashSourceOption,
  bankAccountId: '',
});

export function FleetExpenseQuickModal({ isOpen, onClose, onSuccessMsg }: FleetExpenseQuickModalProps) {
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorData, setErrorData] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(createInitialForm);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingData(true);
    setErrorData(null);
    setFormError(null);

    Promise.all([api.getExpenseCategories(), api.getVehicles(), api.getPersonas('provider'), api.getBankAccounts()])
      .then(([catsData, vehiclesData, suppliersData, bankAccountsData]) => {
        if (cancelled) return;
        setCategories(catsData || []);
        setVehicles(vehiclesData || []);
        setSuppliers((suppliersData || []).filter((s: any) => s.isActive !== false && s.providerType === 'RODADOS'));
        setBankAccounts(bankAccountsData || []);
      })
      .catch((err: any) => {
        if (!cancelled) setErrorData(err.message || 'Error al cargar datos.');
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });

    return () => { cancelled = true; };
  }, [isOpen]);

  const selectedVehicle = useMemo(
    () => (form.vehicleId ? vehicles.find((v) => v.id === Number(form.vehicleId)) || null : null),
    [form.vehicleId, vehicles],
  );

  useEffect(() => {
    if (selectedVehicle) {
      setForm((prev) => ({
        ...prev,
        odometer: prev.odometer ? prev.odometer : String(selectedVehicle.currentOdometer || 0),
      }));
    }
  }, [selectedVehicle]);

  const handleModeChange = (nextMode: ExpenseMode) => {
    setFormError(null);
    setForm((prev) => {
      const nextCat =
        nextMode === 'RODADO'
          ? matchCategoryId(categories, FLEET_SUBTYPE_HINTS[prev.fleetType].categoryKeyword) || prev.categoryId
          : prev.categoryId;
      return { ...prev, mode: nextMode, categoryId: nextCat };
    });
  };

  const handleFleetTypeChange = (nextType: FleetSubType) => {
    const suggestedCat = matchCategoryId(categories, FLEET_SUBTYPE_HINTS[nextType].categoryKeyword);
    setForm((prev) => ({ ...prev, fleetType: nextType, categoryId: suggestedCat || prev.categoryId }));
  };

  const handlePaymentMethodChange = (method: string) => {
    setForm((prev) => ({
      ...prev,
      paymentMethod: method,
      bankAccountId:
        (method === 'BANK_TRANSFER' || method === 'CHECK') && !prev.bankAccountId && bankAccounts.length > 0
          ? String(bankAccounts[0].id)
          : prev.bankAccountId,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amountVal = Number(form.amount);
    if (!amountVal || amountVal <= 0) return setFormError('Ingresá un monto mayor a cero.');
    if (!form.description.trim()) return setFormError('Ingresá una descripción.');

    if (form.affectFinance && form.paymentMethod === 'BANK_TRANSFER' && !form.bankAccountId) {
      return setFormError('Seleccioná una cuenta bancaria.');
    }

    if (form.mode === 'GENERAL') {
      if (!form.categoryId) return setFormError('Seleccioná una categoría.');
      setSubmitting(true);
      try {
        await api.createExpenseNew({
          amount: amountVal,
          categoryId: Number(form.categoryId),
          description: form.description.trim(),
          date: form.date,
          paymentMethod: form.paymentMethod,
          affectFinance: form.affectFinance,
          cashSource: form.affectFinance && form.paymentMethod === 'CASH' ? form.cashSource : undefined,
          bankAccountId: form.affectFinance && form.bankAccountId ? Number(form.bankAccountId) : undefined,
          billingType: 'INTERNAL',
        });
        setForm(createInitialForm());
        onSuccessMsg?.('Gasto registrado.');
        onClose();
      } catch (err: any) {
        setFormError(err.message || 'Error al guardar el gasto.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!form.vehicleId) return setFormError('Seleccioná un vehículo.');
    if (form.odometer === '' || Number(form.odometer) < 0) return setFormError('Ingresá un odómetro válido.');

    setSubmitting(true);
    try {
      const autoCategoryId = matchCategoryId(categories, FLEET_SUBTYPE_HINTS[form.fleetType].categoryKeyword);
      await api.createVehicleMaintenance(Number(form.vehicleId), {
        type: FLEET_SUBTYPE_HINTS[form.fleetType].backendType,
        description: form.description.trim(),
        cost: amountVal,
        odometer: Number(form.odometer),
        date: form.date,
        supplierId: form.supplierId ? Number(form.supplierId) : null,
        categoryId: autoCategoryId ? Number(autoCategoryId) : null,
        affectFinance: form.affectFinance,
        paymentMethod: form.paymentMethod,
        cashSource: form.affectFinance && form.paymentMethod === 'CASH' ? form.cashSource : null,
        bankAccountId: form.affectFinance && form.bankAccountId ? Number(form.bankAccountId) : null,
        billingType: 'INTERNAL',
      });
      setForm(createInitialForm());
      onSuccessMsg?.('Gasto de rodado registrado.');
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
      onClose={() => !submitting && onClose()}
      ariaLabelledBy="quick-expense-modal-title"
      closeOnBackdrop={!submitting}
      style={{ width: '94vw', maxWidth: '620px', height: 'min(640px, 94vh)', padding: '22px 26px', display: 'flex', flexDirection: 'column' }}
    >
      <div className="modal-header" style={{ marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <h2 id="quick-expense-modal-title" style={{ fontSize: '1.08rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Nuevo gasto
        </h2>
        <button type="button" aria-label="Cerrar" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} disabled={submitting}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {loadingData ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Cargando...</div>
      ) : errorData ? (
        <div role="alert" style={{ padding: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#E30613', fontSize: '0.84rem' }}>
          {errorData}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div role="tablist" aria-label="Tipo de gasto" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '4px', backgroundColor: '#F3F4F6', borderRadius: '8px', marginBottom: '12px', flexShrink: 0 }}>
            {([
              { id: 'GENERAL' as const, label: 'General', icon: <Wallet size={15} aria-hidden="true" /> },
              { id: 'RODADO' as const, label: 'Rodado', icon: <Truck size={15} aria-hidden="true" /> },
            ]).map((tab) => {
              const active = form.mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleModeChange(tab.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '7px 10px', border: 'none', borderRadius: '6px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer', backgroundColor: active ? '#FFFFFF' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-secondary)', boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}
                >
                  {tab.icon}{tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>

          {formError && (
            <div role="alert" style={{ marginBottom: '12px', padding: '8px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#E30613', fontSize: '0.82rem', fontWeight: 600 }}>
              {formError}
            </div>
          )}

          {form.mode === 'RODADO' && (
            <QuickExpenseFleetFields
              vehicles={vehicles}
              suppliers={suppliers}
              vehicleId={form.vehicleId}
              fleetType={form.fleetType}
              odometer={form.odometer}
              supplierId={form.supplierId}
              onVehicleChange={(vehicleId) => setForm({ ...form, vehicleId, odometer: '' })}
              onFleetTypeChange={handleFleetTypeChange}
              onOdometerChange={(odometer) => setForm({ ...form, odometer })}
              onSupplierChange={(supplierId) => setForm({ ...form, supplierId })}
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label htmlFor="quick-expense-amount">Monto ($)</label>
              <input id="quick-expense-amount" name="amount" type="number" step="0.01" min="0.01" required className="input tabular-nums" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="quick-expense-date">Fecha</label>
              <input id="quick-expense-date" name="date" type="date" required className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>

          {form.mode === 'GENERAL' && (
            <div className="form-group">
              <label htmlFor="quick-expense-category">Categoría</label>
              <select id="quick-expense-category" name="categoryId" required className="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Seleccionar...</option>
                {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="quick-expense-description">Detalle</label>
            <input id="quick-expense-description" name="description" type="text" required className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <QuickExpensePaymentFields
            idPrefix="quick-expense"
            affectFinance={form.affectFinance}
            onAffectFinanceChange={(affectFinance) => setForm({ ...form, affectFinance })}
            paymentMethod={form.paymentMethod}
            onPaymentMethodChange={handlePaymentMethodChange}
            cashSource={form.cashSource}
            onCashSourceChange={(cashSource) => setForm({ ...form, cashSource })}
            bankAccountId={form.bankAccountId}
            onBankAccountIdChange={(bankAccountId) => setForm({ ...form, bankAccountId })}
            bankAccounts={bankAccounts}
          />
          </div>

          <div className="modal-footer" style={{ marginTop: 'auto', paddingTop: '14px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      )}
    </NativeModalDialog>
  );
}
