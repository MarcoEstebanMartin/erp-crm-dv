import { useEffect, useRef, useState, type FC, type FormEvent } from 'react';
import { X, Zap } from 'lucide-react';
import { api } from '../../utils/api';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { ComprasProviderSummaryModal } from './ComprasProviderSummaryModal';
import { formatCuitDisplay } from './providersHelpers';

interface ArcaBannerState {
  tone: 'success' | 'warning' | 'error';
  text: string;
  existingId?: number;
}

export const ComprasProviderModals: FC<{
  providerModal: { open: boolean; mode: 'create' | 'edit'; data: any } | null;
  setProviderModal: React.Dispatch<React.SetStateAction<{ open: boolean; mode: 'create' | 'edit'; data: any } | null>>;
  onProviderSubmit: (e: FormEvent) => void;
  providers?: any[];
  savingProvider?: boolean;
  accountSummaryModal: any | null;
  setAccountSummaryModal: (v: any | null) => void;
  ledgerData: any[];
  summaryLoading?: boolean;
  summaryError?: string | null;
  errorMsg?: string | null;
  setErrorMsg?: (v: string | null) => void;
}> = ({
  providerModal,
  setProviderModal,
  onProviderSubmit,
  providers = [],
  savingProvider = false,
  accountSummaryModal,
  setAccountSummaryModal,
  ledgerData,
  summaryLoading = false,
  summaryError = null,
  errorMsg,
  setErrorMsg,
}) => {
  const [newContactName, setNewContactName] = useState('');
  const [newContactRole, setNewContactRole] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [isSearchingArca, setIsSearchingArca] = useState(false);
  const [arcaBanner, setArcaBanner] = useState<ArcaBannerState | null>(null);
  const lastLookedUpRef = useRef('');
  const inFlightRef = useRef(false);

  const isOpen = Boolean(providerModal?.open);
  useEffect(() => {
    if (isOpen) {
      setArcaBanner(null);
      lastLookedUpRef.current = '';
      setNewContactName('');
      setNewContactRole('');
      setNewContactPhone('');
    }
  }, [isOpen, providerModal?.mode, providerModal?.data?.id]);

  const closeProviderModal = () => {
    setErrorMsg?.(null);
    setArcaBanner(null);
    setProviderModal(null);
  };

  const handleOpenExisting = async (existingId: number) => {
    try {
      const localHit = providers.find((p) => Number(p.id) === Number(existingId));
      const fullExisting =
        localHit || (await api.getPersonas('ALL', '')).find((p: any) => Number(p.id) === Number(existingId));
      if (fullExisting) {
        setArcaBanner(null);
        setErrorMsg?.(null);
        setProviderModal({
          open: true,
          mode: 'edit',
          data: {
            ...fullExisting,
            rubro: fullExisting.rubro || '',
            contacts: Array.isArray(fullExisting.contacts) ? fullExisting.contacts : [],
          },
        });
      }
    } catch {
      setArcaBanner({ tone: 'error', text: 'No se pudo abrir la ficha existente.' });
    }
  };

  const handleFetchArca = async () => {
    if (inFlightRef.current || !providerModal?.data) return;
    const cuitClean = String(providerModal.data.cuit || '').replace(/\D/g, '');
    if (cuitClean.length < 7 || (cuitClean.length > 8 && cuitClean.length !== 11)) {
      setArcaBanner({ tone: 'error', text: 'Ingresá un DNI (7-8 dígitos) o CUIT (11 dígitos).' });
      return;
    }

    inFlightRef.current = true;
    lastLookedUpRef.current = cuitClean;
    setIsSearchingArca(true);
    setArcaBanner(null);
    setErrorMsg?.(null);

    try {
      const afipData = await api.getPersonaFromAFIP(cuitClean);
      if (!afipData || afipData.found === false) {
        setArcaBanner({
          tone: 'warning',
          text: afipData?.message || 'No se encontraron datos públicos. Completá Razón Social manualmente.',
        });
        return;
      }

      setProviderModal((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          data: {
            ...prev.data,
            cuit: formatCuitDisplay(afipData.cuit || prev.data.cuit) || prev.data.cuit,
            name: afipData.name || prev.data.name,
            address: afipData.address || prev.data.address,
            city: afipData.location || prev.data.city,
          },
        };
      });

      if (afipData.alreadyRegistered && providerModal.mode === 'create' && afipData.existingPersona) {
        setArcaBanner({
          tone: 'warning',
          text: `CUIT ya registrado como "${afipData.existingPersona.name}".`,
          existingId: afipData.existingPersona.id,
        });
      } else {
        setArcaBanner({ tone: 'success', text: afipData.name || 'Datos sincronizados.' });
      }
    } catch (err: any) {
      setArcaBanner({ tone: 'error', text: err?.message || 'Error al consultar ARCA.' });
    } finally {
      inFlightRef.current = false;
      setIsSearchingArca(false);
    }
  };

  const handleBlurCuit = () => {
    const clean = String(providerModal?.data?.cuit || '').replace(/\D/g, '');
    if (clean.length === 11 && !String(providerModal?.data?.name || '').trim() && clean !== lastLookedUpRef.current) {
      void handleFetchArca();
    }
  };

  const cleanDigitsLen = String(providerModal?.data?.cuit || '').replace(/\D/g, '').length;
  const canTriggerArca = !isSearchingArca && cleanDigitsLen >= 7;

  return (
    <>
      <NativeModalDialog isOpen={isOpen} onClose={closeProviderModal} ariaLabelledBy="prov-edit-modal-title" style={{ maxWidth: '620px', width: '94vw', padding: '24px' }}>
        {providerModal && (
          <>
            <div className="modal-header">
              <h3 id="prov-edit-modal-title" style={{ margin: 0 }}>{providerModal.mode === 'create' ? 'Nuevo proveedor' : 'Editar proveedor'}</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={closeProviderModal} aria-label="Cerrar">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            {errorMsg && <div role="alert" className="alert alert-danger" style={{ marginBottom: '12px' }}>{errorMsg}</div>}
            {arcaBanner && (
              <div
                role={arcaBanner.tone === 'error' ? 'alert' : 'status'}
                style={{
                  padding: '9px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.82rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
                  backgroundColor: arcaBanner.tone === 'error' ? '#fef2f2' : arcaBanner.tone === 'warning' ? '#fffbeb' : '#f0fdf4',
                  border: `1px solid ${arcaBanner.tone === 'error' ? '#fecaca' : arcaBanner.tone === 'warning' ? '#fde68a' : '#bbf7d0'}`,
                  color: arcaBanner.tone === 'error' ? '#991b1b' : arcaBanner.tone === 'warning' ? '#92400e' : '#166534',
                }}
              >
                <span>{arcaBanner.text}</span>
                {arcaBanner.existingId && (
                  <button type="button" className="btn btn-secondary" style={{ padding: '3px 9px', fontSize: '0.76rem', whiteSpace: 'nowrap' }} onClick={() => handleOpenExisting(arcaBanner.existingId!)}>
                    Abrir ficha existente
                  </button>
                )}
              </div>
            )}

            <form onSubmit={onProviderSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label htmlFor="prov-cuit">CUIT</label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      id="prov-cuit" type="text" inputMode="numeric" className="input tabular-nums"
                      value={providerModal.data.cuit || ''}
                      onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, cuit: e.target.value } } : null))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleFetchArca(); } }}
                      onBlur={handleBlurCuit}
                      autoCorrect="off" autoCapitalize="none" spellCheck={false}
                      style={{ paddingRight: '86px' }}
                    />
                    <button
                      type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleFetchArca} disabled={!canTriggerArca}
                      title="Consultar padrón ARCA"
                      style={{
                        position: 'absolute', right: '4px', top: '4px', bottom: '4px',
                        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0 9px', borderRadius: '5px',
                        fontSize: '0.74rem', fontWeight: 600, cursor: canTriggerArca ? 'pointer' : 'not-allowed',
                        backgroundColor: canTriggerArca ? '#111827' : '#f1f5f9',
                        color: canTriggerArca ? '#ffffff' : '#64748b',
                        border: canTriggerArca ? '1px solid #111827' : '1px solid #cbd5e1',
                      }}
                    >
                      <Zap size={12} aria-hidden="true" />
                      <span>{isSearchingArca ? 'Buscando...' : 'ARCA'}</span>
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="prov-rubro">Rubro / Marcas</label>
                  <input id="prov-rubro" type="text" className="input" value={providerModal.data.rubro || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, rubro: e.target.value } } : null))} />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="prov-name">Razón Social *</label>
                <input id="prov-name" type="text" className="input" required value={providerModal.data.name || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, name: e.target.value } } : null))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.7fr', gap: '12px' }}>
                <div className="form-group"><label htmlFor="prov-phone">Teléfono</label><input id="prov-phone" type="tel" className="input tabular-nums" value={providerModal.data.phone || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, phone: e.target.value } } : null))} /></div>
                <div className="form-group"><label htmlFor="prov-email">Email</label><input id="prov-email" type="email" className="input" autoCorrect="off" autoCapitalize="none" spellCheck={false} value={providerModal.data.email || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, email: e.target.value } } : null))} /></div>
                <div className="form-group"><label htmlFor="prov-term">Plazo (Días)</label><input id="prov-term" type="number" min={0} className="input tabular-nums" value={providerModal.data.paymentTermDays ?? 30} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, paymentTermDays: Number(e.target.value) } } : null))} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '12px' }}>
                <div className="form-group"><label htmlFor="prov-address">Dirección</label><input id="prov-address" type="text" className="input" value={providerModal.data.address || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, address: e.target.value } } : null))} /></div>
                <div className="form-group"><label htmlFor="prov-city">Localidad</label><input id="prov-city" type="text" className="input" value={providerModal.data.city || ''} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, city: e.target.value } } : null))} /></div>
              </div>

              <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Contactos</div>
                {(providerModal.data.contacts || []).map((c: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', marginBottom: '5px', fontSize: '0.78rem' }}>
                    <span className="tabular-nums"><strong>{c.name}</strong>{c.role ? ` (${c.role})` : ''}{c.phone ? ` · ${c.phone}` : ''}</span>
                    <button type="button" className="btn btn-ghost text-danger" style={{ padding: '0 4px' }} aria-label={`Quitar contacto ${c.name}`} onClick={() => { const next = [...providerModal.data.contacts]; next.splice(idx, 1); setProviderModal({ ...providerModal, data: { ...providerModal.data, contacts: next } }); }}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '6px', marginTop: '6px' }}>
                  <input type="text" aria-label="Nombre contacto" className="input" placeholder="Nombre" style={{ height: '32px', fontSize: '0.78rem' }} value={newContactName} onChange={(e) => setNewContactName(e.target.value)} />
                  <input type="text" aria-label="Rol contacto" className="input" placeholder="Rol" style={{ height: '32px', fontSize: '0.78rem' }} value={newContactRole} onChange={(e) => setNewContactRole(e.target.value)} />
                  <input type="tel" aria-label="Teléfono contacto" className="input tabular-nums" placeholder="Teléfono" style={{ height: '32px', fontSize: '0.78rem' }} value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} />
                  <button type="button" className="btn btn-secondary" style={{ height: '32px', padding: '0 10px', fontSize: '0.76rem' }} onClick={() => {
                    if (!newContactName.trim()) return;
                    const current = providerModal.data.contacts || [];
                    setProviderModal({ ...providerModal, data: { ...providerModal.data, contacts: [...current, { name: newContactName.trim(), role: newContactRole.trim(), phone: newContactPhone.trim(), email: '' }] } });
                    setNewContactName(''); setNewContactRole(''); setNewContactPhone('');
                  }}>
                    + Agregar
                  </button>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '18px', justifyContent: providerModal.mode === 'edit' ? 'space-between' : 'flex-end' }}>
                {providerModal.mode === 'edit' && (
                  <label htmlFor="prov-active" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                    <input id="prov-active" type="checkbox" checked={providerModal.data.isActive !== false} onChange={(e) => setProviderModal((prev) => (prev ? { ...prev, data: { ...prev.data, isActive: e.target.checked } } : null))} />
                    <span>Proveedor activo</span>
                  </label>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary" onClick={closeProviderModal}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={savingProvider}>{savingProvider ? 'Guardando...' : 'Guardar'}</button>
                </div>
              </div>
            </form>
          </>
        )}
      </NativeModalDialog>

      <ComprasProviderSummaryModal accountSummaryModal={accountSummaryModal} onClose={() => setAccountSummaryModal(null)} ledgerData={ledgerData} loading={summaryLoading} errorMsg={summaryError} />
    </>
  );
};
