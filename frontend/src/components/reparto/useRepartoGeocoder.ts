import { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';
import { loadOfficialGoogleMaps, resolveGoogleMapsApiKey } from '../../utils/googleMapsLoader';
import {
  detectRealCity,
  getCityBaseCoords,
  cleanStreetAddress,
  applyJitter,
} from './repartoGeoHelpers';

type CoordCacheEntry = { lat: number; lng: number; address: string; hasExactGps: boolean };

function hasStoredCoords(p: any): boolean {
  if (!p || p.latitude === null || p.latitude === undefined || p.longitude === null || p.longitude === undefined) {
    return false;
  }
  const lat = Number(p.latitude);
  const lng = Number(p.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
}

function isStreetLevelGeocode(result: any): boolean {
  const locType = String(result?.geometry?.location_type || '').toUpperCase();
  if (locType && locType !== 'APPROXIMATE') return true;
  const types: string[] = Array.isArray(result?.types) ? result.types : [];
  return types.some((t) =>
    ['street_address', 'premise', 'subpremise', 'route', 'intersection', 'establishment', 'point_of_interest'].includes(t),
  );
}

export function useRepartoGeocoder({
  pendingOrders,
  setPendingOrders,
  routes,
  setRoutes,
  selectedRoute,
  setSelectedRoute,
}: {
  pendingOrders: any[];
  setPendingOrders: React.Dispatch<React.SetStateAction<any[]>>;
  routes: any[];
  setRoutes: React.Dispatch<React.SetStateAction<any[]>>;
  selectedRoute: any;
  setSelectedRoute: React.Dispatch<React.SetStateAction<any>>;
}) {
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [clientCoordsCache, setClientCoordsCache] = useState<Record<number, CoordCacheEntry>>({});
  const selectedRouteRef = useRef(selectedRoute);
  const isGeocodingRef = useRef(false);

  useEffect(() => {
    selectedRouteRef.current = selectedRoute;
  }, [selectedRoute]);

  useEffect(() => {
    if (!resolveGoogleMapsApiKey()) return;
    loadOfficialGoogleMaps()
      .then(() => setGoogleLoaded(true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!googleLoaded || isGeocodingRef.current) return;

    const personasToGeocode: any[] = [];
    const processedIds = new Set<number>();

    const addPersona = (p: any) => {
      if (!p || !p.id || hasStoredCoords(p)) return;
      const cityName = detectRealCity(p);
      const expectedCacheString = `${p.address || ''}, ${cityName}`;
      if (clientCoordsCache[p.id] && clientCoordsCache[p.id].address === expectedCacheString) return;
      if (processedIds.has(p.id)) return;
      processedIds.add(p.id);
      personasToGeocode.push(p);
    };

    pendingOrders.forEach((o) => addPersona(o.persona));
    routes.forEach((r) => r.orders?.forEach((o: any) => addPersona(o.persona)));
    selectedRouteRef.current?.orders?.forEach((o: any) => addPersona(o.persona));

    if (personasToGeocode.length === 0) return;

    isGeocodingRef.current = true;
    const geocoder = new (window as any).google.maps.Geocoder();
    const newCacheEntries: Record<number, CoordCacheEntry> = {};
    let index = 0;

    const patchPersonaCoordsInState = (personaId: number, lat: number, lng: number) => {
      setPendingOrders((prev) =>
        prev.map((o) => (o.persona?.id === personaId ? { ...o, persona: { ...o.persona, latitude: lat, longitude: lng } } : o)),
      );
      setRoutes((prev) =>
        prev.map((r) =>
          r.orders
            ? {
                ...r,
                orders: r.orders.map((o: any) =>
                  o.persona?.id === personaId ? { ...o, persona: { ...o.persona, latitude: lat, longitude: lng } } : o,
                ),
              }
            : r,
        ),
      );
      const selRoute = selectedRouteRef.current;
      if (selRoute?.orders) {
        setSelectedRoute((prev: any) =>
          prev
            ? {
                ...prev,
                orders: prev.orders.map((o: any) =>
                  o.persona?.id === personaId ? { ...o, persona: { ...o.persona, latitude: lat, longitude: lng } } : o,
                ),
              }
            : null,
        );
      }
    };

    const processNext = () => {
      if (index >= personasToGeocode.length) {
        isGeocodingRef.current = false;
        if (Object.keys(newCacheEntries).length > 0) {
          setClientCoordsCache((prev) => ({ ...prev, ...newCacheEntries }));
        }
        return;
      }

      const p = personasToGeocode[index];
      const cityName = detectRealCity(p);
      const cleanStreet = cleanStreetAddress(p.address || '', cityName);

      if (!cleanStreet) {
        const base = getCityBaseCoords(p);
        const approx = applyJitter(base.lat, base.lng, p.id);
        newCacheEntries[p.id] = {
          lat: approx.lat,
          lng: approx.lng,
          address: `${p.address || ''}, ${cityName}`,
          hasExactGps: false,
        };
        index++;
        setTimeout(processNext, 30);
        return;
      }

      const query = `${cleanStreet}, ${cityName}, Buenos Aires, Argentina`;
      geocoder.geocode(
        { address: query, region: 'AR', componentRestrictions: { country: 'AR' } },
        async (results: any, status: any) => {
          if (status === 'OK' && results?.[0]?.geometry?.location && isStreetLevelGeocode(results[0])) {
            const loc = results[0].geometry.location;
            const exactLat = Number(Number(loc.lat()).toFixed(6));
            const exactLng = Number(Number(loc.lng()).toFixed(6));
            newCacheEntries[p.id] = {
              lat: exactLat,
              lng: exactLng,
              address: `${p.address || ''}, ${cityName}`,
              hasExactGps: true,
            };
            try {
              await api.updatePersona(p.id, { latitude: exactLat, longitude: exactLng });
              patchPersonaCoordsInState(p.id, exactLat, exactLng);
            } catch {
              // Mantiene en cache local sin bloquear el resto del lote
            }
          } else {
            const base = getCityBaseCoords(p);
            const approx = applyJitter(base.lat, base.lng, p.id);
            newCacheEntries[p.id] = {
              lat: approx.lat,
              lng: approx.lng,
              address: `${p.address || ''}, ${cityName}`,
              hasExactGps: false,
            };
          }
          index++;
          setTimeout(processNext, 180);
        },
      );
    };

    processNext();
  }, [googleLoaded, pendingOrders.length, routes.length]);

  const handleUpdateClientCoords = async (clientId: number, lat: number, lng: number) => {
    const exactLat = Number(Number(lat).toFixed(6));
    const exactLng = Number(Number(lng).toFixed(6));
    try {
      await api.updatePersona(clientId, { latitude: exactLat, longitude: exactLng });
      setClientCoordsCache((prev) => ({
        ...prev,
        [clientId]: { ...prev[clientId], lat: exactLat, lng: exactLng, address: prev[clientId]?.address || '', hasExactGps: true },
      }));
      setPendingOrders((prev) =>
        prev.map((o) => (o.persona?.id === clientId ? { ...o, persona: { ...o.persona, latitude: exactLat, longitude: exactLng } } : o)),
      );
      setRoutes((prev) =>
        prev.map((r) =>
          r.orders
            ? {
                ...r,
                orders: r.orders.map((o: any) =>
                  o.persona?.id === clientId ? { ...o, persona: { ...o.persona, latitude: exactLat, longitude: exactLng } } : o,
                ),
              }
            : r,
        ),
      );
      if (selectedRoute?.orders) {
        setSelectedRoute((prev: any) =>
          prev
            ? {
                ...prev,
                orders: prev.orders.map((o: any) =>
                  o.persona?.id === clientId ? { ...o, persona: { ...o.persona, latitude: exactLat, longitude: exactLng } } : o,
                ),
              }
            : null,
        );
      }
    } catch (err) {
      console.error('Error al actualizar coordenadas del cliente:', err);
    }
  };

  return { clientCoordsCache, handleUpdateClientCoords };
}
