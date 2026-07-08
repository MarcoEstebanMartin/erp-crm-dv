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
  History
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
  
  // Definir elementos del menú basados en el rol
  const getMenuItems = () => {
    switch (role) {
      case 'ADMIN':
        return [
          { id: 'dashboard', label: 'Panel Principal', icon: <LayoutDashboard size={18} /> },
          { id: 'clients', label: 'Personas', icon: <Users size={18} /> },
          { id: 'billing', label: 'Facturación', icon: <FileText size={18} /> },
          { id: 'orders', label: 'Pedidos', icon: <ShoppingCart size={18} /> },
          { id: 'products', label: 'Productos', icon: <Package size={18} /> },
          { id: 'deposito', label: 'Depósito', icon: <Warehouse size={18} /> },
          { id: 'reparto', label: 'Reparto', icon: <Truck size={18} /> },
          { id: 'finanzas', label: 'Finanzas', icon: <DollarSign size={18} /> },
          { id: 'rendiciones', label: 'Rendiciones / Arqueo', icon: <DollarSign size={18} /> },
          { id: 'compras', label: 'Compras', icon: <Receipt size={18} /> },
          { id: 'reportes', label: 'Reportes y Analíticas', icon: <TrendingUp size={18} /> },
          { id: 'config', label: 'Configuración', icon: <Settings size={18} /> },
        ];
      case 'FACTURACION':
        return [
          { id: 'dashboard', label: 'Panel Principal', icon: <LayoutDashboard size={18} /> },
          { id: 'clients', label: 'Personas', icon: <Users size={18} /> },
          { id: 'billing', label: 'Facturación', icon: <FileText size={18} /> },
          { id: 'orders', label: 'Pedidos', icon: <ShoppingCart size={18} /> },
          { id: 'products', label: 'Productos', icon: <Package size={18} /> },
          { id: 'deposito', label: 'Depósito', icon: <Warehouse size={18} /> },
          { id: 'reparto', label: 'Reparto', icon: <Truck size={18} /> },
          { id: 'finanzas', label: 'Finanzas', icon: <DollarSign size={18} /> },
          { id: 'rendiciones', label: 'Rendiciones / Arqueo', icon: <DollarSign size={18} /> },
          { id: 'compras', label: 'Compras', icon: <Receipt size={18} /> },
        ];
      case 'VENDEDOR':
        return [
          { id: 'orders', label: 'Toma de Pedidos', icon: <ShoppingCart size={18} /> },
          { id: 'clients', label: 'Mis Personas', icon: <Users size={18} /> },
          { id: 'cobranzas', label: 'Cobranzas y Recibos', icon: <DollarSign size={18} /> },
          { id: 'products', label: 'Catálogo', icon: <Package size={18} /> },
          { id: 'history', label: 'Historial de Pedidos', icon: <History size={18} /> },
        ];
      case 'DEPOSITO':
        return [
          { id: 'deposito', label: 'Preparación (Picking)', icon: <Warehouse size={18} /> },
          { id: 'products', label: 'Control de Stock', icon: <Package size={18} /> },
        ];
      default:
        return [];
    }
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
        {menuItems.map((item) => (
          <div
            key={item.id}
            className={`sidebar-link ${activeTab === item.id ? 'sidebar-link-active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', marginBottom: '4px' }}
          >
            {item.icon}
            <span style={{ fontSize: '0.88rem', fontWeight: activeTab === item.id ? 600 : 400 }}>{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-user" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: 'auto' }}>
        <div className="user-info" style={{ marginBottom: '12px' }}>
          <div className="user-name" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{username}</div>
          <div className="user-role" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{role}</div>
        </div>
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

