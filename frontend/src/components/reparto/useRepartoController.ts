import { useState, useEffect, useMemo } from 'react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import { useGpsTracker } from '../../hooks/useGpsTracker';
import { useRepartoGeocoder } from './useRepartoGeocoder';
import { useRepartoTspRoutes } from './useRepartoTspRoutes';

export function useRepartoController() {
  const confirm = useConfirm();
  const currentUser = api.getCurrentUser();
  const isAdminOrOffice = currentUser?.role === 'ADMIN' || currentUser?.role === 'FACTURACION';

  const [routes, setRoutes] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);

  const visibleRoutes = useMemo(() => {
    if (isAdminOrOffice) return routes;
    const uname = (currentUser?.username || '').toLowerCase().trim();
    return routes.filter(r => {
      const dName = (r.driverName || '').toLowerCase().trim();
      return dName.includes(uname) || uname.includes(dName);
    });
  }, [routes, isAdminOrOffice, currentUser?.username]);

  const [gpsHistory, setGpsHistory] = useState<[number, number][]>([]);
  const [liveGpsInfo, setLiveGpsInfo] = useState<any>(null);

  useGpsTracker({
    activeRouteId: selectedRoute?.id,
    isActive: selectedRoute?.status === 'IN_TRANSIT' || selectedRoute?.custodyStatus === 'LOADED_IN_TRANSIT',
    intervalMs: 60000
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
            if (Array.isArray(data.pings)) {
              setGpsHistory(data.pings.map((p: any) => [p.latitude, p.longitude]));
            }
          }
        })
        .catch(() => {});
    };
    fetchGpsData();
    const interval = setInterval(fetchGpsData, 15000);
    return () => clearInterval(interval);
  }, [selectedRoute?.id]);

  const { clientCoordsCache, handleUpdateClientCoords } = useRepartoGeocoder({
    pendingOrders, setPendingOrders, routes, setRoutes, selectedRoute, setSelectedRoute
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [companionName, setCompanionName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleDescription, setVehicleDescription] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [loadedDrivers, setLoadedDrivers] = useState<string[]>([]);
  const [loadedVehicles, setLoadedVehicles] = useState<{ plate: string; description: string }[]>([]);
  const [expandedStops, setExpandedStops] = useState<{ [key: string]: boolean }>({});
  const [selectedVehicleKey, setSelectedVehicleKey] = useState('');

  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleRoute, setSettleRoute] = useState<any | null>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  const [selectedCityFilter, setSelectedCityFilter] = useState('ALL');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('ALL');
  const [_loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    createRouteStreetPoints, selectedRouteStreetPoints,
    currentTspRoute, mapPoints, activeRouteTspDetails
  } = useRepartoTspRoutes({ selectedOrderIds, pendingOrders, selectedRoute, clientCoordsCache });

  const fetchRoutesAndOrders = async () => {
    setLoading(true);
    try {
      const allRoutes = await api.getDeliveryRoutes();
      setRoutes(allRoutes);

      if (!isAdminOrOffice) {
        const uname = (currentUser?.username || '').toLowerCase().trim();
        const myRoutes = allRoutes.filter((r: any) => {
          const dName = (r.driverName || '').toLowerCase().trim();
          return dName.includes(uname) || uname.includes(dName);
        });
        if (myRoutes.length > 0) {
          const activeOrFirst = myRoutes.find((r: any) => r.status === 'IN_TRANSIT' || r.custodyStatus === 'LOADED_IN_TRANSIT') || myRoutes[0];
          setSelectedRoute(activeOrFirst);
        } else {
          setSelectedRoute(null);
        }
      }

      const allOrders = await api.getOrders();
      const available = allOrders.filter((o: any) => (o.status === 'PREPARED' || o.status === 'DELIVERED' || !!o.invoiceNumber) && !o.deliveryRouteId && o.status !== 'CANCELLED');
      setPendingOrders(available);

      try {
        const banks = await api.getBankAccounts();
        setBankAccounts(banks || []);
      } catch {
        console.warn('Cuentas bancarias no disponibles para este perfil.');
      }
    } catch (err) {
      console.error('Error al cargar datos logísticos:', err);
      setErrorMsg('Error al cargar datos logísticos.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogisticsResources = async () => {
    try {
      const data = await api.getLogisticsResources();
      if (data) {
        setLoadedDrivers(data.drivers || []);
        setLoadedVehicles(data.vehicles || []);
      }
    } catch (err) {
      console.error('Error al cargar recursos de logística:', err);
    }
  };

  useEffect(() => {
    fetchRoutesAndOrders();
    fetchLogisticsResources();
  }, []);

  const handleDeleteRoute = async (routeId: number) => {
    if (!await confirm('¿Estás seguro de que deseas eliminar esta hoja de ruta? Los pedidos asociados serán liberados.', { type: 'danger' })) return;
    setLoading(true);
    try {
      await api.deleteDeliveryRoute(routeId);
      setSuccessMsg('Hoja de ruta eliminada y pedidos liberados.');
      if (selectedRoute?.id === routeId) setSelectedRoute(null);
      await fetchRoutesAndOrders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar la hoja de ruta.');
    } finally {
      setLoading(false);
    }
  };

  const uniqueCities = useMemo(() => {
    const citiesSet = new Set<string>();
    pendingOrders.forEach(o => { if (o.persona?.city) citiesSet.add(o.persona.city.toUpperCase().trim()); });
    return Array.from(citiesSet).sort();
  }, [pendingOrders]);

  const uniqueZones = useMemo(() => {
    if (selectedCityFilter === 'ALL') return [];
    const zonesSet = new Set<string>();
    pendingOrders
      .filter(o => o.persona?.city?.toUpperCase().trim() === selectedCityFilter)
      .forEach(o => { if (o.persona?.route) zonesSet.add(o.persona.route.toUpperCase().trim()); });
    return Array.from(zonesSet).sort();
  }, [pendingOrders, selectedCityFilter]);

  const filteredPendingOrders = useMemo(() => {
    let list = pendingOrders;
    if (selectedCityFilter !== 'ALL') {
      list = list.filter(o => o.persona?.city?.toUpperCase().trim() === selectedCityFilter);
      if (selectedZoneFilter !== 'ALL') {
        list = list.filter(o => o.persona?.route?.toUpperCase().trim() === selectedZoneFilter);
      }
    }
    return list;
  }, [pendingOrders, selectedCityFilter, selectedZoneFilter]);

  useEffect(() => { setSelectedZoneFilter('ALL'); }, [selectedCityFilter]);

  const handleOpenSettleModal = (route: any) => {
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
      checkAmount: Number(o.totalAmount)
    })));
    setShowSettleModal(true);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleRoute) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const expectedCash = settlements.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.amount, 0);
      const expectedTransfers = settlements.filter(s => s.paymentMethod === 'BANK_TRANSFER').reduce((sum, s) => sum + s.amount, 0);
      const expectedChecks = settlements.filter(s => s.paymentMethod === 'CHECK').reduce((sum, s) => sum + s.amount, 0);
      await api.settleDeliveryRoute(settleRoute.id, {
        settlements,
        cashDeclared: expectedCash,
        checksDeclared: expectedChecks,
        transfersDeclared: expectedTransfers
      });
      setSuccessMsg(`✨ Hoja de ruta #${settleRoute.id} liquidada y completada con éxito. Cobros registrados.`);
      setShowSettleModal(false);
      setSettleRoute(null);
      setSelectedRoute(null);
      fetchRoutesAndOrders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al liquidar la hoja de ruta.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOrder = (orderId: number) => {
    setSelectedOrderIds(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]);
  };

  const handleTransferCustody = async (route: any) => {
    const totalBultos = route.orders?.reduce((sum: number, o: any) => sum + Math.max(1, Number(o.bultosCount || 1)), 0) || 0;
    if (!window.confirm(`¿Confirmar la carga de ${totalBultos} bultos en el vehículo de ${route.driverName} y transferir la custodia legal/operativa al chofer?`)) return;
    try {
      setLoading(true);
      const updated = await api.transferRouteCustody(route.id);
      setSuccessMsg(`🔒 Carga de ${totalBultos} bultos confirmada. Custodia transferida exitosamente a ${route.driverName}.`);
      setSelectedRoute(updated);
      fetchRoutesAndOrders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al transferir la custodia de la ruta.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRouteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (selectedOrderIds.length === 0) {
      setErrorMsg('Debe seleccionar al menos un pedido para el reparto.');
      return;
    }
    try {
      setLoading(true);
      await api.createDeliveryRoute({
        driverName,
        companionName: companionName.trim() || undefined,
        vehiclePlate,
        vehicleDescription,
        orderIds: currentTspRoute.map(node => node.id)
      });
      setSuccessMsg('✨ Hoja de ruta de reparto creada y optimizada con éxito.');
      setShowCreateModal(false);
      setDriverName('');
      setCompanionName('');
      setVehiclePlate('');
      setVehicleDescription('');
      setSelectedVehicleKey('');
      setSelectedOrderIds([]);
      fetchRoutesAndOrders();
      fetchLogisticsResources();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la hoja de ruta.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeStatus = async (routeId: number, nextStatus: string) => {
    try {
      setLoading(true);
      await api.updateRouteStatus(routeId, nextStatus);
      setSuccessMsg(`✨ Hoja de ruta #${routeId} actualizada a estado: ${nextStatus === 'IN_TRANSIT' ? 'En Viaje' : 'Completada (Entregada)'}`);
      if (selectedRoute && selectedRoute.id === routeId) {
        setSelectedRoute((prev: any) => ({ ...prev, status: nextStatus }));
      }
      fetchRoutesAndOrders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cambiar estado.');
    } finally {
      setLoading(false);
    }
  };

  const logisticsStats = useMemo(() => {
    const inTransitRoutes = routes.filter(r => r.status === 'IN_TRANSIT');
    return {
      inTransitCount: inTransitRoutes.length,
      pendingOrdersCount: pendingOrders.length
    };
  }, [routes, pendingOrders]);

  return {
    currentUser, isAdminOrOffice, visibleRoutes, selectedRoute, setSelectedRoute,
    createRouteStreetPoints, selectedRouteStreetPoints, gpsHistory, liveGpsInfo,
    handleUpdateClientCoords, showCreateModal, setShowCreateModal,
    driverName, setDriverName, companionName, setCompanionName,
    vehiclePlate, setVehiclePlate, vehicleDescription, setVehicleDescription,
    selectedOrderIds, setSelectedOrderIds, loadedDrivers, loadedVehicles,
    expandedStops, setExpandedStops, selectedVehicleKey, setSelectedVehicleKey,
    showSettleModal, setShowSettleModal, settleRoute, settlements, setSettlements,
    bankAccounts, selectedCityFilter, setSelectedCityFilter, selectedZoneFilter, setSelectedZoneFilter,
    successMsg, setSuccessMsg, errorMsg, setErrorMsg,
    uniqueCities, uniqueZones, filteredPendingOrders,
    handleDeleteRoute, handleOpenSettleModal, handleSettleSubmit, handleToggleOrder,
    handleTransferCustody, currentTspRoute, mapPoints, activeRouteTspDetails,
    handleCreateRouteSubmit, handleChangeStatus, logisticsStats
  };
}
