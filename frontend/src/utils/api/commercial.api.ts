import { request } from './httpClient';
import { adminApi } from './admin.api';

export const commercialApi = {
  // --- OFERTAS SEMANALES ---
  getWeeklyPromos: async () => {
    return await request('/weekly-promos');
  },

  getActiveWeeklyPromos: async () => {
    return await request('/weekly-promos/active');
  },

  createWeeklyPromo: async (promoData: {
    type: 'OFFER_PRICE' | 'BUY_X_GET_Y' | 'COMBO';
    name?: string | null;
    startDate: string;
    endDate?: string | null;
    items: Array<{
      productId: number;
      minQuantity: number;
      freeQuantity?: number;
      promoUnitPrice?: number | null;
    }>;
  }) => {
    return await request('/weekly-promos', {
      method: 'POST',
      body: JSON.stringify(promoData),
    });
  },

  toggleWeeklyPromo: async (id: number) => {
    return await request(`/weekly-promos/${id}/toggle`, {
      method: 'PATCH',
    });
  },

  deleteWeeklyPromo: async (id: number) => {
    return await request(`/weekly-promos/${id}`, {
      method: 'DELETE',
    });
  },

  // --- RUTAS DE PREVENTA & VISITAS ---
  getWeeklySchedule: async () => {
    const res = await request('/weekly-schedule');
    return res.data || res;
  },

  setCurrentWeek: async (weekType: string) => {
    const res = await request('/weekly-schedule/toggle-week', {
      method: 'POST',
      body: JSON.stringify({ weekType })
    });
    return res.data || res;
  },

  createWeeklyScheduleItem: async (data: any) => {
    const res = await request('/weekly-schedule', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.data || res;
  },

  updateWeeklyScheduleItem: async (id: number, data: any) => {
    const res = await request(`/weekly-schedule/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return res.data || res;
  },

  deleteWeeklyScheduleItem: async (id: number) => {
    return await request(`/weekly-schedule/${id}`, {
      method: 'DELETE'
    });
  },

  seedWeeklyScheduleDefaults: async () => {
    const res = await request('/weekly-schedule/seed-defaults', {
      method: 'POST'
    });
    return res.data || res;
  },

  getSaleRoutes: async () => {
    return await request('/sale-routes');
  },

  getSellerSaleRoutes: async () => {
    return await request('/sale-routes/my-routes');
  },

  getSaleRouteById: async (id: number) => {
    return await request(`/sale-routes/${id}`);
  },

  createSaleRoute: async (routeData: { name: string; sellerId?: number | null; dayOfWeek?: string | null }) => {
    return await request('/sale-routes', {
      method: 'POST',
      body: JSON.stringify(routeData)
    });
  },

  updateSaleRoute: async (id: number, routeData: { name?: string; sellerId?: number | null; dayOfWeek?: string | null; isActive?: boolean }) => {
    return await request(`/sale-routes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(routeData)
    });
  },

  deleteSaleRoute: async (id: number) => {
    return await request(`/sale-routes/${id}`, {
      method: 'DELETE'
    });
  },

  updateClientSequence: async (id: number, clientIds: number[]) => {
    return await request(`/sale-routes/${id}/sequence`, {
      method: 'PUT',
      body: JSON.stringify({ clientIds })
    });
  },

  removeClientFromRoute: async (routeId: number, clientId: number) => {
    return await request(`/sale-routes/${routeId}/clients/${clientId}`, {
      method: 'DELETE',
    });
  },

  getUnassignedRouteClients: async () => {
    return await request('/sale-routes/unassigned-clients');
  },

  addClientToRoute: async (id: number, clientId: number) => {
    return await request(`/sale-routes/${id}/clients`, {
      method: 'POST',
      body: JSON.stringify({ clientId })
    });
  },

  recordRouteVisit: async (
    id: number,
    visitData: { personaId: number; status: 'ORDERED' | 'NO_BUY'; noBuyReason?: string | null; notes?: string | null; latitude?: number | null; longitude?: number | null },
    options?: { idempotencyKey?: string }
  ) => {
    return await request(`/sale-routes/${id}/visit`, {
      method: 'POST',
      headers: options?.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
      body: JSON.stringify(visitData)
    });
  },

  optimizeSaleRouteSequence: async (id: number, startCoords?: { lat: number; lng: number }) => {
    return await request(`/sale-routes/${id}/optimize-sequence`, {
      method: 'POST',
      body: JSON.stringify({ startCoords })
    });
  },

  getTodayVisits: async () => {
    return await request('/sale-routes/visits/today');
  },

  // --- FLOTA DE VEHÍCULOS ---
  getVehicles: async () => {
    const res = await request('/fleet');
    return res.vehicles;
  },

  createVehicle: async (data: any) => {
    return await request('/fleet', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateVehicle: async (id: number, data: any) => {
    return await request(`/fleet/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteVehicle: async (id: number) => {
    return await request(`/fleet/${id}`, {
      method: 'DELETE'
    });
  },

  createVehicleMaintenance: async (vehicleId: number, data: any) => {
    return await request(`/fleet/${vehicleId}/maintenances`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  deleteVehicleMaintenance: async (id: number) => {
    return await request(`/fleet/maintenances/${id}`, {
      method: 'DELETE'
    });
  },

  createVehicleExpiry: async (vehicleId: number, data: any) => {
    return await request(`/fleet/${vehicleId}/expirations`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateVehicleExpiry: async (id: number, data: any) => {
    return await request(`/fleet/expirations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteVehicleExpiry: async (id: number) => {
    return await request(`/fleet/expirations/${id}`, {
      method: 'DELETE'
    });
  },

  // --- CONTROL DE COMBUSTIBLE DE FLOTA ---
  getFuelLogs: async (params?: { vehicleId?: number; status?: 'PENDING' | 'SETTLED'; startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams();
    if (params?.vehicleId) query.append('vehicleId', String(params.vehicleId));
    if (params?.status) query.append('status', params.status);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await request(`/fleet/fuel${queryString}`);
    return res.logs;
  },

  getFuelAnalytics: async () => {
    const res = await request('/fleet/fuel/analytics');
    return res;
  },

  createFuelLog: async (data: any) => {
    return await request('/fleet/fuel', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  settleFuelLogs: async (data: any) => {
    return await request('/fleet/fuel/settle', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  deleteFuelLog: async (id: number) => {
    return await request(`/fleet/fuel/${id}`, {
      method: 'DELETE'
    });
  },

  createPerception: async (perceptionData: any) => {
    throw new Error('La creación de impuestos/percepciones no está disponible en la versión actual. Modifique un impuesto existente en su lugar.');
  },

  reconcileAllClientBalances: async () => {
    return await adminApi.checkBalances();
  },

  recalculateAndFixClientBalance: async (personaId: number) => {
    return await adminApi.syncBalances(personaId);
  },

  createCampaign: async (data: { title: string; startDate?: string; endDate?: string; isActive?: boolean }) => {
    return await request('/offers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getCampaignSuggestions: async () => {
    const res = await request('/offers/suggestions');
    return res;
  },

  getWeeklyOfferRecommendations: async (params?: { week?: string; shuffle?: string; baselineCampaignId?: number }) => {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const res = await request(`/offers/recommendations${query}`);
    return res;
  },

  getCampaignComparison: async (baselineId?: number, targetId?: number) => {
    const params = new URLSearchParams();
    if (baselineId) params.append('baselineId', String(baselineId));
    if (targetId) params.append('targetId', String(targetId));
    const res = await request(`/offers/comparison?${params.toString()}`);
    return res;
  },

  addBulkCampaignItems: async (campaignId: number, items: { productId: number, offerPrice: number, specialTag: string | null, campaignGroup?: string | null }[]) => {
    const res = await request(`/offers/${campaignId}/items/bulk`, {
      method: 'POST',
      body: JSON.stringify({ items })
    });
    return res;
  }
};
