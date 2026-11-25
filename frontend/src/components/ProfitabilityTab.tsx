import { useEffect, useRef, useState, type FC, type KeyboardEvent } from 'react';
import { MapPin, Package, Users } from 'lucide-react';
import { api } from '../utils/api';
import { ProfitabilityFiltersAndKpis } from './reports/profitability/ProfitabilityFiltersAndKpis';
import { ProfitabilityTablesAndMatrix } from './reports/profitability/ProfitabilityTablesAndMatrix';
import { computeArDatePreset } from './reports/reportDateHelpers';

interface ProfitabilityTabProps {
  sellers?: Array<{ id: number; username: string }>;
  rubros?: Array<{ id: number; name: string }>;
}

type SubViewId = 'clients' | 'products' | 'cities';
type ClassificationFilter = 'ALL' | 'LOW_MARGIN' | 'STAR' | 'VOLUME' | 'OPPORTUNITY';

export const ProfitabilityTab: FC<ProfitabilityTabProps> = ({ sellers = [], rubros = [] }) => {
  const initialRange = computeArDatePreset('this_month');
  const [loading, setLoading] = useState<boolean>(true);
  const [subView, setSubView] = useState<SubViewId>('clients');
  const [datePreset, setDatePreset] = useState<string>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string>(initialRange.startDate);
  const [endDate, setEndDate] = useState<string>(initialRange.endDate);
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [selectedRubro, setSelectedRubro] = useState<string>('');
  const [selectedBillingType, setSelectedBillingType] = useState<string>('ALL');
  const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [reportData, setReportData] = useState<any>(null);
  const [sellerOptions, setSellerOptions] = useState<Array<{ id: number; username: string }>>(sellers);
  const [rubroOptions, setRubroOptions] = useState<Array<{ id: number; name: string }>>(rubros);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        if (sellerOptions.length === 0) {
          let sellersList: any[] = [];
          if (api.getSellersList) sellersList = await api.getSellersList();
          if ((!sellersList || sellersList.length === 0) && api.getUsers) {
            const u = await api.getUsers();
            if (Array.isArray(u)) sellersList = u.filter((user: any) => user.role === 'VENDEDOR');
          }
          if (Array.isArray(sellersList)) setSellerOptions(sellersList);
        }
        if (rubroOptions.length === 0 && api.getRubros) {
          const r = await api.getRubros();
          if (Array.isArray(r)) setRubroOptions(r);
        }
      } catch (e) {
        console.error('Error al cargar metadatos de vendedores o rubros:', e);
      }
    };
    loadMetadata();
  }, []);

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    if (preset === 'THIS_MONTH') {
      const r = computeArDatePreset('this_month');
      setStartDate(r.startDate);
      setEndDate(r.endDate);
    } else if (preset === 'LAST_MONTH') {
      const r = computeArDatePreset('last_month');
      setStartDate(r.startDate);
      setEndDate(r.endDate);
    } else if (preset === 'QUARTER') {
      const r = computeArDatePreset('quarter');
      setStartDate(r.startDate);
      setEndDate(r.endDate);
    } else if (preset === 'YEAR') {
      const r = computeArDatePreset('year');
      setStartDate(r.startDate);
      setEndDate(r.endDate);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getProfitabilityReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sellerId: selectedSeller ? Number(selectedSeller) : undefined,
        rubroId: selectedRubro ? Number(selectedRubro) : undefined,
        billingType: selectedBillingType !== 'ALL' ? selectedBillingType : undefined,
      })
      .then((data) => {
        if (active) setReportData(data);
      })
      .catch((error) => {
        console.error('Error al cargar reporte de rentabilidad:', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [startDate, endDate, selectedSeller, selectedRubro, selectedBillingType]);

  const formatCurrency = (val: number): string =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(val || 0);

  const filteredClients = (reportData?.clients || []).filter(
    (c: any) =>
      c.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.city.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredProducts = (reportData?.products || []).filter((p: any) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = classificationFilter === 'ALL' || p.classification === classificationFilter;
    return matchesSearch && matchesClass;
  });

  const filteredCities = (reportData?.cities || []).filter((ct: any) =>
    ct.city.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const subTabs: Array<{ id: SubViewId; label: string; Icon: typeof Users }> = [
    { id: 'clients', label: `Clientes (${reportData?.clients?.length || 0})`, Icon: Users },
    { id: 'products', label: `Productos (${reportData?.products?.length || 0})`, Icon: Package },
    { id: 'cities', label: `Localidades (${reportData?.cities?.length || 0})`, Icon: MapPin },
  ];

  const handleSubTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % subTabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + subTabs.length) % subTabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = subTabs.length - 1;
    else return;
    e.preventDefault();
    setSubView(subTabs[nextIdx].id);
    tabRefs.current[nextIdx]?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <ProfitabilityFiltersAndKpis
        datePreset={datePreset}
        setDatePreset={handlePresetChange}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        selectedSeller={selectedSeller}
        setSelectedSeller={setSelectedSeller}
        sellerOptions={sellerOptions}
        selectedRubro={selectedRubro}
        setSelectedRubro={setSelectedRubro}
        rubroOptions={rubroOptions}
        selectedBillingType={selectedBillingType}
        setSelectedBillingType={setSelectedBillingType}
        loading={loading}
        kpis={reportData?.kpis}
        formatCurrency={formatCurrency}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
        <div role="tablist" aria-label="Vistas de rentabilidad" className="linear-tablist">
          {subTabs.map((tab, idx) => {
            const isActive = subView === tab.id;
            const Icon = tab.Icon;
            return (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[idx] = el; }}
                id={`prof-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className="linear-tab tabular-nums"
                onClick={() => setSubView(tab.id)}
                onKeyDown={(e) => handleSubTabKeyDown(e, idx)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Icon size={14} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {subView === 'products' && (
            <select
              id="profitability-classification"
              aria-label="Filtrar por estado de margen"
              className="select"
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value as ClassificationFilter)}
              style={{ padding: '6px 10px', fontSize: '0.82rem', width: 'auto' }}
            >
              <option value="ALL">Todos los estados</option>
              <option value="LOW_MARGIN">Margen bajo (&lt; 15%)</option>
              <option value="STAR">Estrella</option>
              <option value="VOLUME">Volumen</option>
              <option value="OPPORTUNITY">Oportunidad</option>
            </select>
          )}

          <search aria-label="Buscar en rentabilidad" style={{ minWidth: '220px' }}>
            <label htmlFor="profitability-search" className="visually-hidden">Buscar</label>
            <input
              id="profitability-search"
              type="text"
              className="input"
              placeholder={
                subView === 'clients'
                  ? 'Buscar cliente o localidad...'
                  : subView === 'cities'
                    ? 'Buscar localidad...'
                    : 'Buscar SKU o producto...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{ padding: '6px 10px', fontSize: '0.82rem', width: '100%' }}
            />
          </search>
        </div>
      </div>

      <div role="tabpanel" aria-labelledby={`prof-tab-${subView}`}>
        <ProfitabilityTablesAndMatrix
          subView={subView}
          filteredClients={filteredClients}
          filteredProducts={filteredProducts}
          filteredCities={filteredCities}
          formatCurrency={formatCurrency}
        />
      </div>
    </div>
  );
};

export default ProfitabilityTab;
