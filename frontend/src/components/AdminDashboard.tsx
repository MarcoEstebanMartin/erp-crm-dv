import { lazy, Suspense } from 'react';
import { Check, ShoppingCart, Receipt, DollarSign, FileText, TrendingUp, Truck, Warehouse } from 'lucide-react';
import { api } from '../utils/api';
import HomeTab from './admin/HomeTab';
import ClientsTab from './admin/ClientsTab';
import OrdersTab from './admin/OrdersTab';
import ProductsTab from './admin/ProductsTab';
import ConfigTab from './admin/ConfigTab';
import SellerProfileModal from './modals/SellerProfileModal';
import EditOrderModal from './modals/EditOrderModal';
import ProductModal from './modals/ProductModal';
import ClientModal from './modals/ClientModal';
import ImportZipModal from './modals/ImportZipModal';
import ResumenCuentaModal from './modals/ResumenCuentaModal';
import QuickPriceSearchModal from './modals/QuickPriceSearchModal';
import OrderFulfillmentModal from './modals/OrderFulfillmentModal';
import { AdminSummaryCardModal } from './admin/AdminSummaryCardModal';
import { AdminOrderDetailsModal } from './admin/AdminOrderDetailsModal';
import { AdminPaymentModal } from './admin/AdminPaymentModal';
import { AdminQuickClientSearchModal } from './admin/AdminQuickModals';
import { AdminCreateQuickOrderModal } from './admin/AdminCreateQuickOrderModal';
import { AdminDirectInvoiceQuickModal } from './admin/AdminDirectInvoiceQuickModal';
import { useAdminController } from './admin/useAdminController';

const PriceListModal = lazy(() => import('./PriceListModal'));
const UnifiedReportsDashboard = lazy(() => import('./UnifiedReportsDashboard'));
const FulfillmentDashboard = lazy(() => import('./admin/FulfillmentDashboard'));
const RepartoDashboard = lazy(() => import('./RepartoDashboard'));
const RendicionesDashboard = lazy(() => import('./RendicionesDashboard'));
const FieldSettlementsTab = lazy(() =>
  import('./field-receipts/FieldSettlementsTab').then((m) => ({ default: m.FieldSettlementsTab })),
);
const LogisticaDashboard = lazy(() => import('./LogisticaDashboard'));
const ComprasDashboard = lazy(() => import('./ComprasDashboard'));
const FinanzasDashboard = lazy(() => import('./FinanzasDashboard'));
const BillingDashboard = lazy(() => import('./BillingDashboard'));
const DepositoDashboard = lazy(() => import('./DepositoDashboard'));
const GastosDashboard = lazy(() => import('./GastosDashboard'));
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
        <ProductsTab
          products={c.products}
          fetchData={c.fetchData}
          setProductModal={c.setProductModal}
          handleUpdateProductInline={c.handleUpdateProductInline}
          onUploadImage={c.handleUploadImage}
          initialCatalogTab={activeTab === 'stock' ? 'stock' : 'products'}
        />
      )}

      {activeTab === 'deposito' && (
        <Suspense fallback={<LoadingDashboard />}>
          <DepositoDashboard activeTab="deposito" setActiveTab={setActiveTab} />
        </Suspense>
      )}

      {activeTab === 'clients' && (
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
            <OrdersTab
              initialStatusFilter={c.orderStatusFilter}
              ordersVersion={c.ordersVersion}
              fetchData={c.fetchData}
              setOrderDetailsModal={c.setOrderDetailsModal}
              handleOpenEditOrder={c.handleOpenEditOrder}
              setErrorMsg={c.setErrorMsg}
              setSuccessMsg={c.setSuccessMsg}
            />
          )}
          {activeTab === 'billing' && <Suspense fallback={<LoadingDashboard />}><BillingDashboard activeTab={activeTab} setActiveTab={setActiveTab} /></Suspense>}
        </div>
      )}

      {activeTab === 'crm' && <Suspense fallback={<LoadingDashboard />}><CrmDashboard /></Suspense>}
      {(activeTab === 'logistica' || activeTab === 'fleet' || activeTab === 'reparto') && <Suspense fallback={<LoadingDashboard />}><LogisticaDashboard /></Suspense>}
      {activeTab === 'compras' && <Suspense fallback={<LoadingDashboard />}><ComprasDashboard /></Suspense>}

      {(activeTab === 'rendiciones' || activeTab === 'reportes' || activeTab === 'reports') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div role="tablist" aria-label="Caja y finanzas" className="linear-tablist">
            {[
              { id: 'general', label: 'Finanzas', icon: <DollarSign size={15} aria-hidden="true" />, adminOnly: true },
              { id: 'rendiciones', label: 'Rendiciones', icon: <Receipt size={15} aria-hidden="true" />, adminOnly: false },
              { id: 'field-receipts', label: 'Recibos', icon: <Receipt size={15} aria-hidden="true" />, adminOnly: false },
              { id: 'gastos', label: 'Gastos', icon: <DollarSign size={15} aria-hidden="true" />, adminOnly: true },
              { id: 'reportes', label: 'Reportes', icon: <TrendingUp size={15} aria-hidden="true" />, adminOnly: true },
            ]
              .filter((tab) => isAdmin || !tab.adminOnly)
              .map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={c.cajasSubTab === tab.id}
                  className="linear-tab"
                  onClick={() => c.setCajasSubTab(tab.id as any)}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
          </div>

          <Suspense fallback={<LoadingDashboard />}>
            {c.cajasSubTab === 'field-receipts' ? (
              <FieldSettlementsTab />
            ) : c.cajasSubTab === 'rendiciones' ? (
              <RendicionesDashboard />
            ) : isAdmin && c.cajasSubTab === 'general' ? (
              <FinanzasDashboard />
            ) : isAdmin && c.cajasSubTab === 'gastos' ? (
              <GastosDashboard />
            ) : isAdmin && c.cajasSubTab === 'reportes' ? (
              <UnifiedReportsDashboard orders={c.orders} users={c.users} clients={c.clients} products={c.products} financialReport={c.financialReport} />
            ) : isAdmin ? (
              <FinanzasDashboard />
            ) : (
              <RendicionesDashboard />
            )}
          </Suspense>
        </div>
      )}

      {(activeTab === 'config' || activeTab === 'rrhh') && (
        <ConfigTab setErrorMsg={c.setErrorMsg} setSuccessMsg={c.setSuccessMsg} initialTab={activeTab === 'rrhh' ? 'rrhh' : 'general'} />
      )}

      <AdminSummaryCardModal
        summaryCardModal={c.summaryCardModal} orders={c.orders} onClose={() => c.setSummaryCardModal(null)}
        onSelectOrderDetails={c.setOrderDetailsModal}
        onViewAllInOrdersTab={(cardKey) => { c.setOrderStatusFilter(cardKey); setActiveTab('orders'); c.setSummaryCardModal(null); }}
        onNavigateOperationalTab={(tab) => { setActiveTab(tab); c.setSummaryCardModal(null); }}
        onOrderDelivered={c.fetchData} setErrorMsg={c.setErrorMsg} setSuccessMsg={c.setSuccessMsg}
      />

      <AdminOrderDetailsModal
        orderDetailsModal={c.orderDetailsModal} onClose={() => c.setOrderDetailsModal(null)}
        onFastInvoice={(order) => c.setFastInvoiceOrder(order)} fetchData={c.fetchData}
        onOrderUpdated={(updated) => c.setOrderDetailsModal((prev: any) => (prev ? { ...prev, ...updated } : null))}
        setErrorMsg={c.setErrorMsg} setSuccessMsg={c.setSuccessMsg}
      />

      <EditOrderModal editOrderModal={c.editOrderModal} setEditOrderModal={c.setEditOrderModal} products={c.products} fetchData={c.fetchData} setSuccessMsg={c.setSuccessMsg} setErrorMsg={c.setErrorMsg} />
      <ProductModal productModal={c.productModal} setProductModal={c.setProductModal} rubrosList={c.rubrosList} providersList={c.providersList} fetchData={c.fetchData} setSuccessMsg={c.setSuccessMsg} setErrorMsg={c.setErrorMsg} />
      {c.showResumenModal && <ResumenCuentaModal client={c.showResumenModal} onClose={() => c.setShowResumenModal(null)} />}
      <ClientModal clientModal={c.clientModal} setClientModal={c.setClientModal} availableSellers={c.availableSellers} availableSaleRoutes={c.availableSaleRoutes} fetchData={c.fetchData} setSuccessMsg={c.setSuccessMsg} setErrorMsg={c.setErrorMsg} setClientsVersion={c.setClientsVersion} setPaymentModal={c.setPaymentModal} />
      <ImportZipModal isOpen={c.importZipModalOpen} onClose={() => { c.setImportZipModalOpen(false); c.fetchData(); }} />
      {c.sellerProfileModal?.open && <SellerProfileModal sellerId={c.sellerProfileModal.sellerId} onClose={() => c.setSellerProfileModal(null)} onOpenReport={() => setActiveTab('reports')} />}

      <AdminPaymentModal
        paymentModal={c.paymentModal}
        clientProfileModal={c.clientModal?.open && c.clientModal?.mode === 'edit' && c.clientModal?.data?.id ? { open: true, client: c.clientModal.data, ledger: [] } : null}
        onClose={() => c.setPaymentModal(null)}
        onSuccess={async (clientId) => {
          if (c.clientModal?.open && c.clientModal?.mode === 'edit' && c.clientModal?.data?.id === clientId) {
            await c.handleRefreshClientProfile(clientId);
          }
          c.fetchData();
          c.setClientsVersion((prev) => prev + 1);
        }}
        setErrorMsg={c.setErrorMsg}
        setSuccessMsg={c.setSuccessMsg}
      />

      {c.fastInvoiceOrder && (
        <OrderFulfillmentModal order={c.fastInvoiceOrder} onClose={() => c.setFastInvoiceOrder(null)} onSuccess={() => { c.setFastInvoiceOrder(null); c.fetchData(); }} />
      )}

      <Suspense fallback={null}>
        <PriceListModal isOpen={c.isPriceListModalOpen} onClose={() => c.setIsPriceListModalOpen(false)} />
      </Suspense>
      <QuickPriceSearchModal isOpen={c.isQuickSearchModalOpen} onClose={() => c.setIsQuickSearchModalOpen(false)} />

      <AdminQuickClientSearchModal
        clientSearchModal={c.clientSearchModal}
        clients={c.clients}
        quickClientQuery={c.quickClientQuery}
        setQuickClientQuery={c.setQuickClientQuery}
        onClose={() => c.setClientSearchModal(null)}
        onSelectClientAction={(action, client) => {
          if (action === 'ledger') c.setShowResumenModal(client);
          else if (action === 'payment') c.setPaymentModal({ open: true, clientId: client.id, clientName: client.name });
          else if (action === 'order') c.setCreateOrderModal({ open: true, client, cart: [], notes: '' });
        }}
      />

      <AdminCreateQuickOrderModal
        createOrderModal={c.createOrderModal}
        setCreateOrderModal={c.setCreateOrderModal}
        products={c.products}
        onSuccess={c.fetchData}
        setErrorMsg={c.setErrorMsg}
        setSuccessMsg={c.setSuccessMsg}
      />

      <AdminDirectInvoiceQuickModal
        isOpen={c.isDirectInvoiceModalOpen}
        onClose={() => c.setIsDirectInvoiceModalOpen(false)}
        clients={c.clients}
        products={c.products}
        onSuccess={c.fetchData}
        setErrorMsg={c.setErrorMsg}
        setSuccessMsg={c.setSuccessMsg}
      />
    </div>
  );
}
