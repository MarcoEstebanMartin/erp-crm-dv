import type { FC } from 'react';

interface FuelSummary {
  totalFleetSpent: number;
  totalFleetLiters: number;
  totalPendingLiters: number;
  totalPendingCount: number;
  totalFleetKmTraveled: number;
  averageFleetLitersPer100Km: number;
  activeVehiclesCount: number;
}

interface FuelKpisAndRankingProps {
  summary: FuelSummary;
  vehicleStats: any[];
}

const kpiCardStyle = {
  padding: '16px 18px',
  backgroundColor: 'var(--bg-card, #fff)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '6px',
};

const kpiLabelStyle = {
  fontSize: '0.76rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
};

const kpiValueStyle = {
  fontSize: '1.4rem',
  fontWeight: 800,
  color: 'var(--text-primary)',
  letterSpacing: '-0.02em',
};

export const FuelKpisAndRanking: FC<FuelKpisAndRankingProps> = ({ summary, vehicleStats }) => (
  <>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
      <div style={kpiCardStyle}>
        <span style={kpiLabelStyle}>Litros</span>
        <div className="tabular-nums" style={kpiValueStyle}>
          {summary.totalFleetLiters.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '4px' }}>L</span>
        </div>
      </div>

      <div style={kpiCardStyle}>
        <span style={kpiLabelStyle}>Pendiente liquidar</span>
        <div className="tabular-nums" style={kpiValueStyle}>
          {summary.totalPendingLiters.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '4px' }}>L</span>
          {summary.totalPendingCount > 0 && (
            <span style={{ marginLeft: '8px', fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#92400E', verticalAlign: 'middle' }}>
              {summary.totalPendingCount}
            </span>
          )}
        </div>
      </div>

      <div style={kpiCardStyle}>
        <span style={kpiLabelStyle}>Promedio</span>
        <div className="tabular-nums" style={kpiValueStyle}>
          {summary.averageFleetLitersPer100Km > 0 ? summary.averageFleetLitersPer100Km.toFixed(1) : '—'}
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '4px' }}>L/100 km</span>
        </div>
      </div>

      <div style={kpiCardStyle}>
        <span style={kpiLabelStyle}>Liquidado</span>
        <div className="tabular-nums" style={kpiValueStyle}>
          ${summary.totalFleetSpent.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
        </div>
      </div>
    </div>

    <div style={{ backgroundColor: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Vehículos</h3>
      </div>

      {vehicleStats.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Sin vehículos habilitados.</div>
      ) : (
        <div className="table-container" role="region" aria-label="Resumen por vehículo" tabIndex={0}>
          <table style={{ width: '100%', fontSize: '0.83rem' }}>
            <thead>
              <tr>
                <th scope="col">Vehículo</th>
                <th scope="col">Patente</th>
                <th scope="col">Combustible</th>
                <th scope="col" style={{ textAlign: 'right' }}>Litros</th>
                <th scope="col" style={{ textAlign: 'right' }}>Consumo</th>
                <th scope="col" style={{ textAlign: 'right' }}>Liquidado</th>
              </tr>
            </thead>
            <tbody>
              {vehicleStats.map((stat: any) => (
                <tr key={stat.vehicleId}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stat.brand} {stat.model}</td>
                  <td className="tabular-nums" style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{stat.plate}</td>
                  <td>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '2px 7px', borderRadius: '4px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                      {stat.fuelType === 'NAFTA' ? 'Nafta' : 'Diesel'}
                    </span>
                  </td>
                  <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600 }}>
                    {Number(stat.vehicleLiters || 0).toFixed(1)} L
                  </td>
                  <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700 }}>
                    {stat.litersPer100Km > 0 ? `${stat.litersPer100Km.toFixed(1)} L/100` : '—'}
                  </td>
                  <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600 }}>
                    ${Number(stat.vehicleSpent || 0).toLocaleString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </>
);
