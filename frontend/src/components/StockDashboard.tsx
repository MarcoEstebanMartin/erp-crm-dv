import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../utils/api';
import {
  type StockDashboardProps,
  type StockFilterType,
  extractRubroLabel,
  getDisplayedStock,
  computeStockStats
} from './stock/types';
import { computeProductWmsBreakdown } from './deposito/wmsStockBreakdown';
import { isSentinelExpiration } from './stock/lotLabel';
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
import { ExcelImportModal } from './common/ExcelImportModal';
import { StockDriftAlertBanner } from './stock/StockDriftAlertBanner';

export type { StockDashboardProps };

export default function StockDashboard({
  products,
  onRefresh,
  onJumpToMapLocation,
  userRole
}: StockDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRubro, setSelectedRubro] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilterType>('all');
  const [showStockImportModal, setShowStockImportModal] = useState(false);
  const [auditRefreshTick, setAuditRefreshTick] = useState(0);

  const role = userRole ?? api.getCurrentUser()?.role ?? '';
  const canViewCosts = role === 'ADMIN';
  const canViewValuation = role === 'ADMIN';
  const canMutateStock = role === 'ADMIN' || role === 'DEPOSITO';

  const activeProducts = useMemo(
    () => (Array.isArray(products) ? products.filter((p) => p && p.isActive !== false) : []),
    [products]
  );

  const movements = useStockMovements();

  const adjustments = useStockAdjustments({
    products: activeProducts,
    onRefresh,
    onAfterAdjust: movements.refreshAfterAdjust
  });

  const lotManager = useLotManager({
    products: activeProducts,
    onRefresh,
    setLoadingAdjust: adjustments.setLoadingAdjust,
    setErrorMessage: adjustments.setErrorMessage,
    setSuccessMessage: adjustments.setSuccessMessage
  });

  const filteredProducts = activeProducts.filter((p) => {
    const searchLower = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      p.name.toLowerCase().includes(searchLower) ||
      p.sku.toLowerCase().includes(searchLower) ||
      (p.barcode && p.barcode.includes(searchLower));

    const matchesRubro = !selectedRubro || extractRubroLabel(p) === selectedRubro;

    const displayedStock = getDisplayedStock(p, adjustments.pendingAdjustments);
    const minStock = Number(p.minStock ?? 0);

    let matchesStock = true;
    if (stockFilter === 'low') {
      matchesStock = displayedStock > 0 && minStock > 0 && displayedStock < minStock;
    } else if (stockFilter === 'out') {
      matchesStock = displayedStock <= 0;
    } else if (stockFilter === 'located') {
      matchesStock = computeProductWmsBreakdown(p, adjustments.pendingAdjustments).locatedUnits > 0;
    } else if (stockFilter === 'unassigned') {
      matchesStock = computeProductWmsBreakdown(p, adjustments.pendingAdjustments).unassignedUnits > 0;
    } else if (stockFilter === 'expiring') {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      matchesStock = (p.lots || []).some((l: any) => {
        if (l.stock <= 0 || isSentinelExpiration(l.expirationDate)) return false;
        const expDate = new Date(l.expirationDate);
        return !Number.isNaN(expDate.getTime()) && expDate <= thirtyDaysFromNow;
      });
    }

    return matchesSearch && matchesRubro && matchesStock;
  });

  const stats = computeStockStats(filteredProducts, adjustments.pendingAdjustments, canViewCosts);
  const rubrosList = Array.from(new Set(activeProducts.map(extractRubroLabel).filter(Boolean))).sort();

  return (
    <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
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
            type="button"
            onClick={() => adjustments.setSuccessMessage(null)}
            style={{ background: 'none', border: 'none', boxShadow: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
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
            type="button"
            onClick={() => adjustments.setErrorMessage(null)}
            style={{ background: 'none', border: 'none', boxShadow: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <StockDriftAlertBanner
        isAdmin={role === 'ADMIN'}
        refreshToken={auditRefreshTick}
        onReconciled={async () => {
          await onRefresh();
          setAuditRefreshTick((t) => t + 1);
        }}
      />

      <StockKpiCards
        stats={stats}
        filteredCount={filteredProducts.length}
        totalCount={activeProducts.length}
        canViewCosts={canViewCosts}
        canViewValuation={canViewValuation}
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
        canMutateStock={canMutateStock}
        canImportStock={role === 'ADMIN'}
        onOpenExcelImport={() => setShowStockImportModal(true)}
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
        canViewCosts={canViewCosts}
        canViewValuation={canViewValuation}
        canMutateStock={canMutateStock}
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

      {canMutateStock && (
        <StockAdjustModal
          modal={adjustments.adjustModal}
          loading={adjustments.loadingAdjust}
          onChange={adjustments.setAdjustModal}
          onClose={adjustments.closeAdjustModal}
          onSubmit={adjustments.handleAdjustSubmit}
        />
      )}

      <LotManagerModal
        open={lotManager.lotManagerModal.open}
        product={lotManager.lotManagerModal.product}
        loading={adjustments.loadingAdjust}
        canMutateStock={canMutateStock}
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
        onVacateLot={lotManager.handleVacateLot}
        onDeleteLot={lotManager.handleDeleteLot}
        showTransferPanel={lotManager.showTransferPanel}
        onToggleTransferPanel={lotManager.toggleTransferPanel}
        onBackFromTransfer={() => lotManager.setShowTransferPanel(false)}
        transferData={lotManager.transferData}
        onTransferDataChange={lotManager.setTransferData}
        onTransferSubmit={lotManager.handleTransferSubmit}
        onClose={lotManager.closeLotManager}
      />

      {canMutateStock && (
        <QuickInventoryFloatingBar
          pendingCount={Object.keys(adjustments.pendingAdjustments).length}
          loading={adjustments.loadingAdjust}
          onDiscard={() => adjustments.setPendingAdjustments({})}
          onSave={adjustments.handleSaveQuickInventory}
        />
      )}

      {role === 'ADMIN' && (
        <ExcelImportModal
          isOpen={showStockImportModal}
          initialDomain="STOCK_INICIAL"
          onClose={() => setShowStockImportModal(false)}
          onSuccess={() => {
            void onRefresh();
            setAuditRefreshTick((t) => t + 1);
          }}
        />
      )}

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
        .wms-loc-chip {
          transition: border-color 150ms ease-out, background-color 150ms ease-out, transform 150ms ease-out;
        }
        .wms-loc-chip:hover {
          border-color: var(--text-muted) !important;
          background-color: var(--bg-app) !important;
        }
        .wms-loc-chip:active {
          transform: scale(0.98);
        }
        .wms-loc-chip:focus-visible {
          outline: 2px solid CanvasText;
          outline-offset: 2px;
        }
        .wms-loc-arrow {
          color: var(--text-muted);
          font-size: 0.72rem;
          line-height: 1;
          opacity: 0;
          transition: opacity 150ms ease-out;
        }
        .wms-loc-chip:hover .wms-loc-arrow,
        .wms-loc-chip:focus-visible .wms-loc-arrow {
          opacity: 0.85;
        }
        @media (hover: none) {
          .wms-loc-arrow {
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}
