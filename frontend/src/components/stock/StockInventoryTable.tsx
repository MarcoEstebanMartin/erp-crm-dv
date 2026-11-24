import React, { useEffect, useMemo, useRef, useState } from 'react';
import StockInventoryRow from './StockInventoryRow';

const INITIAL_VISIBLE_ROWS = 50;
const VISIBLE_ROWS_STEP = 50;

interface StockInventoryTableProps {
  filteredProducts: any[];
  isQuickInventoryMode: boolean;
  showEmptyLots: boolean;
  pendingAdjustments: Record<string, number>;
  onPendingAdjustmentChange: (key: string, value: number) => void;
  onViewHistory: (product: any) => void;
  onOpenLotManager: (product: any) => void;
  onOpenAdjustModal: (product: any) => void;
  onJumpToMapLocation?: (locationCode: string) => void;
  canViewCosts?: boolean;
  canViewValuation?: boolean;
  canMutateStock?: boolean;
}

const TH_BASE_STYLE: React.CSSProperties = {
  padding: '10px 16px',
  fontWeight: 600,
  fontSize: '0.75rem',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap'
};

export default function StockInventoryTable({
  filteredProducts,
  isQuickInventoryMode,
  showEmptyLots,
  pendingAdjustments,
  onPendingAdjustmentChange,
  onViewHistory,
  onOpenLotManager,
  onOpenAdjustModal,
  onJumpToMapLocation,
  canViewCosts = true,
  canViewValuation = true,
  canMutateStock = true
}: StockInventoryTableProps) {
  const columnCount = 5 + (canViewCosts ? 1 : 0) + (canViewCosts && canViewValuation ? 1 : 0) + (canViewValuation ? 1 : 0);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ROWS);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_ROWS);
  }, [filteredProducts.length]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount],
  );
  const hasMoreRows = visibleProducts.length < filteredProducts.length;

  useEffect(() => {
    if (!hasMoreRows || typeof IntersectionObserver === 'undefined') return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) => Math.min(prev + VISIBLE_ROWS_STEP, filteredProducts.length));
        }
      },
      { rootMargin: '250px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreRows, filteredProducts.length]);

  return (
    <div style={{ marginBottom: '24px' }}>
    <div
      className="table-container"
      style={{
        borderRadius: '10px',
        overflowX: 'auto',
        border: '1px solid var(--border-color)',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ backgroundColor: 'var(--bg-muted)', borderBottom: '1px solid var(--border-color)' }}>
          <tr>
            <th style={{ ...TH_BASE_STYLE, textAlign: 'left' }}>SKU</th>
            <th style={{ ...TH_BASE_STYLE, textAlign: 'left' }}>PRODUCTO</th>
            <th style={{ ...TH_BASE_STYLE, textAlign: 'left' }}>UBICACIÓN WMS / LOTES</th>
            <th style={{ ...TH_BASE_STYLE, textAlign: 'center' }}>FÍSICO</th>
            {canViewCosts && <th style={{ ...TH_BASE_STYLE, textAlign: 'right' }}>COSTO UNIT.</th>}
            {canViewCosts && canViewValuation && <th style={{ ...TH_BASE_STYLE, textAlign: 'right' }}>VALOR COSTO</th>}
            {canViewValuation && <th style={{ ...TH_BASE_STYLE, textAlign: 'right' }}>VALOR VENTA</th>}
            <th style={{ ...TH_BASE_STYLE, textAlign: 'center' }}>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.length === 0 ? (
            <tr>
              <td colSpan={columnCount} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No se encontraron productos con los filtros aplicados.
              </td>
            </tr>
          ) : (
            visibleProducts.map((p) => (
              <StockInventoryRow
                key={p.id}
                product={p}
                isQuickInventoryMode={isQuickInventoryMode}
                showEmptyLots={showEmptyLots}
                pendingAdjustments={pendingAdjustments}
                onPendingAdjustmentChange={onPendingAdjustmentChange}
                onViewHistory={onViewHistory}
                onOpenLotManager={onOpenLotManager}
                onOpenAdjustModal={onOpenAdjustModal}
                onJumpToMapLocation={onJumpToMapLocation}
                canViewCosts={canViewCosts}
                canViewValuation={canViewValuation}
                canMutateStock={canMutateStock}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
    {filteredProducts.length > 0 && (
      <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <span className="tabular-nums">Mostrando <strong>{visibleProducts.length}</strong> de <strong>{filteredProducts.length}</strong> productos</span>
        {hasMoreRows && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '0.76rem', padding: '5px 12px', borderRadius: '6px' }}
            onClick={() => setVisibleCount(filteredProducts.length)}
          >
            Mostrar todos ({filteredProducts.length})
          </button>
        )}
      </div>
    )}
    </div>
  );
}
