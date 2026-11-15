import type { FC } from 'react';
import { Award, DollarSign, Filter, Sparkles, TrendingUp } from 'lucide-react';

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
  return (
    <>
      <search aria-label="Filtros de rentabilidad">
        <div className="card" style={{ padding: '16px 20px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
              <Filter size={16} color="var(--text-secondary)" aria-hidden="true" />
              <span>Filtros</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f8fafc', padding: '3px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
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
                    backgroundColor: datePreset === p.id ? '#1e293b' : 'transparent',
                    color: datePreset === p.id ? '#ffffff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="prof-start-date" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Desde</label>
              <input
                id="prof-start-date"
                type="date"
                className="input tabular-nums"
                value={startDate}
                onChange={(e) => { setDatePreset('CUSTOM'); setStartDate(e.target.value); }}
                style={{ padding: '6px 10px', fontSize: '0.84rem' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="prof-end-date" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Hasta</label>
              <input
                id="prof-end-date"
                type="date"
                className="input tabular-nums"
                value={endDate}
                onChange={(e) => { setDatePreset('CUSTOM'); setEndDate(e.target.value); }}
                style={{ padding: '6px 10px', fontSize: '0.84rem' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="prof-seller" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Vendedor</label>
              <select
                id="prof-seller"
                className="select"
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.84rem' }}
              >
                <option value="">Todos</option>
                {sellerOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.username}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="prof-rubro" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Rubro</label>
              <select
                id="prof-rubro"
                className="select"
                value={selectedRubro}
                onChange={(e) => setSelectedRubro(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.84rem' }}
              >
                <option value="">Todos</option>
                {rubroOptions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="prof-billing-type" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Facturación</label>
              <select
                id="prof-billing-type"
                className="select"
                value={selectedBillingType}
                onChange={(e) => setSelectedBillingType(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.84rem' }}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card" style={{ height: '90px', backgroundColor: '#ffffff', borderRadius: '8px', opacity: 0.6 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div className="card" style={{ padding: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Margen bruto</span>
              <span style={{ padding: '6px', backgroundColor: '#ecfdf5', borderRadius: '6px', color: '#047857', display: 'flex', alignItems: 'center' }}>
                <TrendingUp size={16} aria-hidden="true" />
              </span>
            </div>
            <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(kpis?.totalGrossProfit || 0)}
            </div>
            <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '0.78rem' }}>
              <span style={{ backgroundColor: '#ecfdf5', color: '#047857', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                {kpis?.overallMarginPercent || 0}%
              </span>
            </div>
          </div>

          <div className="card" style={{ padding: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Facturación</span>
              <span style={{ padding: '6px', backgroundColor: '#eff6ff', borderRadius: '6px', color: '#1d4ed8', display: 'flex', alignItems: 'center' }}>
                <DollarSign size={16} aria-hidden="true" />
              </span>
            </div>
            <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(kpis?.totalRevenue || 0)}
            </div>
            <div className="tabular-nums" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Costo: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(kpis?.totalCost || 0)}</strong>
            </div>
          </div>

          <div className="card" style={{ padding: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Cliente #1</span>
              <span style={{ padding: '6px', backgroundColor: '#fffbe6', borderRadius: '6px', color: '#d97706', display: 'flex', alignItems: 'center' }}>
                <Award size={16} aria-hidden="true" />
              </span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {kpis?.topClient?.businessName || 'Sin datos'}
            </div>
            <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              <span>{kpis?.topClient ? formatCurrency(kpis.topClient.grossProfit) : '$ 0'}</span>
              <span style={{ color: '#047857', fontWeight: 700 }}>{kpis?.topClient?.marginPercent || 0}%</span>
            </div>
          </div>

          <div className="card" style={{ padding: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Producto #1</span>
              <span style={{ padding: '6px', backgroundColor: '#faf5ff', borderRadius: '6px', color: '#7e22ce', display: 'flex', alignItems: 'center' }}>
                <Sparkles size={16} aria-hidden="true" />
              </span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {kpis?.topProduct?.name || 'Sin datos'}
            </div>
            <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              <span>{kpis?.topProduct ? formatCurrency(kpis.topProduct.grossProfit) : '$ 0'}</span>
              <span style={{ color: '#7e22ce', fontWeight: 700 }}>{kpis?.topProduct?.marginPercent || 0}%</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
