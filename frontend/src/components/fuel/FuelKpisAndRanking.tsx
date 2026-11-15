import type { FC } from 'react';
import { Fuel, TrendingUp, DollarSign, Gauge, Car } from 'lucide-react';

interface FuelSummary {
  totalFleetSpent: number;
  totalFleetLiters: number;
  totalFleetKmTraveled: number;
  averageFleetLitersPer100Km: number;
  activeVehiclesCount: number;
}

interface FuelKpisAndRankingProps {
  summary: FuelSummary;
  vehicleStats: any[];
}

const kpiCardStyle = {
  padding: '18px 20px',
  backgroundColor: 'var(--bg-card, #fff)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column' as const,
};

const kpiTitleStyle = {
  fontSize: '0.78rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
};

export const FuelKpisAndRanking: FC<FuelKpisAndRankingProps> = ({ summary, vehicleStats }) => {
  const highestConsumingVehicle = vehicleStats.length > 0 && vehicleStats[0].litersPer100Km > 0 ? vehicleStats[0] : null;
  const maxLitersPer100 = Math.max(...vehicleStats.map((s: any) => s.litersPer100Km || 0), 1);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiTitleStyle}>Gasto Total</span>
            <div style={{ padding: '6px', backgroundColor: '#ECFDF5', borderRadius: '6px', display: 'flex' }}>
              <DollarSign size={16} color="#10B981" aria-hidden="true" />
            </div>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px', letterSpacing: '-0.02em' }}>
            ${summary.totalFleetSpent.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiTitleStyle}>Litros Consumidos</span>
            <div style={{ padding: '6px', backgroundColor: '#EFF6FF', borderRadius: '6px', display: 'flex' }}>
              <Fuel size={16} color="#3B82F6" aria-hidden="true" />
            </div>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px', letterSpacing: '-0.02em' }}>
            {summary.totalFleetLiters.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>L</span>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiTitleStyle}>Promedio Flota</span>
            <div style={{ padding: '6px', backgroundColor: '#EEF2FF', borderRadius: '6px', display: 'flex' }}>
              <Gauge size={16} color="#6366F1" aria-hidden="true" />
            </div>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px', letterSpacing: '-0.02em' }}>
            {summary.averageFleetLitersPer100Km > 0 ? summary.averageFleetLitersPer100Km.toFixed(1) : '--'} <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>L/100 km</span>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiTitleStyle}>Mayor Consumo</span>
            <div style={{ padding: '6px', backgroundColor: '#FEF2F2', borderRadius: '6px', display: 'flex' }}>
              <TrendingUp size={16} color="#EF4444" aria-hidden="true" />
            </div>
          </div>
          {highestConsumingVehicle ? (
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {highestConsumingVehicle.brand} {highestConsumingVehicle.model}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span className="tabular-nums" style={{ padding: '2px 6px', backgroundColor: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: '0.75rem', borderRadius: '4px' }}>
                  {highestConsumingVehicle.litersPer100Km} L/100 km
                </span>
                <span className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>({highestConsumingVehicle.plate})</span>
              </div>
            </div>
          ) : (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>Sin medición</span>
          )}
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px 0' }}>
          Ranking de Consumo (L/100 km)
        </h3>

        {vehicleStats.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Sin vehículos activos.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {vehicleStats.map((stat: any) => {
              const percentage = stat.litersPer100Km > 0 ? (stat.litersPer100Km / maxLitersPer100) * 100 : 0;
              let badgeText = 'Normal', badgeBg = 'var(--bg-secondary, #F3F4F6)', badgeColor = 'var(--text-secondary)', barBg = '#374151';
              if (stat.litersPer100Km > 0 && summary.averageFleetLitersPer100Km > 0) {
                if (stat.litersPer100Km > summary.averageFleetLitersPer100Km * 1.25) {
                  badgeText = 'Alto Consumo'; badgeBg = '#FEF2F2'; badgeColor = '#DC2626'; barBg = '#EF4444';
                } else if (stat.litersPer100Km < summary.averageFleetLitersPer100Km * 0.85) {
                  badgeText = 'Eficiente'; badgeBg = '#ECFDF5'; badgeColor = '#059669'; barBg = '#10B981';
                }
              }

              return (
                <div key={stat.vehicleId} style={{ padding: '12px 16px', backgroundColor: 'var(--bg-app, #F9FAFB)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Car size={16} color="var(--text-muted)" aria-hidden="true" />
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.brand} {stat.model}</span>
                      <span className="tabular-nums" style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)', padding: '2px 6px', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}>{stat.plate}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: badgeBg, color: badgeColor }}>{badgeText}</span>
                    </div>

                    <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.82rem' }}>
                      <div><span style={{ color: 'var(--text-muted)' }}>Gasto: </span><strong>${stat.vehicleSpent.toLocaleString('es-AR')}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Cargas: </span><strong>{stat.logsCount}</strong></div>
                      <div style={{ minWidth: '100px', textAlign: 'right', fontWeight: 800, fontSize: '0.9rem' }}>
                        {stat.litersPer100Km > 0 ? `${stat.litersPer100Km} L/100km` : '--'}
                      </div>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '5px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(percentage, 3)}%`, backgroundColor: barBg, borderRadius: '3px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};
