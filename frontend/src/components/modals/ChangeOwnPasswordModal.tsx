import React, { useId, useState } from 'react';
import { Key, Eye, EyeOff, X } from 'lucide-react';
import { api } from '../../utils/api';
import { NativeModalDialog } from './NativeModalDialog';

interface ChangeOwnPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ChangeOwnPasswordModal({ open, onClose }: ChangeOwnPasswordModalProps) {
  const titleId = useId();
  const currentPwdId = useId();
  const newPwdId = useId();
  const confirmPwdId = useId();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
    if (trimmedNew.length < 4) {
      setErrorMsg('Mínimo 4 caracteres.');
      return;
    }
    if (trimmedNew !== confirmPassword.trim()) {
      setErrorMsg('Las claves no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.changeOwnPassword(currentPassword, trimmedNew);
      setSuccessMsg(res?.message || 'Clave actualizada.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo actualizar la clave.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NativeModalDialog
      isOpen={open}
      onClose={resetAndClose}
      ariaLabelledBy={titleId}
      style={{ maxWidth: '420px', width: '100%', padding: 0 }}
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
          <h3 id={titleId} style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} color="var(--color-primary)" /> Cambiar clave
          </h3>
          <button type="button" className="btn btn-ghost" aria-label="Cerrar" style={{ padding: '4px' }} onClick={resetAndClose}>
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
            <label htmlFor={currentPwdId} style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Clave actual</label>
            <input
              id={currentPwdId}
              name="currentPassword"
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
            <label htmlFor={newPwdId} style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Nueva clave</label>
            <input
              id={newPwdId}
              name="newPassword"
              type={showPasswords ? 'text' : 'password'}
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={4}
              required
              autoComplete="new-password"
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor={confirmPwdId} style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Confirmar clave</label>
            <input
              id={confirmPwdId}
              name="confirmPassword"
              type={showPasswords ? 'text' : 'password'}
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={4}
              required
              autoComplete="new-password"
              style={{ width: '100%' }}
            />
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            aria-pressed={showPasswords}
            onClick={() => setShowPasswords((v) => !v)}
            style={{ alignSelf: 'flex-start', padding: '4px 6px', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
            {showPasswords ? 'Ocultar' : 'Mostrar'}
          </button>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="btn btn-secondary" onClick={resetAndClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </NativeModalDialog>
  );
}
