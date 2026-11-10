import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../../utils/api';

interface AdminUserCreateModalProps {
  userModal: { open: boolean; username: string; password: string; role: string };
  setUserModal: React.Dispatch<React.SetStateAction<{ open: boolean; username: string; password: string; role: string }>>;
  onSuccess: () => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export const AdminUserCreateModal: React.FC<AdminUserCreateModalProps> = ({
  userModal,
  setUserModal,
  onSuccess,
  setErrorMsg,
  setSuccessMsg,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  if (!userModal.open) return null;

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userModal.username || !userModal.password) {
      setErrorMsg('Usuario y contraseña son requeridos.');
      return;
    }
    try {
      await api.createUser({ username: userModal.username, password: userModal.password, role: userModal.role });
      setUserModal({ open: false, username: '', password: '', role: 'VENDEDOR' });
      setSuccessMsg('Usuario creado con éxito.');
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear usuario.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Registrar Empleado</h3>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setUserModal({ ...userModal, open: false })}>✕</button>
        </div>
        <form onSubmit={handleUserSubmit}>
          <div className="form-group">
            <label>Nombre de usuario</label>
            <input type="text" className="input" placeholder="ej: juan.perez" value={userModal.username} onChange={(e) => setUserModal({ ...userModal, username: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Contraseña inicial</label>
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} className="input" placeholder="••••••••" value={userModal.password} onChange={(e) => setUserModal({ ...userModal, password: e.target.value })} required style={{ paddingRight: '40px' }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Rol y Nivel de Acceso (RBAC)</label>
            <select className="select" value={userModal.role} onChange={(e) => setUserModal({ ...userModal, role: e.target.value })}>
              <option value="VENDEDOR">Vendedor (Toma pedidos calle, solo ve sus clientes)</option>
              <option value="DEPOSITO">Operario de Depósito (Control físico de stock y armado de pedidos)</option>
              <option value="FACTURACION">Auxiliar de Facturación (Factura pedidos y cobra caja)</option>
              <option value="ADMIN">Administrador (Acceso financiero completo, auditoría y personal)</option>
            </select>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setUserModal({ ...userModal, open: false })}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Crear Usuario</button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AdminQuickClientSearchModalProps {
  clientSearchModal: { open: boolean; action: 'ledger' | 'payment' | 'order' } | null;
  clients: any[];
  quickClientQuery: string;
  setQuickClientQuery: (q: string) => void;
  onClose: () => void;
  onSelectClientAction: (action: 'ledger' | 'payment' | 'order', client: any) => void;
}

export const AdminQuickClientSearchModal: React.FC<AdminQuickClientSearchModalProps> = ({
  clientSearchModal,
  clients,
  quickClientQuery,
  setQuickClientQuery,
  onClose,
  onSelectClientAction,
}) => {
  if (!clientSearchModal || !clientSearchModal.open) return null;

  const filteredQuickClients = clients.filter((c) => {
    if (!c.isClient || c.isActive === false) return false;
    const query = quickClientQuery.toLowerCase();
    return c.name.toLowerCase().includes(query) || (c.cuit && c.cuit.includes(query));
  });

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
        <div className="modal-header">
          <h3>
            {clientSearchModal.action === 'ledger' && '📋 Consultar Cuenta Corriente'}
            {clientSearchModal.action === 'payment' && '💵 Cargar Recibo / Registrar Pago'}
            {clientSearchModal.action === 'order' && '🛒 Iniciar Nuevo Pedido'}
          </h3>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>✕</button>
        </div>
        <div className="form-group" style={{ marginTop: '10px' }}>
          <label>Buscar Cliente (por Nombre o CUIT)</label>
          <input type="text" className="input" autoFocus placeholder="Escriba para buscar..." value={quickClientQuery} onChange={(e) => setQuickClientQuery(e.target.value)} />
        </div>
        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '12px', backgroundColor: '#ffffff' }}>
          {filteredQuickClients.length === 0 ? (
            <div style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem' }}>No se encontraron clientes.</div>
          ) : (
            filteredQuickClients.map((c) => (
              <button
                key={c.id}
                onClick={() => { const action = clientSearchModal.action; onClose(); onSelectClientAction(action, c); }}
                style={{ width: '100%', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', borderBottom: '1px solid #f0f0f2', background: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{c.name}</div>
                  {c.cuit && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>CUIT: {c.cuit}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: Number(c.outstandingBalance || 0) > 0 ? 'var(--color-danger)' : Number(c.outstandingBalance || 0) < 0 ? 'var(--color-success)' : 'var(--text-primary)' }}>
                    {Number(c.outstandingBalance || 0) < 0 ? `$${Math.abs(Number(c.outstandingBalance)).toLocaleString()} (A Favor)` : `$${Number(c.outstandingBalance || 0).toLocaleString()}`}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Saldo CC</div>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="modal-footer" style={{ marginTop: '16px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
};
