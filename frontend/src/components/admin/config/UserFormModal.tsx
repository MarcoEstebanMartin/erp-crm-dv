import React, { useId, useState } from 'react';
import { UserPlus, Eye, EyeOff, X } from 'lucide-react';
import { NativeModalDialog } from '../../modals/NativeModalDialog';

export interface UserFormState {
  open: boolean;
  isEdit?: boolean;
  id?: number;
  username: string;
  password?: string;
  role: string;
  canDeliver?: boolean;
  canPick?: boolean;
}

interface UserFormModalProps {
  userModal: UserFormState;
  setUserModal: React.Dispatch<React.SetStateAction<UserFormState>>;
  currentUserId?: number;
  modalError?: string | null;
  submitting?: boolean;
  onClearError?: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function UserFormModal({
  userModal,
  setUserModal,
  currentUserId,
  modalError,
  submitting = false,
  onClearError,
  onSubmit,
}: UserFormModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const titleId = useId();
  const usernameId = useId();
  const passwordId = useId();
  const roleId = useId();
  const canDeliverId = useId();
  const canPickId = useId();

  const isEditingSelf = Boolean(userModal.isEdit && currentUserId && userModal.id === currentUserId);
  const closeModal = () => {
    onClearError?.();
    setUserModal({ ...userModal, open: false });
  };

  return (
    <NativeModalDialog
      isOpen={userModal.open}
      onClose={closeModal}
      ariaLabelledBy={titleId}
      style={{ maxWidth: '460px', width: '100%', padding: 0 }}
    >
      <div style={{ padding: '24px' }}>
        <div
          className="modal-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '12px',
          }}
        >
          <h3 id={titleId} style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={20} color="var(--color-primary)" />
            {userModal.isEdit ? `Editar ${userModal.username}` : 'Nuevo usuario'}
          </h3>
          <button
            type="button"
            className="btn btn-ghost"
            aria-label="Cerrar"
            style={{ padding: '4px', cursor: 'pointer' }}
            onClick={closeModal}
          >
            <X size={18} />
          </button>
        </div>

        {modalError && (
          <div
            role="alert"
            style={{
              backgroundColor: 'var(--accent-bg-light)',
              color: 'var(--accent-color)',
              padding: '10px 12px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              marginBottom: '12px',
            }}
          >
            {modalError}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label htmlFor={usernameId} style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              Usuario
            </label>
            <input
              id={usernameId}
              name="username"
              type="text"
              className="input"
              value={userModal.username}
              onChange={(e) => {
                onClearError?.();
                setUserModal({ ...userModal, username: e.target.value });
              }}
              minLength={3}
              maxLength={50}
              required
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label htmlFor={passwordId} style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              {userModal.isEdit ? 'Nueva clave (mín. 4)' : 'Clave (mín. 4)'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id={passwordId}
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder={userModal.isEdit ? 'Dejar vacío para conservar' : undefined}
                value={userModal.password || ''}
                onChange={(e) => {
                  onClearError?.();
                  setUserModal({ ...userModal, password: e.target.value });
                }}
                minLength={4}
                required={!userModal.isEdit}
                autoComplete="new-password"
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <button
                type="button"
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
                onClick={() => setShowPassword((prev) => !prev)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label htmlFor={roleId} style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              Rol
            </label>
            <select
              id={roleId}
              name="role"
              className="select"
              value={userModal.role}
              disabled={isEditingSelf}
              onChange={(e) => setUserModal({ ...userModal, role: e.target.value })}
              style={{
                width: '100%',
                height: '40px',
                padding: '0 10px',
                fontSize: '0.85rem',
                ...(isEditingSelf ? { opacity: 0.65, cursor: 'not-allowed' } : {}),
              }}
            >
              <option value="ADMIN">Administrador</option>
              <option value="FACTURACION">Facturación</option>
              <option value="VENDEDOR">Vendedor</option>
              <option value="DEPOSITO">Depósito</option>
            </select>
          </div>

          {userModal.role === 'VENDEDOR' && (
            <fieldset
              className="form-group"
              style={{
                border: 'none',
                padding: 0,
                margin: '0 0 16px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <label
                htmlFor={canDeliverId}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  id={canDeliverId}
                  name="canDeliver"
                  type="checkbox"
                  checked={Boolean(userModal.canDeliver)}
                  onChange={(e) => setUserModal({ ...userModal, canDeliver: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                />
                <span>También reparte</span>
              </label>

              <label
                htmlFor={canPickId}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  id={canPickId}
                  name="canPick"
                  type="checkbox"
                  checked={Boolean(userModal.canPick)}
                  onChange={(e) => setUserModal({ ...userModal, canPick: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                />
                <span>También depósito</span>
              </label>
            </fieldset>
          )}

          <div
            className="modal-footer"
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}
          >
            <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : userModal.isEdit ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </NativeModalDialog>
  );
}
