import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, Edit3, Crown, Building2, Truck, Package, Phone } from 'lucide-react';
import { api } from '../../../utils/api';
import { useConfirm } from '../../../context/ConfirmContext';
import UserFormModal, { type UserFormState } from './UserFormModal';

interface UsersRolesTabProps {
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

const ROLE_GROUPS = [
  {
    roleKey: 'ADMIN',
    title: 'Administración',
    icon: <Crown size={14} />,
    bg: '#FDEDEC',
    color: '#C0392B',
  },
  {
    roleKey: 'FACTURACION',
    title: 'Facturación',
    icon: <Building2 size={14} />,
    bg: '#EBF5FB',
    color: '#2980B9',
  },
  {
    roleKey: 'VENDEDOR',
    title: 'Vendedores',
    icon: <Truck size={14} />,
    bg: '#E8F8F5',
    color: '#117A65',
  },
  {
    roleKey: 'DEPOSITO',
    title: 'Depósito',
    icon: <Package size={14} />,
    bg: '#FEF9E7',
    color: '#B7950B',
  },
];

function formatLastLogin(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function UsersRolesTab({ setErrorMsg, setSuccessMsg }: UsersRolesTabProps) {
  const confirm = useConfirm();
  const currentUser = api.getCurrentUser();
  const [users, setUsers] = useState<any[]>([]);
  const [userModal, setUserModal] = useState<UserFormState>({
    open: false,
    isEdit: false,
    username: '',
    password: '',
    role: 'VENDEDOR',
  });

  useEffect(() => {
    api.getUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    const cleanUsername = userModal.username.trim();
    const cleanPassword = (userModal.password || '').trim();

    if (cleanUsername.length < 3) {
      setErrorMsg('El nombre de usuario debe tener al menos 3 caracteres.');
      return;
    }
    if (!userModal.isEdit && cleanPassword.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (userModal.isEdit && cleanPassword.length > 0 && cleanPassword.length < 6) {
      setErrorMsg('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      if (userModal.isEdit && userModal.id) {
        await api.updateUser(userModal.id, {
          username: cleanUsername,
          role: userModal.role,
          password: cleanPassword,
        });
        if (currentUser?.id === userModal.id) {
          await api.getMe();
        }
        setSuccessMsg(`Empleado ${cleanUsername} actualizado correctamente.`);
      } else {
        await api.createUser({
          username: cleanUsername,
          password: cleanPassword,
          role: userModal.role,
        });
        setSuccessMsg('Usuario creado exitosamente.');
      }
      setUserModal({ open: false, isEdit: false, username: '', password: '', role: 'VENDEDOR' });
      const dataUsers = await api.getUsers();
      setUsers(dataUsers);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar usuario.');
    }
  };

  const handleOpenEditUser = (u: any) => {
    setUserModal({
      open: true,
      isEdit: true,
      id: u.id,
      username: u.username,
      password: '',
      role: u.role,
    });
  };

  const handleToggleUserActive = async (id: number, username: string, active: boolean) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.toggleUserStatus(id);
      setSuccessMsg(`Usuario ${username} ${active ? 'activado' : 'desactivado'} con éxito.`);
      const dataUsers = await api.getUsers();
      setUsers(dataUsers);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cambiar estado.');
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (!await confirm(`¿Está seguro de eliminar permanentemente al usuario ${username}? Esta acción no se puede deshacer.`, { type: 'danger' })) {
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.deleteUser(username);
      setSuccessMsg(`Usuario ${username} eliminado correctamente.`);
      const dataUsers = await api.getUsers();
      setUsers(dataUsers);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar usuario.');
    }
  };

  return (
    <>
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '12px' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            onClick={() => setUserModal({ open: true, isEdit: false, username: '', password: '', role: 'VENDEDOR' })}
          >
            <UserPlus size={16} /> <span style={{ marginLeft: '6px' }}>Nuevo usuario</span>
          </button>
        </div>

        <div className="table-container">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 12px', fontSize: '0.8rem' }}>Usuario</th>
                <th style={{ padding: '8px 12px', fontSize: '0.8rem' }}>Rol</th>
                <th style={{ padding: '8px 12px', fontSize: '0.8rem' }}>Estado</th>
                <th style={{ padding: '8px 12px', fontSize: '0.8rem' }}>Último acceso</th>
                <th style={{ padding: '8px 12px', fontSize: '0.8rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ROLE_GROUPS.map((group) => {
                const groupUsers = users.filter((u) => u.role === group.roleKey);
                return (
                  <React.Fragment key={group.roleKey}>
                    <tr style={{ backgroundColor: group.bg, borderTop: '2px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                      <td colSpan={5} style={{ padding: '6px 12px', fontWeight: 700, fontSize: '0.82rem', color: group.color }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {group.icon}
                          <span>{group.title}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 600 }}>({groupUsers.length})</span>
                        </div>
                      </td>
                    </tr>

                    {groupUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                          Sin usuarios
                        </td>
                      </tr>
                    ) : (
                      groupUsers.map((u) => {
                        const upperName = String(u.username || '').toUpperCase();
                        const isSystemAccount = upperName === 'OFICINA' || upperName === 'TIENDA_ONLINE';
                        const isSelf = currentUser?.id === u.id;

                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600, fontSize: '0.88rem' }}>
                              {u.username}
                              {upperName === 'OFICINA' && (
                                <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: '#2980B9', background: '#EBF5FB', padding: '1px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <Phone size={10} /> Teléfono / WhatsApp
                                </span>
                              )}
                              {upperName === 'TIENDA_ONLINE' && (
                                <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: '#6D28D9', background: '#F3E8FF', padding: '1px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  Tienda Online
                                </span>
                              )}
                              {isSelf && (
                                <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: '#0F766E', background: '#CCFBF1', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                  Tu sesión
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span className="badge" style={{ backgroundColor: group.bg, color: group.color, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', padding: '2px 8px' }}>
                                {group.icon}
                                {group.title}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.82rem', color: u.isActive !== false ? 'var(--color-success)' : 'var(--color-danger)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: u.isActive !== false ? 'var(--color-success)' : 'var(--color-danger)', display: 'inline-block' }} />
                                {u.isActive !== false ? 'Activo' : 'Desactivado'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                              {isSystemAccount ? '—' : formatLastLogin(u.lastLoginAt)}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                              {isSystemAccount ? (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  Sistema
                                </span>
                              ) : (
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                                    onClick={() => handleOpenEditUser(u)}
                                  >
                                    <Edit3 size={13} /> Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    disabled={isSelf}
                                    style={{
                                      padding: '3px 8px',
                                      fontSize: '0.78rem',
                                      ...(isSelf ? { opacity: 0.45, cursor: 'not-allowed' } : {}),
                                    }}
                                    onClick={() => handleToggleUserActive(u.id, u.username, u.isActive === false)}
                                  >
                                    {u.isActive !== false ? 'Desactivar' : 'Activar'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    disabled={isSelf}
                                    aria-label="Eliminar usuario"
                                    style={{
                                      padding: '3px 6px',
                                      color: 'var(--color-corp-red)',
                                      ...(isSelf ? { opacity: 0.35, cursor: 'not-allowed' } : {}),
                                    }}
                                    onClick={() => handleDeleteUser(u.username)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <UserFormModal
        userModal={userModal}
        setUserModal={setUserModal}
        currentUserId={currentUser?.id}
        onSubmit={handleUserSubmit}
      />
    </>
  );
}
