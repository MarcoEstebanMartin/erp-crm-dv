import React from 'react';
import StockInventoryRow from './StockInventoryRow';

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
  onJumpToMapLocation
}: StockInventoryTableProps) {
  return (
    <div
      className="table-container"
      style={{
        borderRadius: '10px',
        overflowX: 'auto',
        border: '1px solid var(--border-color)',
        marginBottom: '24px'
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ backgroundColor: 'var(--bg-muted)', borderBottom: '1px solid var(--border-color)' }}>
          <tr>
            <th style={{ ...TH_BASE_STYLE, textAlign: 'left' }}>SKU</th>
            <th style={{ ...TH_BASE_STYLE, textAlign: 'left' }}>PRODUCTO</th>
            <th style={{ ...TH_BASE_STYLE, textAlign: 'left' }}>UBICACIÓN WMS / LOTES</th>
            <th style={{ ...TH_BASE_STYLE, textAlign: 'center' }}>FÍSICO</th>
            <th style={{ ...TH_BASE_STYLE, textAlign: 'right' }}>COSTO UNIT.</th>
            <th style={{ ...TH_BASE_STYLE, textAlign: 'right' }}>VALOR COSTO</th>
            <th style={{ ...TH_BASE_STYLE, textAlign: 'right' }}>VALOR VENTA</th>
            <th style={{ ...TH_BASE_STYLE, textAlign: 'center' }}>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No se encontraron productos con los filtros aplicados.
              </td>
            </tr>
          ) : (
            filteredProducts.map((p) => (
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
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
