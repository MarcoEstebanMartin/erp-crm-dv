import { useRef, useState, type KeyboardEvent } from 'react';
import {
  BarChart2,
  Calendar,
  DollarSign,
  FileText,
  MapPin,
  Sparkles,
  Store,
  TrendingUp,
  Users
} from 'lucide-react';
import CrmDashboard from './CrmDashboard';
import ProfitabilityTab from './ProfitabilityTab';
import SalesChannelReportsTab from './SalesChannelReportsTab';
import ExecutivePdfReport from './reports/ExecutivePdfReport';
import { FinancialSummaryReportTab } from './reports/FinancialSummaryReportTab';
import SellerMeetingPdfReport from './reports/SellerMeetingPdfReport';
import { WeeklyCashConsolidatedTab } from './reports/WeeklyCashConsolidatedTab';
import { ZoneAnalysisReportTab } from './reports/ZoneAnalysisReportTab';

interface UnifiedReportsDashboardProps {
  orders: any[];
  users: any[];
  clients: any[];
  products: any[];
  financialReport: any;
}

type ReportTabId =
  | 'finanzas'
  | 'pdf_ejecutivo'
  | 'pdf_vendedores'
  | 'canales'
  | 'rentabilidad'
  | 'zonas'
  | 'caja_semanal'
  | 'crm';

const REPORT_TABS: Array<{
  id: ReportTabId;
  label: string;
  Icon: typeof DollarSign;
  iconColor?: string;
}> = [
  { id: 'finanzas', label: 'Resumen Financiero', Icon: DollarSign },
  { id: 'pdf_ejecutivo', label: 'Reporte Ejecutivo PDF', Icon: FileText, iconColor: 'var(--color-corp-red)' },
  { id: 'pdf_vendedores', label: 'Ficha Vendedores PDF', Icon: Users, iconColor: '#0369a1' },
  { id: 'canales', label: 'Canales', Icon: Store },
  { id: 'rentabilidad', label: 'Rentabilidad', Icon: TrendingUp },
  { id: 'zonas', label: 'Zonas', Icon: MapPin },
  { id: 'caja_semanal', label: 'Caja Semanal', Icon: Calendar },
  { id: 'crm', label: 'Alertas IA', Icon: Sparkles }
];

export default function UnifiedReportsDashboard({
  users,
  financialReport
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

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
        <BarChart2 size={24} color="var(--color-primary)" aria-hidden="true" />
        <h2 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Reportes
        </h2>
      </div>

      <div
        role="tablist"
        aria-label="Secciones de reportes"
        className="linear-tablist"
        style={{ marginBottom: '20px', flexWrap: 'wrap' }}
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
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon size={15} color={tab.iconColor} aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-labelledby={`reports-tab-${activeTab}`}>
        {activeTab === 'pdf_ejecutivo' && (
          <ExecutivePdfReport onClose={() => setActiveTab('finanzas')} />
        )}

        {activeTab === 'pdf_vendedores' && (
          <SellerMeetingPdfReport
            sellers={users.filter(u => u.role === 'VENDEDOR' || u.role === 'ADMIN')}
            onClose={() => setActiveTab('finanzas')}
          />
        )}

        {activeTab === 'finanzas' && (
          <FinancialSummaryReportTab financialReport={financialReport} />
        )}

        {activeTab === 'canales' && (
          <div className="fade-in">
            <SalesChannelReportsTab />
          </div>
        )}

        {activeTab === 'rentabilidad' && <ProfitabilityTab />}

        {activeTab === 'zonas' && <ZoneAnalysisReportTab />}

        {activeTab === 'caja_semanal' && <WeeklyCashConsolidatedTab />}

        {activeTab === 'crm' && (
          <div className="fade-in">
            <CrmDashboard initialTab="alerts" hideHeaderTabs={true} />
          </div>
        )}
      </div>
    </div>
  );
}
