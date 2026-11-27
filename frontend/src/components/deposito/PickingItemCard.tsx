import React from 'react';
import { AlertTriangle, Check, MapPin, Minus, Plus } from 'lucide-react';
import { detectWeightAnomaly, getProductLocation } from './depositoHelpers';
import {
  extractCleanLotNumber,
  formatCleanExpirationDate,
  formatWmsLocationCode,
  isGenericUntrackedLot,
  isSentinelExpiration,
} from '../stock/lotLabel';

interface PickingItemCardProps {
  item: any;
  itemAssignments: Record<number, number>;
  confirmedLocations: Record<number, boolean>;
  setConfirmedLocations: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  weightValue: number;
  onWeightChange: (weight: number) => void;
  onFIFOAutoFill: (item: any) => void;
  onLotQtyChange: (orderItemId: number, lotId: number, value: number, maxStock: number) => void;
  onJumpToMapLocation?: (locationCode: string) => void;
}

export const PickingItemCard: React.FC<PickingItemCardProps> = ({
  item,
  itemAssignments,
  confirmedLocations,
  setConfirmedLocations,
  weightValue,
  onWeightChange,
  onFIFOAutoFill,
  onLotQtyChange,
  onJumpToMapLocation,
}) => {
  const productLots = item.product?.lots || [];
  const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
  const isDone = assignedSum === item.quantity;
  const isPartial = assignedSum > 0 && assignedSum < item.quantity;
  const isLowStock = item.product ? Number(item.product.stock || 0) < item.quantity : false;

  const itemZone = item.product?.pickingZone || item.product?.rubro?.pickingZone || 'CAJAS';
  const unitsPerBox = item.product?.unitsPerBox || 1;
  const primaryLocation = getProductLocation(item.product);

  let packingLabel = 'Secos';
  if (unitsPerBox > 1 && item.quantity % unitsPerBox === 0) {
    packingLabel = `${item.quantity / unitsPerBox} cj`;
  } else if (itemZone === 'FRIO') {
    packingLabel = 'Frío';
  } else if (itemZone === 'TABLA') {
    packingLabel = 'Tabla';
  }

  const anomaly = item.product?.isPesable
    ? detectWeightAnomaly(weightValue, item.quantity, item.product?.approximateWeight)
    : { isAnomaly: false, expectedKg: 0, suggestedKg: null };

  const visibleLots = productLots.filter(
    (lot: any) => Number(lot.stock || 0) > 0 || (itemAssignments[lot.id] || 0) > 0,
  );
  const now = new Date();
  const todayDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const cardClass = isDone
    ? 'dep-item-card dep-item-card--done'
    : isPartial
      ? 'dep-item-card dep-item-card--partial'
      : 'dep-item-card';

  return (
    <article className={cardClass}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ minInlineSize: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-primary)', overflowWrap: 'break-word' }}>
            {item.product?.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {item.product?.sku}
            </span>
            {primaryLocation !== 'S/U' && (
              onJumpToMapLocation ? (
                <button
                  type="button"
                  onClick={() => onJumpToMapLocation(primaryLocation)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '2px 8px', borderRadius: '6px', fontSize: '0.74rem',
                    fontFamily: 'monospace', fontWeight: 700,
                    background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1',
                    cursor: 'pointer', touchAction: 'manipulation',
                  }}
                  title="Ver ubicación en el mapa"
                >
                  <MapPin size={12} aria-hidden="true" />
                  <span>{formatWmsLocationCode(primaryLocation)}</span>
                </button>
              ) : (
                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.74rem', fontFamily: 'monospace', fontWeight: 700, background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1' }}>
                  {formatWmsLocationCode(primaryLocation)}
                </span>
              )
            )}
            <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', borderRadius: '6px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
              {packingLabel}
            </span>
            {isLowStock && (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                Stock {item.product?.stock ?? 0} u.
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
          <span
            className="tabular-nums"
            style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              color: isDone ? 'var(--color-success)' : isPartial ? 'var(--color-warning)' : 'var(--text-primary)',
            }}
          >
            {assignedSum} / {item.quantity}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.76rem', minBlockSize: '32px' }}
            onClick={() => onFIFOAutoFill(item)}
            disabled={visibleLots.length === 0}
          >
            {isDone ? 'Reaplicar FIFO' : 'Auto FIFO'}
          </button>
        </div>
      </div>

      {visibleLots.length === 0 ? (
        <div style={{ fontSize: '0.82rem', color: 'var(--color-corp-red)', fontWeight: 600 }}>
          Sin lotes con stock disponible.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {visibleLots.map((lot: any) => {
            const qty = itemAssignments[lot.id] || 0;
            const hasShelf = Boolean(lot.location && lot.location !== 'S/U');
            const isConfirmed = !hasShelf || confirmedLocations[lot.id];
            const isGeneric = isGenericUntrackedLot(lot);
            const cleanLot = extractCleanLotNumber(lot.lotNumber);
            const hasRealExp = !isSentinelExpiration(lot.expirationDate);
            const expObj = hasRealExp ? new Date(lot.expirationDate) : null;
            const isExpired = Boolean(
              expObj &&
                !Number.isNaN(expObj.getTime()) &&
                Date.UTC(expObj.getUTCFullYear(), expObj.getUTCMonth(), expObj.getUTCDate()) <= todayDay,
            );
            const maxAllowed = Math.min(Number(lot.stock || 0), item.quantity);

            return (
              <div key={lot.id} className="dep-lot-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                  {hasShelf ? (
                    <button
                      type="button"
                      onClick={() => setConfirmedLocations((prev) => ({ ...prev, [lot.id]: !prev[lot.id] }))}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 8px', borderRadius: '6px', fontSize: '0.74rem',
                        fontFamily: 'monospace', fontWeight: 700, cursor: 'pointer',
                        background: isConfirmed ? '#dcfce7' : '#fef3c7',
                        color: isConfirmed ? '#166534' : '#92400e',
                        border: isConfirmed ? '1px solid #86efac' : '1px solid #fcd34d',
                        touchAction: 'manipulation',
                      }}
                    >
                      {isConfirmed && <Check size={12} aria-hidden="true" />}
                      <span>{lot.location}</span>
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {isGeneric ? 'Sin ubicar' : cleanLot}
                    </span>
                  )}
                  {!isGeneric && hasShelf && (
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{cleanLot}</span>
                  )}
                  <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {lot.stock} u.
                  </span>
                  {hasRealExp && (
                    <span style={{ color: isExpired ? '#dc2626' : 'var(--text-secondary)', fontWeight: isExpired ? 700 : 400 }}>
                      Vto {formatCleanExpirationDate(lot.expirationDate)}
                    </span>
                  )}
                  {isExpired && (
                    <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px' }}>
                      VENCIDO
                    </span>
                  )}
                </div>

                <div className="dep-stepper">
                  <button
                    type="button"
                    className="dep-stepper-btn"
                    aria-label={`Restar unidad de ${item.product?.name}`}
                    disabled={!isConfirmed || isExpired || qty <= 0}
                    onClick={() => onLotQtyChange(item.id, lot.id, Math.max(0, qty - 1), lot.stock)}
                  >
                    <Minus size={14} aria-hidden="true" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="input tabular-nums"
                    aria-label={`Cantidad lote ${cleanLot} para ${item.product?.name}`}
                    style={{ width: '58px', padding: '4px', fontSize: '0.88rem', minBlockSize: '36px', textAlign: 'center', fontWeight: 700, opacity: isConfirmed && !isExpired ? 1 : 0.45 }}
                    min={0}
                    max={lot.stock}
                    value={qty || ''}
                    onChange={(e) => onLotQtyChange(item.id, lot.id, Number(e.target.value), lot.stock)}
                    placeholder="0"
                    disabled={!isConfirmed || isExpired}
                  />
                  <button
                    type="button"
                    className="dep-stepper-btn"
                    aria-label={`Sumar unidad de ${item.product?.name}`}
                    disabled={!isConfirmed || isExpired || qty >= maxAllowed}
                    onClick={() => onLotQtyChange(item.id, lot.id, Math.min(lot.stock, qty + 1), lot.stock)}
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {item.product?.isPesable && (
        <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <label htmlFor={`weight-${item.id}`} style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Peso real (Kg)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                id={`weight-${item.id}`}
                type="number"
                inputMode="decimal"
                step="0.001"
                className="input tabular-nums"
                style={{ width: '108px', textAlign: 'right', fontWeight: 700, minBlockSize: '40px' }}
                placeholder={item.product?.approximateWeight ? `~${(Number(item.quantity) * Number(item.product.approximateWeight)).toFixed(2)}` : '0.000'}
                value={weightValue || ''}
                onChange={(e) => onWeightChange(Number(e.target.value))}
              />
              <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Kg</span>
            </div>
          </div>

          {anomaly.isAnomaly && (
            <div role="alert" style={{ marginTop: '8px', padding: '8px 10px', backgroundColor: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#92400E', fontWeight: 600 }}>
                <AlertTriangle size={14} aria-hidden="true" />
                <span>Inusual: {weightValue} kg (esperado ~{anomaly.expectedKg} kg)</span>
              </div>
              {anomaly.suggestedKg !== null && (
                <button
                  type="button"
                  className="btn"
                  style={{ backgroundColor: '#D97706', color: '#fff', fontSize: '0.75rem', padding: '5px 10px', fontWeight: 700, borderRadius: '6px' }}
                  onClick={() => onWeightChange(anomaly.suggestedKg!)}
                >
                  Corregir ({anomaly.suggestedKg} kg)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
