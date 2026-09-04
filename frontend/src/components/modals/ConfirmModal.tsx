import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

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
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
          <div style={{
            backgroundColor: colors.bg,
            color: colors.icon,
            padding: '12px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
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
                gap: '6px'
              }}
              className="hover-bg-secondary"
            >
              <X size={16} /> {cancelText}
            </button>
          )}
          <button
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
              boxShadow: `0 4px 6px -1px ${colors.icon}40`
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.btnHover}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = colors.btn}
          >
            <Check size={16} /> {isAlert ? 'Aceptar' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
