import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { fieldReceiptsApi } from '../../api/fieldReceipts.api';
import { ORDERS_QUERY_KEYS, PENDING_ROUTES_QUERY_KEY } from '../../hooks/queries';
import { useConfirm } from '../../context/ConfirmContext';
import { setRuntimeGoogleMapsApiKey } from '../../utils/googleMapsLoader';
import { useRepartoGeocoder } from './useRepartoGeocoder';
import { useRepartoTspRoutes } from './useRepartoTspRoutes';
import { useRepartoGpsAndSettle } from './useRepartoGpsAndSettle';
import {
  buildEditableOrderPool,
  computeRouteOrderFilters,
  normalizeDriverOptions,
  normalizeFleetVehicleOptions,
  reorderStopIds,
  resolveEditRouteFormValues,
  type DriverOption,
  type FleetVehicleOption,
} from './repartoRouteHelpers';

export function useRepartoController() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const currentUser = api.getCurrentUser();
  const isAdminOrOffice = currentUser?.role === 'ADMIN' || currentUser?.role === 'FACTURACION';

  const [routes, setRoutes] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<number | null>(null);
  const [routeName, setRouteName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverEmployeeId, setDriverEmployeeId] = useState<number | null>(null);
  const [companionName, setCompanionName] = useState('');
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleDescription, setVehicleDescription] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [driverOptions, setDriverOptions] = useState<DriverOption[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicleOption[]>([]);
  const [expandedStops, setExpandedStops] = useState<Record<string, boolean>>({});
  const [selectedVehicleKey, setSelectedVehicleKey] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState('ALL');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('ALL');
  const [_loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const visibleRoutes = useMemo(() => {
    if (isAdminOrOffice) return routes;
    const uname = (currentUser?.username || '').toLowerCase().trim();
    return routes.filter((r) => {
      const dName = (r.driverName || '').toLowerCase().trim();
      return dName.includes(uname) || uname.includes(dName);
    });
  }, [routes, isAdminOrOffice, currentUser?.username]);

  const { clientCoordsCache, handleUpdateClientCoords } = useRepartoGeocoder({
    pendingOrders, setPendingOrders, routes, setRoutes, selectedRoute, setSelectedRoute,
  });

  const editingRoute = useMemo(
    () => (editingRouteId ? routes.find((r) => r.id === editingRouteId) || null : null),
    [editingRouteId, routes],
  );
  const modalOrderPool = useMemo(
    () => buildEditableOrderPool(pendingOrders, editingRoute),
    [pendingOrders, editingRoute],
  );

  const {
    createRouteStreetPoints, selectedRouteStreetPoints,
    currentTspRoute, mapPoints, activeRouteTspDetails,
  } = useRepartoTspRoutes({ selectedOrderIds, pendingOrders: modalOrderPool, selectedRoute, clientCoordsCache });

  const invalidateOrderQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEYS.all });
    void queryClient.invalidateQueries({ queryKey: PENDING_ROUTES_QUERY_KEY });
  };

  const fetchRoutesAndOrders = async () => {
    setLoading(true);
    try {
      const [allRoutes, queueRes] = await Promise.all([
        api.getDeliveryRoutes(),
        api.getOrdersPage({ dispatchQueue: true, limit: 200 }),
      ]);
      const safeRoutes = Array.isArray(allRoutes) ? allRoutes : [];
      setRoutes(safeRoutes);
      setSelectedRoute((prev: any) =>
        prev?.id ? safeRoutes.find((r: any) => r.id === prev.id) || null : prev,
      );
      if (!isAdminOrOffice) {
        const uname = (currentUser?.username || '').toLowerCase().trim();
        const myRoutes = safeRoutes.filter((r: any) => {
          const dName = (r.driverName || '').toLowerCase().trim();
          return dName.includes(uname) || uname.includes(dName);
        });
        setSelectedRoute(
          myRoutes.find((r: any) => r.status === 'IN_TRANSIT' || r.custodyStatus === 'LOADED_IN_TRANSIT') ||
            myRoutes[0] || null,
        );
      }
      setPendingOrders(Array.isArray(queueRes?.orders) ? queueRes.orders : []);
      try { setBankAccounts((await api.getBankAccounts()) || []); }
      catch {
        await fieldReceiptsApi.getOfflineBundle().then((b) => setBankAccounts(b.bankAccounts || [])).catch(() => {});
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
        setRuntimeGoogleMapsApiKey(data.googleMapsApiKey);
        setDriverOptions(normalizeDriverOptions(data));
        setFleetVehicles(normalizeFleetVehicleOptions(data));
      }
    } catch (err) {
      console.error('Error al cargar recursos de logística:', err);
    }
  };

  useEffect(() => { void fetchRoutesAndOrders(); void fetchLogisticsResources(); }, []);

  const gpsAndSettle = useRepartoGpsAndSettle({
    selectedRoute, bankAccounts, setSelectedRoute, setLoading, setSuccessMsg, setErrorMsg,
    onSettled: async () => { await fetchRoutesAndOrders(); invalidateOrderQueries(); },
  });

  const handleOpenCreateModal = () => {
    setErrorMsg(null); setEditingRouteId(null); setRouteName('');
    setDriverName(''); setDriverEmployeeId(null); setCompanionName('');
    setVehicleId(null); setVehiclePlate(''); setVehicleDescription('');
    setSelectedVehicleKey(''); setSelectedOrderIds([]);
    setSelectedCityFilter('ALL'); setSelectedZoneFilter('ALL');
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (route: any) => {
    const resolved = resolveEditRouteFormValues(route, driverOptions, fleetVehicles);
    setErrorMsg(null); setEditingRouteId(route.id);
    setRouteName(resolved.routeName); setDriverEmployeeId(resolved.driverEmployeeId);
    setDriverName(resolved.driverName); setCompanionName(resolved.companionName);
    setVehicleId(resolved.vehicleId); setVehiclePlate(resolved.vehiclePlate);
    setVehicleDescription(resolved.vehicleDescription); setSelectedVehicleKey(resolved.selectedVehicleKey);
    setSelectedOrderIds(resolved.orderIds);
    setSelectedCityFilter('ALL'); setSelectedZoneFilter('ALL');
    setShowCreateModal(true);
  };

  const handleDeleteRoute = async (routeId: number) => {
    if (!await confirm('¿Eliminar este viaje? Los pedidos volverán a quedar sin viaje.', { type: 'danger' })) return;
    setLoading(true);
    try {
      await api.deleteDeliveryRoute(routeId);
      setSuccessMsg(`Viaje #${routeId} eliminado.`);
      if (selectedRoute?.id === routeId) setSelectedRoute(null);
      await fetchRoutesAndOrders(); invalidateOrderQueries();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar el viaje.');
    } finally {
      setLoading(false);
    }
  };

  const { uniqueCities, uniqueZones, filteredPendingOrders } = useMemo(
    () => computeRouteOrderFilters(modalOrderPool, selectedCityFilter, selectedZoneFilter),
    [modalOrderPool, selectedCityFilter, selectedZoneFilter],
  );

  useEffect(() => { setSelectedZoneFilter('ALL'); }, [selectedCityFilter]);

  const handleSelectCityOrders = () => {
    const visibleIds = filteredPendingOrders.map((o) => o.id);
    if (visibleIds.length === 0) return;
    const allIncluded = visibleIds.every((id) => selectedOrderIds.includes(id));
    setSelectedOrderIds((prev) =>
      allIncluded ? prev.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...prev, ...visibleIds])),
    );
  };

  const handleToggleOrder = (orderId: number) => {
    setSelectedOrderIds((prev) => (prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]));
  };

  const handleTransferCustody = async (route: any) => {
    const totalBultos = route.orders?.reduce((sum: number, o: any) => sum + Math.max(1, Number(o.bultosCount || 1)), 0) || 0;
    if (!await confirm(`¿Confirmar carga de ${totalBultos} bultos para ${route.driverName}?`, { type: 'warning' })) return;
    try {
      setLoading(true);
      const updated = await api.transferRouteCustody(route.id);
      setSuccessMsg(`Carga confirmada (${totalBultos} bultos).`);
      setSelectedRoute(updated);
      await fetchRoutesAndOrders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al transferir custodia.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRouteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null); setSuccessMsg(null);
    if (selectedOrderIds.length === 0) { setErrorMsg('Seleccione al menos un pedido.'); return; }
    const orderedIds = currentTspRoute.length > 0 ? currentTspRoute.map((n) => n.id) : selectedOrderIds;
    const payload = {
      routeName: routeName.trim() || null,
      driverName,
      driverEmployeeId,
      companionName: companionName.trim() || null,
      vehicleId,
      vehiclePlate,
      vehicleDescription: vehicleDescription.trim() || null,
      orderIds: orderedIds,
    };
    try {
      setLoading(true);
      if (editingRouteId) {
        const updated = await api.updateDeliveryRoute(editingRouteId, payload);
        setSuccessMsg(`Viaje #${editingRouteId} actualizado.`);
        if (updated) setSelectedRoute(updated);
      } else {
        const created = await api.createDeliveryRoute(payload);
        setSuccessMsg('Viaje creado.');
        if (created) setSelectedRoute(created);
      }
      setShowCreateModal(false); setEditingRouteId(null);
      await fetchRoutesAndOrders(); void fetchLogisticsResources(); invalidateOrderQueries();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el viaje.');
    } finally {
      setLoading(false);
    }
  };

  const handleReorderStop = async (routeId: number, currentOrderIds: number[], index: number, direction: -1 | 1) => {
    const nextOrderIds = reorderStopIds(currentOrderIds, index, direction);
    if (nextOrderIds === currentOrderIds) return;
    try {
      setLoading(true);
      const updated = await api.updateDeliveryRoute(routeId, { orderIds: nextOrderIds });
      if (updated) setSelectedRoute(updated);
      await fetchRoutesAndOrders(); invalidateOrderQueries();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al reordenar paradas.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeStatus = async (routeId: number, nextStatus: string) => {
    try {
      setLoading(true);
      await api.updateRouteStatus(routeId, nextStatus);
      setSuccessMsg(`Viaje #${routeId}: ${nextStatus === 'IN_TRANSIT' ? 'En Viaje' : 'Completado'}`);
      await fetchRoutesAndOrders(); invalidateOrderQueries();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cambiar estado.');
    } finally {
      setLoading(false);
    }
  };

  const logisticsStats = useMemo(() => ({
    inTransitCount: routes.filter((r) => r.status === 'IN_TRANSIT').length,
    pendingOrdersCount: pendingOrders.length,
  }), [routes, pendingOrders]);

  return {
    currentUser, isAdminOrOffice, visibleRoutes, selectedRoute, setSelectedRoute,
    createRouteStreetPoints, selectedRouteStreetPoints, handleUpdateClientCoords,
    showCreateModal, setShowCreateModal, editingRouteId, routeName, setRouteName,
    driverName, setDriverName, driverEmployeeId, setDriverEmployeeId,
    companionName, setCompanionName, vehicleId, setVehicleId, vehiclePlate, setVehiclePlate,
    vehicleDescription, setVehicleDescription, selectedOrderIds, setSelectedOrderIds,
    driverOptions, fleetVehicles, modalOrderPool, expandedStops, setExpandedStops,
    selectedVehicleKey, setSelectedVehicleKey, bankAccounts,
    selectedCityFilter, setSelectedCityFilter, selectedZoneFilter, setSelectedZoneFilter,
    successMsg, setSuccessMsg, errorMsg, setErrorMsg, uniqueCities, uniqueZones, filteredPendingOrders,
    handleOpenCreateModal, handleOpenEditModal, handleSelectCityOrders, handleReorderStop,
    handleDeleteRoute, handleToggleOrder, handleTransferCustody,
    currentTspRoute, mapPoints, activeRouteTspDetails, handleCreateRouteSubmit, handleChangeStatus,
    logisticsStats, ...gpsAndSettle,
  };
}
