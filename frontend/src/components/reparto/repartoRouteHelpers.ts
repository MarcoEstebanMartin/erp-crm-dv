import { formatBigIntARS, sumOrdersTotalInt } from '../../utils/fulfillmentCardMeta.helper';

export interface DriverOption {
  employeeId: number | null;
  userId?: number | null;
  fullName: string;
  position?: string;
}

export interface FleetVehicleOption {
  id: number | null;
  plate: string;
  description: string;
}

export interface TripDisplayMetrics {
  ordersCount: number;
  totalBultos: number;
  totalAmountLabel: string;
}

/**
 * Calcula pedidos activos, bultos e importe total en pesos enteros BigInt.
 */
export function computeTripDisplayMetrics(orders: any[]): TripDisplayMetrics {
  const activeOrders = (orders || []).filter((o) => o && o.status !== 'CANCELLED');
  const totalBultos = activeOrders.reduce(
    (sum, o) => sum + Math.max(1, Math.trunc(Number(o.bultosCount || 1))),
    0,
  );
  const totalAmountLabel = formatBigIntARS(sumOrdersTotalInt(activeOrders));
  return {
    ordersCount: activeOrders.length,
    totalBultos,
    totalAmountLabel,
  };
}

/**
 * Intercambia una parada con su adyacente manteniendo orden válido 1..N.
 */
export function reorderStopIds(orderIds: number[], index: number, direction: -1 | 1): number[] {
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || index >= orderIds.length || targetIndex >= orderIds.length) {
    return orderIds;
  }
  const next = [...orderIds];
  const current = next[index];
  next[index] = next[targetIndex];
  next[targetIndex] = current;
  return next;
}

/**
 * Combina pedidos sin viaje con los pedidos actuales de un viaje en edición sin duplicar IDs.
 */
export function buildEditableOrderPool(pendingOrders: any[], editingRoute: any | null): any[] {
  if (!editingRoute || !Array.isArray(editingRoute.orders)) {
    return pendingOrders;
  }
  const byId = new Map<number, any>();
  for (const order of editingRoute.orders) {
    if (order?.id) byId.set(order.id, order);
  }
  for (const order of pendingOrders) {
    if (order?.id && !byId.has(order.id)) byId.set(order.id, order);
  }
  return Array.from(byId.values());
}

/**
 * Normaliza la lista de conductores desde driverOptions o fallback legado.
 */
export function normalizeDriverOptions(data: any): DriverOption[] {
  if (Array.isArray(data?.driverOptions) && data.driverOptions.length > 0) {
    return data.driverOptions.map((d: any) => ({
      employeeId: typeof d.employeeId === 'number' ? d.employeeId : null,
      userId: typeof d.userId === 'number' ? d.userId : null,
      fullName: String(d.fullName || '').trim(),
      position: d.position ? String(d.position) : undefined,
    }));
  }
  const rawDrivers = Array.isArray(data?.drivers) ? data.drivers : [];
  return rawDrivers
    .map((name: string) => ({
      employeeId: null,
      fullName: String(name || '').trim(),
    }))
    .filter((d: DriverOption) => Boolean(d.fullName));
}

/**
 * Normaliza vehículos viales activos desde fleetVehicles o fallback legado.
 */
export function normalizeFleetVehicleOptions(data: any): FleetVehicleOption[] {
  if (Array.isArray(data?.fleetVehicles) && data.fleetVehicles.length > 0) {
    return data.fleetVehicles.map((v: any) => ({
      id: typeof v.id === 'number' ? v.id : null,
      plate: String(v.plate || '').trim().toUpperCase(),
      description: String(v.description || `${v.brand || ''} ${v.model || ''}`).trim(),
    }));
  }
  const rawVehicles = Array.isArray(data?.vehicles) ? data.vehicles : [];
  return rawVehicles
    .map((v: any) => ({
      id: typeof v.id === 'number' ? v.id : null,
      plate: String(v.plate || '').trim().toUpperCase(),
      description: String(v.description || '').trim(),
    }))
    .filter((v: FleetVehicleOption) => Boolean(v.plate));
}

/**
 * Resuelve los valores iniciales de edición de un viaje pendiente contra nómina y flota reales.
 */
export function resolveEditRouteFormValues(
  route: any,
  driverOptions: DriverOption[],
  fleetVehicles: FleetVehicleOption[],
) {
  const matchedDriver = driverOptions.find(
    (d) => (route.driverEmployeeId && d.employeeId === route.driverEmployeeId) || d.fullName === route.driverName,
  );
  const matchedVeh = fleetVehicles.find(
    (v) => (route.vehicleId && v.id === route.vehicleId) || v.plate === route.vehiclePlate,
  );
  return {
    driverEmployeeId: matchedDriver?.employeeId ?? route.driverEmployeeId ?? null,
    driverName: matchedDriver?.fullName || route.driverName || '',
    companionName: route.companionName || '',
    vehicleId: matchedVeh ? matchedVeh.id : (route.vehicleId ?? null),
    vehiclePlate: matchedVeh ? matchedVeh.plate : (route.vehiclePlate || ''),
    vehicleDescription: matchedVeh ? matchedVeh.description : (route.vehicleDescription || ''),
    selectedVehicleKey: matchedVeh ? matchedVeh.plate : route.vehiclePlate ? 'CUSTOM' : '',
    orderIds: (route.orders || []).map((o: any) => o.id),
  };
}

/**
 * Calcula localidades, zonas y pedidos filtrados en una sola pasada lineal O(N).
 */
export function computeRouteOrderFilters(
  orderPool: any[],
  selectedCityFilter: string,
  selectedZoneFilter: string,
) {
  const citiesSet = new Set<string>();
  const zonesSet = new Set<string>();
  const filteredPendingOrders: any[] = [];

  for (const o of orderPool) {
    const city = o.persona?.city?.toUpperCase().trim() || '';
    const zone = o.persona?.route?.toUpperCase().trim() || '';
    if (city) citiesSet.add(city);
    if (selectedCityFilter !== 'ALL' && city === selectedCityFilter && zone) {
      zonesSet.add(zone);
    }
    if (selectedCityFilter === 'ALL' || city === selectedCityFilter) {
      if (selectedCityFilter === 'ALL' || selectedZoneFilter === 'ALL' || zone === selectedZoneFilter) {
        filteredPendingOrders.push(o);
      }
    }
  }

  return {
    uniqueCities: Array.from(citiesSet).sort(),
    uniqueZones: selectedCityFilter === 'ALL' ? [] : Array.from(zonesSet).sort(),
    filteredPendingOrders,
  };
}

/**
 * Devuelve el saldo actual en pesos enteros del cliente asociado a una parada.
 */
export function getStopOutstandingBalance(stop: any): number {
  const raw = stop?.persona?.outstandingBalance ?? stop?.outstandingBalance ?? 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

/**
 * Determina si una parada de viaje debe ofrecer cobro (viaje activo y cliente con saldo > $0).
 */
export function canCollectStop(routeStatus: string | undefined, stop: any): boolean {
  return routeStatus !== 'COMPLETED' && getStopOutstandingBalance(stop) > 0;
}

/**
 * Calcula el importe sugerido de cobro para una parada sin superar nunca el saldo real del cliente.
 */
export function computeStopSuggestedCollectAmount(stop: any): number {
  const balance = getStopOutstandingBalance(stop);
  if (balance <= 0) return 0;
  const orderTotal = Math.round(Number(stop?.totalAmount || 0));
  if (orderTotal > 0) return Math.min(orderTotal, balance);
  return balance;
}
