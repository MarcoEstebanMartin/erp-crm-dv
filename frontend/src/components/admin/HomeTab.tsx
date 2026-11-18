import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import {
  HOME_QUERY_KEYS,
  usePendingRendicionesQuery,
  useWeeklyScheduleQuery,
} from '../../hooks/queries';
import WeeklyScheduleModal from '../modals/WeeklyScheduleModal';
import { HomePendingCashCard } from './home/HomePendingCashCard';
import { HomeQuickActionsGrid } from './home/HomeQuickActionsGrid';
import { HomeWeeklyScheduleRibbon } from './home/HomeWeeklyScheduleRibbon';
import { FleetExpenseQuickModal } from './home/FleetExpenseQuickModal';

interface HomeTabProps {
  orders?: any[];
  ordersSummary?: {
    recibidosCount: number;
    armadosCount: number;
    facturadosCount: number;
    enRepartoCount?: number;
  } | null;
  setActiveTab: (tab: string) => void;
  setSummaryCardModal: (modal: { open: boolean; cardKey: string; cardLabel: string } | null) => void;
  setClientModal: (modal: any) => void;
  setClientSearchModal: (modal: any) => void;
  setQuickClientQuery: (query: string) => void;
  setIsPriceListModalOpen: (open: boolean) => void;
  setIsQuickSearchModalOpen: (open: boolean) => void;
  setIsDirectInvoiceModalOpen: (open: boolean) => void;
  setErrorMsg?: (msg: string | null) => void;
  setSuccessMsg?: (msg: string | null) => void;
}

const DAY_NAMES_ES = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

const EMPTY_CLIENT_DATA = {
  id: 0,
  name: '',
  cuit: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  creditLimit: 0,
  priceList: 'A',
  discount: 0,
  isClient: true,
  isProvider: false,
  isSeller: false,
  isCommissionAgent: false,
  route: '',
  saleRouteId: null,
  sellerId: null,
  isActive: true,
};

export default function HomeTab({
  orders = [],
  ordersSummary,
  setActiveTab,
  setSummaryCardModal,
  setClientModal,
  setClientSearchModal,
  setQuickClientQuery,
  setIsPriceListModalOpen,
  setIsQuickSearchModalOpen,
  setIsDirectInvoiceModalOpen,
  setErrorMsg,
  setSuccessMsg,
}: HomeTabProps) {
  const recibidosCount = useMemo(
    () =>
      ordersSummary
        ? ordersSummary.recibidosCount
        : orders.filter((o) => o.status === 'PENDING' || o.status === 'RECIBIDO').length,
    [ordersSummary, orders],
  );
  const armadosCount = useMemo(
    () =>
      ordersSummary
        ? ordersSummary.armadosCount
        : orders.filter(
            (o) =>
              o.status === 'PREPARING' ||
              (o.status === 'PREPARED' &&
                !o.invoiceNumber &&
                !o.deliveredAt &&
                (!o.deliveryRoute || o.deliveryRoute.status === 'PENDING')),
          ).length,
    [ordersSummary, orders],
  );
  const facturadosCount = useMemo(
    () =>
      ordersSummary
        ? ordersSummary.facturadosCount
        : orders.filter(
            (o) =>
              o.status !== 'CANCELLED' &&
              o.status !== 'PENDING' &&
              o.status !== 'PREPARING' &&
              Boolean(o.invoiceNumber) &&
              !o.deliveredAt &&
              (!o.deliveryRoute || o.deliveryRoute.status === 'PENDING'),
          ).length,
    [ordersSummary, orders],
  );
  const enRepartoCount = useMemo(
    () =>
      ordersSummary
        ? ordersSummary.enRepartoCount ?? 0
        : orders.filter(
            (o) =>
              o.status !== 'CANCELLED' &&
              o.status !== 'PENDING' &&
              o.status !== 'PREPARING' &&
              o.deliveryRoute?.status === 'IN_TRANSIT',
          ).length,
    [ordersSummary, orders],
  );

  const queryClient = useQueryClient();
  const { data: pendingRendicionesRaw, isLoading: loadingRendicionesDetails } =
    usePendingRendicionesQuery();
  const { data: weeklyScheduleRaw } = useWeeklyScheduleQuery();

  const pendingRendicionesDetails: { sellers: any[]; routes: any[] } = {
    sellers: pendingRendicionesRaw?.sellers || [],
    routes: pendingRendicionesRaw?.routes || [],
  };
  const weeklyScheduleData: { currentWeek: string; items: any[] } = {
    currentWeek: weeklyScheduleRaw?.currentWeek || 'SEMANA_1',
    items: weeklyScheduleRaw?.items || [],
  };

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [showFullWeek, setShowFullWeek] = useState(false);
  const [showGastoModal, setShowGastoModal] = useState(false);

  const fetchWeeklySchedule = () => {
    void queryClient.invalidateQueries({ queryKey: HOME_QUERY_KEYS.weeklySchedule });
  };

  const handleToggleCurrentWeek = async () => {
    const nextWeek = weeklyScheduleData.currentWeek === 'SEMANA_1' ? 'SEMANA_2' : 'SEMANA_1';
    try {
      await api.setCurrentWeek(nextWeek);
      fetchWeeklySchedule();
    } catch (err: any) {
      setErrorMsg?.(err?.message || 'Error al cambiar semana.');
    }
  };

  const todayName = DAY_NAMES_ES[new Date().getDay()];
  const activeDayScheduleItems = useMemo(
    () =>
      weeklyScheduleData.items.filter(
        (item) =>
          (item.weekType === weeklyScheduleData.currentWeek || item.weekType === 'TODAS') &&
          item.dayOfWeek === todayName,
      ),
    [weeklyScheduleData, todayName],
  );

  const formattedDate = useMemo(() => {
    const raw = new Date().toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, []);

  const displayUsername = useMemo(() => {
    const raw = api.getCurrentUser()?.username?.trim() || 'Admin';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, []);

  const kpiCards = [
    { key: 'RECIBIDO', label: 'Recibidos', count: recibidosCount, accent: '#007AFF' },
    { key: 'EN_ARMADO', label: 'En armado', count: armadosCount, accent: '#D97706' },
    { key: 'FACTURADO', label: 'Facturados', count: facturadosCount, accent: '#059669' },
    { key: 'EN_VIAJE', label: 'En reparto', count: enRepartoCount, accent: '#7C3AED' },
  ];

  const openClientSearch = (action: 'order' | 'ledger' | 'payment') => {
    setClientSearchModal({ open: true, action });
    setQuickClientQuery('');
  };

  return (
    <div className="home-root">
      <style>{`
        .home-root { width: 100%; padding-top: 8px; }
        @media (min-width: 900px) { .home-root { padding-top: 28px; } }
        .home-kpis-wrap { container: home-kpis / inline-size; inline-size: 100%; }
        .home-kpis-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        @container home-kpis (inline-size >= 720px) {
          .home-kpis-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
        .home-stat-btn { cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; }
        .home-stat-btn:hover { transform: translateY(-1px); border-color: #cbd5e1 !important; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important; }
        .home-compact-section { margin-top: 20px; width: 100%; }
        .home-half-section { margin-top: 20px; width: 100%; }
        @media (min-width: 900px) { .home-half-section { width: 50%; } }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '22px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)', margin: 0 }}>
          Hola, {displayUsername}!
        </h1>
        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{formattedDate}</span>
      </div>

      <div className="home-kpis-wrap">
        <div className="dashboard-grid home-kpis-grid">
          {kpiCards.map((card) => (
            <button
              key={card.key}
              type="button"
              className="card stat-card home-stat-btn"
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                textAlign: 'left',
                gap: '12px',
                padding: '20px 24px',
                background: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                fontVariantNumeric: 'tabular-nums',
              }}
              onClick={() => setSummaryCardModal({ open: true, cardKey: card.key, cardLabel: card.label })}
            >
              <div className="stat-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
                <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: card.accent, flexShrink: 0 }} />
                {card.label}
              </div>
              <div className="stat-value" style={{ color: 'var(--text-primary)', fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {card.count}
              </div>
            </button>
          ))}
        </div>
      </div>

      <HomeQuickActionsGrid
        onDirectInvoice={() => setIsDirectInvoiceModalOpen(true)}
        onNewClient={() => setClientModal({ open: true, mode: 'create', data: { ...EMPTY_CLIENT_DATA } })}
        onNewOrder={() => openClientSearch('order')}
        onOpenPriceList={() => setIsPriceListModalOpen(true)}
        onOpenQuickPriceSearch={() => setIsQuickSearchModalOpen(true)}
        onOpenLedger={() => openClientSearch('ledger')}
        onOpenPayment={() => openClientSearch('payment')}
        onOpenFleetExpense={() => setShowGastoModal(true)}
      />

      <div className="home-compact-section">
        <HomeWeeklyScheduleRibbon
          currentWeek={weeklyScheduleData.currentWeek}
          todayName={todayName}
          activeDayScheduleItems={activeDayScheduleItems}
          allItems={weeklyScheduleData.items}
          showFullWeek={showFullWeek}
          onToggleCurrentWeek={handleToggleCurrentWeek}
          onToggleFullWeek={() => setShowFullWeek((prev) => !prev)}
          onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
        />
      </div>

      <div className="home-half-section">
        <HomePendingCashCard
          sellers={pendingRendicionesDetails.sellers}
          routes={pendingRendicionesDetails.routes}
          loading={loadingRendicionesDetails}
          onOpenRendiciones={() => setActiveTab('rendiciones')}
          onRendicionCompleted={() =>
            void queryClient.invalidateQueries({ queryKey: HOME_QUERY_KEYS.pendingRendiciones })
          }
        />
      </div>

      <FleetExpenseQuickModal isOpen={showGastoModal} onClose={() => setShowGastoModal(false)} onSuccessMsg={(msg) => setSuccessMsg?.(msg)} />

      <WeeklyScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        items={weeklyScheduleData.items}
        currentWeek={weeklyScheduleData.currentWeek}
        onRefresh={fetchWeeklySchedule}
      />
    </div>
  );
}
