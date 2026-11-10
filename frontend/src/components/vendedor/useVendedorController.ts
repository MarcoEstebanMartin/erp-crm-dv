import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../../utils/api';
import { captureCurrentGpsSilently } from '../../utils/geoUtils';
import { generateSafeIdempotencyKey } from '../../utils/idempotencyClient';
import { loadCatalogSnapshot, saveCatalogSnapshot } from '../../utils/offlineCatalogDb';
import { isLikelyNetworkError } from '../../utils/offlineSyncManager';
import { cleanCityName, getTodayKey } from './vendedorHelpers';
import { fetchVendedorTabState } from './vendedorCatalogFetcher';
import { useVendedorOfflineSync } from './useVendedorOfflineSync';
import type { StreetClientFormState } from './VendedorModals';
import type { Persona, Product, Order, Rubro, SaleRoute } from '../../types';

export function useVendedorController(activeTab: string) {
  const [clients, setClients] = useState<Persona[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [filterRubroId, setFilterRubroId] = useState<string>('');

  const [selectedClient, setSelectedClient] = useState<Persona | null>(null);
  const [clientFilter, setClientFilter] = useState('');
  const [cart, setCart] = useState<{ product: any; quantity: number; isEmergencyOverride?: boolean }[]>([]);
  const [orderNotes, setOrderNotes] = useState('');

  const [clientModal, setClientModal] = useState<StreetClientFormState>({
    open: false, name: '', cuit: '', address: '', city: '', phone: '', email: '', route: '', saleRouteId: '', latitude: null, longitude: null,
  });
  const [orderDetailsModal, setOrderDetailsModal] = useState<any | null>(null);
  const [resumenClientModal, setResumenClientModal] = useState<any | null>(null);
  const [isPriceListModalOpen, setIsPriceListModalOpen] = useState(false);
  const [editOrderModal, setEditOrderModal] = useState<{ open: boolean; orderId: number; clientId: number; clientName: string; items: any[] } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [prodSearchQuery, setProdSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [selectedCityFilters, setSelectedCityFilters] = useState<string[]>([]);
  const [sessionVisits, setSessionVisits] = useState<Record<number, { status: string; reason?: string }>>({});
  const [noSaleModal, setNoSaleModal] = useState<{ open: boolean; clientId: number; clientName: string; reason: string; notes: string } | null>(null);

  const [vendedorRoutes, setVendedorRoutes] = useState<SaleRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [todayVisits, setTodayVisits] = useState<any[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const fetchRef = useRef<() => void>(() => undefined);
  const offlineSync = useVendedorOfflineSync({
    onSynced: () => fetchRef.current(),
    showToast,
  });

  const fetchData = useCallback(async () => {
    setErrorMsg(null);
    try {
      const result = await fetchVendedorTabState({
        activeTab,
        prodSearchQuery,
        searchQuery,
        selectedRouteId,
      });

      if (result.clients !== undefined) setClients(result.clients);
      if (result.products !== undefined) setProducts(result.products);
      if (result.orders !== undefined) setOrders(result.orders);
      if (result.rubros !== undefined) setRubros(result.rubros);
      if (result.vendedorRoutes !== undefined) setVendedorRoutes(result.vendedorRoutes);
      if (result.todayVisits !== undefined) setTodayVisits(result.todayVisits);
      if (result.resolvedRouteId && !selectedRouteId) setSelectedRouteId(result.resolvedRouteId);
      if (result.lastCatalogSyncAt) offlineSync.setLastCatalogSyncAt(result.lastCatalogSyncAt);

      offlineSync.setUsingCachedCatalog(result.fromCache);
      if (result.fromCache && !result.hasAnyCachedData) {
        setErrorMsg('Sin conexión y sin copia local previa del catálogo.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener datos.');
    }
  }, [activeTab, prodSearchQuery, selectedRouteId, searchQuery, offlineSync.setLastCatalogSyncAt, offlineSync.setUsingCachedCatalog]);

  fetchRef.current = fetchData;

  useEffect(() => {
    const stored = localStorage.getItem(getTodayKey());
    if (stored) { try { setSessionVisits(JSON.parse(stored)); } catch {} }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setSuccessMsg(null); setErrorMsg(null); }, [activeTab]);

  const uniqueCities = useMemo(() => {
    const unique = [...new Set(clients.map((c) => cleanCityName(c.city)))];
    const sorted = unique.filter((c) => c !== 'OTRAS').sort();
    if (unique.includes('OTRAS')) sorted.push('OTRAS');
    return sorted;
  }, [clients]);

  const addToCart = (product: any) => {
    const existing = cart.find((item) => item.product.id === product.id);
    const minQty = product.minOrderQuantity || 1;
    if (existing) {
      if (existing.quantity >= product.stock) return showToast(`Stock máximo de ${product.name} alcanzado.`, 'error');
      const newQty = existing.quantity + 1;
      setCart(cart.map((item) => (item.product.id === product.id ? { ...item, quantity: newQty } : item)));
      showToast(`Agregado: ${product.name} (x${newQty})`, 'success');
    } else {
      if (product.stock <= 0) return showToast(`Sin stock de ${product.name}.`, 'error');
      setCart([...cart, { product, quantity: minQty }]);
      showToast(`Agregado: ${product.name} (x${minQty})`, 'success');
    }
  };

  const updateCartQty = (productId: number, change: number) => {
    const existing = cart.find((item) => item.product.id === productId);
    if (!existing) return;
    const newQty = existing.quantity + change;
    if (newQty <= 0) setCart(cart.filter((item) => item.product.id !== productId));
    else if (newQty <= existing.product.stock) setCart(cart.map((item) => (item.product.id === productId ? { ...item, quantity: newQty } : item)));
    else setErrorMsg(`Solo hay ${existing.product.stock} unidades en stock.`);
  };

  const markLocalVisit = (clientId: number) => {
    const updatedVisits = { ...sessionVisits, [clientId]: { status: 'VENTA' } };
    setSessionVisits(updatedVisits);
    localStorage.setItem(getTodayKey(), JSON.stringify(updatedVisits));
  };

  const handleConfirmOrder = async () => {
    if (!selectedClient) return setErrorMsg('Debe seleccionar un cliente antes de confirmar.');
    if (cart.length === 0) return setErrorMsg('El carrito está vacío.');

    const items = cart.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      isEmergencyOverride: Boolean(item.isEmergencyOverride || item.quantity < (item.product.minOrderQuantity || 1)),
    }));
    const effectiveRouteId = Number(selectedRouteId || (selectedClient as any).saleRouteId || 0) || null;
    const orderIdempotencyKey = generateSafeIdempotencyKey();

    setLoading(true);
    const gps = await captureCurrentGpsSilently(3000);

    const saveOrderToOfflineQueue = async () => {
      await offlineSync.queueOrderOffline({
        clientId: selectedClient.id, clientName: selectedClient.name, items, notes: orderNotes,
        routeId: effectiveRouteId, latitude: gps?.lat ?? null, longitude: gps?.lng ?? null, idempotencyKey: orderIdempotencyKey,
      });
      markLocalVisit(selectedClient.id);
      setSuccessMsg(`Modo Sin Señal: El pedido de "${selectedClient.name}" quedó protegido en la cola local y se enviará solo al recuperar red.`);
      setCart([]); setOrderNotes(''); setSelectedClient(null); setClientFilter('');
    };

    if (!navigator.onLine) { await saveOrderToOfflineQueue(); setLoading(false); return; }

    try {
      await api.createOrder({ clientId: selectedClient.id, items, notes: orderNotes }, { idempotencyKey: orderIdempotencyKey });
      if (effectiveRouteId) {
        try {
          await api.recordRouteVisit(effectiveRouteId, { personaId: selectedClient.id, status: 'ORDERED', latitude: gps?.lat ?? null, longitude: gps?.lng ?? null }, { idempotencyKey: `${orderIdempotencyKey}-visit` });
        } catch {}
      }
      markLocalVisit(selectedClient.id);
      setSuccessMsg(`¡Pedido cargado con éxito${gps ? ' + Check-in GPS registrado' : ''}! Se envió a depósito.`);
      setCart([]); setOrderNotes(''); setSelectedClient(null); setClientFilter('');
      fetchData();
    } catch (err: any) {
      if (isLikelyNetworkError(err)) await saveOrderToOfflineQueue();
      else setErrorMsg(err.message || 'Error al procesar el pedido.');
    } finally { setLoading(false); }
  };

  const handleSelectRoute = async (routeId: number) => {
    setSelectedRouteId(routeId);
    setLoading(true);
    try {
      const routeDetail = await api.getSaleRouteById(routeId);
      const routeClients = routeDetail.route.clients || [];
      setClients(routeClients);
      await saveCatalogSnapshot(`route_clients_${routeId}`, routeClients);
    } catch (err: any) {
      if (isLikelyNetworkError(err)) {
        const snap = await loadCatalogSnapshot<Persona[]>(`route_clients_${routeId}`);
        if (snap?.payload) setClients(snap.payload);
      } else { setErrorMsg('Error al cargar la ruta: ' + err.message); }
    } finally { setLoading(false); }
  };

  const handleRecordNoSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noSaleModal || !selectedRouteId) return;
    setLoading(true);
    const visitIdempotencyKey = generateSafeIdempotencyKey();
    const gps = await captureCurrentGpsSilently(3000);

    const enqueueVisit = async () => {
      await offlineSync.queueVisitOffline({
        routeId: selectedRouteId, personaId: noSaleModal.clientId, clientName: noSaleModal.clientName,
        status: 'NO_BUY', noBuyReason: noSaleModal.reason, notes: noSaleModal.notes,
        latitude: gps?.lat ?? null, longitude: gps?.lng ?? null, idempotencyKey: visitIdempotencyKey,
      });
      setSuccessMsg('Sin conexión. Visita guardada en cola local.');
      setNoSaleModal(null);
    };

    if (!navigator.onLine) { await enqueueVisit(); setLoading(false); return; }

    try {
      await api.recordRouteVisit(selectedRouteId, { personaId: noSaleModal.clientId, status: 'NO_BUY', noBuyReason: noSaleModal.reason, notes: noSaleModal.notes, latitude: gps?.lat ?? null, longitude: gps?.lng ?? null }, { idempotencyKey: visitIdempotencyKey });
      const [visitsData, routeDetail] = await Promise.all([api.getTodayVisits(), api.getSaleRouteById(selectedRouteId)]);
      setTodayVisits(visitsData.visits || []);
      setClients(routeDetail.route.clients || []);
      setSuccessMsg('Visita y Check-in GPS registrados con éxito.');
      setNoSaleModal(null);
    } catch (err: any) {
      if (isLikelyNetworkError(err)) await enqueueVisit();
      else setErrorMsg(err.message || 'Error al registrar visita.');
    } finally { setLoading(false); }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientModal.name) return setErrorMsg('El nombre es obligatorio.');
    try {
      const client = await api.createClient({
        name: clientModal.name, cuit: clientModal.cuit, address: clientModal.address, city: clientModal.city,
        phone: clientModal.phone, email: clientModal.email, route: clientModal.route,
        saleRouteId: clientModal.saleRouteId ? Number(clientModal.saleRouteId) : null,
        latitude: clientModal.latitude, longitude: clientModal.longitude,
      });
      setClientModal({ open: false, name: '', cuit: '', address: '', city: '', phone: '', email: '', route: '', saleRouteId: '', latitude: null, longitude: null });
      setSelectedClient(client);
      fetchData();
    } catch (err: any) { setErrorMsg(err.message || 'Error al guardar cliente.'); }
  };

  const handleOpenEditOrder = async (order: any) => {
    try {
      const prods = await api.getProducts();
      setProducts(prods);
      const items = order.items.map((i: any) => ({
        id: i.id, productId: i.productId, name: i.product?.name || 'Artículo', sku: i.product?.sku || '',
        quantity: i.quantity, weight: i.weight, isPesable: i.product?.isPesable, approximateWeight: i.product?.approximateWeight,
        listPrice: i.price || i.unitPrice || (i.product ? i.product.listPrice : 0),
      }));
      setEditOrderModal({ open: true, orderId: order.id, clientId: order.clientId, clientName: order.client?.name || order.persona?.name || 'Cliente', items });
    } catch { setErrorMsg('Error al cargar datos para edición.'); }
  };

  return {
    clients, products, orders, rubros, filterRubroId, setFilterRubroId, selectedClient, setSelectedClient,
    clientFilter, setClientFilter, cart, setCart, orderNotes, setOrderNotes, clientModal, setClientModal,
    orderDetailsModal, setOrderDetailsModal, resumenClientModal, setResumenClientModal, isPriceListModalOpen, setIsPriceListModalOpen,
    editOrderModal, setEditOrderModal, searchQuery, setSearchQuery, prodSearchQuery, setProdSearchQuery,
    errorMsg, setErrorMsg, successMsg, setSuccessMsg, loading, setLoading, toast, selectedCityFilters, setSelectedCityFilters,
    noSaleModal, setNoSaleModal, vendedorRoutes, selectedRouteId, todayVisits, uniqueCities, offlineSync,
    fetchData, addToCart, updateCartQty, handleConfirmOrder, handleSelectRoute, handleRecordNoSale, handleCreateClient, handleOpenEditOrder,
  };
}
