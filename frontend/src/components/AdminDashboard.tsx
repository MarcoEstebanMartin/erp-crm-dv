import { lazy, Suspense } from 'react';
import { ShoppingCart, Receipt, DollarSign, FileText, TrendingUp, Warehouse } from 'lucide-react';
import HomeTab from './admin/HomeTab';
import ClientsTab from './admin/ClientsTab';
import OrdersTab from './admin/OrdersTab';
import ProductsTab from './admin/ProductsTab';
import ConfigTab from './admin/ConfigTab';
import ClientProfileModal from './modals/ClientProfileModal';
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
import { AdminUserCreateModal, AdminQuickClientSearchModal } from './admin/AdminQuickModals';
import { AdminCreateQuickOrderModal } from './admin/AdminCreateQuickOrderModal';
import { AdminDirectInvoiceQuickModal } from './admin/AdminDirectInvoiceQuickModal';
import { useAdminController } from './admin/useAdminController';

const PriceListModal = lazy(() => import('./PriceListModal'));
const UnifiedReportsDashboard = lazy(() => import('./UnifiedReportsDashboard'));
const FulfillmentDashboard = lazy(() => import('./admin/FulfillmentDashboard'));
const RendicionesDashboard = lazy(() => import('./RendicionesDashboard'));
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
    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando sección...</span>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

interface AdminDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function AdminDashboard({ activeTab, setActiveTab }: AdminDashboardProps) {
  const c = useAdminController(activeTab);

  return (
    <div style={{ width: '100%' }}>
      {c.errorMsg && (
        <div style={{ backgroundColor: 'var(--accent-bg-light)', color: 'var(--accent-color)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '20px', border: '1px solid rgba(var(--color-corp-red-rgb), 0.15)' }}>
          {c.errorMsg}
        </div>
      )}
      {c.successMsg && (
        <div style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '20px', border: '1px solid rgba(52, 199, 89, 0.15)' }} onClick={() => c.setSuccessMsg(null)}>
          {c.successMsg}
        </div>
      )}

      {activeTab === 'dashboard' && (
        <HomeTab
          orders={c.orders}
          setActiveTab={setActiveTab}
          setSummaryCardModal={c.setSummaryCardModal}
          setClientModal={c.setClientModal}
          setClientSearchModal={c.setClientSearchModal}
          setQuickClientQuery={c.setQuickClientQuery}
          setIsPriceListModalOpen={c.setIsPriceListModalOpen}
          setIsQuickSearchModalOpen={c.setIsQuickSearchModalOpen}
          setIsDirectInvoiceModalOpen={c.setIsDirectInvoiceModalOpen}
        />
      )}

      {(activeTab === 'products' || activeTab === 'catalog' || activeTab === 'stock') && (
        <ProductsTab
          products={c.products}
          fetchData={c.fetchData}
          setProductModal={c.setProductModal}
          handleUpdateProductInline={c.handleUpdateProductInline}
          onUploadImage={c.handleUploadImage}
          onOpenPriceListModal={() => c.setIsPriceListModalOpen(true)}
          onOpenQuickSearchModal={() => c.setIsQuickSearchModalOpen(true)}
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
          setClientModal={c.setClientModal}
          setShowResumenModal={c.setShowResumenModal}
          setPaymentModal={c.setPaymentModal}
          handleViewClientProfile={c.handleViewClientProfile}
          handleViewSellerProfile={(seller: any) => c.setSellerProfileModal({ open: true, sellerId: seller.id })}
          clientsVersion={c.clientsVersion}
        />
      )}

      {(activeTab === 'fulfillment' || activeTab === 'orders' || activeTab === 'billing') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', overflowX: 'auto' }}>
            {[
              { id: 'fulfillment', label: 'Armado de Pedidos', icon: <Warehouse size={15} /> },
              { id: 'orders', label: 'Historial', icon: <ShoppingCart size={15} /> },
              { id: 'billing', label: 'Facturación', icon: <FileText size={15} /> },
            ].map((tab) => (
              <button
                key={tab.id} type="button" className="btn"
                style={{
                  backgroundColor: activeTab === tab.id ? 'var(--color-primary)' : '#fff',
                  color: activeTab === tab.id ? '#fff' : 'var(--text-primary)',
                  border: activeTab === tab.id ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                  fontWeight: 600, fontSize: '0.85rem', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px',
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'fulfillment' && <Suspense fallback={<LoadingDashboard />}><FulfillmentDashboard /></Suspense>}
          {activeTab === 'orders' && <OrdersTab orders={c.orders} fetchData={c.fetchData} setOrderDetailsModal={c.setOrderDetailsModal} handleOpenEditOrder={c.handleOpenEditOrder} setErrorMsg={c.setErrorMsg} setSuccessMsg={c.setSuccessMsg} />}
          {activeTab === 'billing' && <Suspense fallback={<LoadingDashboard />}><BillingDashboard activeTab={activeTab} setActiveTab={setActiveTab} /></Suspense>}
        </div>
      )}

      {activeTab === 'crm' && <Suspense fallback={<LoadingDashboard />}><CrmDashboard /></Suspense>}
      {(activeTab === 'logistica' || activeTab === 'fleet' || activeTab === 'reparto') && <Suspense fallback={<LoadingDashboard />}><LogisticaDashboard /></Suspense>}
      {activeTab === 'compras' && <Suspense fallback={<LoadingDashboard />}><ComprasDashboard /></Suspense>}

      {(activeTab === 'rendiciones' || activeTab === 'reportes' || activeTab === 'reports') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px', overflowX: 'auto' }}>
            {[
              { id: 'general', label: 'Finanzas General', icon: <DollarSign size={15} /> },
              { id: 'rendiciones', label: 'Rendiciones y Arqueos', icon: <Receipt size={15} /> },
              { id: 'gastos', label: 'Control de Gastos', icon: <DollarSign size={15} /> },
              { id: 'reportes', label: 'Reportes y Analíticas', icon: <TrendingUp size={15} /> },
            ].map((tab) => (
              <button
                key={tab.id} type="button" className="btn"
                style={{
                  backgroundColor: c.cajasSubTab === tab.id ? 'var(--color-primary)' : '#fff',
                  color: c.cajasSubTab === tab.id ? '#fff' : 'var(--text-primary)',
                  border: c.cajasSubTab === tab.id ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                  fontWeight: 600, fontSize: '0.85rem', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px',
                }}
                onClick={() => c.setCajasSubTab(tab.id as any)}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          <Suspense fallback={<LoadingDashboard />}>
            {c.cajasSubTab === 'general' ? <FinanzasDashboard /> : c.cajasSubTab === 'rendiciones' ? <RendicionesDashboard /> : c.cajasSubTab === 'gastos' ? <GastosDashboard /> : <UnifiedReportsDashboard orders={c.orders} users={c.users} clients={c.clients} products={c.products} financialReport={c.financialReport} />}
          </Suspense>
        </div>
      )}

      {(activeTab === 'config' || activeTab === 'rrhh') && (
        <ConfigTab setErrorMsg={c.setErrorMsg} setSuccessMsg={c.setSuccessMsg} initialTab={activeTab === 'rrhh' ? 'rrhh' : 'general'} />
      )}

      <AdminSummaryCardModal
        summaryCardModal={c.summaryCardModal}
        orders={c.orders}
        onClose={() => c.setSummaryCardModal(null)}
        onSelectOrderDetails={c.setOrderDetailsModal}
        onViewAllInOrdersTab={(cardKey) => { c.setOrderStatusFilter(cardKey); setActiveTab('orders'); c.setSummaryCardModal(null); }}
      />

      <AdminOrderDetailsModal
        orderDetailsModal={c.orderDetailsModal}
        onClose={() => c.setOrderDetailsModal(null)}
        onFastInvoice={(order) => c.setFastInvoiceOrder(order)}
      />

      <EditOrderModal editOrderModal={c.editOrderModal} setEditOrderModal={c.setEditOrderModal} products={c.products} fetchData={c.fetchData} setSuccessMsg={c.setSuccessMsg} setErrorMsg={c.setErrorMsg} />
      <ProductModal productModal={c.productModal} setProductModal={c.setProductModal} rubrosList={c.rubrosList} providersList={c.providersList} fetchData={c.fetchData} setSuccessMsg={c.setSuccessMsg} setErrorMsg={c.setErrorMsg} />
      {c.showResumenModal && <ResumenCuentaModal client={c.showResumenModal} onClose={() => c.setShowResumenModal(null)} />}
      <ClientModal clientModal={c.clientModal} setClientModal={c.setClientModal} availableSellers={c.availableSellers} availableSaleRoutes={c.availableSaleRoutes} fetchData={c.fetchData} setSuccessMsg={c.setSuccessMsg} setErrorMsg={c.setErrorMsg} setClientsVersion={c.setClientsVersion} />
      <AdminUserCreateModal userModal={c.userModal} setUserModal={c.setUserModal} onSuccess={c.fetchData} setErrorMsg={c.setErrorMsg} setSuccessMsg={c.setSuccessMsg} />
      <ImportZipModal isOpen={c.importZipModalOpen} onClose={() => { c.setImportZipModalOpen(false); c.fetchData(); }} />
      <ClientProfileModal clientProfileModal={c.clientProfileModal} setClientProfileModal={c.setClientProfileModal} setClientModal={c.setClientModal} setPaymentModal={c.setPaymentModal} fetchData={c.fetchData} setSuccessMsg={c.setSuccessMsg} setErrorMsg={c.setErrorMsg} />
      {c.sellerProfileModal?.open && <SellerProfileModal sellerId={c.sellerProfileModal.sellerId} onClose={() => c.setSellerProfileModal(null)} onOpenReport={() => setActiveTab('reports')} />}

      <AdminPaymentModal
        paymentModal={c.paymentModal}
        clientProfileModal={c.clientProfileModal}
        onClose={() => c.setPaymentModal(null)}
        onSuccess={async (clientId) => {
          if (c.clientProfileModal?.client?.id === clientId) await c.handleRefreshClientProfile(clientId);
          c.fetchData();
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
