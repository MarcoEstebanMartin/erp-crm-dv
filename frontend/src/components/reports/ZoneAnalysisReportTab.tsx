import { useEffect, useState, type FC } from 'react';
import { DollarSign, MapPin, TrendingUp, Users } from 'lucide-react';
import { api } from '../../utils/api';
import SellerMeetingPdfReport from './SellerMeetingPdfReport';
import { ZoneAnalysisCopilotAndTables } from './ZoneAnalysisCopilotAndTables';
import { ZoneAnalysisFiltersBar } from './ZoneAnalysisFiltersBar';
import { computeArDatePreset } from './reportDateHelpers';

interface ZoneAnalysisReportTabProps {
  sellers?: any[];
}

const formatWeekLabel = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
};

const resolveZonePeriodDates = (
  preset: string,
  customStart: string,
  customEnd: string,
): { startDate?: string; endDate?: string } => {
  if (preset === 'this_week') return computeArDatePreset('this_week');
  if (preset === 'last_30_days') return computeArDatePreset('last_30_days');
  if (preset === 'this_month') return computeArDatePreset('this_month');
  if (preset === 'last_month') return computeArDatePreset('last_month');
  if (preset === 'custom') {
    return { startDate: customStart || undefined, endDate: customEnd || undefined };
  }
  return {};
};

export const ZoneAnalysisReportTab: FC<ZoneAnalysisReportTabProps> = ({ sellers: propSellers = [] }) => {
  const [zoneData, setZoneData] = useState<any>({
    clients: [],
    totalClients: 0,
    totalDebt: 0,
    topClients: [],
    clientsWithMovements: [],
    topProducts: [],
    bottomProducts: [],
    weeklyInvoicing: [],
    rubroMetrics: [],
    deadStockProducts: [],
  });
  const [zoneLoading, setZoneLoading] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [citiesDropdownOpen, setCitiesDropdownOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [hoveredWeekIdx, setHoveredWeekIdx] = useState<number | null>(null);
  const [selectedRubroChart, setSelectedRubroChart] = useState<string>('all');

  const [zoneDatePreset, setZoneDatePreset] = useState<string>('this_month');
  const [zoneStartDate, setZoneStartDate] = useState<string>('');
  const [zoneEndDate, setZoneEndDate] = useState<string>('');
  const [bottomProductsTab, setBottomProductsTab] = useState<'lento' | 'sin_ventas'>('lento');
  const [showSellerPdf, setShowSellerPdf] = useState(false);

  const [clientSearch, setClientSearch] = useState<string>('');
  const [clientPage, setClientPage] = useState<number>(1);

  useEffect(() => {
    setClientPage(1);
    setClientSearch('');
  }, [selectedCities, selectedSeller, zoneDatePreset, zoneStartDate, zoneEndDate]);

  const loadZoneData = async () => {
    setZoneLoading(true);
    try {
      const { startDate, endDate } = resolveZonePeriodDates(zoneDatePreset, zoneStartDate, zoneEndDate);
      const res = await api.getZoneReports({
        cities: selectedCities,
        sellerId: selectedSeller ? Number(selectedSeller) : undefined,
        startDate,
        endDate,
      });
      setZoneData(res);
      if (res.availableCities) setCities(res.availableCities);
      if (res.availableSellers) setSellers(res.availableSellers);
    } catch (err) {
      console.error(err);
    } finally {
      setZoneLoading(false);
    }
  };

  useEffect(() => {
    loadZoneData();
  }, [selectedCities, selectedSeller, zoneDatePreset, zoneStartDate, zoneEndDate]);

  if (showSellerPdf) {
    const resolvedRange = resolveZonePeriodDates(zoneDatePreset, zoneStartDate, zoneEndDate);
    const pdfSellers = propSellers.length > 0 ? propSellers : sellers;
    return (
      <SellerMeetingPdfReport
        sellers={pdfSellers}
        initialSellerId={selectedSeller ? Number(selectedSeller) : undefined}
        initialStartDate={resolvedRange.startDate}
        initialEndDate={resolvedRange.endDate}
        onClose={() => setShowSellerPdf(false)}
      />
    );
  }

  const zoneWeeklyInvoicing = zoneData.weeklyInvoicing || [];
  const totalInvoicedInZone =
    zoneData.profitability?.totalRevenue ??
    zoneWeeklyInvoicing.reduce((sum: number, w: any) => sum + (w.total || 0), 0);
  const totalOrdersInZone = zoneWeeklyInvoicing.reduce((sum: number, w: any) => sum + (w.count || 0), 0);
  const avgTicketInZone = totalOrdersInZone > 0 ? Math.round(totalInvoicedInZone / totalOrdersInZone) : 0;
  const zoneGrossProfit = zoneData.profitability?.grossProfit || 0;
  const zoneGrossMarginPct = zoneData.profitability?.grossMarginPct || 0;
  const availableRubros = zoneData.rubroMetrics?.map((r: any) => r.name) || [];

  const getWeeklyVal = (w: any) => {
    if (!w) return 0;
    if (selectedRubroChart === 'all') return w.total || 0;
    return w.rubros?.[selectedRubroChart] || 0;
  };

  const maxWeeklyAmount = Math.max(...zoneWeeklyInvoicing.map((w: any) => getWeeklyVal(w)), 1);
  const activeWeek =
    hoveredWeekIdx !== null && zoneWeeklyInvoicing[hoveredWeekIdx]
      ? zoneWeeklyInvoicing[hoveredWeekIdx]
      : zoneWeeklyInvoicing[zoneWeeklyInvoicing.length - 1];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ZoneAnalysisFiltersBar
        cities={cities}
        selectedCities={selectedCities}
        setSelectedCities={setSelectedCities}
        citiesDropdownOpen={citiesDropdownOpen}
        setCitiesDropdownOpen={setCitiesDropdownOpen}
        sellers={sellers}
        selectedSeller={selectedSeller}
        setSelectedSeller={setSelectedSeller}
        zoneDatePreset={zoneDatePreset}
        setZoneDatePreset={setZoneDatePreset}
        zoneStartDate={zoneStartDate}
        setZoneStartDate={setZoneStartDate}
        zoneEndDate={zoneEndDate}
        setZoneEndDate={setZoneEndDate}
        setHoveredWeekIdx={setHoveredWeekIdx}
        loadZoneData={loadZoneData}
        zoneLoading={zoneLoading}
        onOpenSellerPdf={() => setShowSellerPdf(true)}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: '14px' }}>
        <div className="card" style={{ padding: '16px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Clientes</span>
            <Users size={15} color="var(--text-secondary)" aria-hidden="true" />
          </div>
          <span className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 700 }}>{zoneData.totalClients}</span>
        </div>

        <div className="card" style={{ padding: '16px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Cobertura</span>
            <TrendingUp size={15} color="#475569" aria-hidden="true" />
          </div>
          <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              {zoneData.clientsWithMovements ? zoneData.clientsWithMovements.length : 0} de {zoneData.totalClients || 0}
            </span>
            <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', fontSize: '0.76rem', padding: '3px 7px', borderRadius: '4px', fontWeight: 600 }}>
              {zoneData.totalClients > 0 ? Math.round(((zoneData.clientsWithMovements ? zoneData.clientsWithMovements.length : 0) / zoneData.totalClients) * 100) : 0}%
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Facturación</span>
            <DollarSign size={15} color="#475569" aria-hidden="true" />
          </div>
          <span className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>${totalInvoicedInZone.toLocaleString('es-AR')}</span>
        </div>

        <div className="card" style={{ padding: '16px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Utilidad bruta</span>
            <TrendingUp size={15} color="#475569" aria-hidden="true" />
          </div>
          <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: zoneGrossProfit >= 0 ? '#137333' : 'var(--color-corp-red)' }}>
              ${zoneGrossProfit.toLocaleString('es-AR')}
            </span>
            <span className="badge" style={{ backgroundColor: zoneGrossProfit >= 0 ? '#e6f4ea' : 'var(--color-danger-bg)', color: zoneGrossProfit >= 0 ? '#137333' : 'var(--color-danger)', fontSize: '0.74rem', padding: '2px 6px', fontWeight: 600 }}>
              {zoneGrossMarginPct}%
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ticket promedio</span>
            <TrendingUp size={15} color="#475569" aria-hidden="true" />
          </div>
          <span className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>${avgTicketInZone.toLocaleString('es-AR')}</span>
        </div>

        <div className="card" style={{ padding: '16px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', borderLeft: '3px solid var(--color-corp-red)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Deuda</span>
            <MapPin size={15} color="var(--color-corp-red)" aria-hidden="true" />
          </div>
          <span className="tabular-nums" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-corp-red)' }}>${(zoneData.totalDebt || 0).toLocaleString('es-AR')}</span>
        </div>
      </div>

      <div className="card" style={{ padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h4 style={{ fontSize: '0.98rem', fontWeight: 600, margin: 0 }}>Facturación semanal</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="zone-rubro-chart-select" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Categoría</label>
            <select
              id="zone-rubro-chart-select"
              className="select"
              value={selectedRubroChart}
              onChange={(e) => { setSelectedRubroChart(e.target.value); setHoveredWeekIdx(null); }}
              style={{ padding: '5px 10px', fontSize: '0.8rem', width: 'auto', minWidth: '150px', height: '32px' }}
            >
              <option value="all">Todas</option>
              {availableRubros.map((r: string) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {zoneWeeklyInvoicing.length === 0 ? (
          <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-light)', borderRadius: '8px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
            Sin registros en esta zona.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '160px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', gap: '8px' }}>
                {zoneWeeklyInvoicing.map((week: any, idx: number) => {
                  const isActive = activeWeek && activeWeek.weekStart === week.weekStart;
                  const weeklyVal = getWeeklyVal(week);
                  const heightPct = weeklyVal > 0 ? Math.max((weeklyVal / maxWeeklyAmount) * 100, 3) : 0;
                  return (
                    <button
                      key={week.weekStart}
                      type="button"
                      aria-label={`Semana ${formatWeekLabel(week.weekStart)}: $${weeklyVal.toLocaleString('es-AR')}`}
                      onMouseEnter={() => setHoveredWeekIdx(idx)}
                      onFocus={() => setHoveredWeekIdx(idx)}
                      onClick={() => setHoveredWeekIdx(idx)}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', height: '100%', justifyContent: 'flex-end', border: 'none', background: 'transparent', padding: 0 }}
                    >
                      <div style={{ width: '100%', maxWidth: '34px', height: `${heightPct}%`, backgroundColor: isActive ? '#0f172a' : '#cbd5e1', borderRadius: '4px 4px 0 0', transition: 'all 0.2s ease' }} />
                    </button>
                  );
                })}
              </div>
              <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-secondary)', padding: '0 4px' }}>
                {zoneWeeklyInvoicing.map((week: any) => (
                  <div key={week.weekStart} style={{ flex: 1, textAlign: 'center', maxWidth: '34px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatWeekLabel(week.weekStart)}
                  </div>
                ))}
              </div>
            </div>

            <div className="tabular-nums" style={{ backgroundColor: 'var(--bg-light)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>Semana</span>
                <span style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {activeWeek ? formatWeekLabel(activeWeek.weekStart) : 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block' }}>
                  {selectedRubroChart === 'all' ? 'Facturación' : selectedRubroChart}
                </span>
                <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#137333' }}>
                  ${activeWeek ? getWeeklyVal(activeWeek).toLocaleString('es-AR') : '0'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block' }}>Pedidos</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>{activeWeek ? activeWeek.count : '0'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block' }}>Ticket prom.</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                    ${activeWeek && activeWeek.count > 0 ? Math.round(getWeeklyVal(activeWeek) / activeWeek.count).toLocaleString('es-AR') : '0'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ZoneAnalysisCopilotAndTables
        zoneData={zoneData}
        clientSearch={clientSearch}
        setClientSearch={setClientSearch}
        clientPage={clientPage}
        setClientPage={setClientPage}
        bottomProductsTab={bottomProductsTab}
        setBottomProductsTab={setBottomProductsTab}
      />
    </div>
  );
};
