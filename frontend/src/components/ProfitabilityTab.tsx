import { useEffect, useRef, useState, type FC, type KeyboardEvent } from 'react';
import { Layers, Package, Users } from 'lucide-react';
import { api } from '../utils/api';
import { ProfitabilityFiltersAndKpis } from './reports/profitability/ProfitabilityFiltersAndKpis';
import { ProfitabilityTablesAndMatrix } from './reports/profitability/ProfitabilityTablesAndMatrix';

interface ProfitabilityTabProps {
  sellers?: Array<{ id: number; username: string }>;
  rubros?: Array<{ id: number; name: string }>;
}

type SubViewId = 'clients' | 'products' | 'matrix';

export const ProfitabilityTab: FC<ProfitabilityTabProps> = ({ sellers = [], rubros = [] }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [subView, setSubView] = useState<SubViewId>('clients');
  const [datePreset, setDatePreset] = useState<string>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [selectedCity] = useState<string>('');
  const [selectedRubro, setSelectedRubro] = useState<string>('');
  const [selectedBillingType, setSelectedBillingType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [reportData, setReportData] = useState<any>(null);
  const [sellerOptions, setSellerOptions] = useState<Array<{ id: number; username: string }>>(sellers);
  const [rubroOptions, setRubroOptions] = useState<Array<{ id: number; name: string }>>(rubros);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    applyDatePreset(datePreset);
    loadMetadata();
  }, [datePreset]);

  const loadMetadata = async () => {
    try {
      if (sellerOptions.length === 0) {
        let sellersList: any[] = [];
        if (api.getSellersList) {
          sellersList = await api.getSellersList();
        }
        if ((!sellersList || sellersList.length === 0) && api.getUsers) {
          const u = await api.getUsers();
          if (Array.isArray(u)) {
            sellersList = u.filter((user: any) => user.role === 'VENDEDOR');
          }
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

  useEffect(() => {
    loadReport();
  }, [startDate, endDate, selectedSeller, selectedCity, selectedRubro, selectedBillingType]);

  const applyDatePreset = (preset: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'THIS_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === 'LAST_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === 'QUARTER') {
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === 'YEAR') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    }

    if (preset !== 'CUSTOM') {
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await api.getProfitabilityReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sellerId: selectedSeller ? Number(selectedSeller) : undefined,
        city: selectedCity || undefined,
        rubroId: selectedRubro ? Number(selectedRubro) : undefined,
        billingType: selectedBillingType !== 'ALL' ? selectedBillingType : undefined,
      });
      setReportData(data);
    } catch (error) {
      console.error('Error al cargar reporte de rentabilidad:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const filteredClients = (reportData?.clients || []).filter((c: any) =>
    c.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.city.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredProducts = (reportData?.products || []).filter((p: any) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const subTabs: Array<{ id: SubViewId; label: string; Icon: typeof Users }> = [
    { id: 'clients', label: `Clientes (${reportData?.clients?.length || 0})`, Icon: Users },
    { id: 'products', label: `Productos (${reportData?.products?.length || 0})`, Icon: Package },
    { id: 'matrix', label: 'Matriz', Icon: Layers },
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ProfitabilityFiltersAndKpis
        datePreset={datePreset}
        setDatePreset={setDatePreset}
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

        {subView !== 'matrix' && (
          <search aria-label="Buscar en rentabilidad" style={{ minWidth: '220px' }}>
            <label htmlFor="profitability-search" className="visually-hidden">Buscar</label>
            <input
              id="profitability-search"
              type="text"
              className="input"
              placeholder={subView === 'clients' ? 'Buscar cliente o localidad...' : 'Buscar SKU o producto...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{ padding: '6px 10px', fontSize: '0.82rem', width: '100%' }}
            />
          </search>
        )}
      </div>

      <div role="tabpanel" aria-labelledby={`prof-tab-${subView}`}>
        <ProfitabilityTablesAndMatrix
          subView={subView}
          filteredClients={filteredClients}
          filteredProducts={filteredProducts}
          allProducts={reportData?.products || []}
          formatCurrency={formatCurrency}
        />
      </div>
    </div>
  );
};

export default ProfitabilityTab;
