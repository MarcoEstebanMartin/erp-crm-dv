import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import type { Product } from '../../types';
import { computeProductWmsBreakdown } from './wmsStockBreakdown';
import {
  extractCleanLotNumber,
  formatCleanExpirationDate,
  isGenericUntrackedLot,
  isSentinelExpiration,
} from '../stock/lotLabel';
import {
  filterDepositoProducts,
  getLotDaysUntilExpiration,
  hasExpiringOrExpiredLot,
  type DepositoStockFilter,
} from './stockFilterHelpers';

interface DepositoStockListTabProps {
  products: Product[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onRefresh: () => void;
  onOpenStockModal: (product: Product) => void;
  onJumpToMapLocation?: (locationCode: string) => void;
  initialFilter?: DepositoStockFilter;
  onConsumeInitialFilter?: () => void;
}

export const DepositoStockListTab: React.FC<DepositoStockListTabProps> = ({
  products,
  searchQuery,
  setSearchQuery,
  onRefresh,
  onOpenStockModal,
  onJumpToMapLocation,
  initialFilter,
  onConsumeInitialFilter,
}) => {
  const [activeFilter, setActiveFilter] = useState<DepositoStockFilter>(initialFilter || 'ALL');

  useEffect(() => {
    if (initialFilter) {
      setActiveFilter(initialFilter);
      onConsumeInitialFilter?.();
    }
  }, [initialFilter, onConsumeInitialFilter]);

  const counts = useMemo(() => {
    let out = 0;
    let low = 0;
    let expiring = 0;
    let unassigned = 0;
    for (const p of products) {
      const stock = Number(p.stock || 0);
      const min = Number(p.minStock || 0);
      if (stock <= 0) out += 1;
      else if (min > 0 && stock < min) low += 1;
      if (hasExpiringOrExpiredLot(p)) expiring += 1;
      if (computeProductWmsBreakdown(p).unassignedUnits > 0) unassigned += 1;
    }
    return { all: products.length, out, low, expiring, unassigned };
  }, [products]);

  const visibleProducts = useMemo(
    () => filterDepositoProducts(products, activeFilter),
    [products, activeFilter],
  );

  const filterChips: Array<{ id: DepositoStockFilter; label: string; count: number; danger?: boolean }> = [
    { id: 'ALL', label: 'Todos', count: counts.all },
    { id: 'OUT', label: 'Sin stock', count: counts.out, danger: counts.out > 0 },
    { id: 'LOW', label: 'Bajo', count: counts.low },
    { id: 'EXPIRING', label: 'Por vencer', count: counts.expiring, danger: counts.expiring > 0 },
    { id: 'UNASSIGNED', label: 'Sin ubicar', count: counts.unassigned },
  ];

  return (
    <div className="dep-shell">
      <search aria-label="Filtrar stock" className="dep-toolbar">
        <div className="dep-search-row">
          <div className="dep-search-box">
            <label htmlFor="deposito-stock-search" className="visually-hidden">Buscar artículo</label>
            <Search size={16} aria-hidden="true" className="dep-search-icon" />
            <input
              id="deposito-stock-search"
              type="search"
              className="input"
              placeholder="SKU, artículo o código de barras..."
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ minBlockSize: '42px', minInlineSize: '42px', padding: '0 10px' }}
            onClick={onRefresh}
            aria-label="Actualizar"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="dep-chips-row">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`dep-chip ${chip.danger ? 'dep-chip--danger' : ''} ${activeFilter === chip.id ? 'dep-chip--active' : ''}`}
              onClick={() => setActiveFilter(chip.id)}
            >
              <span>{chip.label}</span>
              <span className="tabular-nums" style={{ opacity: 0.78 }}>{chip.count}</span>
            </button>
          ))}
        </div>
      </search>

      {visibleProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', background: 'var(--bg-card)', border: '1px dashed var(--border-color)', borderRadius: '10px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No se encontraron artículos.
        </div>
      ) : (
        <div className="dep-orders-grid" role="list" aria-label="Inventario físico">
          {visibleProducts.map((p) => {
            const minStock = Number(p.minStock ?? 0);
            const isOut = p.stock <= 0;
            const isLow = !isOut && minStock > 0 && p.stock < minStock;
            const activeLots = (p.lots || []).filter((l: any) => l.stock > 0);
            const trackedLots = activeLots.filter((l: any) => !isGenericUntrackedLot(l));
            const wms = computeProductWmsBreakdown(p);
            const statusColor = isOut ? 'var(--color-danger)' : isLow ? 'var(--color-warning)' : 'var(--color-success)';

            return (
              <article
                key={p.id}
                role="listitem"
                className="dep-order-card"
                style={{ borderInlineStartColor: statusColor }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ minInlineSize: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', overflowWrap: 'break-word' }}>
                      {p.name}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {p.sku}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 800, color: isOut ? 'var(--color-danger)' : isLow ? 'var(--color-warning)' : 'var(--text-primary)' }}>
                      {p.stock} u.
                    </div>
                    {minStock > 0 && (
                      <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Mín {minStock}
                      </div>
                    )}
                  </div>
                </div>

                {(wms.slotEntries.length > 0 || wms.unassignedUnits > 0 || trackedLots.length > 0) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(wms.slotEntries.length > 0 || wms.unassignedUnits > 0) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {wms.slotEntries.map((entry) => (
                          <button
                            key={entry.location}
                            type="button"
                            onClick={() => onJumpToMapLocation?.(entry.location)}
                            disabled={!onJumpToMapLocation}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              fontSize: '0.74rem', fontWeight: 700, fontFamily: 'monospace',
                              padding: '3px 8px', borderRadius: '6px',
                              backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0',
                              cursor: onJumpToMapLocation ? 'pointer' : 'default',
                              touchAction: 'manipulation',
                            }}
                            title={onJumpToMapLocation ? `Ver ${entry.location} en el Mapa` : entry.location}
                          >
                            <MapPin size={12} aria-hidden="true" />
                            <span>{entry.location} · {entry.units} u.</span>
                          </button>
                        ))}
                        {wms.unassignedUnits > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.73rem', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 600 }}>
                            Sin ubicar · {wms.unassignedUnits} u.
                          </span>
                        )}
                      </div>
                    )}

                    {trackedLots.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {trackedLots.map((l: any) => {
                          const cleanLot = extractCleanLotNumber(l.lotNumber);
                          const hasExp = !isSentinelExpiration(l.expirationDate);
                          const daysLeft = getLotDaysUntilExpiration(l.expirationDate);
                          const isExpired = daysLeft !== null && daysLeft <= 0;
                          const isSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;
                          return (
                            <span
                              key={l.id}
                              style={{
                                fontSize: '0.72rem',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                backgroundColor: isExpired ? '#fef2f2' : isSoon ? '#fffbeb' : 'var(--bg-secondary)',
                                border: isExpired ? '1px solid #fecaca' : isSoon ? '1px solid #fde68a' : '1px solid var(--border-color)',
                                color: isExpired ? '#b91c1c' : isSoon ? '#b45309' : 'var(--text-secondary)',
                                fontWeight: isExpired || isSoon ? 700 : 500,
                              }}
                            >
                              {cleanLot} · {l.stock} u.
                              {hasExp ? ` · Vto ${formatCleanExpirationDate(l.expirationDate)}` : ''}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ minBlockSize: '38px', padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600 }}
                    onClick={() => onOpenStockModal(p)}
                  >
                    <SlidersHorizontal size={14} aria-hidden="true" />
                    <span>Ajustar</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
