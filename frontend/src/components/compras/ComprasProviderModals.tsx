import React, { useState } from 'react';
import { X } from 'lucide-react';

export const ComprasProviderModals: React.FC<{
  providerModal: { open: boolean; mode: 'create' | 'edit'; data: any } | null;
  setProviderModal: React.Dispatch<React.SetStateAction<{ open: boolean; mode: 'create' | 'edit'; data: any } | null>>;
  onProviderSubmit: (e: React.FormEvent) => void;
  accountSummaryModal: any | null;
  setAccountSummaryModal: (v: any | null) => void;
  ledgerData: any[];
}> = ({ providerModal, setProviderModal, onProviderSubmit, accountSummaryModal, setAccountSummaryModal, ledgerData }) => {
  const [newContactName, setNewContactName] = useState('');
  const [newContactRole, setNewContactRole] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');

  return (
    <>
      {providerModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{providerModal.mode === 'create' ? 'Registrar Nuevo Proveedor' : 'Editar Proveedor'}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setProviderModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={onProviderSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Razón Social *</label>
                  <input type="text" className="input" required value={providerModal.data.name || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, name: e.target.value } } : null))} />
                </div>
                <div className="form-group">
                  <label>Rubro / Marcas</label>
                  <input type="text" className="input" value={providerModal.data.rubro || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, rubro: e.target.value } } : null))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group"><label>CUIT</label><input type="text" className="input" value={providerModal.data.cuit || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, cuit: e.target.value } } : null))} /></div>
                <div className="form-group"><label>Teléfono Principal</label><input type="text" className="input" value={providerModal.data.phone || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, phone: e.target.value } } : null))} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-group"><label>Email</label><input type="email" className="input" value={providerModal.data.email || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, email: e.target.value } } : null))} /></div>
                <div className="form-group"><label>Plazo Pago (Días)</label><input type="number" className="input" value={providerModal.data.paymentTermDays ?? 30} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, paymentTermDays: Number(e.target.value) } } : null))} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-group"><label>Dirección</label><input type="text" className="input" value={providerModal.data.address || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, address: e.target.value } } : null))} /></div>
                <div className="form-group"><label>Localidad</label><input type="text" className="input" value={providerModal.data.city || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, city: e.target.value } } : null))} /></div>
              </div>

              <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.84rem' }}>Contactos Adicionales</h4>
                {(providerModal.data.contacts || []).map((c: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', marginBottom: '6px', fontSize: '0.78rem' }}>
                    <span><strong>{c.name}</strong> {c.role ? `(${c.role})` : ''} {c.phone ? `📞 ${c.phone}` : ''}</span>
                    <button type="button" className="btn btn-ghost text-danger" style={{ padding: '0 4px' }} onClick={() => { const next = [...providerModal.data.contacts]; next.splice(idx, 1); setProviderModal({ ...providerModal, data: { ...providerModal.data, contacts: next } }); }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '6px', marginTop: '8px' }}>
                  <input type="text" className="input" placeholder="Nombre" style={{ height: '30px', fontSize: '0.78rem' }} value={newContactName} onChange={(e) => setNewContactName(e.target.value)} />
                  <input type="text" className="input" placeholder="Rol" style={{ height: '30px', fontSize: '0.78rem' }} value={newContactRole} onChange={(e) => setNewContactRole(e.target.value)} />
                  <input type="text" className="input" placeholder="Teléfono" style={{ height: '30px', fontSize: '0.78rem' }} value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} />
                  <button
                    type="button" className="btn btn-secondary" style={{ height: '30px', padding: '0 10px', fontSize: '0.76rem' }}
                    onClick={() => {
                      if (!newContactName.trim()) return;
                      const current = providerModal.data.contacts || [];
                      setProviderModal({ ...providerModal, data: { ...providerModal.data, contacts: [...current, { name: newContactName.trim(), role: newContactRole.trim(), phone: newContactPhone.trim(), email: newContactEmail.trim() }] } });
                      setNewContactName(''); setNewContactRole(''); setNewContactPhone(''); setNewContactEmail('');
                    }}
                  >
                    + Añadir
                  </button>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '18px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setProviderModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>Guardar Proveedor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {accountSummaryModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Resumen de Cuenta: {accountSummaryModal.name}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setAccountSummaryModal(null)}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: '14px', backgroundColor: '#F8F8FA', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Deuda Pendiente</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>${Number(accountSummaryModal.outstandingBalance || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="table-container" style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr><th>Fecha</th><th>Tipo</th><th>Referencia</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Debe</th><th style={{ textAlign: 'right' }}>Haber</th><th style={{ textAlign: 'right' }}>Saldo</th></tr>
                </thead>
                <tbody>
                  {ledgerData.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center' }}>No hay movimientos registrados.</td></tr>
                  ) : (
                    ledgerData.map((item, idx) => (
                      <tr key={idx}>
                        <td>{new Date(item.date).toLocaleDateString('es-AR')}</td>
                        <td>{item.type === 'DEBIT' ? 'Cargo' : 'Crédito'}</td>
                        <td>{item.reference}</td>
                        <td>{item.description}</td>
                        <td style={{ textAlign: 'right', color: 'var(--color-danger)', fontWeight: 600 }}>{item.type === 'DEBIT' ? `$${Number(item.amount).toLocaleString('es-AR')}` : ''}</td>
                        <td style={{ textAlign: 'right', color: '#2E7D32', fontWeight: 600 }}>{item.type === 'CREDIT' ? `$${Number(item.amount).toLocaleString('es-AR')}` : ''}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>${Number(item.balance).toLocaleString('es-AR')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="modal-footer" style={{ marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setAccountSummaryModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
