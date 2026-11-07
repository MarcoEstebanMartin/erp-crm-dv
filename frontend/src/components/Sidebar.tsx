import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LogOut, 
  LayoutDashboard, 
  Users, 
  ShoppingCart, 
  Package, 
  Warehouse, 
  Truck, 
  DollarSign, 
  Receipt, 
  TrendingUp, 
  Settings, 
  FileText,
  History,
  MapPin,
  ChevronDown,
  ChevronRight,
  Tag,
  Briefcase,
  MessageSquare,
  Building2,
  Menu,
  X
} from 'lucide-react';
import { api } from '../utils/api';

interface SidebarProps {
  username: string;
  role: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export default function Sidebar({ username, role, activeTab, setActiveTab, onLogout }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Mapear ruta actual a pestaña activa
  const currentTab = (() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return segments[1];
    }
    return activeTab || (role === 'VENDEDOR' ? 'orders' : role === 'DEPOSITO' ? 'deposito' : 'dashboard');
  })();

  // Cerrar menú móvil en cambios de ruta
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const userObj = api.getCurrentUser();
  const permissions = userObj?.permissions || {
    canSell: role === 'VENDEDOR' || role === 'ADMIN',
    canPick: role === 'DEPOSITO' || role === 'ADMIN',
    canDeliver: true,
    canCollect: true,
    canManageStock: role === 'DEPOSITO' || role === 'ADMIN'
  };

  // Definir elementos del menú basados en el rol (Core Minimalista)
  const getMenuItems = () => {
    if (role === 'ADMIN' || role === 'FACTURACION') {
      return [
        { id: 'dashboard', label: 'Panel Principal', icon: <LayoutDashboard size={18} /> },
        { id: 'products', label: 'Productos y Stock', icon: <Package size={18} /> },
        { id: 'clients', label: 'Clientes y Cuentas', icon: <Users size={18} /> },
        { id: 'fulfillment', label: 'Pedidos y Facturación', icon: <Warehouse size={18} /> },
        { id: 'rendiciones', label: 'Caja y Cobranzas', icon: <DollarSign size={18} /> },
        { id: 'config', label: 'Configuración', icon: <Building2 size={18} /> },
      ];
    }

    // Para personal operativo (VENDEDOR, DEPOSITO)
    const items: any[] = [];
    
    if (permissions.canSell) {
      items.push({ id: 'orders', label: 'Toma de Pedidos', icon: <ShoppingCart size={18} /> });
      items.push({ id: 'clients', label: 'Clientes y Deudas', icon: <Users size={18} /> });
    }
    if (permissions.canPick) {
      items.push({ id: 'deposito', label: 'Preparación (Picking)', icon: <Warehouse size={18} /> });
    }
    if (permissions.canCollect) {
      items.push({ id: 'cobranzas', label: 'Cobranzas y Recibos', icon: <DollarSign size={18} /> });
    }
    if (permissions.canManageStock || permissions.canSell) {
      items.push({ id: 'products', label: 'Catálogo y Precios', icon: <Package size={18} /> });
    }
    items.push({ id: 'history', label: 'Historial de Pedidos', icon: <History size={18} /> });

    return items;
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

  const currentItemLabel = menuItems.find(item => item.id === currentTab)?.label || 'Don Venancio ERP';
  const isVendedor = role === 'VENDEDOR';

  return (
    <>
      {/* Header Fijo Móvil (Solo visible en pantallas <= 768px) */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!isVendedor && (
            <button 
              className="mobile-hamburger-btn" 
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              aria-label="Abrir menú"
            >
              {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          )}
          <img 
            src="/logo.png" 
            alt="Logo DV" 
            className="mobile-header-logo"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <span className="mobile-header-title">
            {isVendedor ? 'Preventa DV' : currentItemLabel}
          </span>
        </div>

        <div className="mobile-header-status" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-success)',
              animation: 'pulse 2s infinite'
            }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {username || role}
            </span>
          </div>

          {/* Botón directo de salida para vendedores sin entrar a menús */}
          <button
            onClick={handleLogoutClick}
            title="Cerrar sesión"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px'
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Dock Inferior Fijo de Navegación Directa para Vendedores (Móvil) */}
      {isVendedor && (
        <nav className="vendedor-bottom-nav">
          {menuItems.map((item: any) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`vendedor-bottom-nav-item ${isActive ? 'vendedor-bottom-nav-item-active' : ''}`}
                onClick={() => handleTabSelect(item.id)}
              >
                <div className="bottom-nav-icon-wrapper">
                  {item.icon}
                </div>
                <span>{item.label.replace('Toma de ', '').replace('Mis Rutas ', '').replace(' y Recibos', '').replace(' de Precios', '').replace(' de Pedidos', '')}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Backdrop traslúcido para móviles cuando el menú está abierto */}
      {!isVendedor && isMobileOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsMobileOpen(false)} 
        />
      )}

      {/* Contenedor del Sidebar (Drawer en Móvil / Fijo en Escritorio) */}
      <aside className={`sidebar ${!isVendedor && isMobileOpen ? 'sidebar-mobile-active' : ''}`}>
        {/* Cabecera del Sidebar con el Logo y Rol Debajo */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-header">
            <img 
              src="/logo.png" 
              alt="Logo DV" 
              className="sidebar-logo"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            {/* Botón para cerrar drawer en móvil */}
            {!isVendedor && (
              <button 
                className="mobile-drawer-close-btn"
                onClick={() => setIsMobileOpen(false)}
              >
                <X size={20} />
              </button>
            )}
          </div>
          {(() => {
            let dotColor = 'var(--color-success)'; // Verde
            let tooltip = 'Servidor en Línea';

            return (
              <div className="sidebar-status" title={tooltip} style={{ marginTop: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: dotColor,
                  animation: 'pulse 2s infinite'
                }} />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {role === 'ADMIN' ? 'Administrador' : role === 'FACTURACION' ? 'Administrativo' : role === 'VENDEDOR' ? 'Preventista / Vendedor' : 'Operativo'}
                </span>
              </div>
            );
          })()}
        </div>

        <nav className="sidebar-menu">
          {menuItems.map((item: any) => {
            const isActive = currentTab === item.id;

            return (
              <div
                key={item.id}
                className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
                onClick={() => handleTabSelect(item.id)}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  {item.icon}
                </span>
                <span style={{ fontSize: '0.88rem' }}>{item.label}</span>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', fontSize: '0.88rem' }}
            onClick={handleLogoutClick}
          >
            <LogOut size={18} />
            <span>Cerrar sesión</span>
          </button>
        </div>

        <style>{`
          @keyframes pulse {
            0% { transform: scale(0.95); opacity: 0.7; }
            50% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.7; }
          }
        `}</style>
      </aside>
    </>
  );
}


