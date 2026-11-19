import { useMemo } from 'react';
import { VILLEGAS_DEPOT, getClientCoords, solveTSP } from './repartoGeoHelpers';

export function useRepartoTspRoutes({
  selectedOrderIds,
  pendingOrders,
  selectedRoute,
  clientCoordsCache,
}: {
  selectedOrderIds: number[];
  pendingOrders: any[];
  selectedRoute: any | null;
  clientCoordsCache: Record<number, { lat: number; lng: number; address: string; hasExactGps?: boolean }>;
}) {
  const currentTspRoute = useMemo(() => {
    if (selectedOrderIds.length === 0) return [];
    const targets = selectedOrderIds.map((id) => {
      const order = pendingOrders.find((o) => o.id === id);
      const persona = order?.persona || { name: 'Cliente', id: 0 };
      const coords = getClientCoords(persona.id, persona.name, persona, clientCoordsCache);
      return {
        id,
        clientId: persona.id,
        lat: coords.lat,
        lng: coords.lng,
        name: persona.name,
        address: coords.address,
        hasExactGps: coords.hasExactGps,
        invoice: order?.invoiceNumber || `Pedido #${id}`,
      };
    });
    return solveTSP(VILLEGAS_DEPOT, targets);
  }, [selectedOrderIds, pendingOrders, clientCoordsCache]);

  const mapPoints = useMemo<[number, number][]>(() => {
    if (currentTspRoute.length === 0) return [];
    const points: [number, number][] = [VILLEGAS_DEPOT];
    currentTspRoute.forEach((node) => points.push([node.lat, node.lng]));
    points.push(VILLEGAS_DEPOT);
    return points;
  }, [currentTspRoute]);

  const activeRouteTspDetails = useMemo(() => {
    if (!selectedRoute || !selectedRoute.orders) {
      return { locations: [] as any[], points: [] as [number, number][] };
    }
    const rawTargets = selectedRoute.orders.map((o: any) => {
      const p = o.persona || { name: 'Cliente', id: 0 };
      const coords = getClientCoords(p.id, p.name, p, clientCoordsCache);
      return {
        id: o.id,
        clientId: p.id,
        persona: p,
        totalAmount: Number(o.totalAmount || 0),
        lat: coords.lat,
        lng: coords.lng,
        name: p.name,
        address: coords.address,
        hasExactGps: coords.hasExactGps,
        deliverySequence: typeof o.deliverySequence === 'number' ? o.deliverySequence : null,
        invoice: o.invoiceNumber || `Pedido #${o.id}`,
        items: o.items,
      };
    });

    const hasExplicitSequence = rawTargets.some(
      (t: any) => t.deliverySequence !== null && t.deliverySequence > 0,
    );
    const orderedStops = hasExplicitSequence
      ? [...rawTargets].sort(
          (a: any, b: any) =>
            (a.deliverySequence ?? Number.MAX_SAFE_INTEGER) -
              (b.deliverySequence ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
        )
      : solveTSP(VILLEGAS_DEPOT, rawTargets);

    const points: [number, number][] = [VILLEGAS_DEPOT];
    orderedStops.forEach((node: any) => points.push([node.lat, node.lng]));
    points.push(VILLEGAS_DEPOT);
    return { locations: orderedStops, points };
  }, [selectedRoute, clientCoordsCache]);

  return {
    createRouteStreetPoints: mapPoints,
    selectedRouteStreetPoints: activeRouteTspDetails.points,
    currentTspRoute,
    mapPoints,
    activeRouteTspDetails,
  };
}
