import { useState, useEffect, useMemo } from 'react';
import { VILLEGAS_DEPOT, getClientCoords, solveTSP, fetchOSRMRoute } from './repartoGeoHelpers';

export function useRepartoTspRoutes({
  selectedOrderIds,
  pendingOrders,
  selectedRoute,
  clientCoordsCache
}: {
  selectedOrderIds: number[];
  pendingOrders: any[];
  selectedRoute: any | null;
  clientCoordsCache: { [key: number]: { lat: number; lng: number; address: string } };
}) {
  const [createRouteStreetPoints, setCreateRouteStreetPoints] = useState<[number, number][]>([]);
  const [selectedRouteStreetPoints, setSelectedRouteStreetPoints] = useState<[number, number][]>([]);

  const currentTspRoute = useMemo(() => {
    if (selectedOrderIds.length === 0) return [];
    const targets = selectedOrderIds.map(id => {
      const order = pendingOrders.find(o => o.id === id);
      const persona = order?.persona || { name: 'Cliente', id: 0 };
      const coords = getClientCoords(persona.id, persona.name, persona, clientCoordsCache);
      return {
        id,
        clientId: persona.id,
        lat: coords.lat,
        lng: coords.lng,
        name: persona.name,
        address: coords.address,
        invoice: order?.invoiceNumber || `Pedido #${id}`
      };
    });
    return solveTSP(VILLEGAS_DEPOT, targets);
  }, [selectedOrderIds, pendingOrders, clientCoordsCache]);

  const mapPoints = useMemo(() => {
    if (currentTspRoute.length === 0) return [];
    const points: [number, number][] = [VILLEGAS_DEPOT];
    currentTspRoute.forEach(node => points.push([node.lat, node.lng]));
    points.push(VILLEGAS_DEPOT);
    return points;
  }, [currentTspRoute]);

  const activeRouteTspDetails = useMemo(() => {
    if (!selectedRoute || !selectedRoute.orders) return { locations: [], points: [] };
    const targets = selectedRoute.orders.map((o: any) => {
      const p = o.persona || { name: 'Cliente', id: 0 };
      const coords = getClientCoords(p.id, p.name, p, clientCoordsCache);
      return {
        id: o.id,
        clientId: p.id,
        lat: coords.lat,
        lng: coords.lng,
        name: p.name,
        address: coords.address,
        invoice: o.invoiceNumber || `Pedido #${o.id}`,
        items: o.items
      };
    });
    const route = solveTSP(VILLEGAS_DEPOT, targets);
    const points: [number, number][] = [VILLEGAS_DEPOT];
    route.forEach(node => points.push([node.lat, node.lng]));
    points.push(VILLEGAS_DEPOT);
    return { locations: route, points };
  }, [selectedRoute, clientCoordsCache]);

  useEffect(() => {
    if (mapPoints.length < 2) { setCreateRouteStreetPoints([]); return; }
    let active = true;
    fetchOSRMRoute(mapPoints).then(pts => { if (active) setCreateRouteStreetPoints(pts); });
    return () => { active = false; };
  }, [mapPoints]);

  useEffect(() => {
    if (activeRouteTspDetails.points.length < 2) { setSelectedRouteStreetPoints([]); return; }
    let active = true;
    fetchOSRMRoute(activeRouteTspDetails.points).then(pts => { if (active) setSelectedRouteStreetPoints(pts); });
    return () => { active = false; };
  }, [activeRouteTspDetails.points]);

  return {
    createRouteStreetPoints,
    selectedRouteStreetPoints,
    currentTspRoute,
    mapPoints,
    activeRouteTspDetails
  };
}
