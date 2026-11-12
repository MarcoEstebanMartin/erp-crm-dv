import { Package, Coins, TrendingUp, Database } from 'lucide-react';
import type { StockValuationStats } from './types';

interface StockKpiCardsProps {
  stats: StockValuationStats;
  filteredCount: number;
  totalCount: number;
}

const cardStyle = {
  padding: '16px 18px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-sm)',
} as const;

const iconBoxStyle = {
  width: '36px',
  height: '36px',
  minWidth: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--bg-app)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  color: 'var(--text-secondary)',
} as const;

const labelStyle = {
  fontSize: '0.72rem',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
} as const;

const valueStyle = {
  fontSize: '1.35rem',
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginTop: '2px',
  lineHeight: 1.2,
  fontVariantNumeric: 'tabular-nums',
} as const;

const subRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '0.73rem',
  marginTop: '6px',
  flexWrap: 'wrap',
  fontVariantNumeric: 'tabular-nums',
} as const;

export default function StockKpiCards({
  stats,
  filteredCount,
  totalCount,
}: StockKpiCardsProps) {
  const latentProfit = stats.totalRetailVal - stats.totalCost;
  const latentProfitMargin =
    stats.totalCost > 0 ? (latentProfit / stats.totalCost) * 100 : 0;
  const profitPositive = latentProfit >= 0;
  const marginSign = latentProfitMargin >= 0 ? '+' : '';
  const profitSign = profitPositive ? '+' : '-';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px',
        marginBottom: '20px',
      }}
    >
      {/* 1. Unidades Físicas */}
      <div className="card" style={cardStyle}>
        <div style={iconBoxStyle}>
          <Package size={18} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={labelStyle}>Unidades Físicas</span>
          <span style={valueStyle}>
            {stats.totalUnits.toLocaleString('es-AR')}{' '}
            <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)' }}>u.</span>
          </span>
          <div style={subRowStyle}>
            <span style={{ color: 'var(--color-success)', fontWeight: 600 }} title="Unidades asignadas a un estante del Mapa WMS">
              {stats.locatedUnits.toLocaleString('es-AR')} en mapa
            </span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }} title="Unidades contabilizadas pendientes de ubicar en estantería (S/U)">
              {stats.unassignedUnits.toLocaleString('es-AR')} sin ubicar
            </span>
          </div>
        </div>
      </div>

      {/* 2. Valorización (Costo) */}
      <div className="card" style={cardStyle}>
        <div style={iconBoxStyle}>
          <Coins size={18} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={labelStyle}>Valorización (Costo)</span>
          <span style={valueStyle}>
            ${stats.totalCost.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
          <div style={{ ...subRowStyle, color: 'var(--text-secondary)' }}>
            <span>Capital en mercadería</span>
          </div>
        </div>
      </div>

      {/* 3. Valorización (Venta) + Margen Latente Integrado */}
      <div className="card" style={cardStyle}>
        <div style={iconBoxStyle}>
          <TrendingUp size={18} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={labelStyle}>Valorización (Venta)</span>
          <span style={valueStyle}>
            ${stats.totalRetailVal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
          <div style={subRowStyle}>
            <span style={{ color: 'var(--text-secondary)' }}>Margen:</span>
            <span
              style={{
                color: profitPositive ? 'var(--color-success)' : 'var(--color-danger)',
                fontWeight: 600,
              }}
            >
              {profitSign}${Math.abs(latentProfit).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({marginSign}{latentProfitMargin.toFixed(0)}%)
            </span>
          </div>
        </div>
      </div>

      {/* 4. Catálogo Operativo */}
      <div className="card" style={cardStyle}>
        <div style={iconBoxStyle}>
          <Database size={18} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
          <span style={labelStyle}>Catálogo Activo</span>
          <span style={valueStyle}>
            {filteredCount === totalCount ? (
              totalCount
            ) : (
              <span>
                {filteredCount}{' '}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  de {totalCount}
                </span>
              </span>
            )}
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '5px' }}>
              items
            </span>
          </span>
          <div style={subRowStyle}>
            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{stats.goodStockCount} bien</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{stats.lowStockCount} bajos</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{stats.outOfStockCount} agotados</span>
          </div>
        </div>
      </div>
    </div>
  );
}
