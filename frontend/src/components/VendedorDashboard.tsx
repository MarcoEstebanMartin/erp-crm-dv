import React from 'react';
import { ShoppingCart, CheckCircle2, History, Receipt, Home, Navigation, Truck, Warehouse } from 'lucide-react';
import { api } from '../utils/api';
import {
  getActiveAssignedDeliveryRoutes,
  hasDeliveryPermission,
  type AssignableDeliveryRoute,
} from './reparto/repartoDriverMatcher';
import { VendedorHomeTab } from './vendedor/VendedorHomeTab';
import { VendedorOrderTakeTab } from './vendedor/VendedorOrderTakeTab';
import { VendedorRoutesTab } from './vendedor/VendedorRoutesTab';
import { VendedorHistoryTab } from './vendedor/VendedorCatalogHistoryTabs';
import { VendedorStreetClientModal, VendedorNoSaleModal, VendedorOrderDetailModal } from './vendedor/VendedorModals';
import { VendedorOfflineBanner } from './vendedor/VendedorOfflineBanner';
import { FieldCollectionPage } from './field-receipts/FieldCollectionPage';
import { cleanCityName } from './vendedor/vendedorHelpers';
import { useVendedorController } from './vendedor/useVendedorController';

const MobileCobros = React.lazy(() => import('./MobileCobros'));
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
  const currentUser = api.getCurrentUser();
  const canDeliver = hasDeliveryPermission(currentUser);
  const canPick = Boolean(currentUser?.permissions?.canPick);
  const [activeDeliveryRoutes, setActiveDeliveryRoutes] = React.useState<AssignableDeliveryRoute[]>([]);
  const [collectClientId, setCollectClientId] = React.useState<number | null>(null);
  const [mountedTabs, setMountedTabs] = React.useState<Record<string, boolean>>(() => ({
    [activeTab]: true,
  }));

  React.useEffect(() => {
    if (!canDeliver) {
      setActiveDeliveryRoutes([]);
      return;
    }
    if (activeTab !== 'inicio' && activeTab !== 'logistica') return;
    let cancelled = false;
    api.getDeliveryRoutes()
      .then((routes) => {
        if (cancelled) return;
        const list = Array.isArray(routes) ? routes : [];
        setActiveDeliveryRoutes(getActiveAssignedDeliveryRoutes(list, currentUser));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canDeliver, activeTab, currentUser?.id, currentUser?.username]);

  React.useEffect(() => {
    setMountedTabs((prev) => (prev[activeTab] ? prev : { ...prev, [activeTab]: true }));
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [activeTab]);

  const isTabMounted = (tab: string) => activeTab === tab || Boolean(mountedTabs[tab]);

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

        {canDeliver && (
          <button
            type="button"
            className={`vendedor-nav-pill ${activeTab === 'logistica' ? 'vendedor-nav-pill-active' : ''}`}
            aria-current={activeTab === 'logistica' ? 'page' : undefined}
            onClick={() => setActiveTab('logistica')}
          >
            <Truck size={16} />
            <span>Reparto</span>
            {activeDeliveryRoutes.length > 0 && (
              <span className="tabular-nums" style={{ backgroundColor: activeTab === 'logistica' ? '#fff' : '#4338CA', color: activeTab === 'logistica' ? 'var(--text-primary)' : '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '10px', marginLeft: '4px' }}>
                {activeDeliveryRoutes.length}
              </span>
            )}
          </button>
        )}

        {canPick && (
          <button
            type="button"
            className={`vendedor-nav-pill ${activeTab === 'deposito' ? 'vendedor-nav-pill-active' : ''}`}
            aria-current={activeTab === 'deposito' ? 'page' : undefined}
            onClick={() => setActiveTab('deposito')}
          >
            <Warehouse size={16} />
            <span>Depósito</span>
          </button>
        )}

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

      {isTabMounted('inicio') && (
        <div hidden={activeTab !== 'inicio'} style={{ display: activeTab === 'inicio' ? undefined : 'none' }}>
          <VendedorHomeTab
            vendedorRoutes={c.vendedorRoutes}
            selectedRouteId={c.selectedRouteId}
            cartCount={c.cart.length}
            canDeliver={canDeliver}
            activeDeliveryRoutes={activeDeliveryRoutes}
            onGoToSell={() => setActiveTab('orders')}
            onGoToRoute={() => setActiveTab('clients')}
            onGoToCollect={() => setActiveTab('field-receipts')}
            onGoToHistory={() => setActiveTab('history')}
            onGoToReparto={() => setActiveTab('logistica')}
          />
        </div>
      )}

      {isTabMounted('orders') && (
        <div hidden={activeTab !== 'orders'} style={{ display: activeTab === 'orders' ? undefined : 'none' }}>
          <VendedorOrderTakeTab
            isActive={activeTab === 'orders'}
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
        </div>
      )}

      {isTabMounted('history') && (
        <div hidden={activeTab !== 'history'} style={{ display: activeTab === 'history' ? undefined : 'none' }}>
          <VendedorHistoryTab
            orders={c.orders}
            onViewOrderDetails={c.setOrderDetailsModal}
            onEditOrder={c.handleOpenEditOrder}
          />
        </div>
      )}

      {isTabMounted('clients') && (
        <div hidden={activeTab !== 'clients'} style={{ display: activeTab === 'clients' ? undefined : 'none' }}>
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
        </div>
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

      {isTabMounted('field-receipts') && (
        <div hidden={activeTab !== 'field-receipts'} style={{ display: activeTab === 'field-receipts' ? undefined : 'none' }}>
          <FieldCollectionPage
            isActive={activeTab === 'field-receipts'}
            initialClientId={collectClientId}
            onInitialClientHandled={() => setCollectClientId(null)}
          />
        </div>
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

      {activeTab === 'deposito' && canPick && (
        <React.Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando...</div>}>
          <DepositoDashboard activeTab="deposito" setActiveTab={setActiveTab} pickingOnly />
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
