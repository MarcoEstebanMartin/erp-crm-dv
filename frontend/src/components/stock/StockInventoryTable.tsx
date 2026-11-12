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
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        marginBottom: '24px'
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ backgroundColor: 'var(--bg-muted)' }}>
          <tr>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>SKU</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>PRODUCTO</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>LOTES Y UBICACIÓN WMS</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>FÍSICO</th>
            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>COSTO UNIT.</th>
            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>VALOR COSTO</th>
            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>VALOR VENTA</th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
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
