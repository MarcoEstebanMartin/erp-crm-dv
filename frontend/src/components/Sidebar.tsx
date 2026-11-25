import { startTransition, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen, Building2, ClipboardList, DollarSign, Home, LayoutDashboard, LogOut, Map,
  Navigation, Package, Receipt, ShoppingCart, Truck, Users, Warehouse, X,
} from 'lucide-react';
import { api } from '../utils/api';
import { prefetchTabChunk } from '../utils/tabPrefetcher';
import { VendedorBottomNav } from './sidebar/VendedorBottomNav';
import { MobileHeader } from './sidebar/MobileHeader';

interface SidebarProps {
  username: string;
  role: string;
  canDeliver?: boolean;
  canPick?: boolean;
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

export default function Sidebar({
  username, role, canDeliver = false, canPick = false, activeTab, setActiveTab, onLogout,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [vendedorCartCount, setVendedorCartCount] = useState(0);

  useEffect(() => {
    if (role !== 'VENDEDOR') return;
    const onCartCount = (ev: Event) => setVendedorCartCount(Number((ev as CustomEvent<number>).detail || 0));
    window.addEventListener('dv:vendedor-cart-count', onCartCount);
    return () => window.removeEventListener('dv:vendedor-cart-count', onCartCount);
  }, [role]);

  const currentTab = (() => {
    const segments = location.pathname.split('/').filter(Boolean);
    let rawTab = activeTab || (role === 'VENDEDOR' ? 'inicio' : role === 'DEPOSITO' ? 'pedidos' : 'dashboard');
    if (segments[0] === 'deposito') {
      const seg = (segments[1] || '').toLowerCase();
      if (seg === 'stock' || seg === 'products') rawTab = 'stock';
      else if (seg === 'mapa' || seg === 'wms-map') rawTab = 'mapa';
      else if (seg === 'reparto' || seg === 'logistica') rawTab = canDeliver ? 'reparto' : 'pedidos';
      else if (seg === 'cobrar' || seg === 'field-receipts') rawTab = canDeliver ? 'cobrar' : 'pedidos';
      else rawTab = 'pedidos';
    } else if (segments.length >= 2) {
      rawTab = segments[1];
    }
    return role === 'ADMIN' || role === 'FACTURACION' ? ADMIN_PARENT_TAB_MAP[rawTab] || rawTab : rawTab;
  })();

  useEffect(() => { setIsMobileOpen(false); }, [location.pathname]);

  const getMenuItems = () => {
    if (role === 'ADMIN' || role === 'FACTURACION') {
      const adminItems = [
        { id: 'dashboard', label: 'Inicio', icon: <LayoutDashboard size={18} aria-hidden="true" /> },
        { id: 'products', label: 'Productos', icon: <Package size={18} aria-hidden="true" /> },
      ];
      if (role === 'ADMIN') {
        adminItems.push({ id: 'catalogo', label: 'Catálogo', icon: <BookOpen size={18} aria-hidden="true" /> });
      }
      adminItems.push(
        { id: 'clients', label: 'Personas', icon: <Users size={18} aria-hidden="true" /> },
        { id: 'fulfillment', label: 'Pedidos', icon: <Warehouse size={18} aria-hidden="true" /> },
        { id: 'logistica', label: 'Logística', icon: <Truck size={18} aria-hidden="true" /> },
        { id: 'rendiciones', label: 'Caja', icon: <DollarSign size={18} aria-hidden="true" /> },
        { id: 'config', label: 'Configuración', icon: <Building2 size={18} aria-hidden="true" /> },
      );
      return adminItems;
    }
    if (role === 'DEPOSITO') {
      const depositoItems = [
        { id: 'pedidos', label: 'Pedidos', icon: <ClipboardList size={18} aria-hidden="true" /> },
        { id: 'stock', label: 'Stock', icon: <Package size={18} aria-hidden="true" /> },
        { id: 'mapa', label: 'Mapa', icon: <Map size={18} aria-hidden="true" /> },
      ];
      if (canDeliver) {
        depositoItems.push(
          { id: 'reparto', label: 'Reparto', icon: <Truck size={18} aria-hidden="true" /> },
          { id: 'cobrar', label: 'Cobrar', icon: <Receipt size={18} aria-hidden="true" /> },
        );
      }
      return depositoItems;
    }
    const vendedorItems = [
      { id: 'inicio', label: 'Inicio', icon: <Home size={18} aria-hidden="true" /> },
      { id: 'clients', label: 'Ruta', icon: <Navigation size={18} aria-hidden="true" /> },
      { id: 'orders', label: 'Vender', icon: <ShoppingCart size={18} aria-hidden="true" /> },
      { id: 'field-receipts', label: 'Cobrar', icon: <Receipt size={18} aria-hidden="true" /> },
    ];
    if (canDeliver) vendedorItems.push({ id: 'logistica', label: 'Reparto', icon: <Truck size={18} aria-hidden="true" /> });
    if (canPick) vendedorItems.push({ id: 'deposito', label: 'Depósito', icon: <Warehouse size={18} aria-hidden="true" /> });
    return vendedorItems;
  };

  const handleTabSelect = (tabId: string) => {
    if ((role === 'VENDEDOR' || role === 'DEPOSITO') && tabId === currentTab) {
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
      return;
    }
    setIsMobileOpen(false);
    const targetPath = role === 'VENDEDOR' ? `/vendedor/${tabId}` : role === 'DEPOSITO' ? `/deposito/${tabId}` : `/admin/${tabId}`;
    startTransition(() => {
      setActiveTab(tabId);
      navigate(targetPath);
    });
  };

  const menuItems = getMenuItems();
  const handleLogoutClick = () => { api.logout(); onLogout(); };
  const currentItemLabel = menuItems.find((item) => item.id === currentTab)?.label || 'Don Venancio';
  const isMobileAppRole = role === 'VENDEDOR' || role === 'DEPOSITO';

  return (
    <>
      <MobileHeader
        isMobileAppRole={isMobileAppRole}
        isMobileOpen={isMobileOpen}
        onToggleMobileMenu={() => setIsMobileOpen(!isMobileOpen)}
        title={role === 'VENDEDOR' ? 'Preventa' : currentItemLabel}
        userLabel={username || ROLE_LABELS[role] || 'Operativo'}
        isRefreshing={isRefreshing}
        onRefresh={() => { if (isRefreshing) return; setIsRefreshing(true); window.location.reload(); }}
        onLogout={handleLogoutClick}
      />

      {isMobileAppRole && (
        <VendedorBottomNav
          menuItems={menuItems}
          currentTab={currentTab}
          vendedorCartCount={role === 'VENDEDOR' ? vendedorCartCount : 0}
          onSelect={handleTabSelect}
        />
      )}

      {!isMobileAppRole && isMobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsMobileOpen(false)} />
      )}

      <aside className={`sidebar ${!isMobileAppRole && isMobileOpen ? 'sidebar-mobile-active' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-header">
            <img src="/logo.png" alt="Don Venancio" className="sidebar-logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            {!isMobileAppRole && (
              <button type="button" className="mobile-drawer-close-btn" onClick={() => setIsMobileOpen(false)} aria-label="Cerrar menú">
                <X size={20} aria-hidden="true" />
              </button>
            )}
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
                onMouseEnter={() => prefetchTabChunk(role, item.id)}
                onFocus={() => prefetchTabChunk(role, item.id)}
                onClick={() => handleTabSelect(item.id)}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                <span style={{ fontSize: '0.88rem' }}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {username && (
          <div style={{ padding: '0 12px 10px', fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={username}>
            {username}
          </div>
        )}

        <div className="sidebar-user">
          <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', fontSize: '0.88rem' }} onClick={handleLogoutClick}>
            <LogOut size={18} aria-hidden="true" />
            <span>Salir</span>
          </button>
        </div>
      </aside>
    </>
  );
}
