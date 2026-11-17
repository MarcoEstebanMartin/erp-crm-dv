import { useState, useEffect, useMemo } from 'react';
import { api } from '../../utils/api';
import {
  printBatchPickingA4,
  printConsolidatedPickingA4,
  printShippingLabelsBultos,
} from '../../utils/printHelpers';
import {
  computeAdaptiveFulfillmentColumns,
  formatBigIntARS,
  sumOrdersTotalInt,
} from '../../utils/fulfillmentCardMeta.helper';
import {
  isOrderPendingCae,
  matchesOrderSearch,
  resolveOrderClientRoute,
  shouldShowInFulfillmentBilledColumn,
} from '../../utils/orderSearchAndStatus.helper';

export interface FulfillmentConfirmState {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  isAlert?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Encapsula la lógica operativa del tablero de Armado y Facturación: filtros, CAE diferido e impresiones.
 */
export function useFulfillmentDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestingCaeId, setRequestingCaeId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [fulfillmentModalOrder, setFulfillmentModalOrder] = useState<any | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<string>('ALL');
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('list');

  const [confirmState, setConfirmState] = useState<FulfillmentConfirmState>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  const showConfirm = ({
    title = 'Confirmar Acción',
    message,
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    type = 'info',
    isAlert = false,
    onConfirm,
  }: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info' | 'success';
    isAlert?: boolean;
    onConfirm: () => void;
  }) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      type,
      isAlert,
      onConfirm: () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        onConfirm();
      },
      onCancel: () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await api.getOrders();
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
  }, []);

  const handleRequestCae = async (orderId: number) => {
    setRequestingCaeId(orderId);
    try {
      const res = await api.requestCaeForOrder(orderId);
      showConfirm({
        title: 'CAE Asignado con Éxito',
        message: res.message || 'El comprobante fue autorizado por AFIP.',
        type: 'success',
        isAlert: true,
        onConfirm: () => void fetchOrders(),
      });
    } catch (err: any) {
      showConfirm({
        title: 'Error al solicitar CAE',
        message: err.message || 'Error al conectar con AFIP.',
        type: 'danger',
        isAlert: true,
        onConfirm: () => {},
      });
    } finally {
      setRequestingCaeId(null);
    }
  };

  const uniqueSellers = useMemo(
    () => Array.from(new Set(orders.map((o) => o.seller?.username).filter(Boolean))),
    [orders],
  );
  const uniqueRoutes = useMemo(
    () => Array.from(new Set(orders.map((o) => resolveOrderClientRoute(o)).filter(Boolean))),
    [orders],
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!matchesOrderSearch(o, searchQuery)) return false;

      const sellerName = o.seller?.username || '';
      if (selectedSeller !== 'ALL' && sellerName !== selectedSeller) return false;

      const routeName = resolveOrderClientRoute(o);
      if (selectedRoute !== 'ALL' && routeName !== selectedRoute) return false;

      const matchesZone =
        selectedZone === 'ALL' ||
        (o.items || []).some((item: any) => {
          const zone = item.product?.pickingZone || item.product?.rubro?.pickingZone || 'CAJAS';
          return zone === selectedZone;
        });

      return matchesZone;
    });
  }, [orders, searchQuery, selectedSeller, selectedRoute, selectedZone]);

  const pending = filteredOrders.filter((o) => o.status === 'PENDING' || o.status === 'RECIBIDO');
  const preparing = filteredOrders.filter(
    (o) => o.status === 'PREPARING' || (o.status === 'PREPARED' && !o.invoiceNumber),
  );
  const billedOrPendingCae = filteredOrders.filter((o) => shouldShowInFulfillmentBilledColumn(o));
  const pendingCaeCount = billedOrPendingCae.filter((o) => isOrderPendingCae(o)).length;
  const pendingTotalLabel = useMemo(() => formatBigIntARS(sumOrdersTotalInt(pending)), [pending]);
  const preparingTotalLabel = useMemo(() => formatBigIntARS(sumOrdersTotalInt(preparing)), [preparing]);
  const billedTotalLabel = useMemo(
    () => formatBigIntARS(sumOrdersTotalInt(billedOrPendingCae)),
    [billedOrPendingCae],
  );
  const boardGridTemplate = useMemo(
    () => computeAdaptiveFulfillmentColumns(pending.length, preparing.length, billedOrPendingCae.length),
    [pending.length, preparing.length, billedOrPendingCae.length],
  );

  const getFilterLabel = () => {
    const parts: string[] = [];
    if (selectedRoute !== 'ALL') parts.push(`Ruta: ${selectedRoute}`);
    if (selectedSeller !== 'ALL') parts.push(`Vendedor: ${selectedSeller}`);
    if (selectedZone !== 'ALL') parts.push(`Zona: ${selectedZone}`);
    return parts.length > 0 ? parts.join(' | ') : 'Todos los Pedidos';
  };

  const toggleSelectOrder = (id: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAllPending = () => {
    const pendingIds = pending.map((o) => o.id);
    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedOrderIds.includes(id));
    if (allSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !pendingIds.includes(id)));
    } else {
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...pendingIds])));
    }
  };

  const handleRevertToPending = async (orderId: number) => {
    try {
      await api.updateOrderStatus(orderId, 'PENDING' as any);
      void fetchOrders();
    } catch (err) {
      console.error('Error al devolver pedido a pendientes:', err);
    }
  };

  const handleRevertAllPreparingToPending = () => {
    if (preparing.length === 0) return;
    showConfirm({
      title: 'Devolver a Pendientes',
      message: `¿Deseas devolver los ${preparing.length} pedidos de "En Picking" a la columna "Pendientes"?`,
      confirmText: 'Devolver Todos',
      cancelText: 'Cancelar',
      type: 'warning',
      onConfirm: async () => {
        try {
          await Promise.all(preparing.map((o) => api.updateOrderStatus(o.id, 'PENDING' as any)));
          void fetchOrders();
        } catch (err) {
          console.error('Error al devolver todos a pendientes:', err);
        }
      },
    });
  };

  const getOrdersForBatchAction = () =>
    selectedOrderIds.length > 0 ? pending.filter((o) => selectedOrderIds.includes(o.id)) : pending;

  const handlePrintBatchA4 = () => {
    const ordersToPrint = getOrdersForBatchAction();
    if (ordersToPrint.length === 0) {
      showConfirm({
        title: 'Sin Pedidos Pendientes',
        message: 'No hay pedidos seleccionados o pendientes que coincidan con los filtros.',
        isAlert: true,
        confirmText: 'Entendido',
        type: 'info',
        onConfirm: () => {},
      });
      return;
    }

    printBatchPickingA4({
      orders: ordersToPrint,
      zone: selectedZone,
      filterLabel: getFilterLabel(),
    });

    setTimeout(() => {
      showConfirm({
        title: 'Pasar a En Picking',
        message: `¿Deseas mover los ${ordersToPrint.length} pedidos impresos a la columna "En Picking"?`,
        confirmText: 'Pasar a Picking',
        cancelText: 'Mantener en Pendientes',
        type: 'info',
        onConfirm: async () => {
          await Promise.all(ordersToPrint.map((o) => api.updateOrderStatus(o.id, 'PREPARING' as any)));
          setSelectedOrderIds([]);
          void fetchOrders();
        },
      });
    }, 600);
  };

  const handlePrintConsolidated = () => {
    const ordersToPrint = getOrdersForBatchAction();
    if (ordersToPrint.length === 0) {
      showConfirm({
        title: 'Sin Pedidos Pendientes',
        message: 'No hay pedidos pendientes para consolidar.',
        isAlert: true,
        confirmText: 'Entendido',
        type: 'info',
        onConfirm: () => {},
      });
      return;
    }

    printConsolidatedPickingA4({
      orders: ordersToPrint,
      zone: selectedZone,
      filterLabel: getFilterLabel(),
    });
  };

  const handlePrintLabels = (singleOrder?: any) => {
    const ordersToPrint = singleOrder ? [singleOrder] : getOrdersForBatchAction();
    if (ordersToPrint.length === 0) {
      showConfirm({
        title: 'Sin Pedidos',
        message: 'No hay pedidos seleccionados para imprimir rótulos de despacho.',
        isAlert: true,
        confirmText: 'Entendido',
        type: 'info',
        onConfirm: () => {},
      });
      return;
    }

    printShippingLabelsBultos({ orders: ordersToPrint });
  };

  return {
    loading,
    requestingCaeId,
    searchQuery,
    setSearchQuery,
    fulfillmentModalOrder,
    setFulfillmentModalOrder,
    selectedSeller,
    setSelectedSeller,
    selectedRoute,
    setSelectedRoute,
    selectedZone,
    setSelectedZone,
    selectedOrderIds,
    confirmState,
    uniqueSellers,
    uniqueRoutes,
    pending,
    preparing,
    billedOrPendingCae,
    pendingCaeCount,
    viewMode,
    setViewMode,
    pendingTotalLabel,
    preparingTotalLabel,
    billedTotalLabel,
    boardGridTemplate,
    fetchOrders,
    handleRequestCae,
    toggleSelectOrder,
    toggleSelectAllPending,
    handleRevertToPending,
    handleRevertAllPreparingToPending,
    handlePrintBatchA4,
    handlePrintConsolidated,
    handlePrintLabels,
  };
}
