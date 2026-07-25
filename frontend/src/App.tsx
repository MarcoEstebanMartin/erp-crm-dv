import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from './utils/api';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import ReceiptView from './components/ReceiptView';
import QuickPriceSearchModal from './components/modals/QuickPriceSearchModal';
import AdminPages from './pages/admin/AdminPages';
import VendedorPages from './pages/vendedor/VendedorPages';
import DepositoPages from './pages/deposito/DepositoPages';

const ClientPortal = lazy(() => import('./components/store/ClientPortal'));

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
  const [activeTab, setActiveTab] = useState<string>('');
  const [isQuickSearchModalOpen, setIsQuickSearchModalOpen] = useState(false);
  const [isStoreMode, setIsStoreMode] = useState<boolean>(window.location.pathname.startsWith('/tienda'));

  const location = useLocation();
  const navigate = useNavigate();

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
        
        // Sync usuario
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

  const getDefaultRouteForRole = (role: string) => {
    if (role === 'ADMIN' || role === 'FACTURACION') return '/admin/dashboard';
    if (role === 'VENDEDOR') return '/vendedor/orders';
    if (role === 'DEPOSITO') return '/deposito/picking';
    return '/';
  };

  const handleLoginSuccess = () => {
    const currentUser = api.getCurrentUser();
    setUser(currentUser);
    if (currentUser) {
      navigate(getDefaultRouteForRole(currentUser.role));
    }
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setActiveTab('');
    navigate('/');
  };

  // Interceptar ruta o modo para Tienda Online / Portal Clientes
  if (isStoreMode || location.pathname.startsWith('/tienda')) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <ClientPortal onBackToStaffLogin={() => {
          setIsStoreMode(false);
          navigate('/');
        }} />
      </Suspense>
    );
  }

  // Interceptar ruta para recibos compartidos
  if (location.pathname.startsWith('/recibo/')) {
    const receiptId = location.pathname.split('/recibo/')[1];
    return <ReceiptView receiptId={receiptId} />;
  }

  // Si no está autenticado, renderizar Login
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} onOpenStore={() => setIsStoreMode(true)} />;
  }

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
            <Routes>
              {/* Rutas de Administración */}
              <Route path="/admin/:tab?" element={<AdminPages setActiveTab={setActiveTab} />} />

              {/* Rutas de Vendedores */}
              <Route path="/vendedor/:tab?" element={<VendedorPages setActiveTab={setActiveTab} />} />

              {/* Rutas de Depósito */}
              <Route path="/deposito/:tab?" element={<DepositoPages setActiveTab={setActiveTab} />} />

              {/* Redirección por defecto */}
              <Route path="*" element={<Navigate to={getDefaultRouteForRole(user.role)} replace />} />
            </Routes>
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
