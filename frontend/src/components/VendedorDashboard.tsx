import React from 'react';
import { ShoppingCart, CheckCircle2, Package, Users, DollarSign, History } from 'lucide-react';
import PriceListModal from './PriceListModal';
import MobileCobros from './MobileCobros';
import EditOrderModal from './modals/EditOrderModal';
import ResumenCuentaModal from './modals/ResumenCuentaModal';
import { AdminOrderDetailsModal } from './admin/AdminOrderDetailsModal';
import { VendedorOrderTakeTab } from './vendedor/VendedorOrderTakeTab';
import { VendedorRoutesTab } from './vendedor/VendedorRoutesTab';
import { VendedorHistoryTab, VendedorCatalogReadOnlyTab } from './vendedor/VendedorCatalogHistoryTabs';
import { VendedorStreetClientModal, VendedorNoSaleModal } from './vendedor/VendedorModals';
import { VendedorOfflineBanner } from './vendedor/VendedorOfflineBanner';
import { cleanCityName } from './vendedor/vendedorHelpers';
import { useVendedorController } from './vendedor/useVendedorController';

const RepartoDashboard = React.lazy(() => import('./RepartoDashboard'));
const DepositoDashboard = React.lazy(() => import('./DepositoDashboard'));

interface VendedorDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function VendedorDashboard({ activeTab, setActiveTab }: VendedorDashboardProps) {
  const c = useVendedorController(activeTab);

  return (
    <div style={{ width: '100%' }}>
      <div className="vendedor-top-nav-bar" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <button type="button" className={`vendedor-nav-pill ${activeTab === 'orders' ? 'vendedor-nav-pill-active' : ''}`} onClick={() => setActiveTab('orders')}>
          <ShoppingCart size={16} />
          <span>Toma de Pedidos</span>
          {c.cart.length > 0 && (
            <span style={{ backgroundColor: activeTab === 'orders' ? '#fff' : 'var(--color-corp-red)', color: activeTab === 'orders' ? 'var(--text-primary)' : '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '10px', marginLeft: '4px' }}>
              {c.cart.length}
            </span>
          )}
        </button>

        <button type="button" className={`vendedor-nav-pill ${activeTab === 'clients' ? 'vendedor-nav-pill-active' : ''}`} onClick={() => setActiveTab('clients')}>
          <Users size={16} /><span>Rutas y GPS</span>
        </button>

        <button type="button" className={`vendedor-nav-pill ${activeTab === 'cobranzas' ? 'vendedor-nav-pill-active' : ''}`} onClick={() => setActiveTab('cobranzas')}>
          <DollarSign size={16} /><span>Cobranzas</span>
        </button>

        <button type="button" className={`vendedor-nav-pill ${activeTab === 'products' ? 'vendedor-nav-pill-active' : ''}`} onClick={() => setActiveTab('products')}>
          <Package size={16} /><span>Catálogo</span>
        </button>

        <button type="button" className={`vendedor-nav-pill ${activeTab === 'history' ? 'vendedor-nav-pill-active' : ''}`} onClick={() => setActiveTab('history')}>
          <History size={16} /><span>Historial</span>
        </button>
      </div>

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
        <div style={{ backgroundColor: 'var(--accent-bg-light)', color: 'var(--accent-color)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '20px', border: '1px solid rgba(var(--color-corp-red-rgb), 0.15)' }}>
          {c.errorMsg}
        </div>
      )}

      {c.successMsg && (
        <div style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', padding: '16px', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', fontWeight: 500, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(52, 199, 89, 0.15)' }} onClick={() => c.setSuccessMsg(null)}>
          <CheckCircle2 size={18} />
          <span>{c.successMsg}</span>
        </div>
      )}

      {activeTab === 'orders' && (
        <VendedorOrderTakeTab
          clients={c.clients}
          products={c.products}
          rubros={c.rubros}
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
          clients={c.clients}
          orders={c.orders}
          todayVisits={c.todayVisits}
          loading={c.loading}
          onSelectRoute={c.handleSelectRoute}
          onSync={() => { c.setLoading(true); c.fetchData().finally(() => c.setLoading(false)); }}
          onOpenNewClientModal={() => c.setClientModal({ open: true, name: '', cuit: '', address: '', city: '', phone: '', email: '', route: '', saleRouteId: c.selectedRouteId || '', latitude: null, longitude: null })}
          onOpenNoSaleModal={(client) => c.setNoSaleModal({ open: true, clientId: client.id, clientName: client.name, reason: 'Estaba cerrado', notes: '' })}
          onCollectClient={(client) => { c.setSelectedClient(client); setActiveTab('cobranzas'); }}
          onSellToClient={(client) => { c.setSelectedClient(client); setActiveTab('orders'); }}
          onOpenResumenClient={(client) => c.setResumenClientModal(client)}
        />
      )}

      {activeTab === 'cobranzas' && (
        <MobileCobros
          selectedCityFilters={c.selectedCityFilters}
          setSelectedCityFilters={c.setSelectedCityFilters}
          uniqueCities={c.uniqueCities}
          cleanCityName={cleanCityName}
        />
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

      {c.isPriceListModalOpen && <PriceListModal isOpen={c.isPriceListModalOpen} onClose={() => c.setIsPriceListModalOpen(false)} />}

      <VendedorStreetClientModal
        clientModal={c.clientModal}
        setClientModal={c.setClientModal}
        vendedorRoutes={c.vendedorRoutes}
        onSubmit={c.handleCreateClient}
      />

      <AdminOrderDetailsModal
        orderDetailsModal={c.orderDetailsModal}
        onClose={() => c.setOrderDetailsModal(null)}
        onFastInvoice={() => {}}
      />

      <EditOrderModal
        editOrderModal={c.editOrderModal}
        setEditOrderModal={c.setEditOrderModal}
        products={c.products}
        fetchData={c.fetchData}
        setSuccessMsg={c.setSuccessMsg}
        setErrorMsg={c.setErrorMsg}
      />

      <VendedorNoSaleModal
        noSaleModal={c.noSaleModal}
        setNoSaleModal={c.setNoSaleModal}
        loading={c.loading}
        onSubmit={c.handleRecordNoSale}
      />

      {c.resumenClientModal && (
        <ResumenCuentaModal client={c.resumenClientModal} onClose={() => c.setResumenClientModal(null)} />
      )}

      {activeTab === 'logistica' && (
        <React.Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando Logística y Reparto...</div>}>
          <RepartoDashboard />
        </React.Suspense>
      )}

      {activeTab === 'deposito' && (
        <React.Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando Preparación y Depósito...</div>}>
          <DepositoDashboard activeTab="deposito" setActiveTab={setActiveTab} />
        </React.Suspense>
      )}

      {c.toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', backgroundColor: c.toast.type === 'success' ? '#10B981' : c.toast.type === 'error' ? '#EF4444' : '#3B82F6', color: '#fff', padding: '12px 24px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.15)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem', pointerEvents: 'none' }}>
          {c.toast.type === 'success' && <CheckCircle2 size={16} />}
          <span>{c.toast.message}</span>
        </div>
      )}
    </div>
  );
}
