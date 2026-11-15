import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import WeeklyScheduleModal from '../modals/WeeklyScheduleModal';
import { HomePendingCashCard } from './home/HomePendingCashCard';
import { HomeQuickActionsGrid } from './home/HomeQuickActionsGrid';
import { HomeWeeklyScheduleRibbon } from './home/HomeWeeklyScheduleRibbon';
import { FleetExpenseQuickModal } from './home/FleetExpenseQuickModal';

interface HomeTabProps {
  orders: any[];
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
  orders,
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
    () => orders.filter((o) => o.status === 'PENDING' || o.status === 'RECIBIDO').length,
    [orders],
  );
  const armadosCount = useMemo(
    () => orders.filter((o) => o.status === 'PREPARING' || (o.status === 'PREPARED' && !o.invoiceNumber)).length,
    [orders],
  );
  const facturadosCount = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.invoiceNumber ||
          o.status === 'DELIVERED' ||
          o.status === 'BILLED' ||
          (o.deliveryRoute && (o.deliveryRoute.status === 'IN_TRANSIT' || o.deliveryRoute.status === 'COMPLETED')),
      ).length,
    [orders],
  );

  const [pendingRendicionesDetails, setPendingRendicionesDetails] = useState<{ sellers: any[]; routes: any[] }>({
    sellers: [],
    routes: [],
  });
  const [loadingRendicionesDetails, setLoadingRendicionesDetails] = useState(false);
  const [weeklyScheduleData, setWeeklyScheduleData] = useState<{ currentWeek: string; items: any[] }>({
    currentWeek: 'SEMANA_1',
    items: [],
  });
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [showFullWeek, setShowFullWeek] = useState(false);
  const [showGastoModal, setShowGastoModal] = useState(false);

  const fetchRendicionesDetails = async () => {
    setLoadingRendicionesDetails(true);
    try {
      const res = await api.getPendingRendiciones();
      if (res) setPendingRendicionesDetails({ sellers: res.sellers || [], routes: res.routes || [] });
    } catch (err) {
      console.error('Error al obtener rendiciones pendientes:', err);
    } finally {
      setLoadingRendicionesDetails(false);
    }
  };

  const fetchWeeklySchedule = async () => {
    try {
      const res = await api.getWeeklySchedule();
      if (res) setWeeklyScheduleData({ currentWeek: res.currentWeek || 'SEMANA_1', items: res.items || [] });
    } catch (err) {
      console.error('Error al cargar cronograma semanal:', err);
    }
  };

  useEffect(() => {
    fetchWeeklySchedule();
    fetchRendicionesDetails();
  }, []);

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
    <div style={{ maxWidth: '980px', margin: '0 auto' }}>
      <style>{`
        .home-stat-btn { cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .home-stat-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06); }
        .home-mid-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 20px; align-items: stretch; }
        @media (max-width: 820px) { .home-mid-row { grid-template-columns: 1fr; } }
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
              textAlign: 'left',
              padding: '16px 20px',
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color)',
              borderLeft: `3px solid ${card.accent}`,
              borderRadius: '10px',
              fontVariantNumeric: 'tabular-nums',
            }}
            onClick={() => setSummaryCardModal({ open: true, cardKey: card.key, cardLabel: card.label })}
          >
            <div className="stat-label" style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {card.label}
            </div>
            <div className="stat-value" style={{ color: 'var(--text-primary)', fontSize: '2rem', fontWeight: 800, marginTop: '6px' }}>
              {card.count}
            </div>
          </button>
        ))}
      </div>

      <div className="home-mid-row">
        <HomePendingCashCard
          sellers={pendingRendicionesDetails.sellers}
          routes={pendingRendicionesDetails.routes}
          loading={loadingRendicionesDetails}
          onOpenRendiciones={() => setActiveTab('rendiciones')}
        />

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
