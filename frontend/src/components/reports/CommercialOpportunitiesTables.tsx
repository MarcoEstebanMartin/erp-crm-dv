import type { FC } from 'react';
import { formatARS } from '../../utils/format';

export interface ClientAtRiskRow {
  clientId: number;
  clientName: string;
  sellerName: string | null;
  daysSinceLastOrder: number;
  avgCycleDays: number;
  monthlyAvgAmount: number;
  variationPct: number;
  reason: 'OVERDUE_CYCLE' | 'REVENUE_DROP' | 'OVERDUE_AND_DROP';
}

export interface StagnantProductRow {
  productId: number;
  sku: string;
  name: string;
  rubroName: string | null;
  stock: number;
  daysWithoutSale: number | null;
  capitalTiedUp: number;
  listPrice: number;
}

export interface ExpiringLotRow {
  lotId: number;
  sku: string;
  productName: string;
  lotNumber: string;
  expirationDate: string;
  daysToExpire: number;
  stock: number;
  capitalAtRisk: number;
  status: 'EXPIRED' | 'CRITICAL' | 'SOON';
}

const WRAPPER_STYLE = {
  backgroundColor: 'var(--background-card)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  overflow: 'auto' as const,
  maxHeight: '540px',
};

const STICKY_HEAD_STYLE = {
  position: 'sticky' as const,
  top: 0,
  backgroundColor: 'var(--background-card)',
  zIndex: 1,
};

export const ClientsAtRiskTable: FC<{ rows: ClientAtRiskRow[]; loading: boolean }> = ({
  rows,
  loading,
}) => (
  <div tabIndex={0} role="region" aria-label="Clientes en riesgo" style={WRAPPER_STYLE}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
      <thead style={STICKY_HEAD_STYLE}>
        <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500 }}>Cliente</th>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500 }}>Vendedor</th>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500, textAlign: 'right' }}>Sin comprar</th>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500, textAlign: 'right' }}>Ciclo</th>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500, textAlign: 'right' }}>Prom. mensual</th>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500, textAlign: 'right' }}>Variación</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {loading ? 'Calculando...' : 'Sin clientes en riesgo.'}
            </td>
          </tr>
        ) : (
          rows.map((c) => (
            <tr key={c.clientId} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th scope="row" style={{ padding: '10px 14px', fontWeight: 500, textAlign: 'left' }}>{c.clientName}</th>
              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{c.sellerName || '—'}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.daysSinceLastOrder}d</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{c.avgCycleDays}d</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatARS(c.monthlyAvgAmount)}</td>
              <td
                style={{
                  padding: '10px 14px',
                  textAlign: 'right',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: c.variationPct <= -30 ? '#E30613' : 'var(--text-secondary)',
                }}
              >
                {c.variationPct > 0 ? `+${c.variationPct}%` : `${c.variationPct}%`}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

export const StagnantStockTable: FC<{ rows: StagnantProductRow[]; loading: boolean }> = ({
  rows,
  loading,
}) => (
  <div tabIndex={0} role="region" aria-label="Stock inmovilizado" style={WRAPPER_STYLE}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
      <thead style={STICKY_HEAD_STYLE}>
        <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500 }}>Producto</th>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500, textAlign: 'right' }}>Stock</th>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500, textAlign: 'right' }}>Sin venta</th>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500, textAlign: 'right' }}>Capital parado</th>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500, textAlign: 'right' }}>Lista</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {loading ? 'Calculando...' : 'Sin stock inmovilizado.'}
            </td>
          </tr>
        ) : (
          rows.map((p) => (
            <tr key={p.productId} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th scope="row" style={{ padding: '10px 14px', fontWeight: 500, textAlign: 'left' }}>{p.name}</th>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.stock}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                {p.daysWithoutSale === null ? '+180d' : `${p.daysWithoutSale}d`}
              </td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatARS(p.capitalTiedUp)}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatARS(p.listPrice)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

export const ExpiringLotsTable: FC<{ rows: ExpiringLotRow[]; loading: boolean }> = ({
  rows,
  loading,
}) => (
  <div tabIndex={0} role="region" aria-label="Lotes por vencer" style={WRAPPER_STYLE}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
      <thead style={STICKY_HEAD_STYLE}>
        <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500 }}>Producto</th>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500 }}>Lote</th>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500, textAlign: 'right' }}>Vence</th>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500, textAlign: 'right' }}>Stock</th>
          <th scope="col" style={{ padding: '10px 14px', fontWeight: 500, textAlign: 'right' }}>Capital en riesgo</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {loading ? 'Calculando...' : 'Sin lotes próximos a vencer.'}
            </td>
          </tr>
        ) : (
          rows.map((l) => (
            <tr key={l.lotId} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th scope="row" style={{ padding: '10px 14px', fontWeight: 500, textAlign: 'left' }}>{l.productName}</th>
              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{l.lotNumber}</td>
              <td
                style={{
                  padding: '10px 14px',
                  textAlign: 'right',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color:
                    l.status === 'EXPIRED'
                      ? '#E30613'
                      : l.status === 'CRITICAL'
                        ? '#B45309'
                        : 'var(--text-secondary)',
                }}
              >
                {l.daysToExpire < 0
                  ? `Vencido (${Math.abs(l.daysToExpire)}d)`
                  : `${l.daysToExpire}d`}
              </td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{l.stock}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatARS(l.capitalAtRisk)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);
