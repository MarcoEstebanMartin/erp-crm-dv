import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';
import { OrderStatus } from '../../utils/types';
import type { Order, Product, ProductLot } from '../../types';
import { playBeep, sortItemsByOptimalRoute } from './depositoHelpers';
import type { BultosData } from './BultosCloseModal';
import type { StockAdjustModalState } from './DepositoStockAdjustModal';

export function useDepositoController(activeTab: string, confirm: any) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [stockModal, setStockModal] = useState<StockAdjustModalState>({
    open: false, product: null, quantityChange: 0, reason: '', lotNumber: '', isNewLot: false, expirationDate: '', location: '',
  });
  const [lotAssignments, setLotAssignments] = useState<Record<number, Record<number, number>>>({});
  const [confirmedLocations, setConfirmedLocations] = useState<Record<number, boolean>>({});
  const [pesableWeights, setPesableWeights] = useState<Record<number, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expiringLots, setExpiringLots] = useState<ProductLot[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [showBultoModal, setShowBultoModal] = useState(false);
  const [bultosData, setBultosData] = useState<BultosData>({ frio: 0, secos: 0, tabla: 0, cajasCerradas: 0 });
  const [labelsToPrint, setLabelsToPrint] = useState<any[]>([]);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [routeFilter, setRouteFilter] = useState<string>('ALL');
  const [withdrawalFilter, setWithdrawalFilter] = useState<boolean>(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Record<number, boolean>>({});
  const [showConsolidatedView, setShowConsolidatedView] = useState<boolean>(false);
  const [consolidatedCheckedItems, setConsolidatedCheckedItems] = useState<Record<number, boolean>>({});
  const [consolidatedZone, setConsolidatedZone] = useState<string>('ALL');
  const [subTab, setSubTab] = useState<string>('wms-map');
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [pendingPurchaseOrders, setPendingPurchaseOrders] = useState<any[]>([]);
  const [generatingPOForProvider, setGeneratingPOForProvider] = useState<number | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const handleBeforePrint = () => {
      if (showConsolidatedView) document.body.classList.add('printing-consolidated');
      else if (labelsToPrint.length > 0) document.body.classList.add('printing-labels');
    };
    const handleAfterPrint = () => document.body.classList.remove('printing-consolidated', 'printing-labels');
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [showConsolidatedView, labelsToPrint]);

  const fetchData = useCallback(async () => {
    setErrorMsg(null);
    try {
      if (subTab === 'picking' || subTab === 'replenishment') {
        const data = await api.getOrders();
        setOrders(data.filter((o: any) => o.status === OrderStatus.PENDING || o.status === OrderStatus.PREPARING));
      }
      if (subTab === 'picking' || subTab === 'lot-expiration') {
        try {
          const lotsRes = await api.getExpiringLots();
          setExpiringLots(lotsRes.lots || []);
        } catch (lotErr) { console.error('Error al obtener lotes vencidos:', lotErr); }
      }
      if (subTab === 'stock-list' || subTab === 'wms-map') {
        const data = await api.getProducts(subTab === 'stock-list' ? debouncedSearchQuery : '');
        setProducts(data || []);
      }
      const allProds = await api.getProducts('', true);
      setAllProducts(allProds || []);
      if (subTab === 'replenishment') {
        try {
          const pendingPurchs = await api.getPurchaseOrders({ status: 'PENDING' });
          setPendingPurchaseOrders(pendingPurchs || []);
        } catch (poErr) { console.error('Error al obtener OC pendientes:', poErr); }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener datos.');
      setLoading(false);
    }
  }, [subTab, debouncedSearchQuery]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    setSuccessMsg(null);
    setErrorMsg(null);
    setSelectedOrderIds({});
    setShowConsolidatedView(false);
    setSubTab(activeTab === 'products' ? 'stock-list' : 'wms-map');
  }, [activeTab]);

  useEffect(() => {
    if (subTab === 'stock-list' && products.length === 1 && searchQuery.trim() !== '') {
      const match = products[0];
      const term = searchQuery.trim();
      if (match.barcode === term || match.sku === term) {
        setStockModal({ open: true, product: match, quantityChange: 0, reason: 'Ajuste por escaneo rápido', lotNumber: '', isNewLot: false, expirationDate: '', location: '' });
        setSearchQuery('');
      }
    }
  }, [products, searchQuery, subTab]);

  useEffect(() => {
    setConfirmedLocations({});
    if (selectedOrder) {
      const initial: any = {};
      const initialWeights: any = {};
      selectedOrder.items.forEach((item: any) => {
        initial[item.id] = {};
        (item.orderItemLots || []).forEach((oil: any) => { initial[item.id][oil.productLotId] = oil.quantity; });
        if (item.weight) initialWeights[item.id] = Number(item.weight);
      });
      setLotAssignments(initial);
      setPesableWeights(initialWeights);
      setSelectedZone('ALL');
    } else {
      setLotAssignments({});
      setPesableWeights({});
    }
  }, [selectedOrder]);

  const handleStartPicking = async (orderId: number) => {
    setErrorMsg(null);
    try {
      await api.updateOrderStatus(orderId, OrderStatus.PREPARING);
      setSuccessMsg(`Pedido #${orderId} en preparación.`);
      fetchData();
    } catch (err: any) { setErrorMsg(err.message || 'Error al iniciar picking.'); }
  };

  const handleLotQtyChange = (orderItemId: number, lotId: number, value: number, maxStock: number) => {
    const val = isNaN(value) || value < 0 ? 0 : Math.min(value, maxStock);
    setLotAssignments((prev) => ({ ...prev, [orderItemId]: { ...(prev[orderItemId] || {}), [lotId]: val } }));
  };

  const handleFIFOAutoFill = (item: any) => {
    const productLots = item.product?.lots || [];
    let remaining = item.quantity;
    const itemAssignments: Record<number, number> = {};
    for (const lot of productLots) {
      if (remaining <= 0) break;
      const toTake = Math.min(lot.stock, remaining);
      if (toTake > 0) {
        itemAssignments[lot.id] = toTake;
        remaining -= toTake;
        if (lot.location && lot.location !== 'S/U') setConfirmedLocations((prev) => ({ ...prev, [lot.id]: true }));
      }
    }
    setLotAssignments((prev) => ({ ...prev, [item.id]: itemAssignments }));
  };

  const handleFIFOAutoFillAll = () => {
    if (!selectedOrder) return;
    const newAssignments = { ...lotAssignments };
    const newConfirmations = { ...confirmedLocations };
    selectedOrder.items.forEach((item: any) => {
      let remaining = item.quantity;
      const itemAssignments: Record<number, number> = {};
      for (const lot of item.product?.lots || []) {
        if (remaining <= 0) break;
        const toTake = Math.min(lot.stock, remaining);
        if (toTake > 0) {
          itemAssignments[lot.id] = toTake;
          remaining -= toTake;
          if (lot.location && lot.location !== 'S/U') newConfirmations[lot.id] = true;
        }
      }
      newAssignments[item.id] = itemAssignments;
    });
    setConfirmedLocations(newConfirmations);
    setLotAssignments(newAssignments);
  };

  const handleFinishPicking = async () => {
    setErrorMsg(null);
    let hasShortages = false, totalAssignedAll = 0;
    for (const item of selectedOrder.items) {
      const assignedSum = Object.values(lotAssignments[item.id] || {}).reduce((sum: number, qty) => sum + (qty || 0), 0);
      if (assignedSum > item.quantity) return setErrorMsg(`La cantidad asignada para "${item.product?.name}" excede la pedida.`);
      if (assignedSum < item.quantity) hasShortages = true;
      totalAssignedAll += assignedSum;
    }
    if (totalAssignedAll === 0) return setErrorMsg('No podés finalizar el armado con 0 unidades asignadas.');
    if (hasShortages && !(await confirm('Atención: Hay productos con faltantes. ¿Deseás continuar y cerrar el bulto?', { type: 'warning' }))) return;

    let frio = 0, secos = 0, tabla = 0, cajasCerradas = 0;
    selectedOrder.items.forEach((item: any) => {
      const itemZone = item.product?.pickingZone || item.product?.rubro?.pickingZone || 'CAJAS';
      const unitsPerBox = item.product?.unitsPerBox || 1;
      const assignedQty = Object.values(lotAssignments[item.id] || {}).reduce((sum: number, qty) => sum + (qty || 0), 0);
      if (assignedQty === 0) return;
      if (unitsPerBox > 1 && assignedQty % unitsPerBox === 0) cajasCerradas += assignedQty / unitsPerBox;
      else if (itemZone === 'FRIO') frio = 1;
      else if (itemZone === 'TABLA') tabla += 1;
      else secos = 1;
    });
    setBultosData({ frio, secos, tabla, cajasCerradas });
    setShowBultoModal(true);
  };

  const handleConfirmBultosAndFinish = async () => {
    if (!selectedOrder) return;
    setErrorMsg(null);
    setLoading(true);
    const totalBultos = Number(bultosData.frio) + Number(bultosData.secos) + Number(bultosData.tabla) + Number(bultosData.cajasCerradas);
    const assignmentsPayload: any = {};
    for (const item of selectedOrder.items) {
      assignmentsPayload[item.id] = Object.entries(lotAssignments[item.id] || {}).filter(([, qty]) => Number(qty) > 0).map(([lotId, qty]) => ({ lotId: Number(lotId), quantity: qty }));
    }
    try {
      const weightItems = Object.entries(pesableWeights).map(([orderItemId, weight]) => ({ orderItemId: Number(orderItemId), weight: Number(weight) })).filter((i) => i.weight > 0);
      if (weightItems.length > 0) await api.updateOrderWeights(selectedOrder.id, weightItems);
      await api.updateOrderStatus(selectedOrder.id, OrderStatus.PREPARED, assignmentsPayload, totalBultos, bultosData);

      const generatedLabels: any[] = [];
      let index = 1;
      const addLabels = (count: number, zone: string) => {
        for (let i = 0; i < count; i++) {
          generatedLabels.push({ index: index++, total: totalBultos, zone, client: selectedOrder.persona?.name || selectedOrder.client?.name || 'Cliente', route: selectedOrder.persona?.route || 'RETIRO EN DEPÓSITO', sequence: selectedOrder.persona?.routeSequence ? `VISITA #${selectedOrder.persona.routeSequence}` : 'S/D', orderId: selectedOrder.id });
        }
      };
      addLabels(bultosData.frio, '❄️ SECTOR FRÍO (FRACCIONADO)');
      addLabels(bultosData.secos, '📥 SECTOR SECOS (FRACCIONADO)');
      addLabels(bultosData.tabla, '🍾 BEBIDAS / TABLA (CONSOLID.)');
      addLabels(bultosData.cajasCerradas, '📦 CAJA CERRADA / ORIGINAL');

      playBeep('success');
      setSuccessMsg(`Pedido #${selectedOrder.id} preparado con éxito (${totalBultos} bultos).`);
      setShowBultoModal(false);
      setSelectedOrder(null);
      fetchData();
      if (generatedLabels.length > 0) {
        setLabelsToPrint(generatedLabels);
        setTimeout(() => { window.print(); setLabelsToPrint([]); }, 500);
      }
    } catch (err: any) { setErrorMsg(err.message || 'Error al guardar detalles de bultos.'); } finally { setLoading(false); }
  };

  const handleStockAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModal.product || !stockModal.quantityChange) return;
    setErrorMsg(null); setSuccessMsg(null); setLoading(true);
    try {
      await api.adjustStock(stockModal.product.id, Number(stockModal.quantityChange), stockModal.reason || 'Ajuste manual depósito', stockModal.lotNumber || undefined, stockModal.isNewLot ? stockModal.expirationDate : undefined, stockModal.location || undefined);
      setSuccessMsg(`Stock de ${stockModal.product.name} ajustado con éxito.`);
      setStockModal({ open: false, product: null, quantityChange: 0, reason: '', lotNumber: '', isNewLot: false, expirationDate: '', location: '' });
      fetchData();
    } catch (err: any) { setErrorMsg(err.message || 'Error al ajustar stock.'); } finally { setLoading(false); }
  };

  const selectedOrdersList = orders.filter((o) => selectedOrderIds[o.id]);
  const consolidatedItems = (() => {
    const itemsMap: Record<number, { product: any; totalQuantity: number; orderDetails: any[] }> = {};
    selectedOrdersList.forEach((order) => {
      (order.items || []).forEach((item: any) => {
        if (!item.product) return;
        const prodId = item.product.id;
        if (!itemsMap[prodId]) itemsMap[prodId] = { product: item.product, totalQuantity: 0, orderDetails: [] };
        itemsMap[prodId].totalQuantity += item.quantity;
        itemsMap[prodId].orderDetails.push({ orderId: order.id, clientName: order.persona?.name || order.client?.name || 'Cliente', route: order.persona?.route || 'RETIRO EN DEPÓSITO', quantity: item.quantity });
      });
    });
    return sortItemsByOptimalRoute(Object.values(itemsMap));
  })();

  const handleBatchStartPicking = async () => {
    const pendingSelected = selectedOrdersList.filter((o) => o.status === OrderStatus.PENDING);
    if (pendingSelected.length === 0) return alert("No hay pedidos seleccionados en estado 'Esperando Picking'.");
    if (!(await confirm(`¿Deseás pasar los ${pendingSelected.length} pedidos seleccionados a 'En Preparación'?`))) return;
    setLoading(true);
    try {
      await Promise.all(pendingSelected.map((o) => api.updateOrderStatus(o.id, OrderStatus.PREPARING)));
      setSuccessMsg(`Se inició el picking para ${pendingSelected.length} pedidos.`);
      setSelectedOrderIds({});
      fetchData();
    } catch (err: any) { setErrorMsg(err.message || 'Error al iniciar el picking en lote.'); } finally { setLoading(false); }
  };

  return {
    orders, products, selectedOrder, setSelectedOrder, stockModal, setStockModal, lotAssignments, confirmedLocations, setConfirmedLocations,
    pesableWeights, setPesableWeights, searchQuery, setSearchQuery, errorMsg, setErrorMsg, successMsg, setSuccessMsg, loading, expiringLots,
    selectedZone, setSelectedZone, showBultoModal, setShowBultoModal, bultosData, setBultosData, labelsToPrint, setLabelsToPrint,
    orderSearchQuery, setOrderSearchQuery, routeFilter, setRouteFilter, withdrawalFilter, setWithdrawalFilter, selectedStatus, setSelectedStatus,
    selectedOrderIds, setSelectedOrderIds, showConsolidatedView, setShowConsolidatedView, consolidatedCheckedItems, setConsolidatedCheckedItems,
    consolidatedZone, setConsolidatedZone, subTab, setSubTab, allProducts, pendingPurchaseOrders, generatingPOForProvider, setGeneratingPOForProvider,
    fetchData, handleStartPicking, handleLotQtyChange, handleFIFOAutoFill, handleFIFOAutoFillAll, handleFinishPicking, handleConfirmBultosAndFinish,
    handleStockAdjustSubmit, selectedOrdersList, consolidatedItems, handleBatchStartPicking,
  };
}
