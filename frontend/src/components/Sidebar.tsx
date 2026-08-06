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
  Building2
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

  // Mapear ruta actual a pestaña activa
  const currentTab = (() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return segments[1];
    }
    return activeTab || (role === 'VENDEDOR' ? 'orders' : role === 'DEPOSITO' ? 'deposito' : 'dashboard');
  })();

  const userObj = api.getCurrentUser();
  const permissions = userObj?.permissions || {
    canSell: role === 'VENDEDOR' || role === 'ADMIN',
    canPick: role === 'DEPOSITO' || role === 'ADMIN',
    canDeliver: true,
    canCollect: true,
    canManageStock: role === 'DEPOSITO' || role === 'ADMIN'
  };

  // Definir elementos del menú basados en el rol y matriz de permisos
  const getMenuItems = () => {
    if (role === 'ADMIN') {
      return [
        { id: 'dashboard', label: 'Panel Principal', icon: <LayoutDashboard size={18} /> },
        { id: 'crm', label: 'CRM & WhatsApp', icon: <MessageSquare size={18} /> },
        { id: 'fulfillment', label: 'Armado y Facturación', icon: <Warehouse size={18} /> },
        { id: 'clients', label: 'Personas', icon: <Users size={18} /> },
        { id: 'logistica', label: 'Logística y Flota', icon: <Truck size={18} /> },
        { id: 'products', label: 'Productos y Stock', icon: <Package size={18} /> },
        { id: 'compras', label: 'Proveedores', icon: <Receipt size={18} /> },
        { id: 'rendiciones', label: 'Finanzas y Reportes', icon: <DollarSign size={18} /> },
        { id: 'config', label: 'General & Empresa', icon: <Building2 size={18} /> },
      ];
    }

    if (role === 'FACTURACION') {
      return [
        { id: 'dashboard', label: 'Panel Principal', icon: <LayoutDashboard size={18} /> },
        { id: 'crm', label: 'CRM & WhatsApp', icon: <MessageSquare size={18} /> },
        { id: 'fulfillment', label: 'Armado y Facturación', icon: <Warehouse size={18} /> },
        { id: 'clients', label: 'Personas', icon: <Users size={18} /> },
        { id: 'logistica', label: 'Logística y Flota', icon: <Truck size={18} /> },
        { id: 'products', label: 'Productos y Stock', icon: <Package size={18} /> },
        { id: 'compras', label: 'Proveedores', icon: <Receipt size={18} /> },
        { id: 'config', label: 'General & Empresa', icon: <Building2 size={18} /> },
      ];
    }

    // Para personal operativo (VENDEDOR, DEPOSITO, etc.) construimos según permisos granulares
    const items: any[] = [];
    
    if (permissions.canSell) {
      items.push({ id: 'orders', label: 'Toma de Pedidos', icon: <ShoppingCart size={18} /> });
      items.push({ id: 'clients', label: 'Mis Rutas Preventa', icon: <Users size={18} /> });
    }
    if (permissions.canPick) {
      items.push({ id: 'deposito', label: 'Preparación (Picking)', icon: <Warehouse size={18} /> });
    }
    if (permissions.canDeliver) {
      items.push({ id: 'logistica', label: 'Logística y Reparto', icon: <Truck size={18} /> });
    }
    if (permissions.canCollect) {
      items.push({ id: 'cobranzas', label: 'Cobranzas y Recibos', icon: <DollarSign size={18} /> });
    }
    if (permissions.canManageStock || permissions.canSell) {
      items.push({ id: 'products', label: 'Catálogo de Precios', icon: <Package size={18} /> });
    }
    items.push({ id: 'history', label: 'Historial de Pedidos', icon: <History size={18} /> });

    return items;
  };

  const handleTabSelect = (tabId: string) => {
    setActiveTab(tabId);
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

  return (
    <aside className="sidebar">
      {/* Cabecera del Sidebar con el Logo y Rol Debajo */}
      <div className="sidebar-brand">
        <img 
          src="/logo.png" 
          alt="Logo DV" 
          className="sidebar-logo"
          onError={(e) => {
            // Si el logo no carga, ocultarlo
            e.currentTarget.style.display = 'none';
          }}
        />
        {(() => {
          let dotColor = 'var(--color-success)'; // Verde
          let tooltip = 'Servidor en Línea';

          return (
            <div className="sidebar-status" title={tooltip} style={{ marginTop: '12px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: dotColor,
                animation: 'pulse 2s infinite'
              }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {role === 'ADMIN' ? 'Administrador' : role === 'FACTURACION' ? 'Administrativo' : 'Operativo'}
              </span>
            </div>
          );
        })()}
      </div>

      <nav className="sidebar-menu" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        {menuItems.map((item: any) => {
          const isActive = currentTab === item.id;

          return (
            <div
              key={item.id}
              className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
              onClick={() => handleTabSelect(item.id)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                padding: '9px 14px', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                marginBottom: '3px',
                fontWeight: isActive ? 600 : 400
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {item.icon}
              </span>
              <span style={{ fontSize: '0.86rem' }}>{item.label}</span>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-user" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: 'auto' }}>
        <button
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.85rem' }}
          onClick={handleLogoutClick}
        >
          <LogOut size={16} />
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
  );
}

