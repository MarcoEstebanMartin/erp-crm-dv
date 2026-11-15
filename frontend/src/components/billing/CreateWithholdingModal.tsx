import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { formatArgentinaDateKey } from '../../utils/orderSearchAndStatus.helper';
import { NativeModalDialog } from '../modals/NativeModalDialog';

interface CreateWithholdingModalProps {
  isOpen: boolean;
  onClose: () => void;
  personas: any[];
  onSuccess: () => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export function CreateWithholdingModal({
  isOpen,
  onClose,
  personas,
  onSuccess,
  setErrorMsg,
  setSuccessMsg,
}: CreateWithholdingModalProps) {
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    taxType: 'IIBB',
    personaId: '',
    number: '',
    date: formatArgentinaDateKey(new Date()),
    amount: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    setClientSearchQuery('');
    setShowDropdown(false);
    setActiveSuggestionIdx(0);
    setForm({
      taxType: 'IIBB',
      personaId: '',
      number: '',
      date: formatArgentinaDateKey(new Date()),
      amount: '',
    });
  }, [isOpen]);

  const clientsOnly = useMemo(() => personas.filter((p) => p.isClient), [personas]);

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery) return clientsOnly.slice(0, 10);
    const q = clientSearchQuery.toUpperCase();
    return clientsOnly
      .filter((c: any) => c.name?.toUpperCase().includes(q) || (c.cuit && c.cuit.includes(q)))
      .slice(0, 10);
  }, [clientSearchQuery, clientsOnly]);

  const handleSelectClient = (client: any) => {
    setForm((prev) => ({ ...prev, personaId: String(client.id) }));
    setClientSearchQuery(client.name);
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!form.taxType || !form.personaId || !form.number || !form.date || !form.amount) {
      setErrorMsg('Por favor complete todos los campos obligatorios.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createTaxWithholding({
        type: 'RETENCION_SUFRIDA',
        taxType: form.taxType,
        personaId: Number(form.personaId),
        number: form.number,
        date: new Date(form.date).toISOString(),
        amount: Number(form.amount),
        jurisdiction: form.taxType === 'IIBB' ? 'AR-B' : null,
      });

      setSuccessMsg('Movimiento de retención registrado con éxito.');
      onClose();
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar el comprobante impositivo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="create-withholding-title"
      closeOnBackdrop={false}
      style={{ maxWidth: '480px', width: '92vw', padding: '24px' }}
    >
      <div className="modal-header" style={{ marginBottom: '18px' }}>
        <h3 id="create-withholding-title" style={{ margin: 0 }}>
          Ingresar Certificado de Retención
        </h3>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '4px' }}
          onClick={onClose}
          aria-label="Cerrar carga de retención"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="withholding-tax-type">Impuesto</label>
          <select
            id="withholding-tax-type"
            className="select"
            value={form.taxType}
            onChange={(e) => setForm((prev) => ({ ...prev, taxType: e.target.value }))}
            required
          >
            <option value="IIBB">Ingresos Brutos (IIBB)</option>
            <option value="GANANCIAS">Ganancias</option>
          </select>
        </div>

        <div className="form-group" style={{ position: 'relative' }}>
          <label htmlFor="withholding-client-search">Cliente</label>
          <input
            id="withholding-client-search"
            type="search"
            className="input"
            placeholder="Escribí para buscar cliente por nombre o CUIT..."
            autoComplete="off"
            value={clientSearchQuery}
            onChange={(e) => {
              setClientSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 220)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setShowDropdown(true);
                setActiveSuggestionIdx((prev) =>
                  filteredClients.length > 0 ? (prev + 1) % filteredClients.length : 0,
                );
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setShowDropdown(true);
                setActiveSuggestionIdx((prev) =>
                  filteredClients.length > 0
                    ? (prev - 1 + filteredClients.length) % filteredClients.length
                    : 0,
                );
              } else if (e.key === 'Enter' && showDropdown && filteredClients.length > 0) {
                e.preventDefault();
                handleSelectClient(filteredClients[activeSuggestionIdx]);
              }
            }}
            required={!form.personaId}
          />
          {showDropdown && filteredClients.length > 0 && (
            <div className="suggestions-list" style={{ zIndex: 100 }}>
              {filteredClients.map((c, idx) => (
                <div
                  key={c.id}
                  className={`suggestion-item ${idx === activeSuggestionIdx ? 'active' : ''}`}
                  onMouseDown={() => handleSelectClient(c)}
                  onMouseEnter={() => setActiveSuggestionIdx(idx)}
                  style={{
                    backgroundColor: idx === activeSuggestionIdx ? '#F3F4F6' : '#FFFFFF',
                    fontSize: '0.85rem',
                  }}
                >
                  <strong>{c.name}</strong>{' '}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    (CUIT: {c.cuit || 'S/D'})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label htmlFor="withholding-number">Nro Comprobante / Certificado</label>
            <input
              id="withholding-number"
              type="text"
              className="input"
              placeholder="Ej: RET-10293"
              value={form.number}
              onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="withholding-date">Fecha</label>
            <input
              id="withholding-date"
              type="date"
              className="input"
              value={form.date}
              onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="withholding-amount">Importe ($)</label>
          <input
            id="withholding-amount"
            type="number"
            step="0.01"
            className="input tabular-nums"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            required
          />
        </div>

        <div className="modal-footer" style={{ marginTop: '20px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Guardando...' : 'Guardar Comprobante'}
          </button>
        </div>
      </form>
    </NativeModalDialog>
  );
}
