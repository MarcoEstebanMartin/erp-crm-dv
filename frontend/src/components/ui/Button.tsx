import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  style,
  ...props
}, ref) => {
  // Configuración de tamaños
  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '5px 10px', fontSize: '0.78rem', borderRadius: '4px', gap: '5px' },
    md: { padding: '8px 16px', fontSize: '0.85rem', borderRadius: '6px', gap: '6px' },
    lg: { padding: '11px 22px', fontSize: '0.95rem', borderRadius: '8px', gap: '8px' },
  };

  // Configuración de variantes visuales (Minimalismo Stripe / Linear)
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--accent-color)',
      color: '#FFFFFF',
      border: '1px solid var(--accent-color)',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
    },
    secondary: {
      backgroundColor: 'var(--bg-card)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-color)',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-color)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--text-secondary)',
      border: '1px solid transparent',
      boxShadow: 'none',
    },
    danger: {
      backgroundColor: 'var(--color-corp-red)',
      color: '#FFFFFF',
      border: '1px solid var(--color-corp-red)',
      boxShadow: '0 1px 2px rgba(227, 6, 19, 0.2)',
    },
  };

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 500,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.6 : 1,
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    outline: 'none',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...style,
  };

  return (
    <button
      ref={ref}
      style={baseStyle}
      disabled={disabled || isLoading}
      className={`ui-button ui-button-${variant} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span
          style={{
            width: size === 'sm' ? '12px' : size === 'lg' ? '18px' : '14px',
            height: size === 'sm' ? '12px' : size === 'lg' ? '18px' : '14px',
            border: '2px solid currentColor',
            borderRightColor: 'transparent',
            borderRadius: '50%',
            animation: 'ui-spin 0.6s linear infinite',
            display: 'inline-block',
          }}
        />
      ) : leftIcon ? (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>{leftIcon}</span>
      ) : null}
      
      {children}

      {!isLoading && rightIcon ? (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>{rightIcon}</span>
      ) : null}

      <style>{`
        @keyframes ui-spin {
          to { transform: rotate(360deg); }
        }
        .ui-button-primary:hover:not(:disabled) {
          background-color: var(--accent-hover) !important;
          border-color: var(--accent-hover) !important;
        }
        .ui-button-secondary:hover:not(:disabled) {
          background-color: var(--bg-secondary) !important;
          border-color: #cbd5e1 !important;
        }
        .ui-button-outline:hover:not(:disabled) {
          background-color: var(--bg-secondary) !important;
        }
        .ui-button-ghost:hover:not(:disabled) {
          background-color: var(--bg-secondary) !important;
          color: var(--text-primary) !important;
        }
        .ui-button-danger:hover:not(:disabled) {
          background-color: #c00410 !important;
          border-color: #c00410 !important;
        }
        .ui-button:active:not(:disabled) {
          transform: translateY(1px);
        }
      `}</style>
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
