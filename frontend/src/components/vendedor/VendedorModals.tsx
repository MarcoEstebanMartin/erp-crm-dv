import React, { useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import type { SaleRoute } from '../../types';

export interface StreetClientFormState {
  open: boolean;
  name: string;
  cuit: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  route: string;
  saleRouteId: string | number;
  latitude: number | null;
  longitude: number | null;
}

interface VendedorStreetClientModalProps {
  clientModal: StreetClientFormState;
  setClientModal: React.Dispatch<React.SetStateAction<StreetClientFormState>>;
  vendedorRoutes: SaleRoute[];
  onSubmit: (e: React.FormEvent) => void;
}

export const VendedorStreetClientModal: React.FC<VendedorStreetClientModalProps> = ({
  clientModal,
  setClientModal,
  vendedorRoutes,
  onSubmit,
}) => {
  const [capturingGps, setCapturingGps] = useState(false);
  const [gpsFeedback, setGpsFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  if (!clientModal.open) return null;

  const handleClose = () => {
    setGpsFeedback(null);
    setClientModal({ ...clientModal, open: false });
  };

  return (
    <NativeModalDialog isOpen={clientModal.open} onClose={handleClose} ariaLabelledBy="vendedor-new-client-title" style={{ maxWidth: '520px', width: '94vw', padding: '22px', borderRadius: '12px' }}>
      <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 id="vendedor-new-client-title" style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700 }}>Nuevo cliente</h3>
        <button type="button" className="btn btn-ghost" aria-label="Cerrar" style={{ padding: '4px' }} onClick={handleClose}>
          <X size={18} />
        </button>
      </div>

      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="vendedor-client-name">Nombre *</label>
          <input id="vendedor-client-name" type="text" className="input" required value={clientModal.name} onChange={(e) => setClientModal({ ...clientModal, name: e.target.value })} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label htmlFor="vendedor-client-cuit">CUIT / DNI</label>
            <input id="vendedor-client-cuit" type="text" className="input" autoCorrect="off" autoCapitalize="none" spellCheck={false} value={clientModal.cuit} onChange={(e) => setClientModal({ ...clientModal, cuit: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="vendedor-client-city">Localidad</label>
            <input id="vendedor-client-city" type="text" className="input" placeholder="Localidad" value={clientModal.city || ''} onChange={(e) => setClientModal({ ...clientModal, city: e.target.value })} />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="vendedor-client-address">Dirección</label>
          <input id="vendedor-client-address" type="text" className="input" value={clientModal.address} onChange={(e) => setClientModal({ ...clientModal, address: e.target.value })} />
        </div>

        <div className="form-group">
          <label htmlFor="vendedor-client-route">Reparto</label>
          <input id="vendedor-client-route" type="text" list="route-suggestions-mobile" className="input" placeholder="Zona de reparto" value={clientModal.route || ''} onChange={(e) => setClientModal({ ...clientModal, route: e.target.value })} />
          <datalist id="route-suggestions-mobile">
            {['FEDERAL', 'PARQUE', 'CENTRO 1', 'CENTRO 2', 'CENTRO 3', 'CENTRO 4', 'FONAVI', 'PROGRESO', 'TROCHA', 'CICLON', 'CRUCE'].map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label htmlFor="vendedor-client-phone">Teléfono</label>
            <input id="vendedor-client-phone" type="text" className="input" value={clientModal.phone} onChange={(e) => setClientModal({ ...clientModal, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="vendedor-client-email">Email</label>
            <input id="vendedor-client-email" type="email" className="input" autoCorrect="off" autoCapitalize="none" spellCheck={false} value={clientModal.email} onChange={(e) => setClientModal({ ...clientModal, email: e.target.value })} />
          </div>
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="vendedor-client-gps">GPS</label>
              <input
                id="vendedor-client-gps"
                type="text"
                className="input tabular-nums"
                readOnly
                placeholder="Sin capturar"
                value={clientModal.latitude && clientModal.longitude ? `${clientModal.latitude.toFixed(6)}, ${clientModal.longitude.toFixed(6)}` : ''}
                style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text-secondary)' }}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={capturingGps}
              onClick={() => {
                setCapturingGps(true);
                setGpsFeedback(null);
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setClientModal((prev) => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
                      setCapturingGps(false);
                      setGpsFeedback({ tone: 'ok', text: 'GPS capturado.' });
                    },
                    () => {
                      setCapturingGps(false);
                      setGpsFeedback({ tone: 'error', text: 'No se pudo obtener GPS.' });
                    },
                    { enableHighAccuracy: true, timeout: 5000 },
                  );
                } else {
                  setCapturingGps(false);
                  setGpsFeedback({ tone: 'error', text: 'GPS no disponible.' });
                }
              }}
              style={{ height: '38px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <MapPin size={15} />
              <span>{capturingGps ? 'Obteniendo...' : 'Capturar GPS'}</span>
            </button>
          </div>
          {gpsFeedback && (
            <div role={gpsFeedback.tone === 'error' ? 'alert' : 'status'} style={{ marginTop: '6px', fontSize: '0.78rem', color: gpsFeedback.tone === 'error' ? '#991b1b' : '#166534' }}>
              {gpsFeedback.text}
            </div>
          )}
        </div>

        {vendedorRoutes.length > 0 && (
          <div className="form-group">
            <label htmlFor="vendedor-client-sale-route">Ruta</label>
            <select id="vendedor-client-sale-route" className="select" value={clientModal.saleRouteId} onChange={(e) => setClientModal({ ...clientModal, saleRouteId: e.target.value })}>
              <option value="">Sin asignar</option>
              {vendedorRoutes.map((r) => (<option key={r.id} value={r.id}>{r.name} ({r.dayOfWeek || 'Flexible'})</option>))}
            </select>
          </div>
        )}

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={handleClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">Guardar</button>
        </div>
      </form>
    </NativeModalDialog>
  );
};

interface VendedorNoSaleModalProps {
  noSaleModal: { open: boolean; clientId: number; clientName: string; reason: string; notes: string } | null;
  setNoSaleModal: React.Dispatch<React.SetStateAction<{ open: boolean; clientId: number; clientName: string; reason: string; notes: string } | null>>;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const VendedorNoSaleModal: React.FC<VendedorNoSaleModalProps> = ({
  noSaleModal,
  setNoSaleModal,
  loading,
  onSubmit,
}) => {
  if (!noSaleModal || !noSaleModal.open) return null;

  return (
    <NativeModalDialog isOpen={noSaleModal.open} onClose={() => setNoSaleModal(null)} ariaLabelledBy="vendedor-nosale-title" style={{ maxWidth: '450px', width: '94vw', padding: '22px', borderRadius: '12px' }}>
      <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 id="vendedor-nosale-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Visita sin venta</h3>
        <button type="button" className="btn btn-ghost" aria-label="Cerrar" style={{ padding: '4px' }} onClick={() => setNoSaleModal(null)}>
          <X size={18} />
        </button>
      </div>
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: '12px', fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {noSaleModal.clientName}
        </div>
        <div className="form-group">
          <label htmlFor="vendedor-nosale-reason">Motivo</label>
          <select id="vendedor-nosale-reason" className="select" value={noSaleModal.reason} onChange={(e) => setNoSaleModal({ ...noSaleModal, reason: e.target.value })}>
            <option value="Pasó de largo, no compró">Pasó de largo, no compró</option>
            <option value="Estaba cerrado">Estaba cerrado</option>
            <option value="Cerró el local definitivamente">Cerró el local definitivamente</option>
            <option value="No se encontraba el dueño">No se encontraba el dueño</option>
            <option value="Ya compró a otro proveedor">Ya compró a otro proveedor</option>
            <option value="Otro motivo (especificar en notas)">Otro</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="vendedor-nosale-notes">Notas</label>
          <textarea id="vendedor-nosale-notes" className="input" style={{ minHeight: '78px', padding: '10px', fontSize: '0.85rem' }} placeholder="Observaciones" value={noSaleModal.notes || ''} onChange={(e) => setNoSaleModal({ ...noSaleModal, notes: e.target.value })} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => setNoSaleModal(null)}>Cancelar</button>
          <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--accent-color)', borderColor: 'var(--accent-color)' }} disabled={loading}>
            {loading ? 'Guardando...' : 'Registrar visita'}
          </button>
        </div>
      </form>
    </NativeModalDialog>
  );
};
