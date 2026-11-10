import { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';
import {
  CLIENT_COORDS,
  detectRealCity,
  getCityBaseCoords,
  cleanStreetAddress,
  applyJitter,
  loadGoogleMapsScript
} from './repartoGeoHelpers';

export function useRepartoGeocoder({
  pendingOrders,
  setPendingOrders,
  routes,
  setRoutes,
  selectedRoute,
  setSelectedRoute
}: {
  pendingOrders: any[];
  setPendingOrders: React.Dispatch<React.SetStateAction<any[]>>;
  routes: any[];
  setRoutes: React.Dispatch<React.SetStateAction<any[]>>;
  selectedRoute: any;
  setSelectedRoute: React.Dispatch<React.SetStateAction<any>>;
}) {
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [clientCoordsCache, setClientCoordsCache] = useState<{ [key: number]: { lat: number; lng: number; address: string } }>({});

  const apiKey = (import.meta.env as any)?.VITE_GOOGLE_MAPS_API_KEY || '';

  useEffect(() => {
    if (apiKey) {
      loadGoogleMapsScript(apiKey, () => setGoogleLoaded(true));
    }
  }, [apiKey]);

  const selectedRouteRef = useRef(selectedRoute);
  useEffect(() => {
    selectedRouteRef.current = selectedRoute;
  }, [selectedRoute]);

  const isGeocodingRef = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!googleLoaded || isGeocodingRef.current) return;

    const personasToGeocode: any[] = [];
    const processedIds = new Set<number>();

    const addPersona = (p: any) => {
      if (!p || !p.id) return;
      if (typeof p.latitude === 'number' && typeof p.longitude === 'number') return;
      if (CLIENT_COORDS[p.id]) return;

      const expectedAddress = p.address || '';
      const cityName = detectRealCity(p);
      const expectedCacheString = `${expectedAddress}, ${cityName}`;

      if (clientCoordsCache[p.id] && clientCoordsCache[p.id].address === expectedCacheString) return;
      if (processedIds.has(p.id)) return;
      processedIds.add(p.id);
      personasToGeocode.push(p);
    };

    pendingOrders.forEach(o => addPersona(o.persona));
    routes.forEach(r => r.orders?.forEach((o: any) => addPersona(o.persona)));
    const currentSelectedRoute = selectedRouteRef.current;
    if (currentSelectedRoute?.orders) {
      currentSelectedRoute.orders.forEach((o: any) => addPersona(o.persona));
    }

    if (personasToGeocode.length === 0) return;

    isGeocodingRef.current = true;
    const geocoder = new (window as any).google.maps.Geocoder();
    const newCacheEntries: typeof clientCoordsCache = {};

    let index = 0;
    const processNext = () => {
      if (index >= personasToGeocode.length) {
        isGeocodingRef.current = false;
        if (Object.keys(newCacheEntries).length > 0) {
          setClientCoordsCache(prev => ({ ...prev, ...newCacheEntries }));
        }
        return;
      }

      const p = personasToGeocode[index];
      const cityName = detectRealCity(p);
      const cleanStreet = cleanStreetAddress(p.address || '', cityName);

      const handleSuccess = async (lat: number, lng: number, cacheAddress: string) => {
        const jittered = applyJitter(lat, lng, p.id);
        newCacheEntries[p.id] = { lat: jittered.lat, lng: jittered.lng, address: cacheAddress };

        try {
          await api.updatePersona(p.id, { latitude: lat, longitude: lng });
          setPendingOrders(prev => prev.map(o => o.persona?.id === p.id ? { ...o, persona: { ...o.persona, latitude: lat, longitude: lng } } : o));
          setRoutes(prev => prev.map(r => r.orders ? { ...r, orders: r.orders.map((o: any) => o.persona?.id === p.id ? { ...o, persona: { ...o.persona, latitude: lat, longitude: lng } } : o) } : r));
          const selRoute = selectedRouteRef.current;
          if (selRoute && selRoute.orders) {
            const updatedOrders = selRoute.orders.map((o: any) => o.persona?.id === p.id ? { ...o, persona: { ...o.persona, latitude: lat, longitude: lng } } : o);
            setSelectedRoute((prev: any) => prev ? { ...prev, orders: updatedOrders } : null);
          }
        } catch (err) {
          console.error('Error al guardar coordenadas geocodificadas:', err);
        }

        index++;
        setTimeout(processNext, 200);
      };

      const handleFailure = (reason: string) => {
        console.warn(`Geocoding failed for client ${p.name} at ${p.address || ''}: ${reason}`);
        const base = getCityBaseCoords(p);
        const jittered = applyJitter(base.lat, base.lng, p.id);
        newCacheEntries[p.id] = {
          lat: jittered.lat,
          lng: jittered.lng,
          address: p.address ? `${p.address}, ${cityName}` : `Acceso ${cityName}`
        };
        index++;
        setTimeout(processNext, 200);
      };

      if (!cleanStreet) {
        const query = `${cityName}, Buenos Aires, Argentina`;
        geocoder.geocode({ address: query }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            handleSuccess(loc.lat(), loc.lng(), `${p.address || 'ZONA URBANA'}, ${cityName}`);
          } else {
            handleFailure(status);
          }
        });
      } else {
        const query = `${cleanStreet}, ${cityName}, Buenos Aires, Argentina`;
        geocoder.geocode({ address: query }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            handleSuccess(loc.lat(), loc.lng(), `${p.address}, ${cityName}`);
          } else {
            const cityQuery = `${cityName}, Buenos Aires, Argentina`;
            geocoder.geocode({ address: cityQuery }, (results2: any, status2: any) => {
              if (status2 === 'OK' && results2 && results2[0]) {
                const loc2 = results2[0].geometry.location;
                handleSuccess(loc2.lat(), loc2.lng(), `${p.address}, ${cityName}`);
              } else {
                handleFailure(status2);
              }
            });
          }
        });
      }
    };

    processNext();
  }, [googleLoaded, pendingOrders.length, routes.length]);

  const handleUpdateClientCoords = async (clientId: number, lat: number, lng: number) => {
    try {
      await api.updatePersona(clientId, { latitude: lat, longitude: lng });
      setClientCoordsCache(prev => ({ ...prev, [clientId]: { ...prev[clientId], lat, lng } }));
      setPendingOrders(prev => prev.map(o => o.persona?.id === clientId ? { ...o, persona: { ...o.persona, latitude: lat, longitude: lng } } : o));
      setRoutes(prev => prev.map(r => r.orders ? { ...r, orders: r.orders.map((o: any) => o.persona?.id === clientId ? { ...o, persona: { ...o.persona, latitude: lat, longitude: lng } } : o) } : r));
      if (selectedRoute && selectedRoute.orders) {
        const updatedOrders = selectedRoute.orders.map((o: any) => o.persona?.id === clientId ? { ...o, persona: { ...o.persona, latitude: lat, longitude: lng } } : o);
        setSelectedRoute((prev: any) => prev ? { ...prev, orders: updatedOrders } : null);
      }
    } catch (err) {
      console.error('Error al actualizar las coordenadas del cliente:', err);
    }
  };

  return { clientCoordsCache, handleUpdateClientCoords };
}
