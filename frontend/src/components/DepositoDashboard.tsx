import { lazy, Suspense, useState } from 'react';
import { FieldCollectionPage } from './field-receipts/FieldCollectionPage';
import { ClipboardList, Calendar, ShoppingCart, Map, Warehouse } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import { PickingOrdersQueueTab } from './deposito/PickingOrdersQueueTab';

const WarehouseMap = lazy(() =>
  import('./deposito/WarehouseMap').then((m) => ({ default: m.WarehouseMap })),
);
import { PickingActiveOrderView } from './deposito/PickingActiveOrderView';
import { PickingConsolidatedView } from './deposito/PickingConsolidatedView';
import { BultosCloseModal } from './deposito/BultosCloseModal';
import { DepositoStockListTab } from './deposito/DepositoStockListTab';
import type { DepositoStockFilter } from './deposito/stockFilterHelpers';
import { DepositoStockAdjustModal } from './deposito/DepositoStockAdjustModal';
import { DepositoLotsExpirationTab } from './deposito/DepositoLotsExpirationTab';
import { DepositoReplenishmentTab } from './deposito/DepositoReplenishmentTab';
import { DepositoPrintLayouts } from './deposito/DepositoPrintLayouts';
import { useDepositoController } from './deposito/useDepositoController';
import './deposito/depositoApp.css';

interface DepositoDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pickingOnly?: boolean;
  appMode?: boolean;
}

export default function DepositoDashboard({
  activeTab,
  setActiveTab,
  pickingOnly = false,
  appMode = false,
}: DepositoDashboardProps) {
  const confirm = useConfirm();
  const c = useDepositoController(activeTab, confirm, pickingOnly, appMode);
  const [focusedMapLocation, setFocusedMapLocation] = useState<string | null>(null);
  const [pendingStockFilter, setPendingStockFilter] = useState<DepositoStockFilter | undefined>(undefined);

  if (activeTab === 'field-receipts') {
    return <FieldCollectionPage />;
  }

  const isOrderFullyAssigned =
    (c.selectedOrder?.items.every((item: any) => {
      const sum = Object.values(c.lotAssignments[item.id] || {}).reduce((s: number, q) => s + (q || 0), 0);
      return sum <= item.quantity;
    }) &&
      c.selectedOrder?.items.some((item: any) => {
        const sum = Object.values(c.lotAssignments[item.id] || {}).reduce((s: number, q) => s + (q || 0), 0);
        return sum > 0;
      })) ||
    false;

  const uniqueRoutes = Array.from(new Set(c.orders.map((o) => o.persona?.route).filter((r): r is string => Boolean(r && r.trim())))).sort();
  const filteredOrders = c.orders.filter((o) => {
    if (c.selectedStatus !== 'ALL' && o.status !== c.selectedStatus) return false;
    if (c.orderSearchQuery.trim() !== '') {
      const q = c.orderSearchQuery.toLowerCase();
      if (!o.id.toString().includes(q) && !o.persona?.name?.toLowerCase().includes(q) && !o.persona?.city?.toLowerCase().includes(q)) return false;
    }
    if (c.withdrawalFilter) {
      const isW = !o.persona?.route || o.persona.route.trim() === '' || o.persona.route.toUpperCase() === 'RETIRO';
      if (!isW) return false;
    } else if (c.routeFilter !== 'ALL' && o.persona?.route !== c.routeFilter) return false;
    return true;
  });

  return (
    <div style={{ width: '100%' }}>
      {!pickingOnly && !appMode && (
        <div className="no-print linear-tablist" role="tablist" aria-label="Depósito WMS" style={{ marginBottom: '20px' }}>
          {[
            { id: 'wms-map', label: 'Mapa WMS', icon: <Map size={15} aria-hidden="true" /> },
            { id: 'picking', label: 'Picking', icon: <ClipboardList size={15} aria-hidden="true" /> },
            { id: 'stock-list', label: 'Inventario', icon: <Warehouse size={15} aria-hidden="true" /> },
            { id: 'lot-expiration', label: 'Lotes', icon: <Calendar size={15} aria-hidden="true" /> },
            { id: 'replenishment', label: 'Reposición', icon: <ShoppingCart size={15} aria-hidden="true" /> },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={c.subTab === t.id}
              className="linear-tab"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={() => { c.setSubTab(t.id); c.setSelectedOrder(null); c.setShowConsolidatedView(false); }}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {c.errorMsg && <div role="alert" className="alert alert-danger" style={{ marginBottom: '16px' }}>{c.errorMsg}</div>}
      {c.successMsg && <div role="status" className="alert alert-success" style={{ marginBottom: '16px' }} onClick={() => c.setSuccessMsg(null)}>{c.successMsg}</div>}

      {(c.subTab === 'picking' || c.selectedOrder || c.showConsolidatedView) && (
        c.selectedOrder ? (
          <PickingActiveOrderView
            selectedOrder={c.selectedOrder}
            selectedZone={c.selectedZone}
            setSelectedZone={c.setSelectedZone}
            lotAssignments={c.lotAssignments}
            confirmedLocations={c.confirmedLocations}
            setConfirmedLocations={c.setConfirmedLocations}
            pesableWeights={c.pesableWeights}
            setPesableWeights={c.setPesableWeights}
            isOrderFullyAssigned={isOrderFullyAssigned}
            onBack={() => c.setSelectedOrder(null)}
            onFIFOAutoFill={c.handleFIFOAutoFill}
            onFIFOAutoFillAll={c.handleFIFOAutoFillAll}
            onLotQtyChange={c.handleLotQtyChange}
            onFinishPicking={c.handleFinishPicking}
            onJumpToMapLocation={
              pickingOnly
                ? undefined
                : (loc) => {
                    setFocusedMapLocation(loc);
                    c.setSelectedOrder(null);
                    if (appMode) setActiveTab('mapa');
                    else c.setSubTab('wms-map');
                  }
            }
          />
        ) : c.showConsolidatedView ? (
          <PickingConsolidatedView
            selectedOrdersList={c.selectedOrdersList}
            consolidatedItems={c.consolidatedItems}
            consolidatedZone={c.consolidatedZone}
            setConsolidatedZone={c.setConsolidatedZone}
            consolidatedCheckedItems={c.consolidatedCheckedItems}
            setConsolidatedCheckedItems={c.setConsolidatedCheckedItems}
            onBack={() => { c.setShowConsolidatedView(false); c.setConsolidatedCheckedItems({}); }}
          />
        ) : (
          <PickingOrdersQueueTab
            expiringLots={c.expiringLots}
            filteredOrders={filteredOrders}
            uniqueRoutes={uniqueRoutes}
            orderSearchQuery={c.orderSearchQuery}
            setOrderSearchQuery={c.setOrderSearchQuery}
            routeFilter={c.routeFilter}
            setRouteFilter={c.setRouteFilter}
            withdrawalFilter={c.withdrawalFilter}
            setWithdrawalFilter={c.setWithdrawalFilter}
            selectedStatus={c.selectedStatus}
            setSelectedStatus={c.setSelectedStatus}
            selectedOrderIds={c.selectedOrderIds}
            setSelectedOrderIds={c.setSelectedOrderIds}
            loading={c.loading}
            onRefresh={c.fetchData}
            onOpenOrder={c.handleOpenOrderForPicking}
            onBatchStartPicking={c.handleBatchStartPicking}
            onOpenConsolidatedView={() => { c.setConsolidatedCheckedItems({}); c.setConsolidatedZone('ALL'); c.setShowConsolidatedView(true); }}
            onOpenExpiringStock={
              pickingOnly
                ? undefined
                : () => {
                    if (appMode) {
                      setPendingStockFilter('EXPIRING');
                      setActiveTab('stock');
                    } else {
                      c.setSubTab('lot-expiration');
                    }
                  }
            }
            onToggleSelectAll={() => {
              const allSelected = filteredOrders.length > 0 && filteredOrders.every((o) => c.selectedOrderIds[o.id]);
              const next = { ...c.selectedOrderIds };
              filteredOrders.forEach((o) => { if (allSelected) delete next[o.id]; else next[o.id] = true; });
              c.setSelectedOrderIds(next);
            }}
          />
        )
      )}

      {!pickingOnly && c.subTab === 'replenishment' && !c.selectedOrder && !c.showConsolidatedView && (
        <DepositoReplenishmentTab
          orders={c.orders}
          allProducts={c.allProducts}
          pendingPurchaseOrders={c.pendingPurchaseOrders}
          loading={c.loading}
          generatingPOForProvider={c.generatingPOForProvider}
          setGeneratingPOForProvider={c.setGeneratingPOForProvider}
          setErrorMsg={c.setErrorMsg}
          setSuccessMsg={c.setSuccessMsg}
          onRefresh={c.fetchData}
        />
      )}

      {!pickingOnly && c.subTab === 'wms-map' && !c.selectedOrder && !c.showConsolidatedView && (
        <Suspense fallback={<div style={{ padding: '24px', color: 'var(--text-secondary)' }}>Cargando mapa WMS...</div>}>
          <WarehouseMap
            products={c.products}
            onStockUpdated={c.fetchData}
            focusLocationCode={focusedMapLocation}
            onClearFocus={() => setFocusedMapLocation(null)}
          />
        </Suspense>
      )}

      {!pickingOnly && c.subTab === 'stock-list' && !c.selectedOrder && !c.showConsolidatedView && (
        <DepositoStockListTab
          products={c.products}
          searchQuery={c.searchQuery}
          setSearchQuery={c.setSearchQuery}
          onRefresh={c.fetchData}
          onOpenStockModal={(p) => c.setStockModal({ open: true, product: p, quantityChange: 0, reason: '', lotNumber: '', isNewLot: false, expirationDate: '', location: '' })}
          onJumpToMapLocation={(loc) => {
            setFocusedMapLocation(loc);
            if (appMode) {
              setActiveTab('mapa');
            } else {
              c.setSubTab('wms-map');
            }
          }}
          initialFilter={pendingStockFilter}
          onConsumeInitialFilter={() => setPendingStockFilter(undefined)}
        />
      )}

      {!pickingOnly && c.subTab === 'lot-expiration' && !c.selectedOrder && !c.showConsolidatedView && (
        <DepositoLotsExpirationTab
          expiringLots={c.expiringLots}
          allProducts={c.allProducts}
          onRefresh={c.fetchData}
          setStockModal={c.setStockModal}
          onPrintLabels={(labels) => {
            c.setLabelsToPrint(labels);
            setTimeout(() => { window.print(); c.setLabelsToPrint([]); }, 200);
          }}
        />
      )}

      {!pickingOnly && (
        <DepositoStockAdjustModal stockModal={c.stockModal} setStockModal={c.setStockModal} loading={c.loading} onSubmit={c.handleStockAdjustSubmit} />
      )}
      <BultosCloseModal isOpen={c.showBultoModal} bultosData={c.bultosData} setBultosData={c.setBultosData} loading={c.loading} onClose={() => c.setShowBultoModal(false)} onConfirm={c.handleConfirmBultosAndFinish} />
      <DepositoPrintLayouts labelsToPrint={c.labelsToPrint} showConsolidatedView={c.showConsolidatedView} selectedOrdersList={c.selectedOrdersList} consolidatedItems={c.consolidatedItems} />
    </div>
  );
}
