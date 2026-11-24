import type { FC } from 'react';
import { formatARS } from '../../utils/format';

export interface StoppedBuyingSuggestion {
  productId: number;
  sku: string;
  name: string;
  listPrice: number;
  stock: number;
  timesBought: number;
  daysSinceLastBought: number;
}

export interface CrossSellSuggestion {
  productId: number;
  sku: string;
  name: string;
  listPrice: number;
  stock: number;
  peerClientsCount: number;
  affinityPct: number;
  basedOnProductName: string;
}

export interface ClientRecommendationItem {
  clientId: number;
  clientName: string;
  sellerName: string | null;
  totalRevenue: number;
  stoppedBuying: StoppedBuyingSuggestion[];
  crossSell: CrossSellSuggestion[];
}

interface ClientRecommendationsPanelProps {
  items: ClientRecommendationItem[];
  selectedClientId: number | null;
  onSelectClient: (clientId: number) => void;
}

export const ClientRecommendationsPanel: FC<ClientRecommendationsPanelProps> = ({
  items,
  selectedClientId,
  onSelectClient,
}) => {
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: '32px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: '0.88rem',
          backgroundColor: 'var(--background-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
        }}
      >
        Sin sugerencias activas para el criterio actual.
      </div>
    );
  }

  const activeClient =
    items.find((c) => c.clientId === selectedClientId) || items[0];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(240px, 320px) minmax(0, 1fr)',
        gap: '16px',
        alignItems: 'start',
      }}
    >
      <div
        role="listbox"
        aria-label="Clientes con sugerencias"
        style={{
          backgroundColor: 'var(--background-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          maxHeight: '520px',
          overflowY: 'auto',
        }}
      >
        {items.map((client) => {
          const isSelected = client.clientId === activeClient.clientId;
          const totalSignals = client.stoppedBuying.length + client.crossSell.length;
          return (
            <button
              key={client.clientId}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelectClient(client.clientId)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                border: 'none',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: isSelected ? 'var(--bg-subtle, #F3F4F6)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: isSelected ? 600 : 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {client.clientName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                  {client.sellerName || 'Sin vendedor'} · {formatARS(client.totalRevenue)}
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '999px',
                  backgroundColor: isSelected ? '#111827' : 'var(--bg-subtle, #F3F4F6)',
                  color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {totalSignals}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            backgroundColor: 'var(--background-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.84rem',
              fontWeight: 600,
            }}
          >
            <span>Dejó de llevar</span>
            <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {activeClient.stoppedBuying.length}
            </span>
          </div>
          {activeClient.stoppedBuying.length === 0 ? (
            <div style={{ padding: '14px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Sin bajas de recompra.
            </div>
          ) : (
            <div tabIndex={0} role="region" aria-label="Productos que dejó de llevar" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th scope="col" style={{ padding: '8px 14px', fontWeight: 500 }}>Producto</th>
                    <th scope="col" style={{ padding: '8px 14px', fontWeight: 500, textAlign: 'right' }}>Historial</th>
                    <th scope="col" style={{ padding: '8px 14px', fontWeight: 500, textAlign: 'right' }}>Stock</th>
                    <th scope="col" style={{ padding: '8px 14px', fontWeight: 500, textAlign: 'right' }}>Lista</th>
                  </tr>
                </thead>
                <tbody>
                  {activeClient.stoppedBuying.map((item) => (
                    <tr key={item.productId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th scope="row" style={{ padding: '9px 14px', fontWeight: 500, textAlign: 'left' }}>
                        {item.name}
                      </th>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {item.timesBought} ped. · {item.daysSinceLastBought}d
                      </td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {item.stock}
                      </td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatARS(item.listPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div
          style={{
            backgroundColor: 'var(--background-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.84rem',
              fontWeight: 600,
            }}
          >
            <span>Venta cruzada</span>
            <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {activeClient.crossSell.length}
            </span>
          </div>
          {activeClient.crossSell.length === 0 ? (
            <div style={{ padding: '14px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Sin sugerencias de venta cruzada.
            </div>
          ) : (
            <div tabIndex={0} role="region" aria-label="Sugerencias de venta cruzada" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th scope="col" style={{ padding: '8px 14px', fontWeight: 500 }}>Producto</th>
                    <th scope="col" style={{ padding: '8px 14px', fontWeight: 500 }}>Afinidad</th>
                    <th scope="col" style={{ padding: '8px 14px', fontWeight: 500, textAlign: 'right' }}>Stock</th>
                    <th scope="col" style={{ padding: '8px 14px', fontWeight: 500, textAlign: 'right' }}>Lista</th>
                  </tr>
                </thead>
                <tbody>
                  {activeClient.crossSell.map((item) => (
                    <tr key={item.productId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th scope="row" style={{ padding: '9px 14px', fontWeight: 500, textAlign: 'left' }}>
                        {item.name}
                      </th>
                      <td style={{ padding: '9px 14px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {item.affinityPct}% ({item.peerClientsCount} pares · {item.basedOnProductName})
                      </td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {item.stock}
                      </td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatARS(item.listPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
