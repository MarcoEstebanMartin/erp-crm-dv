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
const InstitutionalLanding = lazy(() => import('./components/landing/InstitutionalLanding'));

const LoadingSpinner = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '12px' }}>
    <div style={{
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      border: '2px solid #E5E7EB',
      borderTopColor: '#111827',
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
    if (role === 'DEPOSITO') return '/deposito/picking';
    return '/vendedor/orders';
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
    navigate('/login');
  };

  // Intercept route for shared receipts
  if (location.pathname.startsWith('/recibo/')) {
    const receiptId = location.pathname.split('/recibo/')[1];
    return <ReceiptView receiptId={receiptId} />;
  }

  // Intercept route or mode for Online B2B Store / Client Portal
  if (isStoreMode || location.pathname.startsWith('/tienda') || location.search.includes('token=')) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <ClientPortal onBackToStaffLogin={() => {
          setIsStoreMode(false);
          navigate('/login');
        }} />
      </Suspense>
    );
  }

  // Optional: Institutional Web landing page reserved at /web
  if (!user && (location.pathname === '/web' || location.pathname.startsWith('/web/'))) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <InstitutionalLanding
          onOpenStore={() => {
            setIsStoreMode(true);
            navigate('/tienda');
          }}
          onOpenStaffLogin={() => navigate('/login')}
        />
      </Suspense>
    );
  }

  // If user is not authenticated, render ERP Login screen for / or /login or any other route
  if (!user) {
    return (
      <Login 
        onLoginSuccess={handleLoginSuccess} 
        onOpenStore={() => { setIsStoreMode(true); navigate('/tienda'); }} 
      />
    );
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
      
      <main className="main-content" style={{ paddingBottom: user?.role === 'VENDEDOR' ? '70px' : undefined }}>
        <section style={{ animation: 'fadeIn 0.4s cubic-bezier(0.25, 1, 0.5, 1)', paddingTop: user.role === 'VENDEDOR' ? '8px' : '0' }}>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              {/* Rutas de Administración (restringido a ADMIN y FACTURACION) */}
              <Route
                path="/admin/:tab?"
                element={
                  user.role === 'ADMIN' || user.role === 'FACTURACION' ? (
                    <AdminPages setActiveTab={setActiveTab} />
                  ) : (
                    <Navigate to={getDefaultRouteForRole(user.role)} replace />
                  )
                }
              />

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
