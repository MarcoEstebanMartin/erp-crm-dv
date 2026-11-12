import { History, Layers, MapPin } from 'lucide-react';
import { extractRubroLabel, getDisplayedStock, hasProductPendingAdjustment } from './types';
import { computeProductWmsBreakdown } from '../deposito/wmsStockBreakdown';
import { resolveProductRowValuation } from '../../utils/exactStockMath';
import {
  extractCleanLotNumber,
  formatCleanExpirationDate,
  isGenericUntrackedLot,
  isSentinelExpiration
} from './lotLabel';

interface StockInventoryRowProps {
  product: any;
  isQuickInventoryMode: boolean;
  showEmptyLots: boolean;
  pendingAdjustments: Record<string, number>;
  onPendingAdjustmentChange: (key: string, value: number) => void;
  onViewHistory: (product: any) => void;
  onOpenLotManager: (product: any) => void;
  onOpenAdjustModal: (product: any) => void;
  onJumpToMapLocation?: (locationCode: string) => void;
  canViewCosts?: boolean;
  canMutateStock?: boolean;
}

const NUMERIC_CELL_STYLE: React.CSSProperties = {
  padding: '12px 16px',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap'
};

export default function StockInventoryRow({
  product: p,
  isQuickInventoryMode,
  showEmptyLots,
  pendingAdjustments,
  onPendingAdjustmentChange,
  onViewHistory,
  onOpenLotManager,
  onOpenAdjustModal,
  onJumpToMapLocation,
  canViewCosts = true,
  canMutateStock = true
}: StockInventoryRowProps) {
  const displayedStock = getDisplayedStock(p, pendingAdjustments);
  const wms = computeProductWmsBreakdown(p, pendingAdjustments);
  const isOutOfStock = displayedStock <= 0;
  const minStock = p.minStock ?? 0;
  const isLowStock = !isOutOfStock && minStock > 0 && displayedStock < minStock;
  const cost = Number(p.costPrice) || 0;
  const hasPendingEdit = hasProductPendingAdjustment(p, pendingAdjustments);
  const valuation = resolveProductRowValuation(p, displayedStock, { hasPendingEdit, canViewCosts });

  const activeLots = (p.lots || []).filter((l: any) => {
    const pending = pendingAdjustments[`lot-${l.id}`];
    return (pending !== undefined ? pending : l.stock) > 0;
  });
  const trackedLots = activeLots.filter((l: any) => !isGenericUntrackedLot(l));

  return (
    <tr
      style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s' }}
      className="hover-bg-muted"
    >
      <td style={{ ...NUMERIC_CELL_STYLE, fontFamily: 'monospace', fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
        {p.sku}
      </td>

      <td style={{ padding: '12px 16px' }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{p.name}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ backgroundColor: 'var(--bg-app)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-secondary)', fontWeight: 500, border: '1px solid var(--border-color)' }}>
            {extractRubroLabel(p)}
          </span>
          {p.description && <span>• {p.description}</span>}
        </div>

        {canMutateStock && isQuickInventoryMode && p.lots && p.lots.length > 1 && (
          <div style={{ marginTop: '8px', padding: '10px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', fontSize: '0.76rem', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Conteo por posición / lote:
            </div>
            {p.lots
              .filter((lot: any) => showEmptyLots || lot.stock > 0 || pendingAdjustments[`lot-${lot.id}`] !== undefined)
              .map((lot: any) => {
                const val = pendingAdjustments[`lot-${lot.id}`] !== undefined ? pendingAdjustments[`lot-${lot.id}`] : lot.stock;
                const cleanLot = extractCleanLotNumber(lot.lotNumber);
                const locTag = lot.location && lot.location !== 'S/U' ? ` · ${lot.location}` : '';
                return (
                  <div key={lot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '10px' }}>
                    <span>
                      <strong>{cleanLot}{locTag}</strong>{' '}
                      <span style={{ color: 'var(--text-muted)' }}>({formatCleanExpirationDate(lot.expirationDate)})</span>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        className="input"
                        style={{ width: '70px', padding: '2px 4px', height: '24px', fontSize: '0.78rem', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
                        value={val}
                        onChange={(e) => onPendingAdjustmentChange(`lot-${lot.id}`, Number(e.target.value))}
                        min={0}
                      />
                      <span>u.</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </td>

      <td style={{ padding: '12px 16px', maxWidth: '320px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {trackedLots.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {trackedLots.map((l: any) => {
                const pending = pendingAdjustments[`lot-${l.id}`];
                const st = pending !== undefined ? pending : l.stock;
                const hasRealExp = !isSentinelExpiration(l.expirationDate);
                const expDate = hasRealExp ? new Date(l.expirationDate) : null;
                const isLExp = Boolean(expDate && expDate <= new Date());
                const thirtyDays = new Date();
                thirtyDays.setDate(thirtyDays.getDate() + 30);
                const isLWarn = Boolean(expDate && !isLExp && expDate <= thirtyDays);

                const badgeBg = isLExp ? 'var(--color-danger-bg)' : isLWarn ? 'var(--color-warning-bg)' : 'var(--bg-app)';
                const badgeColor = isLExp ? 'var(--color-danger)' : isLWarn ? 'var(--color-warning)' : 'var(--text-primary)';
                const badgeBorder = isLExp ? 'rgba(239, 68, 68, 0.25)' : isLWarn ? 'rgba(245, 158, 11, 0.25)' : 'var(--border-color)';

                return (
                  <span
                    key={l.id}
                    className="badge"
                    style={{ fontSize: '0.7rem', padding: '2px 7px', backgroundColor: badgeBg, color: badgeColor, border: `1px solid ${badgeBorder}`, borderRadius: '4px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                    title={hasRealExp ? `Vence: ${formatCleanExpirationDate(l.expirationDate)}` : undefined}
                  >
                    {extractCleanLotNumber(l.lotNumber)} · {st} u.
                  </span>
                );
              })}
            </div>
          )}

          {displayedStock > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
              {wms.slotEntries.map((entry) => (
                <button
                  key={entry.location}
                  type="button"
                  onClick={() => onJumpToMapLocation && onJumpToMapLocation(entry.location)}
                  disabled={!onJumpToMapLocation}
                  title={onJumpToMapLocation ? `Ver ${entry.location} en Mapa de Depósito` : entry.location}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: '#f0fdf4',
                    color: '#15803d',
                    border: '1px solid #bbf7d0',
                    cursor: onJumpToMapLocation ? 'pointer' : 'default'
                  }}
                >
                  <MapPin size={12} />
                  <span>{entry.location} · {entry.units} u.{onJumpToMapLocation ? ' ↗' : ''}</span>
                </button>
              ))}

              {wms.unassignedUnits > 0 && (
                <span
                  style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.7rem', fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', padding: '2px 7px', borderRadius: '4px', backgroundColor: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                  title="Mercadería disponible pendiente de asignar a un estante físico"
                >
                  Sin ubicar · {wms.unassignedUnits} u.
                </span>
              )}
            </div>
          ) : (
            trackedLots.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>
          )}
        </div>
      </td>

      <td style={{ ...NUMERIC_CELL_STYLE, textAlign: 'center' }}>
        {canMutateStock && isQuickInventoryMode && (!p.lots || p.lots.length <= 1) ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <input
              type="number"
              className="input"
              style={{ width: '76px', padding: '4px 8px', fontSize: '0.86rem', height: '30px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', fontVariantNumeric: 'tabular-nums' }}
              value={
                p.lots && p.lots.length === 1
                  ? pendingAdjustments[`lot-${p.lots[0].id}`] !== undefined
                    ? pendingAdjustments[`lot-${p.lots[0].id}`]
                    : p.lots[0].stock
                  : pendingAdjustments[`prod-${p.id}`] !== undefined
                  ? pendingAdjustments[`prod-${p.id}`]
                  : p.stock
              }
              onChange={(e) => {
                const key = p.lots && p.lots.length === 1 ? `lot-${p.lots[0].id}` : `prod-${p.id}`;
                onPendingAdjustmentChange(key, Number(e.target.value));
              }}
              min={0}
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>u.</span>
          </div>
        ) : (
          <>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: isOutOfStock ? 'var(--color-corp-red)' : isLowStock ? 'var(--color-warning)' : 'var(--text-primary)' }}>
              {displayedStock} u.
            </span>
            {isOutOfStock && <div style={{ fontSize: '0.68rem', color: 'var(--color-corp-red)', fontWeight: 600, marginTop: '2px' }}>SIN STOCK</div>}
            {isLowStock && <div style={{ fontSize: '0.68rem', color: 'var(--color-warning)', fontWeight: 600, marginTop: '2px' }}>BAJO MÍN ({minStock})</div>}
          </>
        )}
        {valuation.isWeighable && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>
            ~{valuation.estimatedTotalKg.toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg
          </div>
        )}
      </td>

      {canViewCosts && (
        <td style={{ ...NUMERIC_CELL_STYLE, textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
          ${cost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      )}

      {canViewCosts && (
        <td style={{ ...NUMERIC_CELL_STYLE, textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
          ${valuation.stockValueCost.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </td>
      )}

      <td style={{ ...NUMERIC_CELL_STYLE, textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.86rem' }}>
        ${valuation.stockValueSale.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </td>

      <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: '28px', height: '28px', padding: 0, borderRadius: '6px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            onClick={() => onViewHistory(p)}
            title="Ver Kárdex / Movimientos"
          >
            <History size={14} />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0 10px', fontSize: '0.76rem', height: '28px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
            onClick={() => onOpenLotManager(p)}
            title={canMutateStock ? 'Gestionar Lotes (Editar, Vaciar, Eliminar, Transferir)' : 'Consultar Lotes y Vencimientos'}
          >
            <Layers size={13} />
            <span>Lotes</span>
          </button>
          {canMutateStock && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0 10px', fontSize: '0.76rem', height: '28px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}
              onClick={() => onOpenAdjustModal(p)}
              title="Ajustar Stock"
            >
              Ajustar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
