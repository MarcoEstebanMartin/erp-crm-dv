import React, { useState, useMemo } from 'react';
import { api } from '../../utils/api';
import { Plus, X } from 'lucide-react';

interface TaxWithholdingsTabProps {
  taxWithholdings: any[];
  personas: any[];
  loading: boolean;
  loadData: () => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export default function TaxWithholdingsTab({
  taxWithholdings,
  personas,
  loading,
  loadData,
  setErrorMsg,
  setSuccessMsg
}: TaxWithholdingsTabProps) {
  const [showWithholdingModal, setShowWithholdingModal] = useState(false);
  const [withholdingClientSearchQuery, setWithholdingClientSearchQuery] = useState('');
  const [showWithholdingClientDropdown, setShowWithholdingClientDropdown] = useState(false);
  const [activeWithholdingClientSuggestionIdx, setActiveWithholdingClientSuggestionIdx] = useState(0);

  const [withholdingForm, setWithholdingForm] = useState({
    type: 'RETENCION_SUFRIDA',
    taxType: 'IIBB',
    personaId: '',
    number: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    jurisdiction: 'AR-B'
  });

  const clientsOnly = useMemo(() => {
    return personas.filter(p => p.isClient);
  }, [personas]);

  const filteredWithholdingClients = useMemo(() => {
    if (!withholdingClientSearchQuery) return clientsOnly.slice(0, 10);
    const q = withholdingClientSearchQuery.toUpperCase();
    return clientsOnly.filter((c: any) => 
      c.name.toUpperCase().includes(q) || (c.cuit && c.cuit.includes(q))
    ).slice(0, 10);
  }, [withholdingClientSearchQuery, clientsOnly]);

  const handleSelectWithholdingClient = (c: any) => {
    setWithholdingForm(prev => ({ ...prev, personaId: String(c.id) }));
    setWithholdingClientSearchQuery(c.name);
    setShowWithholdingClientDropdown(false);
  };

  const handleCreateWithholdingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const { taxType, personaId, number, date, amount } = withholdingForm;

    if (!taxType || !personaId || !number || !date || !amount) {
      setErrorMsg('Por favor complete todos los campos obligatorios.');
      return;
    }

    try {
      await api.createTaxWithholding({
        type: 'RETENCION_SUFRIDA',
        taxType,
        personaId: Number(personaId),
        number,
        date: new Date(date).toISOString(),
        amount: Number(amount),
        jurisdiction: taxType === 'IIBB' ? 'AR-B' : null
      });

      setSuccessMsg('✅ Movimiento de retención registrado con éxito.');
      setShowWithholdingModal(false);
      // Reset form
      setWithholdingForm({
        type: 'RETENCION_SUFRIDA',
        taxType: 'IIBB',
        personaId: '',
        number: '',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        jurisdiction: 'AR-B'
      });
      setWithholdingClientSearchQuery('');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar el comprobante impositivo.');
    }
  };

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 className="card-title" style={{ margin: '0' }}>🛡️ Declaraciones de Retenciones Impositivas Sufridas</h3>
            <p style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--text-secondary)' }}>
              Comprobantes de retención cargados manualmente para deducir saldo fiscal de cuenta corriente.
            </p>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={() => {
              setWithholdingForm({
                type: 'RETENCION_SUFRIDA',
                taxType: 'IIBB',
                personaId: '',
                number: '',
                date: new Date().toISOString().split('T')[0],
                amount: '',
                jurisdiction: 'AR-B'
              });
              setWithholdingClientSearchQuery('');
              setShowWithholdingModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            Cargar Certificado Retención
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha Certificado</th>
                <th>Tipo Movimiento</th>
                <th>Impuesto</th>
                <th>Nro Certificado</th>
                <th>Persona / CUIT</th>
                <th>Jurisdicción</th>
                <th>Importe Retenido</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center' }}>Cargando retenciones...</td></tr>
              ) : taxWithholdings.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center' }}>No se encontraron certificados de retención.</td></tr>
              ) : (
                taxWithholdings.map((w) => (
                  <tr key={w.id}>
                    <td>{new Date(w.date).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</td>
                    <td>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: w.type === 'RETENCION_SUFRIDA' ? '#EBF5FB' : '#FDEDEC',
                        color: w.type === 'RETENCION_SUFRIDA' ? '#2980B9' : '#C0392B'
                      }}>
                        {w.type === 'RETENCION_SUFRIDA' ? 'Sufrida (Nos retuvo el Cliente)' : 'Practicada (Retuvimos al Proveedor)'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{w.taxType}</td>
                    <td style={{ fontFamily: 'monospace' }}>{w.number}</td>
                    <td>
                      <div>{w.persona?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CUIT: {w.persona?.cuit}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{w.jurisdiction || 'No Aplica'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                      ${Number(w.amount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================================
          MODAL: REGISTRAR RETENCION O PERCEPCION MANUAL
          ==================================================================== */}
      {showWithholdingModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Ingresar Certificado de Retención</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowWithholdingModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateWithholdingSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Impuesto</label>
                  <select
                    className="select"
                    value={withholdingForm.taxType}
                    onChange={(e) => setWithholdingForm(prev => ({ ...prev, taxType: e.target.value }))}
                    required
                  >
                    <option value="IIBB">Ingresos Brutos (IIBB)</option>
                    <option value="GANANCIAS">Ganancias</option>
                  </select>
                </div>
              </div>

              {/* Buscador de Cliente Filtrable con Input */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Cliente</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Escribí para buscar cliente por nombre o CUIT..."
                  value={withholdingClientSearchQuery}
                  onChange={(e) => {
                    setWithholdingClientSearchQuery(e.target.value);
                    setShowWithholdingClientDropdown(true);
                  }}
                  onFocus={() => setShowWithholdingClientDropdown(true)}
                  onBlur={() => setTimeout(() => setShowWithholdingClientDropdown(false), 250)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setShowWithholdingClientDropdown(true);
                      setActiveWithholdingClientSuggestionIdx((prev: number) => 
                        filteredWithholdingClients.length > 0 ? (prev + 1) % filteredWithholdingClients.length : 0
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setShowWithholdingClientDropdown(true);
                      setActiveWithholdingClientSuggestionIdx((prev: number) => 
                        filteredWithholdingClients.length > 0 ? (prev - 1 + filteredWithholdingClients.length) % filteredWithholdingClients.length : 0
                      );
                    } else if (e.key === 'Enter') {
                      if (showWithholdingClientDropdown && filteredWithholdingClients.length > 0) {
                        e.preventDefault();
                        handleSelectWithholdingClient(filteredWithholdingClients[activeWithholdingClientSuggestionIdx]);
                      }
                    }
                  }}
                  style={{ fontSize: '0.9rem' }}
                  required={!withholdingForm.personaId}
                />
                {showWithholdingClientDropdown && filteredWithholdingClients.length > 0 && (
                  <div className="suggestions-list" style={{ position: 'absolute', zIndex: 100, width: '100%', maxHeight: '200px', overflowY: 'auto', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', boxShadow: 'var(--shadow-md)' }}>
                    {filteredWithholdingClients.map((c, idx) => {
                      const isActive = idx === activeWithholdingClientSuggestionIdx;
                      return (
                        <div
                          key={c.id}
                          className={`suggestion-item ${isActive ? 'active' : ''}`}
                          onMouseDown={() => handleSelectWithholdingClient(c)}
                          onMouseEnter={() => setActiveWithholdingClientSuggestionIdx(idx)}
                          style={{
                            backgroundColor: isActive ? '#e8f0fe' : 'inherit',
                            cursor: 'pointer',
                            padding: '8px 12px',
                            fontSize: '0.85rem',
                            borderBottom: '1px solid #f0f0f0'
                          }}
                        >
                          <strong>{c.name}</strong> <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(CUIT: {c.cuit || 'S/D'})</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Número Comprobante / Certificado</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ej: RET-10293 o Factura Nro"
                    value={withholdingForm.number}
                    onChange={(e) => setWithholdingForm(prev => ({ ...prev, number: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fecha</label>
                  <input
                    type="date"
                    className="input"
                    value={withholdingForm.date}
                    onChange={(e) => setWithholdingForm(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Importe ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="0.00"
                    value={withholdingForm.amount}
                    onChange={(e) => setWithholdingForm(prev => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowWithholdingModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>Guardar Comprobante</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
