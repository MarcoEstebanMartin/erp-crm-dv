import {
  Package,
  Coins,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Database
} from 'lucide-react';
import type { StockValuationStats } from './types';

interface StockKpiCardsProps {
  stats: StockValuationStats;
  filteredCount: number;
  totalCount: number;
}

const cardStyle = {
  padding: '20px',
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-sm)'
} as const;

const iconBoxStyle = {
  backgroundColor: 'var(--bg-app)',
  padding: '12px',
  borderRadius: '10px',
  color: 'var(--text-primary)'
} as const;

const labelStyle = {
  fontSize: '0.78rem',
  color: 'var(--text-secondary)',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
} as const;

const valueStyle = {
  fontSize: '1.5rem',
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginTop: '2px'
} as const;

export default function StockKpiCards({
  stats,
  filteredCount,
  totalCount
}: StockKpiCardsProps) {
  const latentProfit = stats.totalRetailVal - stats.totalCost;
  const latentProfitMargin =
    stats.totalCost > 0 ? (latentProfit / stats.totalCost) * 100 : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
      {/* Unidades Totales */}
      <div className="card" style={cardStyle}>
        <div style={iconBoxStyle}><Package size={24} /></div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={labelStyle}>Unidades Físicas</span>
          <span style={valueStyle}>
            {stats.totalUnits.toLocaleString('es-AR')}{' '}
            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>u.</span>
          </span>
        </div>
      </div>

      {/* Costo del Stock */}
      <div className="card" style={cardStyle}>
        <div style={iconBoxStyle}><Coins size={24} /></div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={labelStyle}>Valorización (Costo)</span>
          <span style={valueStyle}>
            ${stats.totalCost.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Retorno Estimado (Venta) */}
      <div className="card" style={cardStyle}>
        <div style={iconBoxStyle}><TrendingUp size={24} /></div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={labelStyle}>Valorización (Venta)</span>
          <span style={valueStyle}>
            ${stats.totalRetailVal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Margen Latente */}
      <div className="card" style={cardStyle}>
        <div style={{
          backgroundColor: latentProfit >= 0 ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
          padding: '12px',
          borderRadius: '10px',
          color: latentProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
        }}>
          {latentProfit >= 0 ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={labelStyle}>Margen Latente</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: latentProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)', marginTop: '2px' }}>
            ${latentProfit.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            <span style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: '6px', opacity: 0.9 }}>
              +{latentProfitMargin.toFixed(0)}%
            </span>
          </span>
        </div>
      </div>

      {/* Estado del Catálogo */}
      <div className="card" style={cardStyle}>
        <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', padding: '12px', borderRadius: '10px', color: '#3B82F6' }}>
          <Database size={24} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <span style={labelStyle}>Catálogo de Productos</span>
          <span style={valueStyle}>
            {filteredCount === totalCount ? (
              totalCount
            ) : (
              <span>
                {filteredCount}{' '}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>de {totalCount}</span>
              </span>
            )}
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>items</span>
          </span>
          <div style={{ display: 'flex', gap: '8px', fontSize: '11px', marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{stats.goodStockCount} Bien</span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{stats.lowStockCount} Bajos</span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{stats.outOfStockCount} Agotados</span>
          </div>
        </div>
      </div>
    </div>
  );
}
