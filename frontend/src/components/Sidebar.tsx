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
  MapPin
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
  
  // Definir secciones del menú basadas en el rol
  const getMenuSections = () => {
    switch (role) {
      case 'ADMIN':
        return [
          {
            title: null,
            items: [
              { id: 'dashboard', label: 'Panel Principal', icon: <LayoutDashboard size={18} /> },
            ]
          },
          {
            title: 'Comercial y Ventas',
            items: [
              { id: 'orders', label: 'Gestión de Pedidos', icon: <ShoppingCart size={18} /> },
              { id: 'clients', label: 'Clientes y Rutas', icon: <Users size={18} /> },
              { id: 'compras', label: 'Proveedores', icon: <Receipt size={18} /> },
            ]
          },
          {
            title: 'Operaciones y Depósito',
            items: [
              { id: 'deposito', label: 'Preparación (Picking)', icon: <Warehouse size={18} /> },
              { id: 'products', label: 'Inventario y Catálogo', icon: <Package size={18} /> },
              { id: 'logistica', label: 'Logística y Flota', icon: <Truck size={18} /> },
            ]
          },
          {
            title: 'Administración',
            items: [
              { id: 'billing', label: 'Facturación', icon: <FileText size={18} /> },
              { id: 'rendiciones', label: 'Finanzas y Caja', icon: <DollarSign size={18} /> },
              { id: 'reportes', label: 'Reportes y Analíticas', icon: <TrendingUp size={18} /> },
              { id: 'config', label: 'Configuración', icon: <Settings size={18} /> },
            ]
          }
        ];
      case 'FACTURACION':
        return [
          {
            title: null,
            items: [
              { id: 'dashboard', label: 'Panel Principal', icon: <LayoutDashboard size={18} /> },
            ]
          },
          {
            title: 'Comercial y Ventas',
            items: [
              { id: 'orders', label: 'Gestión de Pedidos', icon: <ShoppingCart size={18} /> },
              { id: 'clients', label: 'Clientes y Rutas', icon: <Users size={18} /> },
              { id: 'compras', label: 'Proveedores', icon: <Receipt size={18} /> },
            ]
          },
          {
            title: 'Operaciones y Depósito',
            items: [
              { id: 'deposito', label: 'Preparación (Picking)', icon: <Warehouse size={18} /> },
              { id: 'products', label: 'Inventario y Catálogo', icon: <Package size={18} /> },
              { id: 'logistica', label: 'Logística y Flota', icon: <Truck size={18} /> },
            ]
          },
          {
            title: 'Administración',
            items: [
              { id: 'billing', label: 'Facturación', icon: <FileText size={18} /> },
              { id: 'rendiciones', label: 'Finanzas y Caja', icon: <DollarSign size={18} /> },
            ]
          }
        ];
      case 'VENDEDOR':
        return [
          {
            title: 'Mi Operación',
            items: [
              { id: 'orders', label: 'Toma de Pedidos', icon: <ShoppingCart size={18} /> },
              { id: 'clients', label: 'Mis Rutas', icon: <Users size={18} /> },
              { id: 'cobranzas', label: 'Cobranzas y Recibos', icon: <DollarSign size={18} /> },
              { id: 'products', label: 'Catálogo de Precios', icon: <Package size={18} /> },
              { id: 'history', label: 'Historial de Pedidos', icon: <History size={18} /> },
            ]
          }
        ];
      case 'DEPOSITO':
        return [
          {
            title: 'Mi Operación',
            items: [
              { id: 'deposito', label: 'Preparación (Picking)', icon: <Warehouse size={18} /> },
              { id: 'products', label: 'Inventario y Stock', icon: <Package size={18} /> },
            ]
          }
        ];
      default:
        return [];
    }
  };

  const menuSections = getMenuSections();

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
        {menuSections.map((section, sIdx) => (
          <div key={sIdx} style={{ marginBottom: '14px' }}>
            {section.title && (
              <div style={{ 
                fontSize: '0.72rem', 
                fontWeight: 700, 
                color: 'var(--text-secondary)', 
                letterSpacing: '0.05em', 
                padding: '4px 14px', 
                textTransform: 'uppercase',
                marginBottom: '6px'
              }}>
                {section.title}
              </div>
            )}
            {section.items.map((item) => (
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

