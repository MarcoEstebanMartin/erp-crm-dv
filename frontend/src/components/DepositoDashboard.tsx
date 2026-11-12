import { useState } from 'react';
import { ClipboardList, Calendar, ShoppingCart, Map, Warehouse } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import { WarehouseMap } from './deposito/WarehouseMap';
import { PickingOrdersQueueTab } from './deposito/PickingOrdersQueueTab';
import { PickingActiveOrderView } from './deposito/PickingActiveOrderView';
import { PickingConsolidatedView } from './deposito/PickingConsolidatedView';
import { BultosCloseModal } from './deposito/BultosCloseModal';
import { DepositoStockListTab } from './deposito/DepositoStockListTab';
import { DepositoStockAdjustModal } from './deposito/DepositoStockAdjustModal';
import { DepositoLotsExpirationTab } from './deposito/DepositoLotsExpirationTab';
import { DepositoReplenishmentTab } from './deposito/DepositoReplenishmentTab';
import { DepositoPrintLayouts } from './deposito/DepositoPrintLayouts';
import { useDepositoController } from './deposito/useDepositoController';

interface DepositoDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function DepositoDashboard({ activeTab }: DepositoDashboardProps) {
  const confirm = useConfirm();
  const c = useDepositoController(activeTab, confirm);
  const [focusedMapLocation, setFocusedMapLocation] = useState<string | null>(null);

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
      <div className="no-print" style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        {[
          { id: 'wms-map', label: 'Mapa 3D del Depósito (210 Slots)', icon: <Map size={16} /> },
          { id: 'picking', label: 'Preparación / Picking', icon: <ClipboardList size={16} /> },
          { id: 'stock-list', label: 'Inventario Físico', icon: <Warehouse size={16} /> },
          { id: 'lot-expiration', label: 'Lotes y Vencimientos', icon: <Calendar size={16} /> },
          { id: 'replenishment', label: 'Reabastecimiento', icon: <ShoppingCart size={16} /> },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn ${c.subTab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600 }}
            onClick={() => { c.setSubTab(t.id); c.setSelectedOrder(null); c.setShowConsolidatedView(false); }}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {c.errorMsg && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{c.errorMsg}</div>}
      {c.successMsg && <div className="alert alert-success" style={{ marginBottom: '16px' }} onClick={() => c.setSuccessMsg(null)}>{c.successMsg}</div>}

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
            onStartPicking={c.handleStartPicking}
            onSelectOrder={c.setSelectedOrder}
            onBatchStartPicking={c.handleBatchStartPicking}
            onOpenConsolidatedView={() => { c.setConsolidatedCheckedItems({}); c.setConsolidatedZone('ALL'); c.setShowConsolidatedView(true); }}
            onToggleSelectAll={() => {
              const allSelected = filteredOrders.length > 0 && filteredOrders.every((o) => c.selectedOrderIds[o.id]);
              const next = { ...c.selectedOrderIds };
              filteredOrders.forEach((o) => { if (allSelected) delete next[o.id]; else next[o.id] = true; });
              c.setSelectedOrderIds(next);
            }}
          />
        )
      )}

      {c.subTab === 'replenishment' && !c.selectedOrder && !c.showConsolidatedView && (
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

      {c.subTab === 'wms-map' && !c.selectedOrder && !c.showConsolidatedView && (
        <WarehouseMap
          products={c.products}
          onStockUpdated={c.fetchData}
          focusLocationCode={focusedMapLocation}
          onClearFocus={() => setFocusedMapLocation(null)}
        />
      )}

      {c.subTab === 'stock-list' && !c.selectedOrder && !c.showConsolidatedView && (
        <DepositoStockListTab
          products={c.products}
          searchQuery={c.searchQuery}
          setSearchQuery={c.setSearchQuery}
          onRefresh={c.fetchData}
          onOpenStockModal={(p) => c.setStockModal({ open: true, product: p, quantityChange: 0, reason: '', lotNumber: '', isNewLot: false, expirationDate: '', location: '' })}
          onJumpToMapLocation={(loc) => {
            setFocusedMapLocation(loc);
            c.setSubTab('wms-map');
          }}
        />
      )}

      {c.subTab === 'lot-expiration' && !c.selectedOrder && !c.showConsolidatedView && (
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

      <DepositoStockAdjustModal stockModal={c.stockModal} setStockModal={c.setStockModal} loading={c.loading} onSubmit={c.handleStockAdjustSubmit} />
      <BultosCloseModal isOpen={c.showBultoModal} bultosData={c.bultosData} setBultosData={c.setBultosData} loading={c.loading} onClose={() => c.setShowBultoModal(false)} onConfirm={c.handleConfirmBultosAndFinish} />
      <DepositoPrintLayouts labelsToPrint={c.labelsToPrint} showConsolidatedView={c.showConsolidatedView} selectedOrdersList={c.selectedOrdersList} consolidatedItems={c.consolidatedItems} />
    </div>
  );
}
