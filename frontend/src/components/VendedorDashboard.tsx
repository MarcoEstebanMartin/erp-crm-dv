import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { api } from '../utils/api';
import { getOrderStatusInfo } from '../utils/orderStatusHelper';

import { Trash2, ShoppingCart, UserPlus, CheckCircle2, Eye, Edit, Printer, MapPin, Phone, Navigation, ArrowRight, RefreshCw, Package } from 'lucide-react';
import PriceListModal from './PriceListModal';
import MobileCobros from './MobileCobros';
import type { Persona, Product, Order, Rubro, SaleRoute } from '../types';

const RepartoDashboard = React.lazy(() => import('./RepartoDashboard'));
const DepositoDashboard = React.lazy(() => import('./DepositoDashboard'));

interface VendedorDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function VendedorDashboard({ activeTab, setActiveTab }: VendedorDashboardProps) {
  const [clients, setClients] = useState<Persona[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [filterRubroId, setFilterRubroId] = useState<string>('');
  
  // Nuevo Pedido State
  const [selectedClient, setSelectedClient] = useState<Persona | null>(null);
  const [clientFilter, setClientFilter] = useState('');
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  const [subTab, setSubTab] = useState<'create' | 'list'>('create');
  const [orderNotes, setOrderNotes] = useState('');
  
  // Modales
  const [clientModal, setClientModal] = useState({ open: false, name: '', cuit: '', address: '', city: '', phone: '', email: '', route: '', saleRouteId: '' as string | number, latitude: null as number | null, longitude: null as number | null });
  const [orderDetailsModal, setOrderDetailsModal] = useState<any | null>(null);
  const [isPriceListModalOpen, setIsPriceListModalOpen] = useState(false);
  const [editOrderModal, setEditOrderModal] = useState<{ open: boolean; orderId: number; clientId: number; clientName: string; items: { id: number; productId: number; name: string; sku: string; quantity: number; listPrice: number; weight?: number | null; isPesable?: boolean; approximateWeight?: number | null }[] } | null>(null);
  
  // Filtros y búsquedas
  const [searchQuery, setSearchQuery] = useState('');
  const [prodSearchQuery, setProdSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 2500);
  };

  // Filtro de localidad y bitácora de visitas
  const [selectedCityFilters, setSelectedCityFilters] = useState<string[]>([]);
  const [sessionVisits, setSessionVisits] = useState<{[key: number]: { status: string; reason?: string }}>({});
  const [noSaleModal, setNoSaleModal] = useState<{ open: boolean; clientId: number; clientName: string; reason: string; notes: string } | null>(null);

  // Estados para rutas de preventa del vendedor
  const [vendedorRoutes, setVendedorRoutes] = useState<SaleRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [activeRouteDetail, setActiveRouteDetail] = useState<any | null>(null);
  const [todayVisits, setTodayVisits] = useState<any[]>([]);
  const [capturingGps, setCapturingGps] = useState(false);

  const getTodayKey = () => {
    const today = new Date();
    return `visits_${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  };

  const syncOfflineData = useCallback(async () => {
    if (!navigator.onLine) return;

    // 1. Sincronizar pedidos cargados sin señal
    const offlineOrders = JSON.parse(localStorage.getItem('offline_orders') || '[]');
    if (offlineOrders.length > 0) {
      let syncedCount = 0;
      const remainingOrders = [];

      for (const order of offlineOrders) {
        try {
          await api.createOrder({
            clientId: order.clientId,
            items: order.items,
            notes: order.notes
          });
          if (order.routeId) {
            try {
              await api.recordRouteVisit(order.routeId, {
                personaId: order.clientId,
                status: 'ORDERED'
              });
            } catch (e) {}
          }
          syncedCount++;
        } catch (e) {
          console.error("Error al sincronizar pedido offline:", e);
          remainingOrders.push(order);
        }
      }

      localStorage.setItem('offline_orders', JSON.stringify(remainingOrders));
      if (syncedCount > 0) {
        showToast(`✅ Se enviaron automáticamente ${syncedCount} pedido(s) guardados sin señal.`, 'success');
        fetchData();
      }
    }

    // 2. Sincronizar visitas sin venta registradas sin señal
    const offlineVisits = JSON.parse(localStorage.getItem('offline_route_visits') || '[]');
    if (offlineVisits.length > 0) {
      let syncedVisits = 0;
      const remainingVisits = [];

      for (const visit of offlineVisits) {
        try {
          await api.recordRouteVisit(visit.routeId, {
            personaId: visit.personaId,
            status: visit.status,
            noBuyReason: visit.noBuyReason,
            notes: visit.notes
          });
          syncedVisits++;
        } catch (e) {
          remainingVisits.push(visit);
        }
      }

      localStorage.setItem('offline_route_visits', JSON.stringify(remainingVisits));
      if (syncedVisits > 0) {
        showToast(`✅ Se sincronizaron ${syncedVisits} visita(s) registradas sin señal.`, 'success');
      }
    }
  }, []);

  useEffect(() => {
    const key = getTodayKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setSessionVisits(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }

    syncOfflineData();
    window.addEventListener('online', syncOfflineData);
    return () => {
      window.removeEventListener('online', syncOfflineData);
    };
  }, [syncOfflineData]);

  const cleanCityName = (city: string | null | undefined): string => {
    if (!city) return 'OTRAS';
    const upper = city.toUpperCase().trim();
    
    // Si contiene paréntesis al inicio o es muy corto o es un número/guión, probablemente sea una indicación o basura
    if (upper.startsWith('(') || upper === '-' || upper === '0' || upper.length <= 3 || !/[A-Z]/.test(upper)) {
      const KNOWN = [
        'BUNGE', 'VILLEGAS', 'PIEDRITAS', 'ALVEAR', 'LARROUDE', 'TEJEDOR', 'SAUZE', 'CHARLONE', 'BUCHARDO', 'REALICO', 'AMEGHINO'
      ];
      for (const k of KNOWN) {
        if (upper.includes(k)) {
          if (k === 'BUNGE') return 'EMILIO V. BUNGE';
          if (k === 'VILLEGAS') return 'GENERAL VILLEGAS';
          if (k === 'ALVEAR') return 'INTENDENTE ALVEAR';
          if (k === 'SAUZE') return 'VILLA SAUZE';
          if (k === 'CHARLONE') return 'CORONEL CHARLONE';
          if (k === 'BUCHARDO') return 'BUCHARDO';
          return k;
        }
      }
      return 'OTRAS';
    }

    const MAIN_MAPPINGS: { [key: string]: string } = {
      'BUNGE': 'EMILIO V. BUNGE',
      'VILLEGAS': 'GENERAL VILLEGAS',
      'ALVEAR': 'INTENDENTE ALVEAR',
      'SAUZE': 'VILLA SAUZE',
      'CHARLONE': 'CORONEL CHARLONE',
      'BUCHARDO': 'BUCHARDO',
      'AMERICA': 'AMERICA',
      'LARROUDE': 'BERNARDO LARROUDE'
    };

    for (const key in MAIN_MAPPINGS) {
      if (upper.includes(key)) {
        return MAIN_MAPPINGS[key];
      }
    }

    return upper;
  };

  const uniqueCities = React.useMemo(() => {
    const cleaned = clients.map(c => cleanCityName(c.city));
    const unique = [...new Set(cleaned)];
    const hasOtros = unique.includes('OTRAS');
    const sorted = unique.filter(c => c !== 'OTRAS').sort();
    if (hasOtros) sorted.push('OTRAS');
    return sorted;
  }, [clients]);

  const getClientChecklistStatus = (clientId: number) => {
    const today = new Date().toDateString();
    const hasOrderToday = orders.some(o => 
      o.clientId === clientId && 
      new Date(o.createdAt).toDateString() === today && 
      o.status !== 'CANCELLED'
    );
    if (hasOrderToday) return { status: 'VENTA' };
    return sessionVisits[clientId] || null;
  };

  // Filtrar clientes para la selección del pedido
  const filteredClientsForSelect = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(clientFilter.toLowerCase()) || 
      (c.cuit && c.cuit.includes(clientFilter));
    const matchesCity = selectedCityFilters.length === 0 || selectedCityFilters.includes(cleanCityName(c.city));
    return matchesSearch && matchesCity;
  });

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) return '';
    const formatted = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`;
    return `https://wa.me/${formatted}`;
  };

  const getItemPrice = (product: any, client: any) => {
    if (!client) return Math.round(Number(product.listPrice));
    let price = Number(product.listPrice);
    if (client.priceList === 'B') {
      price = Number(product.listPriceB) > 0 ? Number(product.listPriceB) : Number(product.listPrice);
    } else if (client.priceList === 'C') {
      price = Number(product.listPriceC) > 0 ? Number(product.listPriceC) : Number(product.listPrice);
    }

    let discount = Number(client.discount || 0);
    const isQuesoRemottiOrMelincue = product.rubro?.name === 'REMOTTI' || product.description?.toUpperCase() === 'REMOTTI' || product.name?.toUpperCase().includes('REMOTTI') || product.description?.toUpperCase() === 'MELINCUE' || product.name?.toUpperCase().includes('MELINCUE');

    const isFanberlian = client.name?.toUpperCase().includes('FANBERLIAN');
    if (isFanberlian) {
      if (isQuesoRemottiOrMelincue) {
        discount = 3; // 3% de descuento en quesos
      } else {
        discount = 4; // 4% de descuento general en el resto
      }
    } else if (client.priceList === 'ESPECIAL_QUESOS') {
      if (isQuesoRemottiOrMelincue) {
        discount = 3; // 3% de descuento en quesos
      } else {
        discount = 0;
      }
    } else if (client.priceList === 'B') {
      const isMelincue = product.description?.toUpperCase() === 'MELINCUE' || product.name?.toUpperCase().includes('MELINCUE');
      if (isMelincue) {
        discount = 3;
      } else {
        discount = 0;
      }
    }

    return Math.round(price * (1 - discount / 100));
  };


  const fetchData = useCallback(async () => {
    setErrorMsg(null);
    try {
      if (activeTab === 'orders' || activeTab === 'history') {
        const clientData = await api.getClients();
        setClients(clientData.filter((c: any) => c.isActive !== false));
        const prodData = await api.getProducts(prodSearchQuery);
        setProducts(prodData);
        const orderData = await api.getOrders();
        setOrders(orderData);
        const rubroData = await api.getRubros();
        setRubros(rubroData);
      } else if (activeTab === 'clients') {
        // Cargar rutas del vendedor
        const routesData = await api.getSellerSaleRoutes();
        setVendedorRoutes(routesData.routes || []);
        
        // Cargar visitas de hoy
        const visitsData = await api.getTodayVisits();
        setTodayVisits(visitsData.visits || []);

        // Determinar qué ruta seleccionar por defecto si no hay ninguna seleccionada
        let routeIdToLoad = selectedRouteId;
        if (!routeIdToLoad && routesData.routes && routesData.routes.length > 0) {
          const daysMap: {[key: number]: string} = {
            0: 'DOMINGO', 1: 'LUNES', 2: 'MARTES', 3: 'MIERCOLES', 4: 'JUEVES', 5: 'VIERNES', 6: 'SABADO'
          };
          const todayDayName = daysMap[new Date().getDay()];
          const todayRoute = routesData.routes.find((r: any) => r.dayOfWeek === todayDayName);
          if (todayRoute) {
            routeIdToLoad = todayRoute.id;
          } else {
            routeIdToLoad = routesData.routes[0].id;
          }
          setSelectedRouteId(routeIdToLoad);
        }

        if (routeIdToLoad) {
          const routeDetail = await api.getSaleRouteById(routeIdToLoad);
          setActiveRouteDetail(routeDetail.route);
          setClients(routeDetail.route.clients || []);
        } else {
          setClients([]);
          setActiveRouteDetail(null);
        }
      } else if (activeTab === 'products') {
        const prodData = await api.getProducts(searchQuery);
        setProducts(prodData);
        const rubroData = await api.getRubros();
        setRubros(rubroData);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener datos.');
    }
  }, [activeTab, prodSearchQuery, selectedRouteId, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling automático cada 30 segundos si la pestaña es clientes
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === 'clients') {
      interval = setInterval(() => {
        fetchData();
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, fetchData]);

  // Limpiar mensajes al cambiar de pestaña
  useEffect(() => {
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [activeTab, subTab]);

  // --- CARRITO DE COMPRAS ---
  const addToCart = (product: any) => {
    const existing = cart.find(item => item.product.id === product.id);
    const minQty = product.minOrderQuantity || 1;
    let newQty = minQty;
    if (existing) {
      if (existing.quantity >= product.stock) {
        setErrorMsg(`Stock máximo disponible para ${product.name} alcanzado.`);
        showToast(`Stock máximo de ${product.name} alcanzado.`, 'error');
        return;
      }
      newQty = existing.quantity + 1;
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: newQty }
          : item
      ));
    } else {
      if (product.stock <= 0) {
        setErrorMsg(`No hay stock disponible de ${product.name}.`);
        showToast(`Sin stock de ${product.name}.`, 'error');
        return;
      }
      setCart([...cart, { product, quantity: newQty }]);
    }
    setErrorMsg(null);
    showToast(`Agregado: ${product.name} (x${newQty}) al carrito.`, 'success');
  };



  const updateCartQty = (productId: number, change: number) => {
    const existing = cart.find(item => item.product.id === productId);
    if (!existing) return;

    const newQty = existing.quantity + change;
    if (newQty <= 0) {
      setCart(cart.filter(item => item.product.id !== productId));
    } else {
      if (newQty > existing.product.stock) {
        setErrorMsg(`Solo hay ${existing.product.stock} unidades en stock.`);
        return;
      }
      setCart(cart.map(item => 
        item.product.id === productId 
          ? { ...item, quantity: newQty }
          : item
      ));
    }
    setErrorMsg(null);
  };

  const getCartTotal = () => {
    return cart.reduce((acc, curr) => {
      const price = getItemPrice(curr.product, selectedClient);
      const qtyOrWeight = curr.product.isPesable 
        ? curr.quantity * (curr.product.approximateWeight || 1)
        : curr.quantity;
      return acc + Math.round(price * qtyOrWeight);
    }, 0);
  };

  // --- CONFIRMAR PEDIDO (3-CLICS) CON SOPORTE OFFLINE ---
  const handleConfirmOrder = async () => {
    if (!selectedClient) {
      setErrorMsg('Debe seleccionar un cliente antes de confirmar.');
      return;
    }
    if (cart.length === 0) {
      setErrorMsg('El carrito está vacío.');
      return;
    }

    const items = cart.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      isEmergencyOverride: Boolean((item as any).isEmergencyOverride || (item.quantity < (item.product.minOrderQuantity || 1)))
    }));

    const orderPayload = {
      clientId: selectedClient.id,
      items,
      notes: orderNotes
    };

    if (!navigator.onLine) {
      const offlineOrders = JSON.parse(localStorage.getItem('offline_orders') || '[]');
      offlineOrders.push({
        ...orderPayload,
        clientName: selectedClient.name,
        routeId: selectedRouteId,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('offline_orders', JSON.stringify(offlineOrders));

      const updatedVisits = {
        ...sessionVisits,
        [selectedClient.id]: { status: 'VENTA' }
      };
      setSessionVisits(updatedVisits);
      localStorage.setItem(getTodayKey(), JSON.stringify(updatedVisits));

      setSuccessMsg(`⚠️ Sin señal. El pedido de "${selectedClient.name}" se guardó localmente en tu celular. Se enviará a depósito automáticamente al recuperar conexión.`);
      setCart([]);
      setOrderNotes('');
      setSelectedClient(null);
      setClientFilter('');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.createOrder(orderPayload);

      // Registrar visita en base de datos si hay ruta activa
      if (selectedRouteId) {
        try {
          await api.recordRouteVisit(selectedRouteId, {
            personaId: selectedClient.id,
            status: 'ORDERED'
          });
        } catch (e) {
          console.error("Error al registrar visita silenciosa de venta:", e);
        }
      }

      // Registrar venta en sessionVisits
      const updatedVisits = {
        ...sessionVisits,
        [selectedClient.id]: { status: 'VENTA' }
      };
      setSessionVisits(updatedVisits);
      localStorage.setItem(getTodayKey(), JSON.stringify(updatedVisits));

      setSuccessMsg(`✅ ¡Pedido cargado con éxito! Se envió a depósito para su armado.`);
      setCart([]);
      setOrderNotes('');
      setSelectedClient(null);
      setClientFilter('');
      setSubTab('list'); // Ir al historial
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el pedido.');
    } finally {
      setLoading(false);
    }
  };

  // --- FUNCIONES DE PREVENTA DEL VENDEDOR ---
  const handleSelectRoute = async (routeId: number) => {
    setSelectedRouteId(routeId);
    setLoading(true);
    try {
      const routeDetail = await api.getSaleRouteById(routeId);
      setActiveRouteDetail(routeDetail.route);
      setClients(routeDetail.route.clients || []);
    } catch (err: any) {
      setErrorMsg('Error al cargar la ruta: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordNoSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noSaleModal || !selectedRouteId) return;

    if (!navigator.onLine) {
      const pendingQueue = JSON.parse(localStorage.getItem('offline_route_visits') || '[]');
      pendingQueue.push({
        routeId: selectedRouteId,
        personaId: noSaleModal.clientId,
        status: 'NO_BUY',
        noBuyReason: noSaleModal.reason,
        notes: noSaleModal.notes,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('offline_route_visits', JSON.stringify(pendingQueue));
      setSuccessMsg('⚠️ Sin conexión. La visita se guardó localmente y se sincronizará al recuperar señal.');
      setNoSaleModal(null);
      return;
    }

    setLoading(true);
    try {
      let lat = null;
      let lng = null;

      // Intentar obtener geolocalización
      if (navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lat = pos.coords.latitude;
              lng = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { timeout: 3000 }
          );
        });
      }

      await api.recordRouteVisit(selectedRouteId, {
        personaId: noSaleModal.clientId,
        status: 'NO_BUY',
        noBuyReason: noSaleModal.reason,
        notes: noSaleModal.notes,
        latitude: lat,
        longitude: lng
      });

      // Actualizar también visitas de hoy
      const visitsData = await api.getTodayVisits();
      setTodayVisits(visitsData.visits || []);

      setSuccessMsg(`Visita registrada con éxito.`);
      setNoSaleModal(null);
      
      // Recargar ruta activa
      const routeDetail = await api.getSaleRouteById(selectedRouteId);
      setActiveRouteDetail(routeDetail.route);
      setClients(routeDetail.route.clients || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar visita.');
    } finally {
      setLoading(false);
    }
  };

  // --- REGISTRAR NUEVO CLIENTE EN CALLE ---
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientModal.name) {
      setErrorMsg('El nombre es obligatorio.');
      return;
    }

    try {
      const client = await api.createClient({
        name: clientModal.name,
        cuit: clientModal.cuit,
        address: clientModal.address,
        city: clientModal.city,
        phone: clientModal.phone,
        email: clientModal.email,
        route: clientModal.route,
        saleRouteId: clientModal.saleRouteId ? Number(clientModal.saleRouteId) : null,
        latitude: clientModal.latitude,
        longitude: clientModal.longitude
      });
      
      setClientModal({ open: false, name: '', cuit: '', address: '', city: '', phone: '', email: '', route: '', saleRouteId: '', latitude: null, longitude: null });
      setSelectedClient(client); // Auto-seleccionar cliente creado
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar cliente.');
    }
  };

  const handleOpenEditOrder = async (order: any) => {
    try {
      const prods = await api.getProducts();
      setProducts(prods);
      
      const items = order.items.map((i: any) => ({
        id: i.id,
        productId: i.productId,
        name: i.product?.name || 'Artículo',
        sku: i.product?.sku || '',
        quantity: i.quantity,
        weight: i.weight,
        isPesable: i.product?.isPesable,
        approximateWeight: i.product?.approximateWeight,
        listPrice: i.price || i.unitPrice || (i.product ? i.product.listPrice : 0)
      }));
      
      setEditOrderModal({
        open: true,
        orderId: order.id,
        clientId: order.clientId,
        clientName: order.client?.name || order.persona?.name || 'Cliente',
        items
      });
    } catch (err: any) {
      setErrorMsg('Error al cargar datos para edición.');
    }
  };

  const handleEditOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrderModal) return;
    
    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      const itemsPayload = editOrderModal.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        weight: item.weight || null
      }));
      
      await api.updateOrder(editOrderModal.orderId, { items: itemsPayload });
      setEditOrderModal(null);
      setSuccessMsg(`Pedido #${editOrderModal.orderId} actualizado con éxito.`);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar el pedido.');
    }
  };

  const printTicket = (order: any) => {
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) return;

    const companyLogo = localStorage.getItem('company_nombre_fantasia') || 'DV DISTRIBUIDORA';
    const companySub = localStorage.getItem('company_razon_social') || 'Mayorista de Alimentos & Bebidas';
    const companyCuitVal = localStorage.getItem('company_cuit') || '30-71717171-9';

    printWindow.document.write(`
      <html>
        <head>
          <title>Comprobante Pedido #${order.id}</title>
          <style>
            body { font-family: monospace; padding: 20px; color: #000; font-size: 13px; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { font-size: 1.6rem; font-weight: bold; margin-bottom: 4px; }
            .divider { border-top: 1px dashed #000; margin: 12px 0; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 4px; }
            td { padding: 4px 0; }
            .text-right { text-align: right; }
            .footer { text-align: center; margin-top: 30px; font-size: 0.85rem; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">${companyLogo}</div>
            <div>${companySub}</div>
            <div>CUIT: ${companyCuitVal}</div>
            <div>Fecha: ${new Date(order.createdAt || Date.now()).toLocaleString('es-AR')}</div>
            <div><strong>PEDIDO NRO: ${order.id}</strong></div>
          </div>
          <div class="divider"></div>
          <div><strong>Cliente:</strong> ${order.client?.name || order.persona?.name || 'S/D'}</div>
          <div><strong>CUIT:</strong> ${order.client?.cuit || order.persona?.cuit || 'Consumidor Final'}</div>
          <div><strong>Dirección:</strong> ${order.client?.address || order.persona?.address || 'Retira en local'}</div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th>Articulo</th>
                <th class="text-right">Cant</th>
                <th class="text-right">Unit</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item: any) => {
                const price = Number(item.unitPrice ?? item.price ?? 0);
                const isPesable = item.product?.isPesable || (item.weight && Number(item.weight) > 0);
                const subtotal = item.subtotal ? Number(item.subtotal) : (isPesable ? item.quantity * (item.product?.approximateWeight || 1) * price : item.quantity * price);
                const cantDisplay = isPesable && item.weight ? `${item.quantity} u (${Number(item.weight).toFixed(2)} kg)` : (isPesable ? `${item.quantity} u (${(item.quantity * (item.product?.approximateWeight || 1)).toLocaleString()} kg aprox)` : `${item.quantity} u`);
                return `
                  <tr>
                    <td>${item.product?.name || 'Artículo'}</td>
                    <td class="text-right">${cantDisplay}</td>
                    <td class="text-right">$${Math.round(price).toLocaleString('es-AR')}${isPesable ? '/Kg' : ''}</td>
                    <td class="text-right">$${Math.round(subtotal).toLocaleString('es-AR')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem;">
            <span>TOTAL A PAGAR:</span>
            <span>$${Math.round(Number(order.totalAmount)).toLocaleString('es-AR')}</span>
          </div>
          <div style="margin-top: 6px;"><strong>Canal Facturación:</strong> ${order.billingType === 'OFFICIAL' ? 'Sucursal A (Con CAE/AFIP)' : 'Sucursal X (Presupuesto Interno)'}</div>
          <div><strong>Nro Comprobante:</strong> ${order.invoiceNumber || 'No Facturado (Pendiente)'}</div>
          <div class="divider"></div>
          <div class="footer">
            <p>¡Muchas gracias por su compra!</p>
            <p>Para reclamos o logística conserve este ticket</p>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div style={{ width: '100%' }}>
      {errorMsg && (
        <div style={{
          backgroundColor: 'var(--accent-bg-light)',
          color: 'var(--accent-color)',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          marginBottom: '20px',
          border: '1px solid rgba(var(--color-corp-red-rgb), 0.15)'
        }}>
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div style={{
          backgroundColor: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          padding: '16px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.9rem',
          fontWeight: 500,
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid rgba(52, 199, 89, 0.15)'
        }}>
          <CheckCircle2 size={18} />
          {successMsg}
        </div>
      )}

      {/* ====================================================================
          1. TOMA DE PEDIDOS
          ==================================================================== */}
      {activeTab === 'orders' && (
        <div>
          <div>
            <div>
              {/* Clic 1: Seleccionar Cliente */}
              <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ background: 'var(--text-primary)', color: '#fff', width: '20px', height: '20px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>1</span>
                  <span>Seleccionar Cliente</span>
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="🔍 Filtrar cliente por nombre..."
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '10px' }}
                  />

                  {/* Chips horizontales de localidad */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '6px', 
                    overflowX: 'auto', 
                    padding: '4px 2px', 
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                  }}>
                    <button
                      type="button"
                      onClick={() => setSelectedCityFilters([])}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '15px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: '1px solid',
                        borderColor: selectedCityFilters.length === 0 ? 'var(--text-primary)' : 'var(--border-color)',
                        backgroundColor: selectedCityFilters.length === 0 ? 'var(--text-primary)' : '#fff',
                        color: selectedCityFilters.length === 0 ? '#fff' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Todas
                    </button>
                    {uniqueCities.map(city => {
                      const isActive = selectedCityFilters.includes(city);
                      return (
                        <button
                          key={city}
                          type="button"
                          onClick={() => {
                            if (isActive) {
                              setSelectedCityFilters(selectedCityFilters.filter(c => c !== city));
                            } else {
                              setSelectedCityFilters([...selectedCityFilters, city]);
                            }
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '15px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            border: '1px solid',
                            borderColor: isActive ? 'var(--accent-color)' : 'var(--border-color)',
                            backgroundColor: isActive ? 'rgba(var(--color-corp-red-rgb), 0.06)' : '#fff',
                            color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {city}
                        </button>
                      );
                    })}
                  </div>
                  <div className="client-select-row">
                    <div style={{ flex: 1, position: 'relative' }}>
                      <select
                        className="select"
                        value={selectedClient ? selectedClient.id : ''}
                        onChange={(e) => {
                           const client = clients.find(c => c.id === Number(e.target.value));
                           setSelectedClient(client || null);
                        }}
                        style={{ paddingRight: '40px' }}
                      >
                        <option value="">
                          {clientFilter.trim() 
                            ? `-- Seleccionar de los ${filteredClientsForSelect.length} filtrados --`
                            : "-- Selecciona un cliente registrado --"
                          }
                        </option>
                        {filteredClientsForSelect.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button className="btn btn-secondary" style={{ padding: '8px 12px' }} title="Nuevo Cliente" onClick={() => setClientModal({ open: true, name: '', cuit: '', address: '', city: '', phone: '', email: '', route: '', saleRouteId: '', latitude: null, longitude: null })}>
                      <UserPlus size={16} />
                    </button>
                  </div>
                </div>
                {selectedClient && (
                  <div style={{ marginTop: '10px', fontSize: '0.825rem', display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px', backgroundColor: 'var(--bg-light)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div>
                      <strong>Dirección:</strong> {selectedClient.address || 'Sin registrar'} | <strong>Teléfono:</strong> {selectedClient.phone || 'Sin registrar'}
                      {selectedClient.phone && (
                        <a 
                          href={getWhatsAppLink(selectedClient.phone)} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          title="Escribir por WhatsApp" 
                          style={{ marginLeft: '6px', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                          </svg>
                        </a>
                      )}
                    </div>
                    <div className="client-info-stats">
                      <span><strong>Saldo C/C:</strong> <span style={{ 
                        color: Number(selectedClient.outstandingBalance || 0) > 0 
                          ? 'var(--color-danger)' 
                          : Number(selectedClient.outstandingBalance || 0) < 0 
                            ? 'var(--color-success)' 
                            : 'var(--text-primary)', 
                        fontWeight: 600 
                      }}>
                        {Number(selectedClient.outstandingBalance || 0) < 0 
                          ? `$${Math.abs(Number(selectedClient.outstandingBalance)).toLocaleString()} (A Favor)` 
                          : `$${Number(selectedClient.outstandingBalance || 0).toLocaleString()}`}
                      </span></span>
                      <span><strong>Límite Crédito:</strong> <span style={{ fontWeight: 600 }}>${(selectedClient.creditLimit || 0).toLocaleString()}</span></span>
                      <span><strong>Lista:</strong> <span style={{ fontWeight: 600 }}>{selectedClient.priceList === 'C' ? 'Lista Especial 2' : selectedClient.priceList === 'B' ? 'Lista Especial' : 'Lista 4'}</span></span>
                      {Number(selectedClient.discount || 0) > 0 && (
                        <span style={{ color: 'var(--color-success)' }}><strong>Desc. Fijo:</strong> {selectedClient.discount}%</span>
                      )}
                    </div>
                    {Number(selectedClient.outstandingBalance || 0) > 0 && (
                      <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#FFF9E6', border: '1px solid #FFE0B2', borderRadius: '4px', color: '#B78103', fontSize: '0.775rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <strong>⚠️ Cuenta con Deuda Pendiente:</strong>
                        <span>Este cliente posee una deuda activa de <strong>${Number(selectedClient.outstandingBalance).toLocaleString()}</strong>. Se registrará el pedido, pero quedará sujeto a aprobación de administración.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Clic 2: Armar Carrito de Compras */}
              <div className="order-creation-grid">
                {/* Columna Izquierda: Catálogo */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ background: 'var(--text-primary)', color: '#fff', width: '20px', height: '20px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>2</span>
                    <span>Agregar Productos al Carrito</span>
                  </h3>
                  
                  <div className="catalog-filters-row">
                    <div className="search-input-wrapper" style={{ flex: 1.2 }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="🔍 Filtrar catálogo..."
                        value={prodSearchQuery}
                        onChange={(e) => setProdSearchQuery(e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <select
                        className="input"
                        value={filterRubroId}
                        onChange={(e) => setFilterRubroId(e.target.value)}
                        style={{ height: '40px', fontSize: '0.85rem', padding: '8px 12px' }}
                      >
                        <option value="">-- Todos los Rubros --</option>
                        {rubros.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>

                  </div>

                  <div className="catalog-grid" style={{ flex: 1, maxHeight: '600px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px', padding: '10px 4px' }}>
                    {(() => {
                      const filtered = products
                        .filter(p => {
                          if (filterRubroId && Number(p.rubroId) !== Number(filterRubroId)) return false;
                          return true;
                        })
                        .sort((a, b) => {
                          const rubroA = rubros.find(r => Number(r.id) === Number(a.rubroId))?.name || 'Z';
                          const rubroB = rubros.find(r => Number(r.id) === Number(b.rubroId))?.name || 'Z';
                          if (rubroA < rubroB) return -1;
                          if (rubroA > rubroB) return 1;
                          return a.name.localeCompare(b.name);
                        });

                      return filtered.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>No se encontraron productos.</div>
                      ) : (
                        filtered.map(p => {
                          const price = getItemPrice(p, selectedClient);
                          const isMelincue = p.description?.toUpperCase() === 'MELINCUE' || p.name?.toUpperCase().includes('MELINCUE');
                          const hasCustomPrice = selectedClient && (
                             (selectedClient.priceList === 'B' && (isMelincue || Number(p.listPriceB || 0) > 0)) ||
                             (selectedClient.priceList === 'C' && Number(p.listPriceC || 0) > 0) ||
                             Number(selectedClient.discount || 0) > 0
                           );
                          
                          const imgSrc = p.imageUrl ? (p.imageUrl.startsWith('http') ? p.imageUrl : (p.imageUrl.startsWith('/') ? `${p.imageUrl}?v=1.1` : `/uploads/products/${p.imageUrl}?v=1.1`)) : null;
                          const cartItem = cart.find(item => item.product.id === p.id);

                           return (
                             <div key={p.id} className="product-card" style={{ 
                               backgroundColor: '#fff', 
                               borderRadius: '4px', 
                               border: cartItem ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent', 
                               overflow: 'hidden', 
                               display: 'flex', 
                               flexDirection: 'column',
                               alignItems: 'center',
                               padding: '12px',
                               transition: 'all 0.2s ease',
                               cursor: 'pointer',
                               boxShadow: cartItem ? '0 4px 12px rgba(16, 185, 129, 0.08)' : 'none'
                             }}
                             onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = cartItem ? '0 6px 16px rgba(16, 185, 129, 0.15)' : '0 6px 16px rgba(0,0,0,0.06)'; }}
                             onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = cartItem ? '0 4px 12px rgba(16, 185, 129, 0.08)' : 'none'; }}
                             onClick={() => { if(p.stock > 0) addToCart(p); }}
                             >
                               <div style={{ position: 'relative', height: '130px', width: '100%', backgroundColor: '#f8fafc', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                 {imgSrc ? (
                                   <img 
                                     src={imgSrc} 
                                     alt={p.name} 
                                     style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                     loading="lazy" 
                                     onError={(e) => {
                                       e.currentTarget.style.display = 'none';
                                       if (e.currentTarget.nextElementSibling) {
                                         (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                       }
                                     }}
                                   />
                                 ) : null}
                                 <div 
                                   style={{ 
                                     display: imgSrc ? 'none' : 'flex', 
                                     width: '100%', 
                                     height: '100%', 
                                     alignItems: 'center', 
                                     justifyContent: 'center', 
                                     flexDirection: 'column', 
                                     backgroundColor: '#f8fafc',
                                     color: '#94a3b8'
                                   }}
                                 >
                                   <Package size={34} color="#cbd5e1" />
                                   <span style={{ fontSize: '0.68rem', marginTop: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sin foto</span>
                                 </div>

                                 {cartItem && (
                                   <div style={{
                                     position: 'absolute',
                                     top: '0',
                                     left: '0',
                                     backgroundColor: '#10B981',
                                     color: '#fff',
                                     fontSize: '0.65rem',
                                     fontWeight: 700,
                                     padding: '2px 8px',
                                     borderRadius: '4px',
                                     boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                                     zIndex: 2,
                                     display: 'flex',
                                     alignItems: 'center',
                                     gap: '4px'
                                   }}>
                                     <ShoppingCart size={10} />
                                     <span>{cartItem.quantity} en carrito</span>
                                   </div>
                                 )}
                                 {p.stock <= p.minStock && p.stock > 0 && (
                                    <span style={{ position: 'absolute', top: '0', right: '0', background: 'var(--color-warning)', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Poco Stock</span>
                                 )}
                                 {p.stock <= 0 && (
                                    <span style={{ position: 'absolute', top: '0', right: '0', background: 'var(--color-danger)', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Agotado</span>
                                 )}
                               </div>
                               
                               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', textAlign: 'center', flex: 1 }}>
                                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                                   <span style={{ fontWeight: 800, fontSize: '1.3rem', color: hasCustomPrice ? 'var(--color-success)' : 'var(--text-primary)', lineHeight: '1' }}>
                                     ${price.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                     {p.isPesable && <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}> / Kg</span>}
                                   </span>
                                   
                                   {hasCustomPrice && (
                                     <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', textDecoration: 'line-through', marginTop: '2px', fontWeight: 600 }}>
                                       Antes: ${Number(p.listPrice).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{p.isPesable ? ' / Kg' : ''}
                                     </span>
                                   )}
                                   
                                   <div style={{ fontWeight: 600, fontSize: '0.8rem', marginTop: '8px', lineHeight: '1.2', color: 'var(--text-primary)' }}>
                                     {p.name}
                                   </div>
                                 </div>

                                 <button
                                   type="button"
                                   style={{
                                     marginTop: '12px',
                                     width: '100%',
                                     padding: '8px',
                                     borderRadius: '20px',
                                     backgroundColor: p.stock <= 0 
                                       ? 'var(--border-color)' 
                                       : cartItem 
                                         ? '#10B981' 
                                         : 'var(--text-primary)',
                                     color: p.stock <= 0 ? 'var(--text-secondary)' : '#fff',
                                     border: 'none',
                                     fontWeight: 700,
                                     fontSize: '0.75rem',
                                     cursor: p.stock <= 0 ? 'not-allowed' : 'pointer',
                                     transition: 'all 0.2s ease'
                                   }}
                                   onClick={(e) => { e.stopPropagation(); addToCart(p); }}
                                   disabled={p.stock <= 0}
                                   onMouseEnter={(e) => { if (p.stock > 0) e.currentTarget.style.opacity = '0.9'; }}
                                   onMouseLeave={(e) => { if (p.stock > 0) e.currentTarget.style.opacity = '1'; }}
                                 >
                                   {p.stock <= 0 
                                     ? 'AGOTADO' 
                                     : cartItem 
                                       ? `AGREGAR OTRO (+${cartItem.quantity})` 
                                       : '+ AGREGAR'}
                                 </button>
                               </div>
                             </div>
                           );
                        })
                      );
                    })()}
                  </div>
                </div>

                {/* Columna Derecha: Carrito */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShoppingCart size={18} />
                      <span>Detalle del Pedido</span>
                    </h3>
                  </div>

                  <div className="cart-list" style={{ flex: 1, backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                    {cart.length === 0 ? (
                      <div style={{ display: 'flex', height: '150px', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-secondary)', gap: '8px' }}>
                        <ShoppingCart size={24} />
                        <p style={{ fontSize: '0.8rem' }}>El carrito de compras está vacío.</p>
                      </div>
                    ) : (
                      cart.map(item => {
                        const itemPrice = getItemPrice(item.product, selectedClient);
                        return (
                          <div key={item.product.id} className="list-item" style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                {item.product.name}
                                {item.product.isPesable && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--color-danger)', marginLeft: '6px', fontWeight: 600 }}>
                                    ({(item.quantity * (item.product.approximateWeight || 1)).toLocaleString()} Kg aprox.)
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {item.product.isPesable ? (
                                  <>Subtotal: ${Math.round(itemPrice * item.quantity * (item.product.approximateWeight || 1)).toLocaleString()} (${itemPrice.toLocaleString()} / Kg)</>
                                ) : (
                                  <>Subtotal: ${(itemPrice * item.quantity).toLocaleString()} (${itemPrice.toLocaleString()} c/u)</>
                                )}
                              </div>
                              {item.quantity < (item.product.minOrderQuantity || 1) && (
                                <div style={{ marginTop: '3px', fontSize: '0.7rem', color: '#e30613', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontWeight: 700 }}>⚠️ Mín: {item.product.minOrderQuantity} u.</span>
                                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer', fontWeight: 600 }}>
                                    <input
                                      type="checkbox"
                                      checked={Boolean((item as any).isEmergencyOverride)}
                                      onChange={(e) => {
                                        setCart(cart.map(c => c.product.id === item.product.id ? { ...c, isEmergencyOverride: e.target.checked } : c));
                                      }}
                                    />
                                    Excepción Emergencia
                                  </label>
                                </div>
                              )}
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button className="btn btn-secondary" style={{ padding: '2px 6px' }} onClick={() => updateCartQty(item.product.id, -1)}>-</button>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.quantity}</span>
                              <button className="btn btn-secondary" style={{ padding: '2px 6px' }} onClick={() => updateCartQty(item.product.id, 1)}>+</button>
                              <button className="btn btn-ghost text-danger" style={{ padding: '4px' }} onClick={() => updateCartQty(item.product.id, -item.quantity)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
                    {/* Notas/Observaciones */}
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        📝 Notas / Observaciones del Envío:
                      </label>
                      <textarea
                        className="input"
                        placeholder="Ej: Entregar después de las 17 hs, tiene cambio..."
                        style={{ width: '100%', fontSize: '0.8rem', padding: '8px', minHeight: '50px', resize: 'vertical' }}
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Importe Total:</span>
                      <span style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                        ${getCartTotal().toLocaleString()}
                      </span>
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '12px', fontWeight: 600 }}
                      onClick={handleConfirmOrder}
                      disabled={loading}
                    >
                      {loading ? 'Procesando...' : 'Confirmar Pedido'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          1.5 HISTORIAL DE PEDIDOS
          ==================================================================== */}
      {activeTab === 'history' && (
        <div>
          <div className="table-container">
            <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Nro Comprobante</th>
                    <th>Canal</th>
                    <th>Total</th>
                    <th>Estado Envío</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0' }}>No registraste pedidos aún.</td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id}>
                        <td style={{ fontSize: '0.8rem' }}>{new Date(o.createdAt).toLocaleDateString('es-AR')}</td>
                        <td style={{ fontWeight: 500 }}>{o.client?.name || o.persona?.name || 'S/D'}</td>
                        <td style={{ fontFamily: 'monospace' }}>{o.invoiceNumber || 'Pendiente'}</td>
                        <td>
                          <span className={o.billingType === 'OFFICIAL' ? 'badge badge-official' : 'badge badge-internal'}>
                            {o.billingType === 'OFFICIAL' ? 'Sucursal A' : 'Sucursal X'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>${Math.round(Number(o.totalAmount)).toLocaleString('es-AR')}</td>
                        <td>
                          {(() => {
                            const statusInfo = getOrderStatusInfo(o);
                            return (
                              <span 
                                className={`badge badge-${statusInfo.badgeClass}`}
                                style={{
                                  backgroundColor: statusInfo.color + '15',
                                  color: statusInfo.color,
                                  border: `1px solid ${statusInfo.color}30`,
                                  fontWeight: 600
                                }}
                              >
                                {statusInfo.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ display: 'flex', gap: '6px' }}>
                          <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} title="Ver Detalle" onClick={() => setOrderDetailsModal(o)}>
                            <Eye size={12} />
                          </button>
                          <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} title="Imprimir Ticket" onClick={() => printTicket(o)}>
                            <Printer size={12} />
                          </button>
                          {o.status === 'PENDING' && (
                            <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} title="Editar Pedido" onClick={() => handleOpenEditOrder(o)}>
                              <Edit size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
        </div>
      )}

      {/* ====================================================================
          2. MIS CLIENTES
          ==================================================================== */}
      {activeTab === 'clients' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Fila superior: Selector de ruta y Nuevo Cliente */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
            {vendedorRoutes.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 300px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 Ruta Activa:</span>
                <select
                  className="select"
                  value={selectedRouteId || ''}
                  onChange={(e) => handleSelectRoute(Number(e.target.value))}
                  style={{ height: '36px', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem' }}
                >
                  {vendedorRoutes.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.dayOfWeek || 'Flexible'})</option>
                  ))}
                </select>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setLoading(true);
                    fetchData().finally(() => setLoading(false));
                  }}
                  title="Actualizar Saldos"
                  style={{ padding: '6px 10px', height: '36px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={16} className={loading ? "spin-animation" : ""} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Sync</span>
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--color-corp-red)', fontWeight: 600 }}>
                ⚠️ No tienes rutas de venta asignadas.
              </div>
            )}

            <button className="btn btn-primary" onClick={() => setClientModal({ open: true, name: '', cuit: '', address: '', city: '', phone: '', email: '', route: '', saleRouteId: selectedRouteId || '', latitude: null, longitude: null })}>
              <UserPlus size={16} />
              <span>Nuevo Cliente (Calle)</span>
            </button>
          </div>

          {/* Barra de Progreso de la Ruta */}
          {activeRouteDetail && (
            (() => {
              const total = clients.length;
              const visitados = clients.filter(c => {
                const hasOrder = orders.some(o => 
                  o.clientId === c.id && 
                  new Date(o.createdAt).toDateString() === new Date().toDateString() &&
                  o.status !== 'CANCELLED'
                );
                const hasNoBuy = todayVisits.some(v => v.personaId === c.id);
                return hasOrder || hasNoBuy;
              }).length;
              const porcentaje = total > 0 ? Math.round((visitados / total) * 100) : 0;

              return (
                <div style={{ padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-light)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    <span>Efectividad de la Ruta de Hoy</span>
                    <span>{visitados} / {total} Clientes Visitados ({porcentaje}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${porcentaje}%`, height: '100%', backgroundColor: porcentaje === 100 ? 'var(--color-success)' : 'var(--accent-color)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })()
          )}

          {/* Listado de Clientes Secuenciado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {clients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 12px', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No hay clientes asociados a la ruta activa, o no has seleccionado ninguna ruta.
              </div>
            ) : (
              clients.map((c, index) => {
                const hasOrderToday = orders.some(o => 
                  o.clientId === c.id && 
                  new Date(o.createdAt).toDateString() === new Date().toDateString() &&
                  o.status !== 'CANCELLED'
                );
                
                const visitToday = todayVisits.find(v => v.personaId === c.id);
                const visitStatus = hasOrderToday ? 'VENTA' : (visitToday ? 'NO_COMPRO' : 'PENDIENTE');

                return (
                  <div
                    key={c.id}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      backgroundColor: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                    className="client-card-hover"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                          #{index + 1}
                        </span>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</h4>
                      </div>
                      
                      {Number(c.outstandingBalance || 0) > 0 && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-corp-red)', backgroundColor: 'rgba(var(--color-corp-red-rgb),0.05)', padding: '3px 8px', borderRadius: '12px', border: '1px solid rgba(var(--color-corp-red-rgb),0.15)' }}>
                          Debe: ${Math.round(Number(c.outstandingBalance)).toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} /> {c.address || 'Sin dirección'} {c.city ? `(${c.city})` : ''}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {c.route && (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                            📍 Reparto: {c.route}
                          </span>
                        )}
                        {c.phone && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={12} /> {c.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        {visitStatus === 'VENTA' ? (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(52, 199, 89, 0.15)', color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> Compró
                          </span>
                        ) : visitStatus === 'NO_COMPRO' ? (
                          <span
                            title={`Motivo: ${visitToday?.noBuyReason || 'No especificado'}`}
                            style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(142, 142, 147, 0.15)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            ⚠️ No Compró ({visitToday?.noBuyReason})
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(0, 122, 255, 0.1)', color: '#007AFF', display: 'inline-flex', alignItems: 'center' }}>
                            ⚪ Pendiente
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        {c.phone && (
                          <a
                            href={getWhatsAppLink(c.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: '6px', minWidth: 'auto', borderRadius: '6px' }}
                            title="Escribir por WhatsApp"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                            </svg>
                          </a>
                        )}

                        {c.latitude && c.longitude ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: '6px', minWidth: 'auto', borderRadius: '6px' }}
                            title="Ver ubicación en mapa"
                          >
                            <Navigation size={14} />
                          </a>
                        ) : (
                          <button
                            disabled
                            className="btn btn-secondary"
                            style={{ padding: '6px', minWidth: 'auto', borderRadius: '6px', opacity: 0.3 }}
                            title="Sin coordenadas GPS"
                          >
                            <Navigation size={14} />
                          </button>
                        )}

                        <button
                          className="btn btn-secondary"
                          onClick={() => setNoSaleModal({ open: true, clientId: c.id, clientName: c.name, reason: 'Local Cerrado', notes: '' })}
                          style={{ padding: '6px 10px', fontSize: '0.72rem', borderRadius: '6px' }}
                          disabled={visitStatus !== 'PENDIENTE'}
                        >
                          No Compra
                        </button>
                        
                        {Number(c.outstandingBalance || 0) > 0 && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              setSelectedClient(c);
                              setActiveTab('cobranzas');
                            }}
                            style={{ padding: '6px 10px', fontSize: '0.72rem', borderRadius: '6px', color: 'var(--color-corp-red)' }}
                          >
                            Cobrar
                          </button>
                        )}

                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            setSelectedClient(c);
                            setActiveTab('orders');
                            setSubTab('create');
                          }}
                          style={{ padding: '6px 12px', fontSize: '0.72rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}
                          disabled={visitStatus === 'VENTA'}
                        >
                          <span>Vender</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          3. CATALOGO DE PRODUCTOS (READ-ONLY)
          ==================================================================== */}
      {activeTab === 'cobranzas' && (
        <MobileCobros 
          selectedCityFilters={selectedCityFilters}
          setSelectedCityFilters={setSelectedCityFilters}
          uniqueCities={uniqueCities}
          cleanCityName={cleanCityName}
        />
      )}

      {activeTab === 'products' && (
        <div className="no-print">
          <div className="actions-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
            <div className="search-input-wrapper" style={{ flex: 1, minWidth: '250px' }}>
              <input
                type="text"
                className="input"
                placeholder="🔍 Buscar en el catálogo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0, minWidth: '180px' }}>
              <select
                className="input"
                style={{ height: '40px', fontSize: '0.85rem', padding: '8px 12px' }}
                value={filterRubroId}
                onChange={(e) => setFilterRubroId(e.target.value)}
              >
                <option value="">-- Todos los Rubros --</option>
                {rubros.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <button 
              type="button"
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              onClick={() => setIsPriceListModalOpen(true)}
            >
              <span>📄 </span>
              <span>Listas PDF</span>
            </button>
          </div>

          <div className="catalog-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px', padding: '10px 4px' }}>
            {(() => {
              const filtered = products
                .filter(p => {
                  if (filterRubroId && Number(p.rubroId) !== Number(filterRubroId)) return false;
                  return true;
                })
                .sort((a, b) => {
                  const rubroA = rubros.find(r => Number(r.id) === Number(a.rubroId))?.name || 'Z';
                  const rubroB = rubros.find(r => Number(r.id) === Number(b.rubroId))?.name || 'Z';
                  if (rubroA < rubroB) return -1;
                  if (rubroA > rubroB) return 1;
                  return a.name.localeCompare(b.name);
                });

              return filtered.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>No se encontraron productos.</div>
              ) : (
                filtered.map((p) => {
                  const imgSrc = p.imageUrl ? (p.imageUrl.startsWith('http') ? p.imageUrl : (p.imageUrl.startsWith('/') ? `${p.imageUrl}?v=1.1` : `/uploads/products/${p.imageUrl}?v=1.1`)) : null;

                  return (
                    <div key={p.id} className="product-card" style={{ 
                      backgroundColor: '#fff', 
                      borderRadius: '4px', 
                      border: '1px solid transparent', 
                      overflow: 'hidden', 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '12px',
                      transition: 'box-shadow 0.2s ease, transform 0.2s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <div style={{ position: 'relative', height: '130px', width: '100%', backgroundColor: '#f8fafc', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {imgSrc ? (
                          <img 
                            src={imgSrc} 
                            alt={p.name} 
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                            loading="lazy" 
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.nextElementSibling) {
                                (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div 
                          style={{ 
                            display: imgSrc ? 'none' : 'flex', 
                            width: '100%', 
                            height: '100%', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            flexDirection: 'column', 
                            backgroundColor: '#f8fafc',
                            color: '#94a3b8'
                          }}
                        >
                          <Package size={34} color="#cbd5e1" />
                          <span style={{ fontSize: '0.68rem', marginTop: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sin foto</span>
                        </div>

                        {p.stock <= p.minStock && p.stock > 0 && (
                           <span style={{ position: 'absolute', top: '0', right: '0', background: 'var(--color-warning)', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Poco Stock</span>
                        )}
                        {p.stock <= 0 && (
                           <span style={{ position: 'absolute', top: '0', right: '0', background: 'var(--color-danger)', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Agotado</span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', textAlign: 'center', flex: 1 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                          <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--text-primary)', lineHeight: '1' }}>
                            ${Number(p.listPrice).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                          
                          <div style={{ fontWeight: 600, fontSize: '0.8rem', marginTop: '8px', lineHeight: '1.2', color: 'var(--text-primary)' }}>
                            {p.name}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal Lista de Precios PDF */}
      {isPriceListModalOpen && (
        <PriceListModal isOpen={isPriceListModalOpen} onClose={() => setIsPriceListModalOpen(false)} />
      )}

      {/* ALTA CLIENTE MODAL */}
      {clientModal.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Registrar Nuevo Cliente</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setClientModal({ ...clientModal, open: false })}>✕</button>
            </div>
            <form onSubmit={handleCreateClient}>
              <div className="form-group">
                <label>Nombre Comercial / Razón Social</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Almacén Don Carlos"
                  value={clientModal.name}
                  onChange={(e) => setClientModal({ ...clientModal, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>CUIT (Sin guiones)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: 20222334449"
                  value={clientModal.cuit}
                  onChange={(e) => setClientModal({ ...clientModal, cuit: e.target.value })}
                  onBlur={async (e) => {
                    const c = e.target.value;
                    if(c && c.length >= 8) {
                      try {
                        const json = await api.getAfipData(c);
                        if(json && json.status === 'success' && json.data) {
                          setClientModal(prev => ({...prev, name: json.data.name || prev.name, address: json.data.address || prev.address, city: json.data.location || prev.city}));
                        } else if (json && json.name) {
                          setClientModal(prev => ({...prev, name: json.name || prev.name, address: json.address || prev.address, city: json.location || prev.city}));
                        }
                      } catch(err) { console.error('Error AFIP', err); }
                    }
                  }}
                />
              </div>

              <div className="form-group">
                <label>Dirección de Entrega</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Belgrano 150, CABA"
                  value={clientModal.address}
                  onChange={(e) => setClientModal({ ...clientModal, address: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Localidad</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: General Villegas"
                  value={clientModal.city || ''}
                  onChange={(e) => setClientModal({ ...clientModal, city: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Zona de Reparto (Chofer)</label>
                <input
                  type="text"
                  list="route-suggestions-mobile"
                  className="input"
                  placeholder="ej: CENTRO 1, TROCHA..."
                  value={clientModal.route || ''}
                  onChange={(e) => setClientModal({ ...clientModal, route: e.target.value })}
                />
                <datalist id="route-suggestions-mobile">
                  <option value="FEDERAL" />
                  <option value="PARQUE" />
                  <option value="CENTRO 1" />
                  <option value="CENTRO 2" />
                  <option value="CENTRO 3" />
                  <option value="CENTRO 4" />
                  <option value="FONAVI" />
                  <option value="PROGRESO" />
                  <option value="TROCHA" />
                  <option value="CICLON" />
                  <option value="CRUCE" />
                </datalist>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    className="input"
                    value={clientModal.phone}
                    onChange={(e) => setClientModal({ ...clientModal, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    className="input"
                    value={clientModal.email}
                    onChange={(e) => setClientModal({ ...clientModal, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label>GPS (Latitud, Longitud)</label>
                  <input
                    type="text"
                    className="input"
                    readOnly
                    placeholder="Ubicación no capturada"
                    value={clientModal.latitude && clientModal.longitude ? `${clientModal.latitude.toFixed(6)}, ${clientModal.longitude.toFixed(6)}` : ''}
                    style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text-secondary)' }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={capturingGps}
                  onClick={async () => {
                    setCapturingGps(true);
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          setClientModal(prev => ({
                            ...prev,
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                          }));
                          setCapturingGps(false);
                          alert('📍 Ubicación capturada con éxito.');
                        },
                        (error) => {
                          setCapturingGps(false);
                          alert('Error al obtener ubicación: Permiso denegado o GPS apagado.');
                        },
                        { enableHighAccuracy: true, timeout: 5000 }
                      );
                    } else {
                      setCapturingGps(false);
                      alert('El navegador no soporta geolocalización.');
                    }
                  }}
                  style={{ height: '38px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {capturingGps ? 'Obteniendo...' : '📍 Capturar GPS'}
                </button>
              </div>

              {vendedorRoutes.length > 0 && (
                <div className="form-group">
                  <label>Asignar a Ruta de Venta</label>
                  <select
                    className="select"
                    value={clientModal.saleRouteId}
                    onChange={(e) => setClientModal({ ...clientModal, saleRouteId: e.target.value })}
                    style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', width: '100%', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                  >
                    <option value="">-- No Asignar a Ruta --</option>
                    {vendedorRoutes.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.dayOfWeek || 'Flexible'})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setClientModal({ ...clientModal, open: false })}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Detalles de pedido */}
      {orderDetailsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Pedido #{orderDetailsModal.id}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setOrderDetailsModal(null)}>✕</button>
            </div>
            
            {/* Barra de progreso de preparación */}
            {orderDetailsModal.status !== 'CANCELLED' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                {[
                  { status: 'RECIBIDO', label: 'Recibido' },
                  { status: 'EN_PICKING', label: 'En Picking' },
                  { status: 'ARMADO', label: 'Armado' },
                  { status: 'FACTURADO', label: 'Facturado' },
                  { status: 'EN_VIAJE', label: 'En Viaje' },
                  { status: 'ENTREGADO', label: 'Entregado' }
                ].map((step, idx, arr) => {
                  const logicalStatus = getOrderStatusInfo(orderDetailsModal).label.toUpperCase().replace(' ', '_');
                  const statusOrder = ['RECIBIDO', 'EN_PICKING', 'ARMADO', 'FACTURADO', 'EN_VIAJE', 'ENTREGADO'];
                  const currentIdx = statusOrder.indexOf(logicalStatus);
                  const stepIdx = statusOrder.indexOf(step.status);
                  const isCompleted = stepIdx <= currentIdx;
                  const isActive = step.status === logicalStatus;
                  
                  return (
                    <React.Fragment key={step.status}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: isCompleted ? 'var(--color-success)' : 'var(--border-color)',
                          color: isCompleted ? '#fff' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          border: isActive ? '2px solid var(--text-primary)' : 'none',
                          transition: 'all 0.3s'
                        }}>
                          {isCompleted ? '✓' : idx + 1}
                        </div>
                        <span style={{ fontSize: '0.7rem', marginTop: '6px', fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {step.label}
                        </span>
                      </div>
                      {idx < arr.length - 1 && (
                        <div style={{
                          height: '2px',
                          flex: 1,
                          backgroundColor: stepIdx < currentIdx ? 'var(--color-success)' : 'var(--border-color)',
                          margin: '0 -10px',
                          transform: 'translateY(-10px)'
                        }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '8px 12px', backgroundColor: '#FFF2F2', color: 'var(--color-danger)', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 500, marginBottom: '16px', display: 'inline-block' }}>
                ❌ Este pedido ha sido CANCELADO.
              </div>
            )}

            <div style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
              <p><strong>Cliente:</strong> {orderDetailsModal.client?.name || orderDetailsModal.persona?.name || 'S/D'}</p>
              <p><strong>Dirección:</strong> {orderDetailsModal.client?.address || orderDetailsModal.persona?.address || 'S/D'}</p>
              <p><strong>Estado:</strong> {(() => {
                const statusInfo = getOrderStatusInfo(orderDetailsModal);
                return (
                  <span 
                    className={`badge badge-${statusInfo.badgeClass}`}
                    style={{
                      backgroundColor: statusInfo.color + '15',
                      color: statusInfo.color,
                      border: `1px solid ${statusInfo.color}30`,
                      fontWeight: 600
                    }}
                  >
                    {statusInfo.label}
                  </span>
                );
              })()}</p>
              <p><strong>Fecha de Carga:</strong> {new Date(orderDetailsModal.createdAt).toLocaleString('es-AR')}</p>
              {orderDetailsModal.notes && (
                <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: '#FEF7E0', borderLeft: '3px solid #FBBC04', borderRadius: '4px' }}>
                  <strong>📝 Notas de Entrega:</strong> {orderDetailsModal.notes}
                </div>
              )}
            </div>

            <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Artículo</th>
                    <th className="text-right">Cantidad</th>
                    <th className="text-right">Precio Unit.</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {orderDetailsModal.items.map((item: any, idx: number) => {
                    const price = Number(item.unitPrice ?? item.price ?? 0);
                    const isPesable = item.product?.isPesable || (item.weight && Number(item.weight) > 0);
                    const subtotal = item.subtotal ? Number(item.subtotal) : (isPesable ? item.quantity * (item.product?.approximateWeight || 1) * price : item.quantity * price);
                    return (
                      <tr key={idx}>
                        <td>{item.product?.name}</td>
                        <td className="text-right">
                          {item.quantity} u.
                          {isPesable && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginLeft: '4px' }}>
                              ({item.weight ? `${Number(item.weight).toFixed(2)} Kg` : `${(item.quantity * (item.product?.approximateWeight || 1)).toLocaleString()} Kg aprox`})
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          ${price.toLocaleString()}
                          {isPesable && ' / Kg'}
                        </td>
                        <td className="text-right">${Math.round(subtotal).toLocaleString('es-AR')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: 'right', marginTop: '20px', fontWeight: 'bold', fontSize: '1.1rem' }}>
              Monto Total: ${Math.round(Number(orderDetailsModal.totalAmount)).toLocaleString('es-AR')}
            </div>
            
            <div className="modal-footer" style={{ marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => { printTicket(orderDetailsModal); setOrderDetailsModal(null); }}>
                <Printer size={16} />
                <span>Imprimir Ticket</span>
              </button>
              <button className="btn btn-primary" onClick={() => setOrderDetailsModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Editar Pedido */}
      {editOrderModal && editOrderModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div className="modal-header">
              <h3>Editar Pedido #{editOrderModal.orderId} - {editOrderModal.clientName}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setEditOrderModal(null)}>✕</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '20px', overflowY: 'auto', flex: 1, padding: '10px 0' }}>
              {/* Catálogo de Productos */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ marginBottom: '10px', fontSize: '0.9rem' }}>Añadir Artículos</h4>
                <div className="search-input-wrapper" style={{ marginBottom: '10px' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="🔍 Buscar producto..."
                    value={prodSearchQuery}
                    onChange={(e) => setProdSearchQuery(e.target.value)}
                  />
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '300px', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '10px' }}>
                  {products
                    .filter(p => p.name.toLowerCase().includes(prodSearchQuery.toLowerCase()) || p.sku.toLowerCase().includes(prodSearchQuery.toLowerCase()))
                    .map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Stock: {p.stock} | ${p.listPrice}</div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => {
                            const existing = editOrderModal.items.find(item => item.productId === p.id);
                            if (existing) {
                              setEditOrderModal({
                                ...editOrderModal,
                                items: editOrderModal.items.map(item =>
                                  item.productId === p.id ? { ...item, quantity: item.quantity + 1 } : item
                                )
                              });
                            } else {
                              setEditOrderModal({
                                ...editOrderModal,
                                items: [...editOrderModal.items, {
                                  id: Date.now(),
                                  productId: p.id,
                                  name: p.name,
                                  sku: p.sku,
                                  quantity: 1,
                                  isPesable: p.isPesable,
                                  approximateWeight: p.approximateWeight != null ? Number(p.approximateWeight) : undefined,
                                  listPrice: Number(p.listPrice)
                                }]
                              });
                            }
                          }}
                        >
                          + Agregar
                        </button>
                      </div>
                    ))}
                </div>
              </div>
              
              {/* Artículos del pedido */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ marginBottom: '10px', fontSize: '0.9rem' }}>Detalle Actual del Pedido</h4>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '350px', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '10px' }}>
                  {editOrderModal.items.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No hay artículos en el pedido.</p>
                  ) : (
                    editOrderModal.items.map(item => (
                      <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ flex: 1, marginRight: '10px' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>${item.listPrice} c/u {item.isPesable && '(Por Kg)'}</div>
                          {item.isPesable && (
                            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Peso Exacto (Kg):</span>
                              <input 
                                type="number" 
                                step="0.01"
                                className="input" 
                                style={{ width: '80px', padding: '2px 6px', fontSize: '0.8rem' }}
                                value={item.weight || ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setEditOrderModal({
                                    ...editOrderModal,
                                    items: editOrderModal.items.map(i => 
                                      i.productId === item.productId ? { ...i, weight: isNaN(val) ? null : val } : i
                                    )
                                  });
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '2px 6px' }}
                            onClick={() => {
                              const newQty = item.quantity - 1;
                              if (newQty <= 0) {
                                setEditOrderModal({
                                  ...editOrderModal,
                                  items: editOrderModal.items.filter(i => i.productId !== item.productId)
                                });
                              } else {
                                setEditOrderModal({
                                  ...editOrderModal,
                                  items: editOrderModal.items.map(i =>
                                    i.productId === item.productId ? { ...i, quantity: newQty } : i
                                  )
                                });
                              }
                            }}
                          >
                            -
                          </button>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.quantity}</span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '2px 6px' }}
                            onClick={() => {
                              setEditOrderModal({
                                ...editOrderModal,
                                items: editOrderModal.items.map(i =>
                                  i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i
                                )
                              });
                            }}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost text-danger"
                            style={{ padding: '4px' }}
                            onClick={() => {
                              setEditOrderModal({
                                ...editOrderModal,
                                items: editOrderModal.items.filter(i => i.productId !== item.productId)
                              });
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.05rem', marginBottom: '12px' }}>
                    <span>Nuevo Total:</span>
                    <span>${editOrderModal.items.reduce((acc, i) => acc + (i.listPrice * (i.isPesable ? (i.weight || (i.quantity * (i.approximateWeight || 1))) : i.quantity)), 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditOrderModal(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={handleEditOrderSubmit}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL REGISTRAR NO VENTA */}
      {noSaleModal && noSaleModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Registrar Visita sin Venta</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setNoSaleModal(null)}>✕</button>
            </div>
            <form onSubmit={handleRecordNoSale}>
              <div style={{ marginBottom: '14px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Cliente: <strong>{noSaleModal.clientName}</strong>
              </div>

              <div className="form-group">
                <label>Motivo de No Venta</label>
                <select
                  className="select"
                  value={noSaleModal.reason}
                  onChange={(e) => setNoSaleModal({ ...noSaleModal, reason: e.target.value })}
                  style={{ backgroundColor: '#fff', color: 'var(--text-primary)' }}
                >
                  <option value="Pasó de largo, no compró">Pasó de largo, no compró</option>
                  <option value="Estaba cerrado">Estaba cerrado</option>
                  <option value="Cerró el local definitivamente">Cerró el local definitivamente</option>
                  <option value="No se encontraba el dueño">No se encontraba el dueño</option>
                  <option value="Ya compró a otro proveedor">Ya compró a otro proveedor</option>
                  <option value="Otro motivo (especificar en notas)">Otro motivo (especificar en notas)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Notas / Comentarios</label>
                <textarea
                  className="input"
                  style={{ minHeight: '80px', padding: '10px', fontSize: '0.85rem' }}
                  placeholder="ej: El dueño regresa el jueves por la mañana..."
                  value={noSaleModal.notes || ''}
                  onChange={(e) => setNoSaleModal({ ...noSaleModal, notes: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setNoSaleModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--accent-color)', borderColor: 'var(--accent-color)' }} disabled={loading}>
                  {loading ? 'Registrando...' : 'Registrar Visita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'logistica' && (
        <React.Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando Logística y Reparto...</div>}>
          <RepartoDashboard />
        </React.Suspense>
      )}

      {activeTab === 'deposito' && (
        <React.Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando Preparación y Depósito...</div>}>
          <DepositoDashboard activeTab="deposito" setActiveTab={setActiveTab} />
        </React.Suspense>
      )}

      {/* Alerta flotante Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: toast.type === 'success' ? '#10B981' : toast.type === 'error' ? '#EF4444' : '#3B82F6',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 600,
          fontSize: '0.9rem',
          pointerEvents: 'none',
          transition: 'opacity 0.25s ease-in-out'
        }}>
          {toast.type === 'success' && <CheckCircle2 size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
