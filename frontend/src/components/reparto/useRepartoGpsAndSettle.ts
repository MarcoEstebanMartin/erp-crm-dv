import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../utils/api';
import type { OfflineBundleClient } from '../../api/fieldReceipts.api';
import { useGpsTracker } from '../../hooks/useGpsTracker';
import {
  buildInitialRouteSettlements,
  computeRouteSettlementTotals,
  type RouteSettlementRow,
} from './repartoSettlementHelpers';

export interface CollectStopTarget {
  client: OfflineBundleClient;
  deliveryRouteId: number;
  suggestedAmount: number;
}

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
  const [settlements, setSettlements] = useState<RouteSettlementRow[]>([]);
  const [collectStopTarget, setCollectStopTarget] = useState<CollectStopTarget | null>(null);

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
    setSettlements(buildInitialRouteSettlements(route, bankAccounts));
    setShowSettleModal(true);
  };

  const handleSettleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!settleRoute) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const totals = computeRouteSettlementTotals(settlements);
      await api.settleDeliveryRoute(settleRoute.id, {
        settlements,
        cashDeclared: totals.totalCash,
        checksDeclared: totals.totalCheck,
        transfersDeclared: totals.totalTransfer,
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

  const handleOpenCollectForStop = (stop: any) => {
    if (!selectedRoute?.id || !stop) return;
    const p = stop.persona || {};
    const client: OfflineBundleClient = {
      id: Number(stop.clientId || p.id),
      name: String(stop.name || p.name || 'Cliente'),
      cuit: p.cuit ?? null,
      city: p.city ?? null,
      address: stop.address || p.address || null,
      phone: p.phone ?? null,
      route: p.route ?? null,
      saleRouteId: p.saleRouteId ?? null,
      routeSequence: p.routeSequence ?? null,
      outstandingBalance: Number(p.outstandingBalance || 0),
      sellerId: p.sellerId ?? null,
    };
    setErrorMsg(null);
    setCollectStopTarget({
      client,
      deliveryRouteId: Number(selectedRoute.id),
      suggestedAmount: Math.round(Number(stop.totalAmount || 0)),
    });
  };

  const handleCollectSuccess = (info: {
    offline: boolean;
    receiptNumber?: string | null;
    provisionalCode: string;
    totalAmount: number;
  }) => {
    setCollectStopTarget(null);
    const label = info.receiptNumber || info.provisionalCode;
    setSuccessMsg(
      info.offline
        ? `Recibo ${label} guardado offline ($${info.totalAmount.toLocaleString('es-AR')}).`
        : `Recibo ${label} registrado ($${info.totalAmount.toLocaleString('es-AR')}).`,
    );
    void onSettled();
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
    collectStopTarget,
    setCollectStopTarget,
    handleOpenCollectForStop,
    handleCollectSuccess,
  };
}
