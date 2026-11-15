import { useState, type FC, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';

export const ComprasProviderModals: FC<{
  providerModal: { open: boolean; mode: 'create' | 'edit'; data: any } | null;
  setProviderModal: React.Dispatch<React.SetStateAction<{ open: boolean; mode: 'create' | 'edit'; data: any } | null>>;
  onProviderSubmit: (e: FormEvent) => void;
  accountSummaryModal: any | null;
  setAccountSummaryModal: (v: any | null) => void;
  ledgerData: any[];
  errorMsg?: string | null;
  setErrorMsg?: (v: string | null) => void;
}> = ({ providerModal, setProviderModal, onProviderSubmit, accountSummaryModal, setAccountSummaryModal, ledgerData, errorMsg, setErrorMsg }) => {
  const [newContactName, setNewContactName] = useState('');
  const [newContactRole, setNewContactRole] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  const closeProviderModal = () => { setErrorMsg?.(null); setProviderModal(null); };

  return (
    <>
      <NativeModalDialog isOpen={Boolean(providerModal?.open)} onClose={closeProviderModal} ariaLabelledBy="prov-edit-modal-title" style={{ maxWidth: '600px', width: '94vw', padding: '24px' }}>
        {providerModal && (
          <>
            <div className="modal-header">
              <h3 id="prov-edit-modal-title" style={{ margin: 0 }}>{providerModal.mode === 'create' ? 'Nuevo Proveedor' : 'Editar Proveedor'}</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={closeProviderModal} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
            </div>
            {errorMsg && <div role="alert" className="alert alert-danger" style={{ marginBottom: '12px' }}>{errorMsg}</div>}
            <form onSubmit={onProviderSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label htmlFor="prov-name">Razón Social *</label>
                  <input id="prov-name" type="text" className="input" required value={providerModal.data.name || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, name: e.target.value } } : null))} />
                </div>
                <div className="form-group">
                  <label htmlFor="prov-rubro">Rubro / Marcas</label>
                  <input id="prov-rubro" type="text" className="input" value={providerModal.data.rubro || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, rubro: e.target.value } } : null))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group"><label htmlFor="prov-cuit">CUIT</label><input id="prov-cuit" type="text" className="input tabular-nums" value={providerModal.data.cuit || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, cuit: e.target.value } } : null))} autoCorrect="off" autoCapitalize="none" spellCheck={false} /></div>
                <div className="form-group"><label htmlFor="prov-phone">Teléfono</label><input id="prov-phone" type="text" className="input tabular-nums" value={providerModal.data.phone || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, phone: e.target.value } } : null))} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-group"><label htmlFor="prov-email">Email</label><input id="prov-email" type="email" className="input" value={providerModal.data.email || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, email: e.target.value } } : null))} /></div>
                <div className="form-group"><label htmlFor="prov-term">Plazo Pago (Días)</label><input id="prov-term" type="number" className="input tabular-nums" value={providerModal.data.paymentTermDays ?? 30} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, paymentTermDays: Number(e.target.value) } } : null))} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-group"><label htmlFor="prov-address">Dirección</label><input id="prov-address" type="text" className="input" value={providerModal.data.address || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, address: e.target.value } } : null))} /></div>
                <div className="form-group"><label htmlFor="prov-city">Localidad</label><input id="prov-city" type="text" className="input" value={providerModal.data.city || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, city: e.target.value } } : null))} /></div>
              </div>

              <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.84rem' }}>Contactos</h4>
                {(providerModal.data.contacts || []).map((c: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', marginBottom: '6px', fontSize: '0.78rem' }}>
                    <span className="tabular-nums"><strong>{c.name}</strong>{c.role ? ` (${c.role})` : ''}{c.phone ? ` · ${c.phone}` : ''}</span>
                    <button type="button" className="btn btn-ghost text-danger" style={{ padding: '0 4px' }} aria-label={`Quitar contacto ${c.name}`} onClick={() => { const next = [...providerModal.data.contacts]; next.splice(idx, 1); setProviderModal({ ...providerModal, data: { ...providerModal.data, contacts: next } }); }}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '6px', marginTop: '8px' }}>
                  <input type="text" aria-label="Nombre contacto" className="input" placeholder="Nombre" style={{ height: '30px', fontSize: '0.78rem' }} value={newContactName} onChange={(e) => setNewContactName(e.target.value)} />
                  <input type="text" aria-label="Rol contacto" className="input" placeholder="Rol" style={{ height: '30px', fontSize: '0.78rem' }} value={newContactRole} onChange={(e) => setNewContactRole(e.target.value)} />
                  <input type="text" aria-label="Teléfono contacto" className="input tabular-nums" placeholder="Teléfono" style={{ height: '30px', fontSize: '0.78rem' }} value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} />
                  <button type="button" className="btn btn-secondary" style={{ height: '30px', padding: '0 10px', fontSize: '0.76rem' }} onClick={() => {
                    if (!newContactName.trim()) return;
                    const current = providerModal.data.contacts || [];
                    setProviderModal({ ...providerModal, data: { ...providerModal.data, contacts: [...current, { name: newContactName.trim(), role: newContactRole.trim(), phone: newContactPhone.trim(), email: '' }] } });
                    setNewContactName(''); setNewContactRole(''); setNewContactPhone('');
                  }}>
                    + Agregar
                  </button>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '18px' }}>
                <button type="button" className="btn btn-secondary" onClick={closeProviderModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>Guardar</button>
              </div>
            </form>
          </>
        )}
      </NativeModalDialog>

      <NativeModalDialog isOpen={Boolean(accountSummaryModal)} onClose={() => setAccountSummaryModal(null)} ariaLabelledBy="prov-summary-modal-title" style={{ maxWidth: '800px', width: '94vw', padding: '24px' }}>
        {accountSummaryModal && (
          <>
            <div className="modal-header">
              <h3 id="prov-summary-modal-title" style={{ margin: 0 }}>Cuenta Corriente: {accountSummaryModal.name}</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setAccountSummaryModal(null)} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
            </div>
            <div style={{ marginBottom: '14px', backgroundColor: '#F8F8FA', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Deuda Pendiente</div>
              <div className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 700 }}>${Number(accountSummaryModal.outstandingBalance || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="table-container table-container--sticky" role="region" aria-label="Cuenta corriente del proveedor" tabIndex={0} style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr><th scope="col">Fecha</th><th scope="col">Tipo</th><th scope="col">Referencia</th><th scope="col">Descripción</th><th scope="col" style={{ textAlign: 'right' }}>Debe</th><th scope="col" style={{ textAlign: 'right' }}>Haber</th><th scope="col" style={{ textAlign: 'right' }}>Saldo</th></tr>
                </thead>
                <tbody>
                  {ledgerData.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center' }}>Sin movimientos registrados.</td></tr>
                  ) : (
                    ledgerData.map((item, idx) => (
                      <tr key={idx}>
                        <td className="tabular-nums">{new Date(item.date).toLocaleDateString('es-AR')}</td>
                        <td>{item.type === 'DEBIT' ? 'Cargo' : 'Crédito'}</td>
                        <td className="tabular-nums">{item.reference}</td>
                        <td>{item.description}</td>
                        <td className="tabular-nums" style={{ textAlign: 'right', color: 'var(--color-danger)', fontWeight: 600 }}>{item.type === 'DEBIT' ? `$${Number(item.amount).toLocaleString('es-AR')}` : ''}</td>
                        <td className="tabular-nums" style={{ textAlign: 'right', color: '#2E7D32', fontWeight: 600 }}>{item.type === 'CREDIT' ? `$${Number(item.amount).toLocaleString('es-AR')}` : ''}</td>
                        <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700 }}>${Number(item.balance).toLocaleString('es-AR')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="modal-footer" style={{ marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setAccountSummaryModal(null)}>Cerrar</button>
            </div>
          </>
        )}
      </NativeModalDialog>
    </>
  );
};
