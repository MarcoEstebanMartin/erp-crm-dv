import React from 'react';
import { AlertCircle, UploadCloud, X } from 'lucide-react';
import type { ExpenseCategory } from './gastos.types';
import { NativeModalDialog } from '../modals/NativeModalDialog';

interface GastosCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  submitting: boolean;
  errorMsg: string | null;
  categories: ExpenseCategory[];
  bankAccounts: any[];
  vehicles: any[];
  newAmount: string;
  setNewAmount: (v: string) => void;
  newDate: string;
  setNewDate: (v: string) => void;
  newCategoryId: string;
  setNewCategoryId: (v: string) => void;
  newDescription: string;
  setNewDescription: (v: string) => void;
  newPaymentMethod: string;
  setNewPaymentMethod: (v: string) => void;
  newCashSource: 'CAJA_GRANDE' | 'CAJA_OFICINA';
  setNewCashSource: (v: 'CAJA_GRANDE' | 'CAJA_OFICINA') => void;
  newBillingType: string;
  setNewBillingType: (v: string) => void;
  newBankAccountId: string;
  setNewBankAccountId: (v: string) => void;
  newVehicleId: string;
  setNewVehicleId: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function GastosCreateModal({
  isOpen, onClose, submitting, errorMsg, categories, bankAccounts, vehicles,
  newAmount, setNewAmount, newDate, setNewDate, newCategoryId, setNewCategoryId,
  newDescription, setNewDescription, newPaymentMethod, setNewPaymentMethod,
  newCashSource, setNewCashSource,
  newBillingType, setNewBillingType, newBankAccountId, setNewBankAccountId,
  newVehicleId, setNewVehicleId, onSubmit,
}: GastosCreateModalProps) {
  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      ariaLabelledBy="gasto-create-title"
      closeOnBackdrop={!submitting}
      style={{ maxWidth: '500px', width: '92vw', padding: '24px' }}
    >
      <div className="modal-header" style={{ marginBottom: '18px' }}>
        <h3 id="gasto-create-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Nuevo Gasto</h3>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} disabled={submitting} aria-label="Cerrar">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {errorMsg && (
        <div role="alert" style={{ padding: '10px 12px', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.84rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={15} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="gasto-new-amount">Monto ($)</label>
            <input
              id="gasto-new-amount"
              type="number"
              className="input tabular-nums"
              required
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              style={{ fontSize: '1.1rem', fontFamily: 'monospace' }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="gasto-new-date">Fecha</label>
            <input id="gasto-new-date" type="date" className="input" required value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="gasto-new-category">Categoría</label>
          <select id="gasto-new-category" className="select" required value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)}>
            <option value="">Seleccionar...</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="gasto-new-description">Descripción</label>
          <input id="gasto-new-description" type="text" className="input" required placeholder="Detalle del gasto" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="gasto-new-method">Medio de Pago</label>
            <select
              id="gasto-new-method"
              className="select"
              value={newPaymentMethod}
              onChange={(e) => {
                setNewPaymentMethod(e.target.value);
                if (e.target.value === 'BANK_TRANSFER' && bankAccounts.length > 0) {
                  setNewBankAccountId(String(bankAccounts[0].id));
                }
              }}
            >
              <option value="CASH">Efectivo</option>
              <option value="BANK_TRANSFER">Transferencia</option>
              <option value="CHECK">Cheque</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="gasto-new-billing">Sucursal</label>
            <select id="gasto-new-billing" className="select" value={newBillingType} onChange={(e) => setNewBillingType(e.target.value)}>
              <option value="INTERNAL">Sucursal X</option>
              <option value="OFFICIAL">Sucursal A</option>
            </select>
          </div>
        </div>

        {newPaymentMethod === 'CASH' && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="gasto-new-cash-source">Caja</label>
            <select
              id="gasto-new-cash-source"
              className="select"
              value={newCashSource}
              onChange={(e) => setNewCashSource(e.target.value as 'CAJA_GRANDE' | 'CAJA_OFICINA')}
            >
              <option value="CAJA_GRANDE">Caja Grande</option>
              <option value="CAJA_OFICINA">Caja Oficina</option>
            </select>
          </div>
        )}

        {newPaymentMethod === 'BANK_TRANSFER' && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="gasto-new-bank">Cuenta Bancaria</label>
            <select id="gasto-new-bank" className="select" required value={newBankAccountId} onChange={(e) => setNewBankAccountId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>{b.name} (${Number(b.balance).toLocaleString('es-AR')})</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="gasto-new-vehicle">Vehículo (Opcional)</label>
          <select id="gasto-new-vehicle" className="select" value={newVehicleId} onChange={(e) => setNewVehicleId(e.target.value)}>
            <option value="">Ninguno</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.brand} {v.model} - {v.plate}</option>
            ))}
          </select>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '6px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </NativeModalDialog>
  );
}

interface GastosImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  importing: boolean;
  errorMsg: string | null;
  selectedFile: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function GastosImportExcelModal({
  isOpen, onClose, importing, errorMsg, selectedFile, onFileChange, onSubmit,
}: GastosImportExcelModalProps) {
  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={() => !importing && onClose()}
      ariaLabelledBy="gasto-import-title"
      closeOnBackdrop={!importing}
      style={{ maxWidth: '480px', width: '92vw', padding: '24px' }}
    >
      <div className="modal-header" style={{ marginBottom: '18px' }}>
        <h3 id="gasto-import-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Importar Gastos Excel</h3>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} disabled={importing} aria-label="Cerrar">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {errorMsg && (
        <div role="alert" style={{ padding: '10px 12px', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.84rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={15} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <label
          htmlFor="gastos-excel-file"
          style={{
            border: '2px dashed var(--border-color)',
            borderRadius: '8px',
            padding: '28px 20px',
            textAlign: 'center',
            backgroundColor: '#F9FAFB',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <input id="gastos-excel-file" type="file" accept=".xlsx, .csv" onChange={onFileChange} style={{ display: 'none' }} disabled={importing} />
          <UploadCloud size={32} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {selectedFile ? selectedFile.name : 'Seleccionar archivo (.xlsx / .csv)'}
          </span>
        </label>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={importing}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!selectedFile || importing} style={{ backgroundColor: 'var(--color-corp-red)', borderColor: 'var(--color-corp-red)' }}>
            {importing ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </form>
    </NativeModalDialog>
  );
}
