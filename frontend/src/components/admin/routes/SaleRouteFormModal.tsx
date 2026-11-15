import React from 'react';
import { X } from 'lucide-react';
import { NativeModalDialog } from '../../modals/NativeModalDialog';

interface SaleRouteFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  formName: string;
  setFormName: (v: string) => void;
  formSellerId: string;
  setFormSellerId: (v: string) => void;
  formDay: string;
  setFormDay: (v: string) => void;
  formActive: boolean;
  setFormActive: (v: boolean) => void;
  sellers: any[];
  daysOfWeek: readonly string[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const SaleRouteFormModal: React.FC<SaleRouteFormModalProps> = ({
  isOpen,
  isEditing,
  formName,
  setFormName,
  formSellerId,
  setFormSellerId,
  formDay,
  setFormDay,
  formActive,
  setFormActive,
  sellers,
  daysOfWeek,
  saving,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="sale-route-modal-title"
      style={{ maxWidth: '460px', width: '94vw', padding: '22px', borderRadius: '12px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
        <h3 id="sale-route-modal-title" style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700 }}>
          {isEditing ? 'Editar ruta' : 'Nueva ruta'}
        </h3>
        <button type="button" className="btn btn-ghost" aria-label="Cerrar" style={{ padding: '4px' }} onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="route-form-name" style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            Nombre *
          </label>
          <input
            id="route-form-name"
            type="text"
            className="input"
            placeholder="Nombre de ruta"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="route-form-seller" style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            Vendedor
          </label>
          <select
            id="route-form-seller"
            className="select"
            value={formSellerId}
            onChange={(e) => setFormSellerId(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">Sin vendedor</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.username.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="route-form-day" style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            Día
          </label>
          <select
            id="route-form-day"
            className="select"
            value={formDay}
            onChange={(e) => setFormDay(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">Sin día</option>
            {daysOfWeek.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {isEditing && (
          <label htmlFor="route-form-active" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer' }}>
            <input
              id="route-form-active"
              type="checkbox"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
            />
            <span>Activa</span>
          </label>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '4px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </NativeModalDialog>
  );
};
