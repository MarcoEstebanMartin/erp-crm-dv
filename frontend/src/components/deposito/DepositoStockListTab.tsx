import React from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import type { Product } from '../../types';
import { computeProductWmsBreakdown } from './wmsStockBreakdown';
import {
  extractCleanLotNumber,
  formatCleanExpirationDate,
  isGenericUntrackedLot,
  isSentinelExpiration,
} from '../stock/lotLabel';

interface DepositoStockListTabProps {
  products: Product[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onRefresh: () => void;
  onOpenStockModal: (product: Product) => void;
  onJumpToMapLocation?: (locationCode: string) => void;
}

export const DepositoStockListTab: React.FC<DepositoStockListTabProps> = ({
  products,
  searchQuery,
  setSearchQuery,
  onRefresh,
  onOpenStockModal,
  onJumpToMapLocation,
}) => {
  return (
    <div>
      <div className="actions-bar">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="input"
            placeholder="Buscar por SKU, nombre o código de barra..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn-secondary" onClick={onRefresh} title="Actualizar listado">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Artículo</th>
              <th>Ubicación WMS / Lotes</th>
              <th style={{ textAlign: 'right' }}>Stock Físico</th>
              <th style={{ textAlign: 'right' }}>Stock Mínimo</th>
              <th>Estado</th>
              <th style={{ textAlign: 'center' }}>Ajuste</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                  No se encontraron productos.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const minStock = Number(p.minStock ?? 0);
                const isOut = p.stock <= 0;
                const isLow = !isOut && minStock > 0 && p.stock < minStock;
                const activeLots = (p.lots || []).filter((l: any) => l.stock > 0);
                const trackedLots = activeLots.filter((l: any) => !isGenericUntrackedLot(l));
                const wms = computeProductWmsBreakdown(p);
                const hasLocations = wms.slotEntries.length > 0 || wms.unassignedUnits > 0;

                const statusColor = isOut
                  ? 'var(--color-danger)'
                  : isLow
                    ? 'var(--color-warning)'
                    : 'var(--color-success)';
                const statusLabel = isOut ? 'Sin Stock' : isLow ? 'Stock Bajo' : 'Stock Saludable';

                return (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.sku}</td>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {trackedLots.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {trackedLots.map((l: any) => {
                              const cleanLot = extractCleanLotNumber(l.lotNumber);
                              const hasExp = !isSentinelExpiration(l.expirationDate);
                              return (
                                <span
                                  key={l.id}
                                  className="badge"
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    backgroundColor: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                  }}
                                >
                                  {cleanLot} · {l.stock} u.
                                  {hasExp ? ` · Vto ${formatCleanExpirationDate(l.expirationDate)}` : ''}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {hasLocations ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                            {wms.slotEntries.map((entry) => (
                              <button
                                key={entry.location}
                                type="button"
                                onClick={() => onJumpToMapLocation && onJumpToMapLocation(entry.location)}
                                disabled={!onJumpToMapLocation}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  fontFamily: 'monospace',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: '#dcfce7',
                                  color: '#15803d',
                                  border: '1px solid #86efac',
                                  boxShadow: 'none',
                                  cursor: onJumpToMapLocation ? 'pointer' : 'default',
                                }}
                                title={onJumpToMapLocation ? `Ver ${entry.location} en el Mapa` : entry.location}
                              >
                                <MapPin size={12} />
                                <span>
                                  {entry.location} · {entry.units} u.{onJumpToMapLocation ? ' ↗' : ''}
                                </span>
                              </button>
                            ))}
                            {wms.unassignedUnits > 0 && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  fontSize: '0.72rem',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: '#f1f5f9',
                                  color: '#475569',
                                  border: '1px solid #cbd5e1',
                                  fontWeight: 500,
                                }}
                              >
                                Sin ubicar · {wms.unassignedUnits} u.
                              </span>
                            )}
                          </div>
                        ) : (
                          trackedLots.length === 0 && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                          )
                        )}
                      </div>
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        color: isOut ? 'var(--color-danger)' : isLow ? 'var(--color-warning)' : 'inherit',
                      }}
                    >
                      {p.stock} u.
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {minStock} u.
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          color: statusColor,
                        }}
                      >
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: statusColor,
                          }}
                        />
                        {statusLabel}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '5px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                        onClick={() => onOpenStockModal(p)}
                      >
                        Modificar Stock
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
