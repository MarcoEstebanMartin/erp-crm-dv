import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'official' | 'internal' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  showDot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  showDot = false,
  className = '',
  style,
  ...props
}) => {
  const variantStyles: Record<string, { bg: string; color: string; border: string; dot: string }> = {
    official: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0', dot: '#10B981' },
    internal: { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB', dot: '#6B7280' },
    success:  { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0', dot: '#10B981' },
    warning:  { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A', dot: '#F59E0B' },
    danger:   { bg: '#FEF2F2', color: '#B91C1C', border: '#FCA5A5', dot: '#EF4444' },
    info:     { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', dot: '#3B82F6' },
    neutral:  { bg: '#F9FAFB', color: '#4B5563', border: '#E5E7EB', dot: '#9CA3AF' },
  };

  const config = variantStyles[variant] || variantStyles.neutral;

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 9px',
    borderRadius: '12px',
    fontSize: '0.74rem',
    fontWeight: 600,
    backgroundColor: config.bg,
    color: config.color,
    border: `1px solid ${config.border}`,
    letterSpacing: '0.01em',
    lineHeight: 1.2,
    userSelect: 'none',
    ...style,
  };

  return (
    <span style={baseStyle} className={`ui-badge ui-badge-${variant} ${className}`} {...props}>
      {showDot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: config.dot,
            display: 'inline-block',
          }}
        />
      )}
      {children}
    </span>
  );
};

export default Badge;
