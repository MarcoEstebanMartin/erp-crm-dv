import React, { useState } from 'react';
import { UserPlus, Eye, EyeOff } from 'lucide-react';

export interface UserFormState {
  open: boolean;
  isEdit?: boolean;
  id?: number;
  username: string;
  password?: string;
  role: string;
}

interface UserFormModalProps {
  userModal: UserFormState;
  setUserModal: React.Dispatch<React.SetStateAction<UserFormState>>;
  currentUserId?: number;
  onSubmit: (e: React.FormEvent) => void;
}

export default function UserFormModal({
  userModal,
  setUserModal,
  currentUserId,
  onSubmit,
}: UserFormModalProps) {
  const [showPassword, setShowPassword] = useState(false);

  if (!userModal.open) return null;

  const isEditingSelf = Boolean(userModal.isEdit && currentUserId && userModal.id === currentUserId);

  return (
    <div
      className="modal-overlay animate-fade-in"
      style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: '480px',
          width: '100%',
          padding: '24px',
          borderRadius: '12px',
          background: '#fff',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
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
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={20} color="var(--primary-color)" />
            {userModal.isEdit ? `Editar Empleado: ${userModal.username}` : 'Registrar Nuevo Empleado'}
          </h3>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '4px', cursor: 'pointer' }}
            onClick={() => setUserModal({ ...userModal, open: false })}
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              Nombre de usuario (Login)
            </label>
            <input
              type="text"
              className="input"
              placeholder="ej: esteban, pablo, diego..."
              value={userModal.username}
              onChange={(e) => setUserModal({ ...userModal, username: e.target.value })}
              minLength={3}
              maxLength={50}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              {userModal.isEdit ? 'Nueva Contraseña (dejar en blanco para conservar actual)' : 'Contraseña de Acceso'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder={userModal.isEdit ? '•••••••• (Mínimo 6 caracteres para cambiar)' : '•••••••• (Mínimo 6 caracteres)'}
                value={userModal.password || ''}
                onChange={(e) => setUserModal({ ...userModal, password: e.target.value })}
                minLength={6}
                required={!userModal.isEdit}
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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
            <small style={{ display: 'block', marginTop: '4px', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              Mínimo 6 caracteres. Al cambiar la clave se cierran automáticamente sesiones abiertas con la clave anterior.
            </small>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              Rol y Nivel de Acceso en Distribuidora
            </label>
            <select
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
              <option value="ADMIN">Administrador General (Pablo / Esteban - Acceso Total)</option>
              <option value="FACTURACION">Oficina / Administración (Facturación, Listas de Precio, Recibos, Notas de Crédito)</option>
              <option value="VENDEDOR">Vendedor de Calle (Toma de pedidos en ruta)</option>
              <option value="DEPOSITO">Depósito y Logística (Armado de pedidos, Balanza, Stock)</option>
            </select>
            {isEditingSelf && (
              <small style={{ display: 'block', marginTop: '4px', fontSize: '0.74rem', color: '#B45309' }}>
                No podés cambiar el rol de tu propio usuario en sesión.
              </small>
            )}
          </div>

          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              marginBottom: '16px',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
            }}
          >
            Los permisos y módulos visibles se rigen al 100% por el <strong>Rol</strong> asignado.
          </div>

          <div
            className="modal-footer"
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}
          >
            <button type="button" className="btn btn-secondary" onClick={() => setUserModal({ ...userModal, open: false })}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {userModal.isEdit ? 'Guardar Cambios' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
