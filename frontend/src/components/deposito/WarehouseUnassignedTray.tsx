import React, { useMemo, useState } from 'react';
import { PackagePlus, Search, X } from 'lucide-react';
import { formatCleanExpirationDate, isSentinelExpiration } from '../stock/lotLabel';
import type { UnassignedTrayItem } from './wmsMapHelpers';

interface WarehouseUnassignedTrayProps {
  items: UnassignedTrayItem[];
  selectedItem: UnassignedTrayItem | null;
  onSelectItem: (item: UnassignedTrayItem | null) => void;
}

export const WarehouseUnassignedTray: React.FC<WarehouseUnassignedTrayProps> = ({
  items,
  selectedItem,
  onSelectItem,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.product.name.toLowerCase().includes(q) ||
        i.product.sku.toLowerCase().includes(q) ||
        i.lotNumber.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div
      style={{
        width: '340px',
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '8px',
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-primary)',
          }}
        >
          <PackagePlus size={16} aria-hidden="true" />
          Por Ubicar (S/U)
        </h4>
        <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
          {items.length}
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        <label htmlFor="wms-tray-search" className="visually-hidden">
          Filtrar mercadería sin ubicar
        </label>
        <input
          id="wms-tray-search"
          type="search"
          className="form-control"
          placeholder="Buscar SKU o producto..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          style={{ height: '33px', fontSize: '0.8rem', paddingLeft: '28px' }}
        />
        <Search
          size={13}
          aria-hidden="true"
          style={{ position: 'absolute', left: '9px', top: '10px', color: '#94a3b8' }}
        />
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            padding: '24px 10px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.84rem',
          }}
        >
          {items.length === 0 ? 'Todo el stock está ubicado en el mapa.' : 'Sin coincidencias.'}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '430px',
            overflowY: 'auto',
          }}
        >
          {filtered.map((item) => {
            const isActive = selectedItem?.key === item.key;
            const sentinel = isSentinelExpiration(item.expirationDate);
            const expColor =
              item.health === 'EXPIRED'
                ? '#dc2626'
                : item.health === 'EXPIRING_SOON'
                  ? '#b45309'
                  : 'var(--text-secondary)';
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectItem(isActive ? null : item)}
                style={{
                  textAlign: 'left',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: isActive ? '2px solid #007AFF' : '1px solid var(--border-color)',
                  backgroundColor: isActive ? '#eff6ff' : '#fafafa',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '6px',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                    [{item.product.sku}] {item.product.name}
                  </span>
                  <span
                    className="badge badge-success"
                    style={{ fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}
                  >
                    {item.units} u.
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.73rem',
                    color: expColor,
                    fontWeight: item.health === 'OK' ? 500 : 700,
                  }}
                >
                  <span>
                    Lote: {item.lotNumber} ·{' '}
                    {sentinel
                      ? 'Sin vencimiento'
                      : item.health === 'EXPIRED'
                        ? `Vencido (${formatCleanExpirationDate(item.expirationDate)})`
                        : `Vence: ${formatCleanExpirationDate(item.expirationDate)}`}
                  </span>
                  {isActive && <X size={13} aria-hidden="true" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
