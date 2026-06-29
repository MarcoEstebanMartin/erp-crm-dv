import { useState, useEffect } from 'react';
import { api } from './utils/api';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import VendedorDashboard from './components/VendedorDashboard';
import DepositoDashboard from './components/DepositoDashboard';
import FacturacionDashboard from './components/FacturacionDashboard';

function App() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('');

  // Cargar usuario persistido al montar
  useEffect(() => {
    const currentUser = api.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      // Asignar pestaña por defecto según rol
      setDefaultTabForRole(currentUser.role);
    }
  }, []);

  const setDefaultTabForRole = (role: string) => {
    if (role === 'ADMIN') {
      setActiveTab('dashboard');
    } else if (role === 'FACTURACION') {
      setActiveTab('orders');
    } else if (role === 'VENDEDOR') {
      setActiveTab('orders');
    } else if (role === 'DEPOSITO') {
      setActiveTab('deposito');
    }
  };

  const handleLoginSuccess = () => {
    const currentUser = api.getCurrentUser();
    setUser(currentUser);
    if (currentUser) {
      setDefaultTabForRole(currentUser.role);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActiveTab('');
  };

  // Si no está autenticado, renderizar Login
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Renderizado del Dashboard correspondiente
  const renderDashboard = () => {
    switch (user.role) {
      case 'ADMIN':
        return <AdminDashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
      case 'FACTURACION':
        return <FacturacionDashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
      case 'VENDEDOR':
        return <VendedorDashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
      case 'DEPOSITO':
        return <DepositoDashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
      default:
        return (
          <div className="card">
            <h2>Acceso Denegado</h2>
            <p>El rol del usuario es inválido o no posee un panel asignado.</p>
          </div>
        );
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return '¡Buen día';
    if (hour >= 12 && hour < 20) return '¡Buenas tardes';
    return '¡Buenas noches';
  };

  const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  // Obtener título legible de la pestaña activa o saludo dinámico
  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return `${getGreeting()}, ${user ? user.username : 'Usuario'}!`;
      case 'clients':
        return '👥 Clientes & Cuentas Corrientes';
      case 'orders':
        return '🛒 Gestión de Pedidos';
      case 'products':
        return '📦 Catálogo de Artículos & Inventario';
      case 'deposito':
        return '🏪 Control de Depósito y Picking';
      case 'reparto':
        return '🚚 Logística & Hojas de Ruta';
      case 'finanzas':
        return '💰 Cajas & Tesorería';
      case 'billing':
        return '🧾 Facturación, Comprobantes & Impuestos';
      case 'compras':
        return '🧾 Compras & Proveedores';
      case 'reports':
        return '📈 Reportes de Venta & Rentabilidad';
      case 'crm':
        return '🤖 Asistente CRM & Inteligencia Artificial';
      case 'personal':
        return '👨‍💼 Control de Personal';
      case 'config':
        return '⚙️ Configuración del Sistema';
      case 'audit':
        return '📜 Historial de Auditoría';
      default:
        return 'Distribuidora DV';
    }
  };

  const getHeaderSubtitle = () => {
    const dateStr = capitalizeFirstLetter(
      new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    );
    if (activeTab === 'dashboard') {
      return dateStr;
    }
    return `Sesión activa de ${user ? user.username : ''} | ${dateStr.toLowerCase()}`;
  };

  return (
    <div className="layout-app">
      <Sidebar
        username={user.username}
        role={user.role}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />
      
      <main className="main-content">
        {user.role !== 'VENDEDOR' && (
          <header className="header-container no-print">
            <div>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '2px' }}>
                {getHeaderTitle()}
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {getHeaderSubtitle()}
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                fontSize: '0.75rem',
                backgroundColor: '#E5E5EA',
                padding: '6px 12px',
                borderRadius: '20px',
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}>
                {localStorage.getItem('simulation_mode') === 'true' ? '🔌 Modo Simulación Local' : '🌐 Conectado al Servidor'}
              </span>
            </div>
          </header>
        )}

        <section style={{ animation: 'fadeIn 0.4s cubic-bezier(0.25, 1, 0.5, 1)', paddingTop: user.role === 'VENDEDOR' ? '20px' : '0' }}>
          {renderDashboard()}
        </section>
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default App;
