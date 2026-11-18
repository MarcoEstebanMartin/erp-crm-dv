import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  DollarSign,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Navigation,
  Package,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { api } from '../utils/api';

interface SidebarProps {
  username: string;
  role: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  FACTURACION: 'Facturación',
  VENDEDOR: 'Preventa',
  DEPOSITO: 'Depósito',
};

const ADMIN_PARENT_TAB_MAP: Record<string, string> = {
  catalog: 'products',
  stock: 'products',
  compras: 'clients',
  entregas: 'fulfillment',
  orders: 'fulfillment',
  billing: 'fulfillment',
  fleet: 'logistica',
  reparto: 'logistica',
  reportes: 'rendiciones',
  reports: 'rendiciones',
  rrhh: 'config',
};

export default function Sidebar({ username, role, activeTab, setActiveTab, onLogout }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [vendedorCartCount, setVendedorCartCount] = useState(0);

  useEffect(() => {
    if (role !== 'VENDEDOR') return;
    const onCartCount = (ev: Event) => {
      const count = Number((ev as CustomEvent<number>).detail || 0);
      setVendedorCartCount(count);
    };
    window.addEventListener('dv:vendedor-cart-count', onCartCount);
    return () => window.removeEventListener('dv:vendedor-cart-count', onCartCount);
  }, [role]);

  const currentTab = (() => {
    const segments = location.pathname.split('/').filter(Boolean);
    let rawTab = activeTab || (role === 'VENDEDOR' ? 'inicio' : role === 'DEPOSITO' ? 'deposito' : 'dashboard');
    if (segments[0] === 'deposito') {
      rawTab = segments[1] === 'stock' ? 'products' : 'deposito';
    } else if (segments.length >= 2) {
      rawTab = segments[1];
    }
    if (role === 'ADMIN' || role === 'FACTURACION') {
      return ADMIN_PARENT_TAB_MAP[rawTab] || rawTab;
    }
    return rawTab;
  })();

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const getMenuItems = () => {
    if (role === 'ADMIN' || role === 'FACTURACION') {
      return [
        { id: 'dashboard', label: 'Inicio', icon: <LayoutDashboard size={18} aria-hidden="true" /> },
        { id: 'products', label: 'Productos', icon: <Package size={18} aria-hidden="true" /> },
        { id: 'clients', label: 'Personas', icon: <Users size={18} aria-hidden="true" /> },
        { id: 'fulfillment', label: 'Pedidos', icon: <Warehouse size={18} aria-hidden="true" /> },
        { id: 'logistica', label: 'Logística', icon: <Truck size={18} aria-hidden="true" /> },
        { id: 'rendiciones', label: 'Caja', icon: <DollarSign size={18} aria-hidden="true" /> },
        { id: 'config', label: 'Configuración', icon: <Building2 size={18} aria-hidden="true" /> },
      ];
    }

    if (role === 'DEPOSITO') {
      return [
        { id: 'deposito', label: 'Picking', icon: <Warehouse size={18} aria-hidden="true" /> },
        { id: 'products', label: 'Stock', icon: <Package size={18} aria-hidden="true" /> },
        { id: 'field-receipts', label: 'Recibos', icon: <DollarSign size={18} aria-hidden="true" /> },
        { id: 'history', label: 'Historial', icon: <History size={18} aria-hidden="true" /> },
      ];
    }

    return [
      { id: 'inicio', label: 'Inicio', icon: <Home size={18} aria-hidden="true" /> },
      { id: 'clients', label: 'Ruta', icon: <Navigation size={18} aria-hidden="true" /> },
      { id: 'orders', label: 'Vender', icon: <ShoppingCart size={18} aria-hidden="true" /> },
      { id: 'field-receipts', label: 'Cobrar', icon: <Receipt size={18} aria-hidden="true" /> },
    ];
  };

  const handleTabSelect = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileOpen(false);
    let targetPath = `/admin/${tabId}`;
    if (role === 'VENDEDOR') {
      targetPath = `/vendedor/${tabId}`;
    } else if (role === 'DEPOSITO') {
      if (tabId === 'deposito') {
        targetPath = '/deposito/picking';
      } else if (tabId === 'products') {
        targetPath = '/deposito/stock';
      } else {
        targetPath = `/vendedor/${tabId}`;
      }
    }
    navigate(targetPath);
  };

  const menuItems = getMenuItems();

  const handleLogoutClick = () => {
    api.logout();
    onLogout();
  };

  const roleLabel = ROLE_LABELS[role] || 'Operativo';
  const currentItemLabel = menuItems.find((item) => item.id === currentTab)?.label || 'Don Venancio';
  const isVendedor = role === 'VENDEDOR';

  return (
    <>
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!isVendedor && (
            <button
              type="button"
              className="mobile-hamburger-btn"
              onClick={() => setIsMobileOpen(!isMobileOpen)}
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
          <span className="mobile-header-title">{isVendedor ? 'Preventa' : currentItemLabel}</span>
        </div>

        <div className="mobile-header-status" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {username || roleLabel}
          </span>

          {isVendedor && (
            <button
              type="button"
              onClick={() => {
                if (isRefreshing) return;
                setIsRefreshing(true);
                window.dispatchEvent(new CustomEvent('dv:vendedor-sync'));
                setTimeout(() => setIsRefreshing(false), 900);
              }}
              aria-label="Actualizar datos"
              title="Actualizar datos"
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
            onClick={handleLogoutClick}
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

      {isVendedor && (
        <nav aria-label="Menú móvil" className="vendedor-bottom-nav">
          {menuItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                className={`vendedor-bottom-nav-item ${isActive ? 'vendedor-bottom-nav-item-active' : ''}`}
                onClick={() => handleTabSelect(item.id)}
              >
                <div className="bottom-nav-icon-wrapper" style={{ position: 'relative' }}>
                  {item.icon}
                  {item.id === 'orders' && vendedorCartCount > 0 && (
                    <span
                      className="tabular-nums"
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-8px',
                        minWidth: '16px',
                        height: '16px',
                        padding: '0 4px',
                        borderRadius: '999px',
                        backgroundColor: 'var(--color-corp-red)',
                        color: '#ffffff',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        lineHeight: '16px',
                        textAlign: 'center',
                      }}
                    >
                      {vendedorCartCount}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {!isVendedor && isMobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsMobileOpen(false)} />
      )}

      <aside className={`sidebar ${!isVendedor && isMobileOpen ? 'sidebar-mobile-active' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-header">
            <img
              src="/logo.png"
              alt="Don Venancio"
              className="sidebar-logo"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            {!isVendedor && (
              <button
                type="button"
                className="mobile-drawer-close-btn"
                onClick={() => setIsMobileOpen(false)}
                aria-label="Cerrar menú"
              >
                <X size={20} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="sidebar-status" style={{ marginTop: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {roleLabel}
            </span>
          </div>
        </div>

        <nav aria-label="Menú principal" className="sidebar-menu">
          {menuItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
                onClick={() => handleTabSelect(item.id)}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                <span style={{ fontSize: '0.88rem' }}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', fontSize: '0.88rem' }}
            onClick={handleLogoutClick}
          >
            <LogOut size={18} aria-hidden="true" />
            <span>Salir</span>
          </button>
        </div>
      </aside>
    </>
  );
}
