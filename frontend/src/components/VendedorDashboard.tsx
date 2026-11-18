import React from 'react';
import { ShoppingCart, CheckCircle2, Package, History, Receipt, Home, Navigation } from 'lucide-react';
import { VendedorHomeTab } from './vendedor/VendedorHomeTab';
import { VendedorOrderTakeTab } from './vendedor/VendedorOrderTakeTab';
import { VendedorRoutesTab } from './vendedor/VendedorRoutesTab';
import { VendedorHistoryTab, VendedorCatalogReadOnlyTab } from './vendedor/VendedorCatalogHistoryTabs';
import { VendedorStreetClientModal, VendedorNoSaleModal, VendedorOrderDetailModal } from './vendedor/VendedorModals';
import { VendedorOfflineBanner } from './vendedor/VendedorOfflineBanner';
import { cleanCityName } from './vendedor/vendedorHelpers';
import { useVendedorController } from './vendedor/useVendedorController';

const PriceListModal = React.lazy(() => import('./PriceListModal'));
const MobileCobros = React.lazy(() => import('./MobileCobros'));
const FieldCollectionPage = React.lazy(() =>
  import('./field-receipts/FieldCollectionPage').then((m) => ({ default: m.FieldCollectionPage })),
);
const EditOrderModal = React.lazy(() => import('./modals/EditOrderModal'));
const ResumenCuentaModal = React.lazy(() => import('./modals/ResumenCuentaModal'));
const RepartoDashboard = React.lazy(() => import('./RepartoDashboard'));
const DepositoDashboard = React.lazy(() => import('./DepositoDashboard'));

interface VendedorDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function VendedorDashboard({ activeTab, setActiveTab }: VendedorDashboardProps) {
  const c = useVendedorController(activeTab);
  const [collectClientId, setCollectClientId] = React.useState<number | null>(null);

  return (
    <div style={{ width: '100%' }}>
      <nav aria-label="Preventa" className="vendedor-top-nav-bar" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <button
          type="button"
          className={`vendedor-nav-pill ${activeTab === 'inicio' ? 'vendedor-nav-pill-active' : ''}`}
          aria-current={activeTab === 'inicio' ? 'page' : undefined}
          onClick={() => setActiveTab('inicio')}
        >
          <Home size={16} /><span>Inicio</span>
        </button>

        <button
          type="button"
          className={`vendedor-nav-pill ${activeTab === 'clients' ? 'vendedor-nav-pill-active' : ''}`}
          aria-current={activeTab === 'clients' ? 'page' : undefined}
          onClick={() => setActiveTab('clients')}
        >
          <Navigation size={16} /><span>Ruta</span>
        </button>

        <button
          type="button"
          className={`vendedor-nav-pill ${activeTab === 'orders' ? 'vendedor-nav-pill-active' : ''}`}
          aria-current={activeTab === 'orders' ? 'page' : undefined}
          onClick={() => setActiveTab('orders')}
        >
          <ShoppingCart size={16} />
          <span>Vender</span>
          {c.cart.length > 0 && (
            <span className="tabular-nums" style={{ backgroundColor: activeTab === 'orders' ? '#fff' : 'var(--color-corp-red)', color: activeTab === 'orders' ? 'var(--text-primary)' : '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '10px', marginLeft: '4px' }}>
              {c.cart.length}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`vendedor-nav-pill ${activeTab === 'field-receipts' ? 'vendedor-nav-pill-active' : ''}`}
          aria-current={activeTab === 'field-receipts' ? 'page' : undefined}
          onClick={() => setActiveTab('field-receipts')}
        >
          <Receipt size={16} /><span>Cobrar</span>
        </button>

        <button
          type="button"
          className={`vendedor-nav-pill ${activeTab === 'products' ? 'vendedor-nav-pill-active' : ''}`}
          aria-current={activeTab === 'products' ? 'page' : undefined}
          onClick={() => setActiveTab('products')}
        >
          <Package size={16} /><span>Catálogo</span>
        </button>

        <button
          type="button"
          className={`vendedor-nav-pill ${activeTab === 'history' ? 'vendedor-nav-pill-active' : ''}`}
          aria-current={activeTab === 'history' ? 'page' : undefined}
          onClick={() => setActiveTab('history')}
        >
          <History size={16} /><span>Historial</span>
        </button>
      </nav>

      <VendedorOfflineBanner
        isOnline={c.offlineSync.isOnline}
        isSyncing={c.offlineSync.isSyncing}
        usingCachedCatalog={c.offlineSync.usingCachedCatalog}
        lastCatalogSyncAt={c.offlineSync.lastCatalogSyncAt}
        queuedOrders={c.offlineSync.queuedOrders}
        queuedVisits={c.offlineSync.queuedVisits}
        onSyncNow={c.offlineSync.syncNow}
        onDiscardOrder={c.offlineSync.removeQueuedOrder}
        onRetryOrder={c.offlineSync.retryQueuedOrder}
      />

      {c.errorMsg && (
        <div role="alert" style={{ backgroundColor: 'var(--accent-bg-light)', color: 'var(--accent-color)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '16px', border: '1px solid rgba(var(--color-corp-red-rgb), 0.15)' }}>
          {c.errorMsg}
        </div>
      )}

      {c.successMsg && (
        <div role="status" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', fontWeight: 500, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(52, 199, 89, 0.15)' }} onClick={() => c.setSuccessMsg(null)}>
          <CheckCircle2 size={17} />
          <span>{c.successMsg}</span>
        </div>
      )}

      {activeTab === 'inicio' && (
        <VendedorHomeTab
          vendedorRoutes={c.vendedorRoutes}
          selectedRouteId={c.selectedRouteId}
          cartCount={c.cart.length}
          onGoToSell={() => setActiveTab('orders')}
          onGoToRoute={() => setActiveTab('clients')}
          onGoToCollect={() => setActiveTab('field-receipts')}
          onGoToHistory={() => setActiveTab('history')}
          onGoToCatalog={() => setActiveTab('products')}
        />
      )}

      {activeTab === 'orders' && (
        <VendedorOrderTakeTab
          clients={c.clients}
          products={c.products}
          rubros={c.rubros}
          weeklyPromos={c.weeklyPromos}
          selectedClient={c.selectedClient}
          setSelectedClient={c.setSelectedClient}
          clientFilter={c.clientFilter}
          setClientFilter={c.setClientFilter}
          selectedCityFilters={c.selectedCityFilters}
          setSelectedCityFilters={c.setSelectedCityFilters}
          uniqueCities={c.uniqueCities}
          prodSearchQuery={c.prodSearchQuery}
          setProdSearchQuery={c.setProdSearchQuery}
          filterRubroId={c.filterRubroId}
          setFilterRubroId={c.setFilterRubroId}
          cart={c.cart}
          setCart={c.setCart}
          orderNotes={c.orderNotes}
          setOrderNotes={c.setOrderNotes}
          loading={c.loading}
          onAddToCart={c.addToCart}
          onUpdateCartQty={c.updateCartQty}
          onSetCartQty={c.setCartQty}
          onConfirmOrder={c.handleConfirmOrder}
          onOpenNewClientModal={() => c.setClientModal({ open: true, name: '', cuit: '', address: '', city: '', phone: '', email: '', route: '', saleRouteId: '', latitude: null, longitude: null })}
        />
      )}

      {activeTab === 'history' && (
        <VendedorHistoryTab
          orders={c.orders}
          onViewOrderDetails={c.setOrderDetailsModal}
          onEditOrder={c.handleOpenEditOrder}
        />
      )}

      {activeTab === 'clients' && (
        <VendedorRoutesTab
          vendedorRoutes={c.vendedorRoutes}
          selectedRouteId={c.selectedRouteId}
          clients={c.routeClients}
          orders={c.orders}
          todayVisits={c.todayVisits}
          loading={c.loading}
          onSelectRoute={c.handleSelectRoute}
          onSync={() => { c.setLoading(true); c.fetchData(true).finally(() => c.setLoading(false)); }}
          onOpenNewClientModal={() => c.setClientModal({ open: true, name: '', cuit: '', address: '', city: '', phone: '', email: '', route: '', saleRouteId: c.selectedRouteId || '', latitude: null, longitude: null })}
          onOpenNoSaleModal={(client) => c.setNoSaleModal({ open: true, clientId: client.id, clientName: client.name, reason: 'Estaba cerrado', notes: '' })}
          onCollectClient={(client) => { setCollectClientId(client.id); setActiveTab('field-receipts'); }}
          onSellToClient={(client) => { c.setSelectedClient(client); setActiveTab('orders'); }}
          onOpenResumenClient={(client) => c.setResumenClientModal(client)}
          onReorderClients={c.handleReorderRouteClients}
          onRemoveClient={c.handleRemoveClientFromRoute}
        />
      )}

      {activeTab === 'cobranzas' && (
        <React.Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando...</div>}>
          <MobileCobros
            selectedCityFilters={c.selectedCityFilters}
            setSelectedCityFilters={c.setSelectedCityFilters}
            uniqueCities={c.uniqueCities}
            cleanCityName={cleanCityName}
          />
        </React.Suspense>
      )}

      {activeTab === 'field-receipts' && (
        <React.Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando...</div>}>
          <FieldCollectionPage
            initialClientId={collectClientId}
            onInitialClientHandled={() => setCollectClientId(null)}
          />
        </React.Suspense>
      )}

      {activeTab === 'products' && (
        <VendedorCatalogReadOnlyTab
          products={c.products}
          rubros={c.rubros}
          searchQuery={c.searchQuery}
          setSearchQuery={c.setSearchQuery}
          filterRubroId={c.filterRubroId}
          setFilterRubroId={c.setFilterRubroId}
          onOpenPriceListModal={() => c.setIsPriceListModalOpen(true)}
        />
      )}

      {c.isPriceListModalOpen && (
        <React.Suspense fallback={null}>
          <PriceListModal isOpen={c.isPriceListModalOpen} onClose={() => c.setIsPriceListModalOpen(false)} />
        </React.Suspense>
      )}

      <VendedorStreetClientModal
        clientModal={c.clientModal}
        setClientModal={c.setClientModal}
        vendedorRoutes={c.vendedorRoutes}
        onSubmit={c.handleCreateClient}
      />

      <VendedorOrderDetailModal
        order={c.orderDetailsModal}
        onClose={() => c.setOrderDetailsModal(null)}
      />

      {c.editOrderModal?.open && (
        <React.Suspense fallback={null}>
          <EditOrderModal
            editOrderModal={c.editOrderModal}
            setEditOrderModal={c.setEditOrderModal}
            products={c.products}
            fetchData={() => c.fetchData(true)}
            setSuccessMsg={c.setSuccessMsg}
            setErrorMsg={c.setErrorMsg}
          />
        </React.Suspense>
      )}

      <VendedorNoSaleModal
        noSaleModal={c.noSaleModal}
        setNoSaleModal={c.setNoSaleModal}
        loading={c.loading}
        onSubmit={c.handleRecordNoSale}
      />

      {c.resumenClientModal && (
        <React.Suspense fallback={null}>
          <ResumenCuentaModal client={c.resumenClientModal} onClose={() => c.setResumenClientModal(null)} />
        </React.Suspense>
      )}

      {activeTab === 'logistica' && (
        <React.Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando...</div>}>
          <RepartoDashboard />
        </React.Suspense>
      )}

      {activeTab === 'deposito' && (
        <React.Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando...</div>}>
          <DepositoDashboard activeTab="deposito" setActiveTab={setActiveTab} />
        </React.Suspense>
      )}

      {c.toast && (
        <div role="status" style={{ position: 'fixed', top: '20px', right: '20px', backgroundColor: c.toast.type === 'success' ? '#10B981' : c.toast.type === 'error' ? '#EF4444' : '#3B82F6', color: '#fff', padding: '12px 20px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.15)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.88rem', pointerEvents: 'none' }}>
          {c.toast.type === 'success' && <CheckCircle2 size={16} />}
          <span>{c.toast.message}</span>
        </div>
      )}
    </div>
  );
}
