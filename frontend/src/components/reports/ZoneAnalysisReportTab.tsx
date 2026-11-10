import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, DollarSign, MapPin } from 'lucide-react';
import { api } from '../../utils/api';
import { ZoneAnalysisFiltersBar } from './ZoneAnalysisFiltersBar';
import { ZoneAnalysisCopilotAndTables } from './ZoneAnalysisCopilotAndTables';

const formatWeekLabel = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
};

export const ZoneAnalysisReportTab: React.FC = () => {
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
    salesRecommendations: []
  });
  const [zoneLoading, setZoneLoading] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [citiesDropdownOpen, setCitiesDropdownOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [hoveredWeekIdx, setHoveredWeekIdx] = useState<number | null>(null);
  const [selectedRubroChart, setSelectedRubroChart] = useState<string>('all');

  const [zoneDatePreset, setZoneDatePreset] = useState<string>('all');
  const [zoneStartDate, setZoneStartDate] = useState<string>('');
  const [zoneEndDate, setZoneEndDate] = useState<string>('');
  const [bottomProductsTab, setBottomProductsTab] = useState<'lento' | 'sin_ventas'>('lento');

  const [clientSearch, setClientSearch] = useState<string>('');
  const [clientPage, setClientPage] = useState<number>(1);

  useEffect(() => {
    setClientPage(1);
    setClientSearch('');
  }, [selectedCities, selectedSeller, zoneDatePreset, zoneStartDate, zoneEndDate]);

  const loadZoneData = async () => {
    setZoneLoading(true);
    try {
      let startStr: string | undefined = undefined;
      let endStr: string | undefined = undefined;

      const now = new Date();
      if (zoneDatePreset === 'this_week') {
        startStr = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
        endStr = now.toISOString().split('T')[0];
      } else if (zoneDatePreset === 'last_30_days') {
        startStr = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
        endStr = now.toISOString().split('T')[0];
      } else if (zoneDatePreset === 'this_month') {
        startStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endStr = now.toISOString().split('T')[0];
      } else if (zoneDatePreset === 'last_month') {
        startStr = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        endStr = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      } else if (zoneDatePreset === 'custom') {
        if (zoneStartDate) startStr = zoneStartDate;
        if (zoneEndDate) endStr = zoneEndDate;
      }

      const res = await api.getZoneReports({
        cities: selectedCities,
        sellerId: selectedSeller ? Number(selectedSeller) : undefined,
        startDate: startStr,
        endDate: endStr
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

  const zoneWeeklyInvoicing = zoneData.weeklyInvoicing || [];
  const totalInvoicedInZone = zoneWeeklyInvoicing.reduce((sum: number, w: any) => sum + (w.total || 0), 0);
  const totalOrdersInZone = zoneWeeklyInvoicing.reduce((sum: number, w: any) => sum + (w.count || 0), 0);
  const avgTicketInZone = totalOrdersInZone > 0 ? Math.round(totalInvoicedInZone / totalOrdersInZone) : 0;
  const availableRubros = zoneData.rubroMetrics?.map((r: any) => r.name) || [];

  const getWeeklyVal = (w: any) => {
    if (!w) return 0;
    if (selectedRubroChart === 'all') return w.total || 0;
    return w.rubros?.[selectedRubroChart] || 0;
  };

  const maxWeeklyAmount = Math.max(...zoneWeeklyInvoicing.map((w: any) => getWeeklyVal(w)), 1);
  const activeWeek = hoveredWeekIdx !== null && zoneWeeklyInvoicing[hoveredWeekIdx]
    ? zoneWeeklyInvoicing[hoveredWeekIdx]
    : zoneWeeklyInvoicing[zoneWeeklyInvoicing.length - 1];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>CLIENTES EN LA ZONA</span>
            <Users size={18} color="var(--text-secondary)" />
          </div>
          <span style={{ fontSize: '1.8rem', fontWeight: 700 }}>{zoneData.totalClients}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Clientes activos registrados</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>COBERTURA DE VENTAS</span>
            <TrendingUp size={18} color="#1a73e8" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 700 }}>
              {zoneData.clientsWithMovements ? zoneData.clientsWithMovements.length : 0} de {zoneData.totalClients || 0}
            </span>
            <span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
              {zoneData.totalClients > 0 ? Math.round(((zoneData.clientsWithMovements ? zoneData.clientsWithMovements.length : 0) / zoneData.totalClients) * 100) : 0}%
            </span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Clientes con compras en el período</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>FACTURACIÓN TOTAL</span>
            <DollarSign size={18} color="#137333" />
          </div>
          <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#137333' }}>${totalInvoicedInZone.toLocaleString()}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ventas entregadas acumuladas</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TICKET PROMEDIO</span>
            <TrendingUp size={18} color="#1a73e8" />
          </div>
          <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a73e8' }}>${avgTicketInZone.toLocaleString()}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Monto promedio por pedido</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid var(--color-corp-red)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>DEUDA EN LA ZONA</span>
            <MapPin size={18} color="var(--color-corp-red)" />
          </div>
          <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-corp-red)' }}>${(zoneData.totalDebt || 0).toLocaleString()}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Saldo total pendiente</span>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '12px' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Evolución de Facturación Semanal</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Visualizar por:</span>
            <select
              className="select"
              value={selectedRubroChart}
              onChange={e => { setSelectedRubroChart(e.target.value); setHoveredWeekIdx(null); }}
              style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto', minWidth: '160px', height: '32px' }}
            >
              <option value="all">Todas las categorías</option>
              {availableRubros.map((r: string) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 24px 0' }}>
          Ventas entregadas consolidadas por semana. Pasa el cursor sobre las barras para ver el detalle de cada semana.
        </p>

        {zoneWeeklyInvoicing.length === 0 ? (
          <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-light)', borderRadius: '8px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
            No hay registros de facturación en esta zona.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '32px', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', gap: '8px' }}>
                {zoneWeeklyInvoicing.map((week: any, idx: number) => {
                  const isActive = activeWeek && activeWeek.weekStart === week.weekStart;
                  const weeklyVal = getWeeklyVal(week);
                  const heightPct = weeklyVal > 0 ? Math.max((weeklyVal / maxWeeklyAmount) * 100, 3) : 0;
                  return (
                    <div key={week.weekStart} onMouseEnter={() => setHoveredWeekIdx(idx)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ width: '100%', maxWidth: '36px', height: `${heightPct}%`, backgroundColor: isActive ? '#1a73e8' : '#e0e0e0', borderRadius: '4px 4px 0 0', transition: 'all 0.2s ease' }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0 4px' }}>
                {zoneWeeklyInvoicing.map((week: any) => (
                  <div key={week.weekStart} style={{ flex: 1, textAlign: 'center', maxWidth: '36px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatWeekLabel(week.weekStart)}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-light)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>SEMANA SELECCIONADA</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Semana del {activeWeek ? formatWeekLabel(activeWeek.weekStart) : 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                  {selectedRubroChart === 'all' ? 'Facturación total' : `Facturación ${selectedRubroChart}`}
                </span>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#137333' }}>
                  ${activeWeek ? getWeeklyVal(activeWeek).toLocaleString() : '0'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Pedidos</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{activeWeek ? activeWeek.count : '0'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Ticket Prom.</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                    ${activeWeek && activeWeek.count > 0 ? Math.round(getWeeklyVal(activeWeek) / activeWeek.count).toLocaleString() : '0'}
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
