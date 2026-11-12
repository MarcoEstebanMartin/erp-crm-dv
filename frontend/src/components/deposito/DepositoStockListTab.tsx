import React from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import type { Product } from '../../types';
import { computeProductWmsBreakdown } from './wmsStockBreakdown';

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
        <button className="btn btn-secondary" onClick={onRefresh}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Artículo</th>
              <th>Ubicación Principal</th>
              <th>Lotes en Góndola</th>
              <th>Stock Físico Total</th>
              <th>Stock Mínimo</th>
              <th>Estado</th>
              <th>Ajuste</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '24px 0' }}>
                  No se encontraron productos.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const isLow = p.stock <= p.minStock;
                const activeLots = (p.lots || []).filter((l: any) => l.stock > 0);
                const wms = computeProductWmsBreakdown(p);
                return (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.sku}</td>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {wms.slotEntries.map((entry) => (
                          <button
                            key={entry.location}
                            type="button"
                            onClick={() => onJumpToMapLocation && onJumpToMapLocation(entry.location)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                              border: '1px solid #86efac',
                              cursor: onJumpToMapLocation ? 'pointer' : 'default',
                            }}
                            title="Hacé clic para ver este Slot en el Mapa 3D"
                          >
                            <MapPin size={12} /> {entry.location} ({entry.units} u.) ↗
                          </button>
                        ))}
                        {wms.unassignedUnits > 0 && (
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.72rem',
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                              border: '1px solid #cbd5e1',
                              fontWeight: 600,
                            }}
                          >
                            📦 S/U: {wms.unassignedUnits} u.
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {activeLots.length === 0 ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Sin lotes activos
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {activeLots.map((l: any) => (
                            <span
                              key={l.id}
                              className="badge"
                              style={{
                                fontSize: '0.75rem',
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                              }}
                            >
                              {l.lotNumber} ({l.stock} u. - V:{' '}
                              {new Date(l.expirationDate).toLocaleDateString('es-AR', {
                                timeZone: 'UTC',
                              })}
                              )
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: isLow ? 'var(--accent-color)' : 'inherit' }}>
                      {p.stock} u.
                    </td>
                    <td>{p.minStock} u.</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 500,
                          color: isLow ? 'var(--color-warning)' : 'var(--color-success)',
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: isLow ? 'var(--color-warning)' : 'var(--color-success)',
                          }}
                        />
                        {isLow ? 'Stock Crítico' : 'Stock Saludable'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
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
