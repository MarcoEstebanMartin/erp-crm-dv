import { lazy, Suspense } from 'react';
import { Activity, ArrowLeftRight, DollarSign, Receipt, TrendingUp } from 'lucide-react';
import type { Order, Persona, Product, User } from '../../types';

const UnifiedReportsDashboard = lazy(() => import('../UnifiedReportsDashboard'));
const WeeklyPulseTab = lazy(() => import('../finanzas/WeeklyPulseTab'));
const RendicionesDashboard = lazy(() => import('../RendicionesDashboard'));
const FieldSettlementsTab = lazy(() =>
  import('../field-receipts/FieldSettlementsTab').then((m) => ({ default: m.FieldSettlementsTab })),
);
const FinanzasDashboard = lazy(() => import('../FinanzasDashboard'));
const TransferenciasDashboard = lazy(() => import('../finanzas/TransferenciasDashboard'));
const GastosDashboard = lazy(() => import('../GastosDashboard'));

export type CajasSubTab =
  | 'general'
  | 'rendiciones'
  | 'field-receipts'
  | 'transferencias'
  | 'gastos'
  | 'reportes'
  | 'pulso';

interface CajaHubSectionProps {
  isAdmin: boolean;
  cajasSubTab: CajasSubTab;
  setCajasSubTab: (tab: CajasSubTab) => void;
  orders: Order[];
  users: User[];
  clients: Persona[];
  products: Product[];
  financialReport: any;
  fallback: React.ReactNode;
}

export function CajaHubSection({
  isAdmin,
  cajasSubTab,
  setCajasSubTab,
  orders,
  users,
  clients,
  products,
  financialReport,
  fallback,
}: CajaHubSectionProps) {
  const tabs: Array<{ id: CajasSubTab; label: string; icon: React.ReactNode; adminOnly: boolean }> = [
    { id: 'general', label: 'Finanzas', icon: <DollarSign size={15} aria-hidden="true" />, adminOnly: true },
    { id: 'rendiciones', label: 'Rendiciones', icon: <Receipt size={15} aria-hidden="true" />, adminOnly: false },
    { id: 'field-receipts', label: 'Recibos', icon: <Receipt size={15} aria-hidden="true" />, adminOnly: false },
    { id: 'transferencias', label: 'Transferencias', icon: <ArrowLeftRight size={15} aria-hidden="true" />, adminOnly: false },
    { id: 'gastos', label: 'Gastos', icon: <DollarSign size={15} aria-hidden="true" />, adminOnly: true },
    { id: 'reportes', label: 'Reportes', icon: <TrendingUp size={15} aria-hidden="true" />, adminOnly: true },
    { id: 'pulso', label: 'Pulso Semanal', icon: <Activity size={15} aria-hidden="true" />, adminOnly: true },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div role="tablist" aria-label="Caja y finanzas" className="linear-tablist">
        {tabs
          .filter((tab) => isAdmin || !tab.adminOnly)
          .map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={cajasSubTab === tab.id}
              className="linear-tab"
              onClick={() => setCajasSubTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
      </div>

      <Suspense fallback={fallback}>
        {cajasSubTab === 'field-receipts' ? (
          <FieldSettlementsTab />
        ) : cajasSubTab === 'transferencias' ? (
          <TransferenciasDashboard />
        ) : cajasSubTab === 'rendiciones' ? (
          <RendicionesDashboard />
        ) : isAdmin && cajasSubTab === 'general' ? (
          <FinanzasDashboard />
        ) : isAdmin && cajasSubTab === 'gastos' ? (
          <GastosDashboard />
        ) : isAdmin && cajasSubTab === 'reportes' ? (
          <UnifiedReportsDashboard
            orders={orders}
            users={users}
            clients={clients}
            products={products}
            financialReport={financialReport}
          />
        ) : isAdmin && cajasSubTab === 'pulso' ? (
          <WeeklyPulseTab />
        ) : isAdmin ? (
          <FinanzasDashboard />
        ) : (
          <RendicionesDashboard />
        )}
      </Suspense>
    </div>
  );
}
