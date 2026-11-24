import { useEffect, useMemo, useState, type FC } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { api } from '../../utils/api';
import { formatARS } from '../../utils/format';
import {
  ClientRecommendationsPanel,
  type ClientRecommendationItem,
} from './ClientRecommendationsPanel';
import {
  ClientsAtRiskTable,
  ExpiringLotsTable,
  StagnantStockTable,
  type ClientAtRiskRow,
  type ExpiringLotRow,
  type StagnantProductRow,
} from './CommercialOpportunitiesTables';

type SectionKey = 'risk' | 'stagnant' | 'expiring' | 'recommendations';

interface CommercialOpportunitiesData {
  summary: {
    clientsAtRiskCount: number;
    clientsAtRiskMonthlyAmount: number;
    stagnantProductsCount: number;
    stagnantCapitalTotal: number;
    expiringLotsCount: number;
    expiredLotsCount: number;
    expiringCapitalTotal: number;
    clientsWithRecommendationsCount: number;
  };
  clientsAtRisk: ClientAtRiskRow[];
  stagnantProducts: StagnantProductRow[];
  expiringLots: ExpiringLotRow[];
  recommendations: ClientRecommendationItem[];
}

export const CommercialOpportunitiesTab: FC = () => {
  const [section, setSection] = useState<SectionKey>('risk');
  const [stagnantDays, setStagnantDays] = useState<30 | 45 | 60>(30);
  const [expiringDays, setExpiringDays] = useState<30 | 60>(30);
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [data, setData] = useState<CommercialOpportunitiesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async (sDays = stagnantDays, eDays = expiringDays) => {
    setLoading(true);
    setError(null);
    try {
      const report = await api.getCommercialOpportunities({
        stagnantDays: sDays,
        expiringDays: eDays,
      });
      setData(report);
    } catch {
      setError('No se pudo cargar el análisis de oportunidades.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(stagnantDays, expiringDays);
  }, [stagnantDays, expiringDays]);

  const query = search.trim().toLowerCase();

  const filteredRisk = useMemo(() => {
    if (!data) return [];
    if (!query) return data.clientsAtRisk;
    return data.clientsAtRisk.filter(
      (c) =>
        c.clientName.toLowerCase().includes(query) ||
        (c.sellerName || '').toLowerCase().includes(query),
    );
  }, [data, query]);

  const filteredStagnant = useMemo(() => {
    if (!data) return [];
    if (!query) return data.stagnantProducts;
    return data.stagnantProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        (p.rubroName || '').toLowerCase().includes(query),
    );
  }, [data, query]);

  const filteredExpiring = useMemo(() => {
    if (!data) return [];
    if (!query) return data.expiringLots;
    return data.expiringLots.filter(
      (l) =>
        l.productName.toLowerCase().includes(query) ||
        l.lotNumber.toLowerCase().includes(query) ||
        l.sku.toLowerCase().includes(query),
    );
  }, [data, query]);

  const filteredRecommendations = useMemo(() => {
    if (!data) return [];
    if (!query) return data.recommendations;
    return data.recommendations.filter(
      (r) =>
        r.clientName.toLowerCase().includes(query) ||
        (r.sellerName || '').toLowerCase().includes(query),
    );
  }, [data, query]);

  const summary = data?.summary;

  const kpiCards: Array<{
    key: SectionKey;
    label: string;
    count: number;
    amount: string;
    danger?: boolean;
  }> = [
    {
      key: 'risk',
      label: 'Clientes en riesgo',
      count: summary?.clientsAtRiskCount ?? 0,
      amount: summary ? `${formatARS(summary.clientsAtRiskMonthlyAmount)}/mes` : '—',
      danger: (summary?.clientsAtRiskCount ?? 0) > 0,
    },
    {
      key: 'stagnant',
      label: 'Stock inmovilizado',
      count: summary?.stagnantProductsCount ?? 0,
      amount: summary ? formatARS(summary.stagnantCapitalTotal) : '—',
    },
    {
      key: 'expiring',
      label: 'Por vencer',
      count: summary?.expiringLotsCount ?? 0,
      amount: summary ? formatARS(summary.expiringCapitalTotal) : '—',
      danger: (summary?.expiredLotsCount ?? 0) > 0,
    },
    {
      key: 'recommendations',
      label: 'Qué ofrecer',
      count: summary?.clientsWithRecommendationsCount ?? 0,
      amount: 'clientes',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            backgroundColor: '#FEF2F2',
            color: '#991B1B',
            border: '1px solid #FECACA',
            fontSize: '0.84rem',
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '12px',
        }}
      >
        {kpiCards.map((card) => {
          const active = section === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setSection(card.key)}
              aria-pressed={active}
              style={{
                textAlign: 'left',
                padding: '14px 16px',
                borderRadius: '8px',
                border: active ? '1px solid #111827' : '1px solid var(--border-color)',
                backgroundColor: 'var(--background-card)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {card.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '1.45rem',
                    fontWeight: 700,
                    color: card.danger ? '#E30613' : 'var(--text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {loading && !data ? '—' : card.count}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                  {card.amount}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '340px' }}>
          <Search
            size={15}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
            }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            aria-label="Filtrar resultados"
            style={{
              width: '100%',
              padding: '7px 10px 7px 32px',
              fontSize: '0.84rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--background-card)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {section === 'stagnant' && (
            <div role="group" aria-label="Ventana de días sin venta" style={{ display: 'inline-flex', gap: '4px' }}>
              {([30, 45, 60] as const).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setStagnantDays(days)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: stagnantDays === days ? '#111827' : 'var(--background-card)',
                    color: stagnantDays === days ? '#FFFFFF' : 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {days}d
                </button>
              ))}
            </div>
          )}

          {section === 'expiring' && (
            <div role="group" aria-label="Ventana de vencimiento" style={{ display: 'inline-flex', gap: '4px' }}>
              {([30, 60] as const).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setExpiringDays(days)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: expiringDays === days ? '#111827' : 'var(--background-card)',
                    color: expiringDays === days ? '#FFFFFF' : 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {days}d
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => loadReport(stagnantDays, expiringDays)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '0.82rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--background-card)',
              color: 'var(--text-primary)',
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            <RefreshCw size={14} aria-hidden="true" />
            Actualizar
          </button>
        </div>
      </div>

      {section === 'risk' && <ClientsAtRiskTable rows={filteredRisk} loading={loading} />}
      {section === 'stagnant' && <StagnantStockTable rows={filteredStagnant} loading={loading} />}
      {section === 'expiring' && <ExpiringLotsTable rows={filteredExpiring} loading={loading} />}
      {section === 'recommendations' && (
        <ClientRecommendationsPanel
          items={filteredRecommendations}
          selectedClientId={selectedClientId}
          onSelectClient={setSelectedClientId}
        />
      )}
    </div>
  );
};
