import React, { useState } from 'react';
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

  if (!clientModal.open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Registrar Nuevo Cliente</h3>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setClientModal({ ...clientModal, open: false })}>✕</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Nombre Comercial / Razón Social *</label>
            <input type="text" className="input" required value={clientModal.name} onChange={(e) => setClientModal({ ...clientModal, name: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label>CUIT / DNI</label>
              <input type="text" className="input" value={clientModal.cuit} onChange={(e) => setClientModal({ ...clientModal, cuit: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Localidad</label>
              <input type="text" className="input" placeholder="ej: General Villegas" value={clientModal.city || ''} onChange={(e) => setClientModal({ ...clientModal, city: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Dirección de Entrega</label>
            <input type="text" className="input" value={clientModal.address} onChange={(e) => setClientModal({ ...clientModal, address: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Zona de Reparto (Chofer)</label>
            <input type="text" list="route-suggestions-mobile" className="input" placeholder="ej: CENTRO 1, TROCHA..." value={clientModal.route || ''} onChange={(e) => setClientModal({ ...clientModal, route: e.target.value })} />
            <datalist id="route-suggestions-mobile">
              {['FEDERAL', 'PARQUE', 'CENTRO 1', 'CENTRO 2', 'CENTRO 3', 'CENTRO 4', 'FONAVI', 'PROGRESO', 'TROCHA', 'CICLON', 'CRUCE'].map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label>Teléfono</label>
              <input type="text" className="input" value={clientModal.phone} onChange={(e) => setClientModal({ ...clientModal, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" className="input" value={clientModal.email} onChange={(e) => setClientModal({ ...clientModal, email: e.target.value })} />
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label>GPS (Latitud, Longitud)</label>
              <input
                type="text" className="input" readOnly placeholder="Ubicación no capturada"
                value={clientModal.latitude && clientModal.longitude ? `${clientModal.latitude.toFixed(6)}, ${clientModal.longitude.toFixed(6)}` : ''}
                style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text-secondary)' }}
              />
            </div>
            <button
              type="button" className="btn btn-secondary" disabled={capturingGps}
              onClick={() => {
                setCapturingGps(true);
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setClientModal((prev) => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
                      setCapturingGps(false);
                      alert('📍 Ubicación GPS capturada con éxito.');
                    },
                    () => { setCapturingGps(false); alert('Error al obtener ubicación GPS.'); },
                    { enableHighAccuracy: true, timeout: 5000 },
                  );
                } else {
                  setCapturingGps(false);
                }
              }}
              style={{ height: '38px', whiteSpace: 'nowrap' }}
            >
              {capturingGps ? 'Obteniendo...' : '📍 Capturar GPS'}
            </button>
          </div>

          {vendedorRoutes.length > 0 && (
            <div className="form-group">
              <label>Asignar a Ruta de Venta</label>
              <select className="select" value={clientModal.saleRouteId} onChange={(e) => setClientModal({ ...clientModal, saleRouteId: e.target.value })}>
                <option value="">-- No Asignar a Ruta --</option>
                {vendedorRoutes.map((r) => (<option key={r.id} value={r.id}>{r.name} ({r.dayOfWeek || 'Flexible'})</option>))}
              </select>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setClientModal({ ...clientModal, open: false })}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Registrar Cliente</button>
          </div>
        </form>
      </div>
    </div>
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
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '450px' }}>
        <div className="modal-header">
          <h3>Registrar Visita sin Venta (Check-in GPS)</h3>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setNoSaleModal(null)}>✕</button>
        </div>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '14px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Cliente: <strong>{noSaleModal.clientName}</strong>
          </div>
          <div className="form-group">
            <label>Motivo de No Venta</label>
            <select className="select" value={noSaleModal.reason} onChange={(e) => setNoSaleModal({ ...noSaleModal, reason: e.target.value })}>
              <option value="Pasó de largo, no compró">Pasó de largo, no compró</option>
              <option value="Estaba cerrado">Estaba cerrado</option>
              <option value="Cerró el local definitivamente">Cerró el local definitivamente</option>
              <option value="No se encontraba el dueño">No se encontraba el dueño</option>
              <option value="Ya compró a otro proveedor">Ya compró a otro proveedor</option>
              <option value="Otro motivo (especificar en notas)">Otro motivo (especificar en notas)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Notas / Comentarios</label>
            <textarea className="input" style={{ minHeight: '80px', padding: '10px', fontSize: '0.85rem' }} placeholder="ej: El dueño regresa el jueves..." value={noSaleModal.notes || ''} onChange={(e) => setNoSaleModal({ ...noSaleModal, notes: e.target.value })} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setNoSaleModal(null)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--accent-color)', borderColor: 'var(--accent-color)' }} disabled={loading}>
              {loading ? 'Registrando GPS...' : 'Registrar Visita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
