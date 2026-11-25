import React from 'react';
import { ArrowLeft, Check, Zap } from 'lucide-react';
import { sortItemsByOptimalRoute } from './depositoHelpers';
import { PickingItemCard } from './PickingItemCard';

interface PickingActiveOrderViewProps {
  selectedOrder: any;
  selectedZone: string;
  setSelectedZone: (zone: string) => void;
  lotAssignments: Record<number, Record<number, number>>;
  confirmedLocations: Record<number, boolean>;
  setConfirmedLocations: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  pesableWeights: Record<number, number>;
  setPesableWeights: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  isOrderFullyAssigned: boolean;
  onBack: () => void;
  onFIFOAutoFill: (item: any) => void;
  onFIFOAutoFillAll: () => void;
  onLotQtyChange: (orderItemId: number, lotId: number, value: number, maxStock: number) => void;
  onFinishPicking: (orderId: number) => void;
  onJumpToMapLocation?: (locationCode: string) => void;
}

const ZONE_DEFS = [
  { id: 'ALL', label: 'Todos' },
  { id: 'FRIO', label: 'Frío' },
  { id: 'TABLA', label: 'Tabla' },
  { id: 'CAJAS', label: 'Secos' },
];

export const PickingActiveOrderView: React.FC<PickingActiveOrderViewProps> = ({
  selectedOrder,
  selectedZone,
  setSelectedZone,
  lotAssignments,
  confirmedLocations,
  setConfirmedLocations,
  pesableWeights,
  setPesableWeights,
  isOrderFullyAssigned,
  onBack,
  onFIFOAutoFill,
  onFIFOAutoFillAll,
  onLotQtyChange,
  onFinishPicking,
  onJumpToMapLocation,
}) => {
  const getItemZone = (i: any) => i.product?.pickingZone || i.product?.rubro?.pickingZone || 'CAJAS';

  const filteredItems = sortItemsByOptimalRoute(
    selectedOrder.items.filter((item: any) => selectedZone === 'ALL' || getItemZone(item) === selectedZone),
  );

  const distinctZones = new Set(selectedOrder.items.map(getItemZone));
  const countZone = (zId: string) =>
    zId === 'ALL'
      ? selectedOrder.items.length
      : selectedOrder.items.filter((i: any) => getItemZone(i) === zId).length;

  const totalItemsCount = selectedOrder.items.length;
  const itemsPreparedCount = selectedOrder.items.filter((item: any) => {
    const assignedSum = Object.values(lotAssignments[item.id] || {}).reduce((sum: number, qty) => sum + (qty || 0), 0);
    return assignedSum === item.quantity;
  }).length;
  const itemsPartialCount = selectedOrder.items.filter((item: any) => {
    const assignedSum = Object.values(lotAssignments[item.id] || {}).reduce((sum: number, qty) => sum + (qty || 0), 0);
    return assignedSum > 0 && assignedSum < item.quantity;
  }).length;
  const progressPercent =
    totalItemsCount > 0 ? Math.round(((itemsPreparedCount + itemsPartialCount * 0.5) / totalItemsCount) * 100) : 0;

  const clientName = selectedOrder.client?.name || selectedOrder.persona?.name || 'Cliente';
  const routeLabel = selectedOrder.persona?.route?.trim() || 'Retiro depósito';

  return (
    <div className="dep-shell">
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minInlineSize: 0 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 10px', minBlockSize: '38px' }}
              onClick={onBack}
              aria-label="Volver a pedidos"
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
            <div style={{ minInlineSize: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.02rem' }}>
                  #{selectedOrder.id}
                </span>
                <span style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
                  {clientName}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {routeLabel}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ minBlockSize: '38px', fontSize: '0.82rem', fontWeight: 600 }}
            onClick={onFIFOAutoFillAll}
          >
            <Zap size={14} aria-hidden="true" />
            <span>Auto FIFO</span>
          </button>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Progreso</span>
            <span className="tabular-nums" style={{ fontWeight: 700, color: itemsPreparedCount === totalItemsCount ? 'var(--color-success)' : 'var(--text-primary)' }}>
              {itemsPreparedCount} / {totalItemsCount} listos
            </span>
          </div>
          <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: itemsPreparedCount === totalItemsCount ? 'var(--color-success)' : '#111827',
                transition: 'width 0.25s ease',
              }}
            />
          </div>
        </div>

        {distinctZones.size > 1 && (
          <div className="dep-chips-row">
            {ZONE_DEFS.filter((z) => z.id === 'ALL' || countZone(z.id) > 0).map((zone) => (
              <button
                key={zone.id}
                type="button"
                className={`dep-chip ${selectedZone === zone.id ? 'dep-chip--active' : ''}`}
                onClick={() => setSelectedZone(zone.id)}
              >
                <span>{zone.label}</span>
                <span className="tabular-nums" style={{ opacity: 0.75 }}>{countZone(zone.id)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="dep-picking-items" role="list" aria-label="Artículos del pedido">
        {filteredItems.map((item: any) => (
          <PickingItemCard
            key={item.id}
            item={item}
            itemAssignments={lotAssignments[item.id] || {}}
            confirmedLocations={confirmedLocations}
            setConfirmedLocations={setConfirmedLocations}
            weightValue={Number(pesableWeights[item.id] || 0)}
            onWeightChange={(w) => setPesableWeights((prev) => ({ ...prev, [item.id]: w }))}
            onFIFOAutoFill={onFIFOAutoFill}
            onLotQtyChange={onLotQtyChange}
            onJumpToMapLocation={onJumpToMapLocation}
          />
        ))}
      </div>

      <div className="dep-sticky-footer">
        <button type="button" className="btn btn-secondary" style={{ minBlockSize: '44px' }} onClick={onBack}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ minBlockSize: '44px', flex: '1 1 200px', maxWidth: '320px' }}
          onClick={() => onFinishPicking(selectedOrder.id)}
          disabled={!isOrderFullyAssigned}
        >
          <Check size={16} aria-hidden="true" />
          <span>Cerrar bultos</span>
        </button>
      </div>
    </div>
  );
};
