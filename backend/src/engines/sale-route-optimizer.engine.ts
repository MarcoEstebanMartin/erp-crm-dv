export interface RouteClientGeoPoint {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  latitude: unknown;
  longitude: unknown;
  routeSequence: number | null;
}

/**
 * Calcula la distancia Haversine en kilómetros entre dos coordenadas GPS (Lat/Lng).
 */
export function calculateHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Optimiza el recorrido de una ruta de clientes mediante TSP Vecino Más Cercano.
 */
export function optimizeClientsByNearestNeighbor<T extends RouteClientGeoPoint>(
  clients: T[],
  startCoords?: { lat: number; lng: number },
): { orderedClients: T[]; optimizedClientsCount: number; totalDistanceKm: number } {
  const clientsWithGps = clients.filter(
    (c) =>
      c.latitude !== null &&
      c.longitude !== null &&
      !Number.isNaN(Number(c.latitude)) &&
      !Number.isNaN(Number(c.longitude)),
  );
  const clientsWithoutGps = clients.filter(
    (c) =>
      c.latitude === null ||
      c.longitude === null ||
      Number.isNaN(Number(c.latitude)) ||
      Number.isNaN(Number(c.longitude)),
  );

  const orderedClients: T[] = [];
  let totalDistanceKm = 0;

  if (clientsWithGps.length > 0) {
    const unvisited = [...clientsWithGps];
    let currentLat = startCoords?.lat ?? Number(unvisited[0].latitude);
    let currentLng = startCoords?.lng ?? Number(unvisited[0].longitude);

    if (!startCoords) {
      const first = unvisited.shift()!;
      orderedClients.push(first);
      currentLat = Number(first.latitude);
      currentLng = Number(first.longitude);
    }

    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const c = unvisited[i];
        const dist = calculateHaversineKm(
          currentLat,
          currentLng,
          Number(c.latitude),
          Number(c.longitude),
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestIndex = i;
        }
      }

      const nextClient = unvisited.splice(nearestIndex, 1)[0];
      orderedClients.push(nextClient);
      totalDistanceKm += minDistance;
      currentLat = Number(nextClient.latitude);
      currentLng = Number(nextClient.longitude);
    }
  }

  orderedClients.push(...clientsWithoutGps);

  return {
    orderedClients,
    optimizedClientsCount: clientsWithGps.length,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
  };
}
