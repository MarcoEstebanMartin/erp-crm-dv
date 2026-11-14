import { api } from '../../utils/api';
import {
  filterCachedProducts,
  loadCatalogSnapshot,
  saveCatalogSnapshot,
} from '../../utils/offlineCatalogDb';
import { isLikelyNetworkError } from '../../utils/offlineSyncManager';
import type { Persona, Product, Order, Rubro, SaleRoute } from '../../types';
import type { WeeklyPromo } from '../admin/config/weeklyPromo.helpers';

export interface VendedorFetchInput {
  activeTab: string;
  prodSearchQuery: string;
  searchQuery: string;
  selectedRouteId: number | null;
}

export interface VendedorFetchOutput {
  fromCache: boolean;
  lastCatalogSyncAt?: string;
  hasAnyCachedData?: boolean;
  clients?: Persona[];
  products?: Product[];
  orders?: Order[];
  rubros?: Rubro[];
  vendedorRoutes?: SaleRoute[];
  todayVisits?: any[];
  resolvedRouteId?: number | null;
  weeklyPromos?: WeeklyPromo[];
}

async function readCachedVendedorData(input: VendedorFetchInput): Promise<VendedorFetchOutput> {
  const [cliSnap, prodSnap, ordSnap, rubSnap, routesSnap, visitsSnap, promoSnap] = await Promise.all([
    loadCatalogSnapshot<Persona[]>('clients_active'),
    loadCatalogSnapshot<Product[]>('products_full'),
    loadCatalogSnapshot<Order[]>('orders_recent'),
    loadCatalogSnapshot<Rubro[]>('rubros_all'),
    loadCatalogSnapshot<SaleRoute[]>('seller_routes'),
    loadCatalogSnapshot<any[]>('today_visits'),
    loadCatalogSnapshot<WeeklyPromo[]>('weekly_promos_active'),
  ]);

  let resolvedClients = cliSnap?.payload;
  if (input.activeTab === 'clients' && input.selectedRouteId) {
    const routeSnap = await loadCatalogSnapshot<Persona[]>(`route_clients_${input.selectedRouteId}`);
    if (routeSnap?.payload) resolvedClients = routeSnap.payload;
  }

  const q = input.activeTab === 'products' ? input.searchQuery : input.prodSearchQuery;
  const filteredProducts = prodSnap?.payload
    ? filterCachedProducts(prodSnap.payload, q)
    : undefined;

  return {
    fromCache: true,
    lastCatalogSyncAt: prodSnap?.updatedAt,
    hasAnyCachedData: Boolean(prodSnap?.payload || cliSnap?.payload),
    clients: resolvedClients,
    products: filteredProducts,
    orders: ordSnap?.payload,
    rubros: rubSnap?.payload,
    vendedorRoutes: routesSnap?.payload,
    todayVisits: visitsSnap?.payload,
    weeklyPromos: promoSnap?.payload,
  };
}

export async function fetchVendedorTabState(input: VendedorFetchInput): Promise<VendedorFetchOutput> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return readCachedVendedorData(input);
  }

  try {
    if (input.activeTab === 'orders' || input.activeTab === 'history') {
      const [clientData, prodData, orderData, rubroData, promoData] = await Promise.all([
        api.getClients(),
        api.getProducts(input.prodSearchQuery),
        api.getOrders(),
        api.getRubros(),
        api.getActiveWeeklyPromos().catch(() => null),
      ]);
      const activeClients = clientData.filter((c: any) => c.isActive !== false);
      const resolvedPromos = Array.isArray(promoData)
        ? promoData
        : (await loadCatalogSnapshot<WeeklyPromo[]>('weekly_promos_active'))?.payload || [];
      let syncTs: string | undefined;

      await Promise.all([
        saveCatalogSnapshot('clients_active', activeClients),
        saveCatalogSnapshot('orders_recent', orderData),
        saveCatalogSnapshot('rubros_all', rubroData),
        Array.isArray(promoData)
          ? saveCatalogSnapshot('weekly_promos_active', promoData)
          : Promise.resolve(),
        !input.prodSearchQuery.trim()
          ? saveCatalogSnapshot('products_full', prodData).then((ts) => { syncTs = ts; })
          : Promise.resolve(),
      ]);

      return {
        fromCache: false,
        lastCatalogSyncAt: syncTs,
        clients: activeClients,
        products: prodData,
        orders: orderData,
        rubros: rubroData,
        weeklyPromos: resolvedPromos,
      };
    }

    if (input.activeTab === 'clients') {
      const [routesData, visitsData] = await Promise.all([
        api.getSellerSaleRoutes(),
        api.getTodayVisits(),
      ]);
      const routesList: SaleRoute[] = routesData.routes || [];
      const visitsList = visitsData.visits || [];

      await Promise.all([
        saveCatalogSnapshot('seller_routes', routesList),
        saveCatalogSnapshot('today_visits', visitsList),
      ]);

      let routeIdToLoad = input.selectedRouteId;
      if (!routeIdToLoad && routesList.length > 0) {
        const daysMap: Record<number, string> = {
          0: 'DOMINGO', 1: 'LUNES', 2: 'MARTES', 3: 'MIERCOLES', 4: 'JUEVES', 5: 'VIERNES', 6: 'SABADO',
        };
        const todayRoute = routesList.find((r: any) => r.dayOfWeek === daysMap[new Date().getDay()]);
        routeIdToLoad = todayRoute ? todayRoute.id : routesList[0].id;
      }

      let routeClients: Persona[] = [];
      if (routeIdToLoad) {
        const routeDetail = await api.getSaleRouteById(routeIdToLoad);
        routeClients = routeDetail.route.clients || [];
        await saveCatalogSnapshot(`route_clients_${routeIdToLoad}`, routeClients);
      }

      return {
        fromCache: false,
        vendedorRoutes: routesList,
        todayVisits: visitsList,
        resolvedRouteId: routeIdToLoad,
        clients: routeClients,
      };
    }

    if (input.activeTab === 'products') {
      const [prodData, rubroData, promoData] = await Promise.all([
        api.getProducts(input.searchQuery),
        api.getRubros(),
        api.getActiveWeeklyPromos().catch(() => null),
      ]);
      await Promise.all([
        saveCatalogSnapshot('rubros_all', rubroData),
        Array.isArray(promoData)
          ? saveCatalogSnapshot('weekly_promos_active', promoData)
          : Promise.resolve(),
      ]);
      let syncTs: string | undefined;
      if (!input.searchQuery.trim()) {
        syncTs = await saveCatalogSnapshot('products_full', prodData);
      }
      return {
        fromCache: false,
        lastCatalogSyncAt: syncTs,
        products: prodData,
        rubros: rubroData,
        weeklyPromos: Array.isArray(promoData) ? promoData : undefined,
      };
    }

    return { fromCache: false };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      return readCachedVendedorData(input);
    }
    throw err;
  }
}
