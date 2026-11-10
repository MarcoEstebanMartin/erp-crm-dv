import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../utils/api';
import { captureCurrentGpsSilently } from '../../utils/geoUtils';
import { cleanCityName, getTodayKey } from './vendedorHelpers';
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

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const fetchData = useCallback(async () => {
    setErrorMsg(null);
    try {
      if (activeTab === 'orders' || activeTab === 'history') {
        const [clientData, prodData, orderData, rubroData] = await Promise.all([
          api.getClients(),
          api.getProducts(prodSearchQuery),
          api.getOrders(),
          api.getRubros(),
        ]);
        setClients(clientData.filter((c: any) => c.isActive !== false));
        setProducts(prodData);
        setOrders(orderData);
        setRubros(rubroData);
      } else if (activeTab === 'clients') {
        const [routesData, visitsData] = await Promise.all([api.getSellerSaleRoutes(), api.getTodayVisits()]);
        setVendedorRoutes(routesData.routes || []);
        setTodayVisits(visitsData.visits || []);

        let routeIdToLoad = selectedRouteId;
        if (!routeIdToLoad && routesData.routes?.length > 0) {
          const daysMap: Record<number, string> = { 0: 'DOMINGO', 1: 'LUNES', 2: 'MARTES', 3: 'MIERCOLES', 4: 'JUEVES', 5: 'VIERNES', 6: 'SABADO' };
          const todayRoute = routesData.routes.find((r: any) => r.dayOfWeek === daysMap[new Date().getDay()]);
          routeIdToLoad = todayRoute ? todayRoute.id : routesData.routes[0].id;
          setSelectedRouteId(routeIdToLoad);
        }

        if (routeIdToLoad) {
          const routeDetail = await api.getSaleRouteById(routeIdToLoad);
          setClients(routeDetail.route.clients || []);
        } else {
          setClients([]);
        }
      } else if (activeTab === 'products') {
        const [prodData, rubroData] = await Promise.all([api.getProducts(searchQuery), api.getRubros()]);
        setProducts(prodData);
        setRubros(rubroData);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener datos.');
    }
  }, [activeTab, prodSearchQuery, selectedRouteId, searchQuery]);

  const syncOfflineData = useCallback(async () => {
    if (!navigator.onLine) return;
    const offlineOrders = JSON.parse(localStorage.getItem('offline_orders') || '[]');
    if (offlineOrders.length > 0) {
      let syncedCount = 0;
      const remaining = [];
      for (const order of offlineOrders) {
        try {
          await api.createOrder({ clientId: order.clientId, items: order.items, notes: order.notes });
          if (order.routeId) {
            try { await api.recordRouteVisit(order.routeId, { personaId: order.clientId, status: 'ORDERED', latitude: order.latitude ?? null, longitude: order.longitude ?? null }); } catch {}
          }
          syncedCount++;
        } catch { remaining.push(order); }
      }
      localStorage.setItem('offline_orders', JSON.stringify(remaining));
      if (syncedCount > 0) { showToast(`✅ Se enviaron ${syncedCount} pedido(s) guardados sin señal.`, 'success'); fetchData(); }
    }

    const offlineVisits = JSON.parse(localStorage.getItem('offline_route_visits') || '[]');
    if (offlineVisits.length > 0) {
      let syncedVisits = 0;
      const remainingV = [];
      for (const v of offlineVisits) {
        try {
          await api.recordRouteVisit(v.routeId, { personaId: v.personaId, status: v.status, noBuyReason: v.noBuyReason, notes: v.notes, latitude: v.latitude ?? null, longitude: v.longitude ?? null });
          syncedVisits++;
        } catch { remainingV.push(v); }
      }
      localStorage.setItem('offline_route_visits', JSON.stringify(remainingV));
      if (syncedVisits > 0) showToast(`✅ Se sincronizaron ${syncedVisits} visita(s) offline.`, 'success');
    }
  }, [fetchData]);

  useEffect(() => {
    const stored = localStorage.getItem(getTodayKey());
    if (stored) { try { setSessionVisits(JSON.parse(stored)); } catch {} }
    syncOfflineData();
    window.addEventListener('online', syncOfflineData);
    return () => window.removeEventListener('online', syncOfflineData);
  }, [syncOfflineData]);

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

  const handleConfirmOrder = async () => {
    if (!selectedClient) return setErrorMsg('Debe seleccionar un cliente antes de confirmar.');
    if (cart.length === 0) return setErrorMsg('El carrito está vacío.');

    const items = cart.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      isEmergencyOverride: Boolean(item.isEmergencyOverride || item.quantity < (item.product.minOrderQuantity || 1)),
    }));

    setLoading(true);
    const gps = await captureCurrentGpsSilently(3000);

    if (!navigator.onLine) {
      const offlineOrders = JSON.parse(localStorage.getItem('offline_orders') || '[]');
      offlineOrders.push({ clientId: selectedClient.id, items, notes: orderNotes, clientName: selectedClient.name, routeId: selectedRouteId, latitude: gps?.lat ?? null, longitude: gps?.lng ?? null, timestamp: new Date().toISOString() });
      localStorage.setItem('offline_orders', JSON.stringify(offlineOrders));
      const updatedVisits = { ...sessionVisits, [selectedClient.id]: { status: 'VENTA' } };
      setSessionVisits(updatedVisits);
      localStorage.setItem(getTodayKey(), JSON.stringify(updatedVisits));
      setSuccessMsg(`⚠️ Sin señal. El pedido de "${selectedClient.name}" se guardó localmente y se enviará al recuperar conexión.`);
      setCart([]); setOrderNotes(''); setSelectedClient(null); setClientFilter(''); setLoading(false);
      return;
    }

    try {
      await api.createOrder({ clientId: selectedClient.id, items, notes: orderNotes });
      const effectiveRouteId = selectedRouteId || (selectedClient as any).saleRouteId;
      if (effectiveRouteId) {
        try {
          await api.recordRouteVisit(Number(effectiveRouteId), {
            personaId: selectedClient.id,
            status: 'ORDERED',
            latitude: gps?.lat ?? null,
            longitude: gps?.lng ?? null,
          });
        } catch {}
      }
      const updatedVisits = { ...sessionVisits, [selectedClient.id]: { status: 'VENTA' } };
      setSessionVisits(updatedVisits);
      localStorage.setItem(getTodayKey(), JSON.stringify(updatedVisits));
      setSuccessMsg(`✅ ¡Pedido cargado con éxito${gps ? ' + Check-in GPS registrado' : ''}! Se envió a depósito.`);
      setCart([]); setOrderNotes(''); setSelectedClient(null); setClientFilter('');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el pedido.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRoute = async (routeId: number) => {
    setSelectedRouteId(routeId);
    setLoading(true);
    try {
      const routeDetail = await api.getSaleRouteById(routeId);
      setClients(routeDetail.route.clients || []);
    } catch (err: any) { setErrorMsg('Error al cargar la ruta: ' + err.message); } finally { setLoading(false); }
  };

  const handleRecordNoSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noSaleModal || !selectedRouteId) return;
    setLoading(true);
    const gps = await captureCurrentGpsSilently(3000);

    if (!navigator.onLine) {
      const pendingQueue = JSON.parse(localStorage.getItem('offline_route_visits') || '[]');
      pendingQueue.push({ routeId: selectedRouteId, personaId: noSaleModal.clientId, status: 'NO_BUY', noBuyReason: noSaleModal.reason, notes: noSaleModal.notes, latitude: gps?.lat ?? null, longitude: gps?.lng ?? null, timestamp: new Date().toISOString() });
      localStorage.setItem('offline_route_visits', JSON.stringify(pendingQueue));
      setSuccessMsg('⚠️ Sin conexión. Visita guardada localmente.');
      setNoSaleModal(null); setLoading(false);
      return;
    }

    try {
      await api.recordRouteVisit(selectedRouteId, { personaId: noSaleModal.clientId, status: 'NO_BUY', noBuyReason: noSaleModal.reason, notes: noSaleModal.notes, latitude: gps?.lat ?? null, longitude: gps?.lng ?? null });
      const [visitsData, routeDetail] = await Promise.all([api.getTodayVisits(), api.getSaleRouteById(selectedRouteId)]);
      setTodayVisits(visitsData.visits || []);
      setClients(routeDetail.route.clients || []);
      setSuccessMsg('✅ Visita y Check-in GPS registrados con éxito.');
      setNoSaleModal(null);
    } catch (err: any) { setErrorMsg(err.message || 'Error al registrar visita.'); } finally { setLoading(false); }
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
    noSaleModal, setNoSaleModal, vendedorRoutes, selectedRouteId, todayVisits, uniqueCities,
    fetchData, addToCart, updateCartQty, handleConfirmOrder, handleSelectRoute, handleRecordNoSale, handleCreateClient, handleOpenEditOrder,
  };
}
