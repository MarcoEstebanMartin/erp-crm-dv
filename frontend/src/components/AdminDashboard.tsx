import { lazy, Suspense } from 'react';
import { Check, ShoppingCart, FileText, Truck, Warehouse } from 'lucide-react';
import { api } from '../utils/api';
import HomeTab from './admin/HomeTab';
import { useAdminController } from './admin/useAdminController';
import { AdminModalsHost } from './admin/AdminModalsHost';

const ClientsTab = lazy(() => import('./admin/ClientsTab'));
const OrdersTab = lazy(() => import('./admin/OrdersTab'));
const ProductsTab = lazy(() => import('./admin/ProductsTab'));
const CatalogStudioTab = lazy(() => import('./admin/catalog-studio/CatalogStudioTab'));
const ConfigTab = lazy(() => import('./admin/ConfigTab'));
const CajaHubSection = lazy(() =>
  import('./admin/CajaHubSection').then((m) => ({ default: m.CajaHubSection })),
);
const FulfillmentDashboard = lazy(() => import('./admin/FulfillmentDashboard'));
const RepartoDashboard = lazy(() => import('./RepartoDashboard'));
const LogisticaDashboard = lazy(() => import('./LogisticaDashboard'));
const ComprasDashboard = lazy(() => import('./ComprasDashboard'));
const BillingDashboard = lazy(() => import('./BillingDashboard'));
const DepositoDashboard = lazy(() => import('./DepositoDashboard'));
const CrmDashboard = lazy(() => import('./CrmDashboard'));

const LoadingDashboard = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', padding: '40px', backgroundColor: 'var(--background-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
    <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid rgba(var(--color-corp-red-rgb), 0.1)', borderTopColor: 'var(--color-corp-red)', animation: 'spin 0.8s linear infinite' }} />
    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando...</span>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

interface AdminDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function AdminDashboard({ activeTab, setActiveTab }: AdminDashboardProps) {
  const c = useAdminController(activeTab);
  const isAdmin = api.getCurrentUser()?.role === 'ADMIN';
  const afipCert = isAdmin ? api.getServerConfig()?.afipCertStatus : null;
  const showCertAlert = afipCert?.status === 'EXPIRING_SOON' || afipCert?.status === 'EXPIRED';
  const certDateStr = afipCert?.validTo
    ? new Date(afipCert.validTo).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
    : '';

  return (
    <div style={{ width: '100%' }}>
      {showCertAlert && (
        <div
          role="alert"
          style={{
            backgroundColor: afipCert.status === 'EXPIRED' ? '#FEF2F2' : '#FFFBEB',
            color: afipCert.status === 'EXPIRED' ? '#991B1B' : '#92400E',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            fontWeight: 600,
            marginBottom: '16px',
            border: `1px solid ${afipCert.status === 'EXPIRED' ? '#FECACA' : '#FDE68A'}`,
          }}
        >
          {afipCert.status === 'EXPIRED'
            ? `Certificado ARCA vencido (${certDateStr}). Renovar para emitir CAE.`
            : `Certificado ARCA vence en ${afipCert.daysRemaining} días (${certDateStr}). Renovar antes del vencimiento.`}
        </div>
      )}
      {c.errorMsg && (
        <div style={{ backgroundColor: 'var(--accent-bg-light)', color: 'var(--accent-color)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '20px', border: '1px solid rgba(var(--color-corp-red-rgb), 0.15)' }}>
          {c.errorMsg}
        </div>
      )}
      {c.successMsg && (
        <div
          role="status"
          aria-label={c.successMsg === '__CHECK__' ? 'Actualizado' : undefined}
          style={{
            backgroundColor: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            padding: c.successMsg === '__CHECK__' ? '8px 14px' : '12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            marginBottom: '20px',
            border: '1px solid rgba(52, 199, 89, 0.15)',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() => c.setSuccessMsg(null)}
        >
          {c.successMsg === '__CHECK__' ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : c.successMsg}
        </div>
      )}

      {activeTab === 'dashboard' && (
        <HomeTab
          orders={c.orders}
          ordersSummary={c.ordersSummary}
          setActiveTab={setActiveTab}
          onOpenRendiciones={() => {
            c.setCajasSubTab('rendiciones');
            setActiveTab('rendiciones');
          }}
          setSummaryCardModal={c.setSummaryCardModal}
          setClientModal={c.setClientModal}
          setClientSearchModal={c.setClientSearchModal}
          setQuickClientQuery={c.setQuickClientQuery}
          setIsPriceListModalOpen={c.setIsPriceListModalOpen}
          setIsQuickSearchModalOpen={c.setIsQuickSearchModalOpen}
          setIsDirectInvoiceModalOpen={c.setIsDirectInvoiceModalOpen}
          setErrorMsg={c.setErrorMsg}
          setSuccessMsg={c.setSuccessMsg}
        />
      )}

      {(activeTab === 'products' || activeTab === 'catalog' || activeTab === 'stock') && (
        <Suspense fallback={<LoadingDashboard />}>
          <ProductsTab
            products={c.products}
            fetchData={c.fetchData}
            setProductModal={c.setProductModal}
            handleUpdateProductInline={c.handleUpdateProductInline}
            onUploadImage={c.handleUploadImage}
            initialCatalogTab={activeTab === 'stock' ? 'stock' : 'products'}
          />
        </Suspense>
      )}

      {activeTab === 'catalogo' && (
        <Suspense fallback={<LoadingDashboard />}>
          <CatalogStudioTab />
        </Suspense>
      )}

      {activeTab === 'deposito' && (
        <Suspense fallback={<LoadingDashboard />}>
          <DepositoDashboard activeTab="deposito" setActiveTab={setActiveTab} />
        </Suspense>
      )}

      {activeTab === 'clients' && (
        <Suspense fallback={<LoadingDashboard />}>
          <ClientsTab
            setActiveTab={setActiveTab}
            clients={c.clients}
            setClients={c.setClients}
            availableSellers={c.availableSellers}
            availableSaleRoutes={c.availableSaleRoutes}
            setClientModal={c.setClientModal}
            setShowResumenModal={c.setShowResumenModal}
            setPaymentModal={c.setPaymentModal}
            handleViewClientProfile={c.handleViewClientProfile}
            handleViewSellerProfile={(seller: any) => c.setSellerProfileModal({ open: true, sellerId: seller.id })}
            clientsVersion={c.clientsVersion}
            onProvidersChanged={c.fetchData}
          />
        </Suspense>
      )}

      {(activeTab === 'fulfillment' || activeTab === 'entregas' || activeTab === 'orders' || activeTab === 'billing') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <nav aria-label="Pedidos y facturación" className="linear-underline-nav">
            {[
              { id: 'fulfillment', label: 'Armado', icon: <Warehouse size={15} aria-hidden="true" /> },
              { id: 'billing', label: 'Facturación', icon: <FileText size={15} aria-hidden="true" /> },
              { id: 'entregas', label: 'Entregas', icon: <Truck size={15} aria-hidden="true" /> },
              { id: 'orders', label: 'Historial', icon: <ShoppingCart size={15} aria-hidden="true" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="linear-nav-link"
                aria-current={activeTab === tab.id ? 'page' : undefined}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === 'fulfillment' && <Suspense fallback={<LoadingDashboard />}><FulfillmentDashboard /></Suspense>}
          {activeTab === 'entregas' && <Suspense fallback={<LoadingDashboard />}><RepartoDashboard /></Suspense>}
          {activeTab === 'orders' && (
            <Suspense fallback={<LoadingDashboard />}>
              <OrdersTab
                initialStatusFilter={c.orderStatusFilter}
                ordersVersion={c.ordersVersion}
                fetchData={c.fetchData}
                setOrderDetailsModal={c.setOrderDetailsModal}
                handleOpenEditOrder={c.handleOpenEditOrder}
                setErrorMsg={c.setErrorMsg}
                setSuccessMsg={c.setSuccessMsg}
              />
            </Suspense>
          )}
          {activeTab === 'billing' && <Suspense fallback={<LoadingDashboard />}><BillingDashboard activeTab={activeTab} setActiveTab={setActiveTab} /></Suspense>}
        </div>
      )}

      {activeTab === 'crm' && <Suspense fallback={<LoadingDashboard />}><CrmDashboard /></Suspense>}
      {(activeTab === 'logistica' || activeTab === 'fleet' || activeTab === 'reparto') && <Suspense fallback={<LoadingDashboard />}><LogisticaDashboard /></Suspense>}
      {activeTab === 'compras' && <Suspense fallback={<LoadingDashboard />}><ComprasDashboard /></Suspense>}

      {(activeTab === 'rendiciones' || activeTab === 'reportes' || activeTab === 'reports') && (
        <Suspense fallback={<LoadingDashboard />}>
          <CajaHubSection
            isAdmin={isAdmin} cajasSubTab={c.cajasSubTab} setCajasSubTab={c.setCajasSubTab}
            orders={c.orders} users={c.users} clients={c.clients} products={c.products}
            financialReport={c.financialReport} fallback={<LoadingDashboard />}
          />
        </Suspense>
      )}

      {(activeTab === 'config' || activeTab === 'rrhh') && (
        <Suspense fallback={<LoadingDashboard />}>
          <ConfigTab setErrorMsg={c.setErrorMsg} setSuccessMsg={c.setSuccessMsg} initialTab={activeTab === 'rrhh' ? 'rrhh' : 'general'} />
        </Suspense>
      )}

      <AdminModalsHost c={c} setActiveTab={setActiveTab} />
    </div>
  );
}
