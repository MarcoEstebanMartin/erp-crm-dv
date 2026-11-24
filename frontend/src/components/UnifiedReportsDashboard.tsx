import { useRef, useState, type KeyboardEvent } from 'react';
import { DollarSign, MapPin, Target, TrendingUp } from 'lucide-react';
import ProfitabilityTab from './ProfitabilityTab';
import { CommercialOpportunitiesTab } from './reports/CommercialOpportunitiesTab';
import { FinancialSummaryReportTab } from './reports/FinancialSummaryReportTab';
import { ZoneAnalysisReportTab } from './reports/ZoneAnalysisReportTab';

interface UnifiedReportsDashboardProps {
  orders: any[];
  users: any[];
  clients: any[];
  products: any[];
  financialReport: any;
}

type ReportTabId = 'finanzas' | 'rentabilidad' | 'zonas' | 'oportunidades';

const REPORT_TABS: Array<{
  id: ReportTabId;
  label: string;
  Icon: typeof DollarSign;
}> = [
  { id: 'finanzas', label: 'Resumen', Icon: DollarSign },
  { id: 'rentabilidad', label: 'Rentabilidad', Icon: TrendingUp },
  { id: 'zonas', label: 'Zonas', Icon: MapPin },
  { id: 'oportunidades', label: 'Oportunidades', Icon: Target },
];

export default function UnifiedReportsDashboard({
  users,
  financialReport,
}: UnifiedReportsDashboardProps) {
  const [activeTab, setActiveTab] = useState<ReportTabId>('finanzas');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % REPORT_TABS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + REPORT_TABS.length) % REPORT_TABS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = REPORT_TABS.length - 1;
    else return;
    e.preventDefault();
    setActiveTab(REPORT_TABS[nextIdx].id);
    tabRefs.current[nextIdx]?.focus();
  };

  const sellerUsers = users.filter((u) => u.role === 'VENDEDOR' || u.role === 'ADMIN');

  return (
    <div className="fade-in">
      <div
        role="tablist"
        aria-label="Secciones de reportes"
        className="linear-tablist"
        style={{ marginBottom: '16px', flexWrap: 'nowrap', overflowX: 'auto' }}
      >
        {REPORT_TABS.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[idx] = el; }}
              id={`reports-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className="linear-tab"
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
            >
              <Icon size={15} aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-labelledby={`reports-tab-${activeTab}`}>
        {activeTab === 'finanzas' && (
          <FinancialSummaryReportTab financialReport={financialReport} users={users} />
        )}

        {activeTab === 'rentabilidad' && <ProfitabilityTab />}

        {activeTab === 'zonas' && <ZoneAnalysisReportTab sellers={sellerUsers} />}

        {activeTab === 'oportunidades' && <CommercialOpportunitiesTab />}
      </div>
    </div>
  );
}
