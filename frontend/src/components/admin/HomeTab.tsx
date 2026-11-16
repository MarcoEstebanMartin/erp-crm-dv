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
        : orders.filter((o) => o.status === 'PREPARING' || (o.status === 'PREPARED' && !o.invoiceNumber)).length,
    [ordersSummary, orders],
  );
  const facturadosCount = useMemo(
    () =>
      ordersSummary
        ? ordersSummary.facturadosCount
        : orders.filter(
            (o) =>
              o.invoiceNumber ||
              o.status === 'DELIVERED' ||
              o.status === 'BILLED' ||
              (o.deliveryRoute && (o.deliveryRoute.status === 'IN_TRANSIT' || o.deliveryRoute.status === 'COMPLETED')),
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
    { key: 'ARMADO', label: 'En armado', count: armadosCount, accent: '#D97706' },
    { key: 'FACTURADO', label: 'Facturados', count: facturadosCount, accent: '#059669' },
  ];

  const openClientSearch = (action: 'order' | 'ledger' | 'payment') => {
    setClientSearchModal({ open: true, action });
    setQuickClientQuery('');
  };

  return (
    <div>
      <style>{`
        .home-stat-btn { cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .home-stat-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06); }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>
          Hola, {displayUsername}!
        </h1>
        <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{formattedDate}</span>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {kpiCards.map((card) => (
          <button
            key={card.key}
            type="button"
            className="card stat-card home-stat-btn"
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '4px',
              padding: '18px 20px',
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color)',
              borderLeft: `3px solid ${card.accent}`,
              borderRadius: '10px',
              fontVariantNumeric: 'tabular-nums',
            }}
            onClick={() => setSummaryCardModal({ open: true, cardKey: card.key, cardLabel: card.label })}
          >
            <div className="stat-label" style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
              {card.label}
            </div>
            <div className="stat-value" style={{ color: 'var(--text-primary)', fontSize: '2.1rem', fontWeight: 800, lineHeight: 1.1 }}>
              {card.count}
            </div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: '20px' }}>
        <HomePendingCashCard
          sellers={pendingRendicionesDetails.sellers}
          routes={pendingRendicionesDetails.routes}
          loading={loadingRendicionesDetails}
          onOpenRendiciones={() => setActiveTab('rendiciones')}
        />
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

      <div style={{ marginTop: '20px' }}>
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
