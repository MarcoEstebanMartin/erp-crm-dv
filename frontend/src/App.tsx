import { useState, useEffect, lazy, Suspense } from 'react';
import { api } from './utils/api';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import ReceiptView from './components/ReceiptView';
import QuickPriceSearchModal from './components/modals/QuickPriceSearchModal';

// Carga diferida de los dashboards principales
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const VendedorDashboard = lazy(() => import('./components/VendedorDashboard'));
const DepositoDashboard = lazy(() => import('./components/DepositoDashboard'));

const LoadingSpinner = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '12px' }}>
    <div style={{
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      border: '2px solid rgba(var(--color-corp-red-rgb), 0.1)',
      borderTopColor: 'var(--color-corp-red)',
      animation: 'spin 0.8s linear infinite'
    }} />
    <span style={{ fontSize: '14px', color: '#666', fontWeight: 500 }}>Cargando panel...</span>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);


function App() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    return window.location.hash.replace('#', '');
  });
  const [isQuickSearchModalOpen, setIsQuickSearchModalOpen] = useState(false);

  // Atajo de teclado global Ctrl + Q para consulta de precios
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        setIsQuickSearchModalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cargar usuario persistido al montar
  useEffect(() => {
    const init = async () => {
      let currentUser = api.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        const hash = window.location.hash.replace('#', '');
        if (hash) {
          setActiveTab(hash);
        } else {
          setDefaultTabForRole(currentUser.role);
        }
        
        // Refetch to sync latest config and user data
        currentUser = await api.getMe();
        if (currentUser) {
          setUser(currentUser);
        } else {
          handleLogout();
        }
      }
    };
    init();
  }, []);

  // Sincronizar el estado de React con la URL del navegador
  useEffect(() => {
    if (activeTab) {
      window.location.hash = activeTab;
    }
  }, [activeTab]);

  // Escuchar botones Atrás y Adelante del navegador
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash !== activeTab) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeTab]);

  const setDefaultTabForRole = (role: string) => {
    if (role === 'ADMIN') {
      setActiveTab('dashboard');
    } else if (role === 'FACTURACION') {
      setActiveTab('dashboard');
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
    api.logout();
    setUser(null);
    window.location.hash = '';
  };

  // Interceptar ruta para recibos compartidos
  if (window.location.pathname.startsWith('/recibo/')) {
    const receiptId = window.location.pathname.split('/recibo/')[1];
    return <ReceiptView receiptId={receiptId} />;
  }

  // Si no está autenticado, renderizar Login
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Renderizado del Dashboard correspondiente
  const renderDashboard = () => {
    switch (user.role) {
      case 'ADMIN':
      case 'FACTURACION':
        return <AdminDashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
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


        <section style={{ animation: 'fadeIn 0.4s cubic-bezier(0.25, 1, 0.5, 1)', paddingTop: user.role === 'VENDEDOR' ? '20px' : '0' }}>
          <Suspense fallback={<LoadingSpinner />}>
            {renderDashboard()}
          </Suspense>
        </section>
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <QuickPriceSearchModal
        isOpen={isQuickSearchModalOpen}
        onClose={() => setIsQuickSearchModalOpen(false)}
      />
    </div>
  );
}

export default App;
