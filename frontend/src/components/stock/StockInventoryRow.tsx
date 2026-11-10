import { History, Layers } from 'lucide-react';
import { extractRubroLabel, getDisplayedStock } from './types';

interface StockInventoryRowProps {
  product: any;
  isQuickInventoryMode: boolean;
  showEmptyLots: boolean;
  pendingAdjustments: Record<string, number>;
  onPendingAdjustmentChange: (key: string, value: number) => void;
  onViewHistory: (product: any) => void;
  onOpenLotManager: (product: any) => void;
  onOpenAdjustModal: (product: any) => void;
}

export default function StockInventoryRow({
  product: p,
  isQuickInventoryMode,
  showEmptyLots,
  pendingAdjustments,
  onPendingAdjustmentChange,
  onViewHistory,
  onOpenLotManager,
  onOpenAdjustModal
}: StockInventoryRowProps) {
  const displayedStock = getDisplayedStock(p, pendingAdjustments);
  const isOutOfStock = displayedStock <= 0;
  const isLowStock = !isOutOfStock && displayedStock <= p.minStock;
  const cost = Number(p.costPrice) || 0;
  const listPrice = Number(p.listPrice) || 0;
  const stockValCost = displayedStock * cost;
  const stockValRetail = displayedStock * listPrice;
  const activeLots = (p.lots || []).filter((l: any) => {
    const pending = pendingAdjustments[`lot-${l.id}`];
    const st = pending !== undefined ? pending : l.stock;
    return st > 0;
  });

  return (
    <tr
      style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }}
      className="hover-bg-muted"
    >
      {/* SKU */}
      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
        {p.sku}
      </td>

      {/* Producto */}
      <td style={{ padding: '12px 16px' }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{p.name}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ backgroundColor: 'var(--bg-app)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {extractRubroLabel(p)}
          </span>
          {p.description && <span>• {p.description}</span>}
        </div>

        {isQuickInventoryMode && p.lots && p.lots.length > 1 && (
          <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#F3F4F6', borderRadius: '6px', fontSize: '0.78rem', border: '1px dashed #D1D5DB' }}>
            <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Ajuste de Lotes Coexistentes:
            </div>
            {p.lots
              .filter((lot: any) => showEmptyLots || lot.stock > 0 || pendingAdjustments[`lot-${lot.id}`] !== undefined)
              .map((lot: any) => {
                const val = pendingAdjustments[`lot-${lot.id}`] !== undefined ? pendingAdjustments[`lot-${lot.id}`] : lot.stock;
                return (
                  <div key={lot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '10px' }}>
                    <span>
                      Lote <strong>{lot.lotNumber}</strong>{' '}
                      <span style={{ color: 'var(--text-muted)' }}>
                        (Vence: {new Date(lot.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })})
                      </span>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        className="input"
                        style={{ width: '70px', padding: '2px 4px', height: '24px', fontSize: '0.78rem', textAlign: 'center' }}
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

      {/* Lotes activos */}
      <td style={{ padding: '12px 16px', maxWidth: '280px' }}>
        {activeLots.length === 0 ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin lotes activos</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {activeLots.map((l: any) => {
              const pending = pendingAdjustments[`lot-${l.id}`];
              const st = pending !== undefined ? pending : l.stock;
              const isLExp = new Date(l.expirationDate) <= new Date();
              const thirtyDays = new Date();
              thirtyDays.setDate(thirtyDays.getDate() + 30);
              const isLWarn = !isLExp && new Date(l.expirationDate) <= thirtyDays;

              let badgeBg = 'var(--bg-app)';
              let badgeColor = 'var(--text-primary)';
              let badgeBorder = 'var(--border-color)';

              if (isLExp) {
                badgeBg = 'var(--color-danger-bg)';
                badgeColor = 'var(--color-danger)';
                badgeBorder = 'rgba(239, 68, 68, 0.2)';
              } else if (isLWarn) {
                badgeBg = 'var(--color-warning-bg)';
                badgeColor = 'var(--color-warning)';
                badgeBorder = 'rgba(245, 158, 11, 0.2)';
              }

              return (
                <span
                  key={l.id}
                  className="badge"
                  style={{ fontSize: '0.7rem', padding: '2px 6px', backgroundColor: badgeBg, color: badgeColor, border: `1px solid ${badgeBorder}`, borderRadius: '4px' }}
                  title={`Vence: ${new Date(l.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}`}
                >
                  {l.lotNumber} ({st} u.)
                </span>
              );
            })}
          </div>
        )}
      </td>

      {/* Stock Físico */}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        {isQuickInventoryMode && (!p.lots || p.lots.length <= 1) ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <input
              type="number"
              className="input"
              style={{ width: '80px', padding: '4px 8px', fontSize: '0.88rem', height: '32px', textAlign: 'center', border: '1px solid var(--accent-color)', borderRadius: '6px' }}
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
                const val = Number(e.target.value);
                const key = p.lots && p.lots.length === 1 ? `lot-${p.lots[0].id}` : `prod-${p.id}`;
                onPendingAdjustmentChange(key, val);
              }}
              min={0}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>u.</span>
          </div>
        ) : (
          <>
            <span
              style={{
                fontWeight: 700,
                fontSize: '0.92rem',
                color: isOutOfStock ? 'var(--color-danger)' : isLowStock ? 'var(--color-warning)' : 'var(--text-primary)'
              }}
            >
              {displayedStock} u.
            </span>
            {isOutOfStock && <div style={{ fontSize: '0.68rem', color: 'var(--color-danger)', fontWeight: 600, marginTop: '2px' }}>SIN STOCK</div>}
            {isLowStock && <div style={{ fontSize: '0.68rem', color: 'var(--color-warning)', fontWeight: 600, marginTop: '2px' }}>BAJO MÍN ({p.minStock})</div>}
          </>
        )}
      </td>

      {/* Costo Unitario */}
      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
        ${cost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>

      {/* Costo Total */}
      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
        ${stockValCost.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </td>

      {/* Valor Venta */}
      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
        ${stockValRetail.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </td>

      {/* Acciones */}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', gap: '6px' }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '6px', borderRadius: '6px', color: 'var(--text-secondary)' }}
            onClick={() => onViewHistory(p)}
            title="Ver Kárdex / Movimientos"
          >
            <History size={15} />
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.78rem', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => onOpenLotManager(p)}
            title="Gestionar Lotes (Editar, Eliminar, Transferir)"
          >
            <Layers size={13} />
            <span>Lotes</span>
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.78rem', height: '28px', borderRadius: '6px' }}
            onClick={() => onOpenAdjustModal(p)}
            title="Ajustar Stock"
          >
            Ajustar
          </button>
        </div>
      </td>
    </tr>
  );
}
