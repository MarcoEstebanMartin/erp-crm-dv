import { useState } from 'react';
import { X } from 'lucide-react';
import {
  type StockDashboardProps,
  type StockFilterType,
  extractRubroLabel,
  computeStockStats
} from './stock/types';
import { computeProductWmsBreakdown } from './deposito/wmsStockBreakdown';
import { useStockMovements } from './stock/useStockMovements';
import { useStockAdjustments } from './stock/useStockAdjustments';
import { useLotManager } from './stock/useLotManager';
import StockKpiCards from './stock/StockKpiCards';
import StockFiltersBar from './stock/StockFiltersBar';
import StockInventoryTable from './stock/StockInventoryTable';
import GlobalMovementsPanel from './stock/GlobalMovementsPanel';
import ProductKardexDrawer from './stock/ProductKardexDrawer';
import StockAdjustModal from './stock/StockAdjustModal';
import LotManagerModal from './stock/LotManagerModal';
import QuickInventoryFloatingBar from './stock/QuickInventoryFloatingBar';

export type { StockDashboardProps };

export default function StockDashboard({ products, onRefresh, onJumpToMapLocation }: StockDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRubro, setSelectedRubro] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilterType>('all');

  const movements = useStockMovements();

  const adjustments = useStockAdjustments({
    products,
    onRefresh,
    onAfterAdjust: movements.refreshAfterAdjust
  });

  const lotManager = useLotManager({
    products,
    onRefresh,
    setLoadingAdjust: adjustments.setLoadingAdjust,
    setErrorMessage: adjustments.setErrorMessage,
    setSuccessMessage: adjustments.setSuccessMessage
  });

  const filteredProducts = products.filter((p) => {
    const searchLower = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      p.name.toLowerCase().includes(searchLower) ||
      p.sku.toLowerCase().includes(searchLower) ||
      (p.barcode && p.barcode.includes(searchLower));

    const matchesRubro = !selectedRubro || extractRubroLabel(p) === selectedRubro;

    let matchesStock = true;
    if (stockFilter === 'low') {
      matchesStock = p.stock > 0 && p.stock <= p.minStock;
    } else if (stockFilter === 'out') {
      matchesStock = p.stock <= 0;
    } else if (stockFilter === 'located') {
      matchesStock = computeProductWmsBreakdown(p, adjustments.pendingAdjustments).locatedUnits > 0;
    } else if (stockFilter === 'unassigned') {
      matchesStock = computeProductWmsBreakdown(p, adjustments.pendingAdjustments).unassignedUnits > 0;
    } else if (stockFilter === 'expiring') {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      matchesStock = (p.lots || []).some((l: any) => {
        if (l.stock <= 0) return false;
        const expDate = new Date(l.expirationDate);
        return expDate > new Date() && expDate <= thirtyDaysFromNow;
      });
    }

    return matchesSearch && matchesRubro && matchesStock;
  });

  const stats = computeStockStats(filteredProducts, adjustments.pendingAdjustments);
  const rubrosList = Array.from(new Set(products.map(extractRubroLabel).filter(Boolean))).sort();

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Mensajes de Alerta */}
      {adjustments.successMessage && (
        <div
          style={{
            backgroundColor: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.88rem',
            fontWeight: 500,
            marginBottom: '20px',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{adjustments.successMessage}</span>
          <button
            onClick={() => adjustments.setSuccessMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {adjustments.errorMessage && (
        <div
          style={{
            backgroundColor: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.88rem',
            fontWeight: 500,
            marginBottom: '20px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{adjustments.errorMessage}</span>
          <button
            onClick={() => adjustments.setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <StockKpiCards
        stats={stats}
        filteredCount={filteredProducts.length}
        totalCount={products.length}
      />

      <StockFiltersBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedRubro={selectedRubro}
        onRubroChange={setSelectedRubro}
        rubrosList={rubrosList}
        stockFilter={stockFilter}
        onStockFilterChange={setStockFilter}
        isQuickInventoryMode={adjustments.isQuickInventoryMode}
        onToggleQuickInventory={() => {
          if (adjustments.isQuickInventoryMode) {
            adjustments.setPendingAdjustments({});
          }
          adjustments.setIsQuickInventoryMode(!adjustments.isQuickInventoryMode);
        }}
        showEmptyLots={adjustments.showEmptyLots}
        onShowEmptyLotsChange={adjustments.setShowEmptyLots}
        showGlobalMovements={movements.showGlobalMovements}
        onToggleGlobalMovements={() => movements.setShowGlobalMovements(!movements.showGlobalMovements)}
      />

      <StockInventoryTable
        filteredProducts={filteredProducts}
        isQuickInventoryMode={adjustments.isQuickInventoryMode}
        showEmptyLots={adjustments.showEmptyLots}
        pendingAdjustments={adjustments.pendingAdjustments}
        onPendingAdjustmentChange={(key, val) =>
          adjustments.setPendingAdjustments({ ...adjustments.pendingAdjustments, [key]: val })
        }
        onViewHistory={movements.fetchProductHistory}
        onOpenLotManager={lotManager.openLotManager}
        onOpenAdjustModal={adjustments.openAdjustModal}
        onJumpToMapLocation={onJumpToMapLocation}
      />

      <GlobalMovementsPanel
        open={movements.showGlobalMovements}
        loading={movements.loadingGlobalMovements}
        movements={movements.globalMovements}
        onClose={() => movements.setShowGlobalMovements(false)}
      />

      <ProductKardexDrawer
        open={movements.showHistoryPanel}
        product={movements.selectedProductForHistory}
        loading={movements.loadingHistory}
        movements={movements.movementsHistory}
        onClose={movements.closeHistoryPanel}
      />

      <StockAdjustModal
        modal={adjustments.adjustModal}
        loading={adjustments.loadingAdjust}
        onChange={adjustments.setAdjustModal}
        onClose={adjustments.closeAdjustModal}
        onSubmit={adjustments.handleAdjustSubmit}
      />

      <LotManagerModal
        open={lotManager.lotManagerModal.open}
        product={lotManager.lotManagerModal.product}
        loading={adjustments.loadingAdjust}
        editingLot={lotManager.editingLot}
        editLotNumber={lotManager.editLotNumber}
        editExpirationDate={lotManager.editExpirationDate}
        editLocation={lotManager.editLocation}
        onEditLotNumberChange={lotManager.setEditLotNumber}
        onEditExpirationDateChange={lotManager.setEditExpirationDate}
        onEditLocationChange={lotManager.setEditLocation}
        onStartEditingLot={lotManager.startEditingLot}
        onCancelEditingLot={() => lotManager.setEditingLot(null)}
        onUpdateLotSubmit={lotManager.handleUpdateLotSubmit}
        onDeleteLot={lotManager.handleDeleteLot}
        showTransferPanel={lotManager.showTransferPanel}
        onToggleTransferPanel={lotManager.toggleTransferPanel}
        onBackFromTransfer={() => lotManager.setShowTransferPanel(false)}
        transferData={lotManager.transferData}
        onTransferDataChange={lotManager.setTransferData}
        onTransferSubmit={lotManager.handleTransferSubmit}
        onClose={lotManager.closeLotManager}
      />

      <QuickInventoryFloatingBar
        pendingCount={Object.keys(adjustments.pendingAdjustments).length}
        loading={adjustments.loadingAdjust}
        onDiscard={() => adjustments.setPendingAdjustments({})}
        onSave={adjustments.handleSaveQuickInventory}
      />

      <style>{`
        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .hover-bg-muted:hover {
          background-color: var(--bg-app) !important;
        }
      `}</style>
    </div>
  );
}
