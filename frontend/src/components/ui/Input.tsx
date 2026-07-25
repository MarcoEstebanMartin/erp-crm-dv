import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  shortcutHint?: string;
  containerStyle?: React.CSSProperties;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  shortcutHint,
  className = '',
  containerStyle,
  style,
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', ...containerStyle }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '0.8rem',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{label}</span>
          {shortcutHint && (
            <kbd
              style={{
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '3px',
                padding: '1px 5px',
                color: 'var(--text-muted)',
              }}
            >
              {shortcutHint}
            </kbd>
          )}
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        {leftIcon && (
          <div
            style={{
              position: 'absolute',
              left: '10px',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          >
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          className={`ui-input ${error ? 'ui-input-error' : ''} ${className}`}
          style={{
            width: '100%',
            padding: '8px 12px',
            paddingLeft: leftIcon ? '34px' : '12px',
            paddingRight: rightIcon ? '34px' : '12px',
            borderRadius: 'var(--radius-sm)',
            border: error ? '1px solid var(--color-danger)' : '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontSize: '0.88rem',
            outline: 'none',
            transition: 'all 0.15s ease-in-out',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.02)',
            ...style,
          }}
          {...props}
        />

        {rightIcon && (
          <div
            style={{
              position: 'absolute',
              right: '10px',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-muted)',
            }}
          >
            {rightIcon}
          </div>
        )}
      </div>

      {error ? (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 500 }}>
          {error}
        </span>
      ) : helperText ? (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {helperText}
        </span>
      ) : null}

      <style>{`
        .ui-input:focus {
          border-color: #9CA3AF !important;
          box-shadow: 0 0 0 2px rgba(156, 163, 175, 0.2) !important;
        }
        .ui-input-error:focus {
          border-color: var(--color-danger) !important;
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
        }
      `}</style>
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
