import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { NativeModalDialog } from './NativeModalDialog';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info' | 'success';
  isAlert?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title = 'Confirmar Acción',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  type = 'warning',
  isAlert = false
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getColors = () => {
    switch (type) {
      case 'danger': return { icon: '#E30613', bg: 'rgba(227, 6, 19, 0.1)', btn: '#E30613', btnHover: '#c20510' };
      case 'info': return { icon: '#3b82f6', bg: '#dbeafe', btn: '#3b82f6', btnHover: '#2563eb' };
      case 'success': return { icon: '#10b981', bg: '#d1fae5', btn: '#10b981', btnHover: '#059669' };
      case 'warning':
      default: return { icon: '#f59e0b', bg: '#fef3c7', btn: '#f59e0b', btnHover: '#d97706' };
    }
  };

  const colors = getColors();

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={isAlert ? onConfirm : onCancel}
      ariaLabelledBy="confirm-modal-title"
      style={{
        maxWidth: '400px',
        width: '90%',
        borderRadius: '12px',
        padding: '24px',
        animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          backgroundColor: colors.bg,
          color: colors.icon,
          padding: '12px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <AlertTriangle size={24} aria-hidden="true" />
        </div>
        <div>
          <h3 id="confirm-modal-title" style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            {title}
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            {message}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        {!isAlert && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            className="hover-bg-secondary"
          >
            <X size={16} aria-hidden="true" /> {cancelText}
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          style={{
            padding: '8px 16px',
            backgroundColor: colors.btn,
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: `0 4px 6px -1px ${colors.icon}40`,
          }}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = colors.btnHover; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = colors.btn; }}
        >
          <Check size={16} aria-hidden="true" /> {isAlert ? 'Aceptar' : confirmText}
        </button>
      </div>
    </NativeModalDialog>
  );
}
