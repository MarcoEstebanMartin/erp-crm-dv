import type { FC } from 'react';
import { Award, DollarSign, Package, TrendingUp } from 'lucide-react';

interface ProfitabilityFiltersAndKpisProps {
  datePreset: string;
  setDatePreset: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  selectedSeller: string;
  setSelectedSeller: (val: string) => void;
  sellerOptions: Array<{ id: number; username: string }>;
  selectedRubro: string;
  setSelectedRubro: (val: string) => void;
  rubroOptions: Array<{ id: number; name: string }>;
  selectedBillingType: string;
  setSelectedBillingType: (val: string) => void;
  loading: boolean;
  kpis: any;
  formatCurrency: (val: number) => string;
}

const PRESETS = [
  { id: 'THIS_MONTH', label: 'Este mes' },
  { id: 'LAST_MONTH', label: 'Mes anterior' },
  { id: 'QUARTER', label: 'Trimestre' },
  { id: 'YEAR', label: 'Año' },
  { id: 'CUSTOM', label: 'Personalizado' },
];

export const ProfitabilityFiltersAndKpis: FC<ProfitabilityFiltersAndKpisProps> = ({
  datePreset,
  setDatePreset,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedSeller,
  setSelectedSeller,
  sellerOptions,
  selectedRubro,
  setSelectedRubro,
  rubroOptions,
  selectedBillingType,
  setSelectedBillingType,
  loading,
  kpis,
  formatCurrency,
}) => {
  const overallMargin = kpis?.overallMarginPercent || 0;
  const grossProfit = kpis?.totalGrossProfit || 0;

  return (
    <>
      <search aria-label="Filtros de rentabilidad">
        <div className="card" style={{ padding: '14px 16px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f8fafc', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)', alignSelf: 'flex-start', flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={datePreset === p.id}
                onClick={() => setDatePreset(p.id)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: datePreset === p.id ? 600 : 500,
                  backgroundColor: datePreset === p.id ? '#0f172a' : 'transparent',
                  color: datePreset === p.id ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="prof-start-date" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Desde</label>
              <input
                id="prof-start-date"
                type="date"
                className="input tabular-nums"
                value={startDate}
                onChange={(e) => { setDatePreset('CUSTOM'); setStartDate(e.target.value); }}
                style={{ padding: '6px 10px', fontSize: '0.82rem' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="prof-end-date" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Hasta</label>
              <input
                id="prof-end-date"
                type="date"
                className="input tabular-nums"
                value={endDate}
                onChange={(e) => { setDatePreset('CUSTOM'); setEndDate(e.target.value); }}
                style={{ padding: '6px 10px', fontSize: '0.82rem' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="prof-seller" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Vendedor</label>
              <select
                id="prof-seller"
                className="select"
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.82rem' }}
              >
                <option value="">Todos</option>
                {sellerOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.username}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="prof-rubro" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Rubro</label>
              <select
                id="prof-rubro"
                className="select"
                value={selectedRubro}
                onChange={(e) => setSelectedRubro(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.82rem' }}
              >
                <option value="">Todos</option>
                {rubroOptions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="prof-billing-type" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Facturación</label>
              <select
                id="prof-billing-type"
                className="select"
                value={selectedBillingType}
                onChange={(e) => setSelectedBillingType(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.82rem' }}
              >
                <option value="ALL">Todas (Oficial + X)</option>
                <option value="OFFICIAL">Oficial (Factura A/B)</option>
                <option value="INTERNAL">Interno (X)</option>
              </select>
            </div>
          </div>
        </div>
      </search>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card" style={{ height: '86px', backgroundColor: '#ffffff', borderRadius: '10px', opacity: 0.6 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          <div className="card" style={{ padding: '16px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Margen bruto</span>
              <TrendingUp size={15} color="#475569" aria-hidden="true" />
            </div>
            <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.35rem', fontWeight: 700, color: grossProfit >= 0 ? '#047857' : 'var(--color-corp-red)' }}>
                {formatCurrency(grossProfit)}
              </span>
              <span style={{ backgroundColor: overallMargin >= 0 ? '#ecfdf5' : '#fef2f2', color: overallMargin >= 0 ? '#047857' : 'var(--color-corp-red)', fontWeight: 600, fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px' }}>
                {overallMargin}%
              </span>
            </div>
          </div>

          <div className="card" style={{ padding: '16px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Facturación</span>
              <DollarSign size={15} color="#475569" aria-hidden="true" />
            </div>
            <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(kpis?.totalRevenue || 0)}
            </div>
            <div className="tabular-nums" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Costo: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(kpis?.totalCost || 0)}</strong>
            </div>
          </div>

          <div className="card" style={{ padding: '16px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Cliente #1</span>
              <Award size={15} color="#475569" aria-hidden="true" />
            </div>
            <div style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {kpis?.topClient?.businessName || 'Sin datos'}
            </div>
            <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              <span>{kpis?.topClient ? formatCurrency(kpis.topClient.grossProfit) : '$ 0'}</span>
              <span style={{ color: '#047857', fontWeight: 600 }}>{kpis?.topClient?.marginPercent || 0}%</span>
            </div>
          </div>

          <div className="card" style={{ padding: '16px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Producto #1</span>
              <Package size={15} color="#475569" aria-hidden="true" />
            </div>
            <div style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {kpis?.topProduct?.name || 'Sin datos'}
            </div>
            <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              <span>{kpis?.topProduct ? formatCurrency(kpis.topProduct.grossProfit) : '$ 0'}</span>
              <span style={{ color: '#047857', fontWeight: 600 }}>{kpis?.topProduct?.marginPercent || 0}%</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
