import { LogOut, Menu, RefreshCw, X } from 'lucide-react';

interface MobileHeaderProps {
  isMobileAppRole: boolean;
  isMobileOpen: boolean;
  onToggleMobileMenu: () => void;
  title: string;
  userLabel: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}

export function MobileHeader({
  isMobileAppRole,
  isMobileOpen,
  onToggleMobileMenu,
  title,
  userLabel,
  isRefreshing,
  onRefresh,
  onLogout,
}: MobileHeaderProps) {
  return (
    <header className="mobile-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {!isMobileAppRole && (
          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={onToggleMobileMenu}
            aria-label="Abrir menú"
            aria-expanded={isMobileOpen}
          >
            {isMobileOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        )}
        <img
          src="/logo.png"
          alt="Don Venancio"
          className="mobile-header-logo"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <span className="mobile-header-title">{title}</span>
      </div>

      <div className="mobile-header-status" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {userLabel}
        </span>

        {isMobileAppRole && (
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Actualizar"
            title="Actualizar"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '6px',
              borderRadius: '6px',
              touchAction: 'manipulation',
            }}
          >
            <RefreshCw size={17} className={isRefreshing ? 'spin-animation' : ''} aria-hidden="true" />
          </button>
        )}

        <button
          type="button"
          onClick={onLogout}
          aria-label="Salir"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '4px',
          }}
        >
          <LogOut size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
