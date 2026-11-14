import React, { useState } from 'react';
import { Key, Eye, EyeOff, X } from 'lucide-react';
import { api } from '../../utils/api';

interface ChangeOwnPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ChangeOwnPasswordModal({ open, onClose }: ChangeOwnPasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!open) return null;

  const resetAndClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedNew = newPassword.trim();
    if (trimmedNew.length < 6) {
      setErrorMsg('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (trimmedNew !== confirmPassword.trim()) {
      setErrorMsg('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.changeOwnPassword(currentPassword, trimmedNew);
      setSuccessMsg(res?.message || 'Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo actualizar la contraseña.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay animate-fade-in"
      style={{ zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: '420px',
          width: '100%',
          padding: '24px',
          borderRadius: '12px',
          background: '#fff',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.12)',
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
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} color="var(--color-primary)" /> Cambiar mi contraseña
          </h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={resetAndClose}>
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div style={{ backgroundColor: 'var(--accent-bg-light)', color: 'var(--accent-color)', padding: '10px 12px', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '12px' }}>
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', padding: '10px 12px', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '12px' }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group">
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Contraseña actual</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Nueva contraseña (mínimo 6 caracteres)</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Confirmar nueva contraseña</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
              style={{ width: '100%' }}
            />
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowPasswords((v) => !v)}
            style={{ alignSelf: 'flex-start', padding: '4px 6px', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
            {showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
          </button>

          <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            Tu sesión actual seguirá activa y se cerrarán automáticamente las sesiones abiertas en otros dispositivos.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="btn btn-secondary" onClick={resetAndClose}>
              Cerrar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Actualizar clave'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
