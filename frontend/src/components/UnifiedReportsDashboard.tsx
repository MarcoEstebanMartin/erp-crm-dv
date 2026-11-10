import { useState } from 'react';
import {
  BarChart2,
  DollarSign,
  Users,
  MapPin,
  TrendingUp,
  Sparkles,
  FileText,
  Calendar,
  Store
} from 'lucide-react';
import CrmDashboard from './CrmDashboard';
import ProfitabilityTab from './ProfitabilityTab';
import SalesChannelReportsTab from './SalesChannelReportsTab';
import ExecutivePdfReport from './reports/ExecutivePdfReport';
import SellerMeetingPdfReport from './reports/SellerMeetingPdfReport';
import { FinancialSummaryReportTab } from './reports/FinancialSummaryReportTab';
import { ZoneAnalysisReportTab } from './reports/ZoneAnalysisReportTab';
import { WeeklyCashConsolidatedTab } from './reports/WeeklyCashConsolidatedTab';

interface UnifiedReportsDashboardProps {
  orders: any[];
  users: any[];
  clients: any[];
  products: any[];
  financialReport: any;
}

export default function UnifiedReportsDashboard({
  users,
  financialReport
}: UnifiedReportsDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    'finanzas' | 'canales' | 'rentabilidad' | 'zonas' | 'caja_semanal' | 'crm' | 'pdf_ejecutivo' | 'pdf_vendedores'
  >('finanzas');

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        <BarChart2 size={28} color="var(--color-primary)" />
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Reportes y Analíticas
        </h2>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap' }}>
        {[
          { id: 'finanzas', label: 'Resumen Financiero', icon: <DollarSign size={16} /> },
          { id: 'pdf_ejecutivo', label: '📄 Reporte Dirección PDF', icon: <FileText size={16} color="var(--color-corp-red)" /> },
          { id: 'pdf_vendedores', label: '👥 Ficha Vendedores PDF', icon: <Users size={16} color="#0369a1" /> },
          { id: 'canales', label: 'Depósito & Canales', icon: <Store size={16} /> },
          { id: 'rentabilidad', label: 'Rentabilidad', icon: <TrendingUp size={16} /> },
          { id: 'zonas', label: 'Análisis de Zonas', icon: <MapPin size={16} /> },
          { id: 'caja_semanal', label: 'Caja Semanal Consolidada', icon: <Calendar size={16} /> },
          { id: 'crm', label: 'Alertas + IA', icon: <Sparkles size={16} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: activeTab === tab.id ? 'var(--bg-light)' : 'transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '8px',
              fontWeight: activeTab === tab.id ? 600 : 500,
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

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
  );
}
