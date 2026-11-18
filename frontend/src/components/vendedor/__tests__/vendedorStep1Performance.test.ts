import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  getClients: vi.fn(),
  getProducts: vi.fn(),
  getRubros: vi.fn(),
  getActiveWeeklyPromos: vi.fn(),
  getOrdersPage: vi.fn(),
  getSellerSaleRoutes: vi.fn(),
  getTodayVisits: vi.fn(),
  getSaleRouteById: vi.fn(),
}));

vi.mock('../../../utils/api', () => ({ api: mockApi }));

import { fetchVendedorTabState } from '../vendedorCatalogFetcher';
import { __resetOfflineDbMemoryForTests } from '../../../utils/offlineCatalogDb';

describe('Vendedor Paso 1 — Velocidad de Datos y Carga', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetOfflineDbMemoryForTests();
  });

  it('pide catálogo en modo liviano (light=true) en la pestaña Vender', async () => {
    mockApi.getClients.mockResolvedValue([
      { id: 1, name: 'Cliente Activo', isActive: true },
      { id: 2, name: 'Cliente Inactivo', isActive: false },
    ]);
    mockApi.getProducts.mockResolvedValue([{ id: 10, sku: '100', name: 'Yerba', listPrice: 2500, stock: 20 }]);
    mockApi.getRubros.mockResolvedValue([{ id: 1, name: 'Almacén' }]);
    mockApi.getActiveWeeklyPromos.mockResolvedValue([]);

    const res = await fetchVendedorTabState({
      activeTab: 'orders',
      prodSearchQuery: '',
      searchQuery: '',
      selectedRouteId: null,
    });

    expect(mockApi.getProducts).toHaveBeenCalledWith('', false, true);
    expect(res.clients).toHaveLength(1);
    expect(res.clients?.[0].id).toBe(1);
    expect(res.routeClients).toBeUndefined();
    expect(res.products).toHaveLength(1);
  });

  it('limita el historial de pedidos a 50 registros usando getOrdersPage', async () => {
    mockApi.getOrdersPage.mockResolvedValue({
      orders: [{ id: 99, totalAmount: 15000 }],
      pagination: { total: 120, page: 1, limit: 50, totalPages: 3 },
    });

    const res = await fetchVendedorTabState({
      activeTab: 'history',
      prodSearchQuery: '',
      searchQuery: '',
      selectedRouteId: null,
    });

    expect(mockApi.getOrdersPage).toHaveBeenCalledWith({ page: 1, limit: 50 });
    expect(res.orders).toEqual([{ id: 99, totalAmount: 15000 }]);
  });

  it('en Ruta separa routeClients de clients y precarga la ruta seleccionada en paralelo', async () => {
    mockApi.getSellerSaleRoutes.mockResolvedValue({
      routes: [{ id: 10, name: 'Ruta Lunes', dayOfWeek: 'LUNES' }],
    });
    mockApi.getTodayVisits.mockResolvedValue({ visits: [{ personaId: 5, status: 'NO_BUY' }] });
    mockApi.getSaleRouteById.mockResolvedValue({
      route: { id: 10, clients: [{ id: 5, name: 'Kiosco Sur' }] },
    });

    const res = await fetchVendedorTabState({
      activeTab: 'clients',
      prodSearchQuery: '',
      searchQuery: '',
      selectedRouteId: 10,
    });

    expect(mockApi.getSaleRouteById).toHaveBeenCalledTimes(1);
    expect(mockApi.getSaleRouteById).toHaveBeenCalledWith(10);
    expect(res.routeClients).toEqual([{ id: 5, name: 'Kiosco Sur' }]);
    expect(res.clients).toBeUndefined();
    expect(res.todayVisits).toHaveLength(1);
  });
});
