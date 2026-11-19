import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../utils/api';
import { useGpsTracker } from '../../hooks/useGpsTracker';

export function useRepartoGpsAndSettle({
  selectedRoute,
  bankAccounts,
  setSelectedRoute,
  setLoading,
  setSuccessMsg,
  setErrorMsg,
  onSettled,
}: {
  selectedRoute: any | null;
  bankAccounts: any[];
  setSelectedRoute: (r: any | null) => void;
  setLoading: (v: boolean) => void;
  setSuccessMsg: (v: string | null) => void;
  setErrorMsg: (v: string | null) => void;
  onSettled: () => Promise<void>;
}) {
  const [gpsHistory, setGpsHistory] = useState<[number, number][]>([]);
  const [liveGpsInfo, setLiveGpsInfo] = useState<any>(null);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleRoute, setSettleRoute] = useState<any | null>(null);
  const [settlements, setSettlements] = useState<any[]>([]);

  useGpsTracker({
    activeRouteId: selectedRoute?.id,
    isActive: selectedRoute?.status === 'IN_TRANSIT' || selectedRoute?.custodyStatus === 'LOADED_IN_TRANSIT',
    intervalMs: 60000,
  });

  useEffect(() => {
    if (!selectedRoute?.id) {
      setGpsHistory([]);
      setLiveGpsInfo(null);
      return;
    }
    const fetchGpsData = () => {
      api.getRouteGpsHistory(selectedRoute.id)
        .then((data: any) => {
          if (data?.route) {
            setLiveGpsInfo(data.route);
            if (Array.isArray(data.pings)) setGpsHistory(data.pings.map((p: any) => [p.latitude, p.longitude]));
          }
        })
        .catch(() => {});
    };
    fetchGpsData();
    const interval = setInterval(fetchGpsData, 15000);
    return () => clearInterval(interval);
  }, [selectedRoute?.id]);

  const handleOpenSettleModal = (route: any) => {
    setErrorMsg(null);
    setSettleRoute(route);
    setSettlements(route.orders.map((o: any) => ({
      orderId: o.id,
      clientName: o.persona?.name || 'Cliente',
      invoiceNumber: o.invoiceNumber || `Pedido #${o.id}`,
      amount: Number(o.totalAmount),
      paymentMethod: 'CASH',
      bankAccountId: bankAccounts[0]?.id || '',
      checkNumber: '',
      checkIssuer: '',
      isEcheq: false,
      checkAmount: Number(o.totalAmount),
    })));
    setShowSettleModal(true);
  };

  const handleSettleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!settleRoute) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const expectedCash = settlements.filter((s) => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.amount, 0);
      const expectedTransfers = settlements.filter((s) => s.paymentMethod === 'BANK_TRANSFER').reduce((sum, s) => sum + s.amount, 0);
      const expectedChecks = settlements.filter((s) => s.paymentMethod === 'CHECK').reduce((sum, s) => sum + s.amount, 0);
      await api.settleDeliveryRoute(settleRoute.id, {
        settlements, cashDeclared: expectedCash, checksDeclared: expectedChecks, transfersDeclared: expectedTransfers,
      });
      setSuccessMsg(`Viaje #${settleRoute.id} liquidado.`);
      setShowSettleModal(false);
      setSettleRoute(null);
      setSelectedRoute(null);
      await onSettled();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al liquidar el viaje.');
    } finally {
      setLoading(false);
    }
  };

  return {
    gpsHistory,
    liveGpsInfo,
    showSettleModal,
    setShowSettleModal,
    settleRoute,
    settlements,
    setSettlements,
    handleOpenSettleModal,
    handleSettleSubmit,
  };
}
