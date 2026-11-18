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
  routeClients?: Persona[];
  products?: Product[];
  orders?: Order[];
  rubros?: Rubro[];
  vendedorRoutes?: SaleRoute[];
  todayVisits?: any[];
  resolvedRouteId?: number | null;
  weeklyPromos?: WeeklyPromo[];
}

const VENDEDOR_HISTORY_LIMIT = 50;

export async function readCachedVendedorData(input: VendedorFetchInput): Promise<VendedorFetchOutput> {
  const [cliSnap, prodSnap, ordSnap, rubSnap, routesSnap, visitsSnap, promoSnap, routeCliSnap] = await Promise.all([
    loadCatalogSnapshot<Persona[]>('clients_active'),
    loadCatalogSnapshot<Product[]>('products_full'),
    loadCatalogSnapshot<Order[]>('orders_recent'),
    loadCatalogSnapshot<Rubro[]>('rubros_all'),
    loadCatalogSnapshot<SaleRoute[]>('seller_routes'),
    loadCatalogSnapshot<any[]>('today_visits'),
    loadCatalogSnapshot<WeeklyPromo[]>('weekly_promos_active'),
    input.selectedRouteId
      ? loadCatalogSnapshot<Persona[]>(`route_clients_${input.selectedRouteId}`)
      : Promise.resolve(null),
  ]);

  const q = input.activeTab === 'products' ? input.searchQuery : input.prodSearchQuery;
  const products = prodSnap?.payload
    ? (q.trim() ? filterCachedProducts(prodSnap.payload, q) : prodSnap.payload)
    : undefined;

  return {
    fromCache: true,
    lastCatalogSyncAt: prodSnap?.updatedAt,
    hasAnyCachedData: Boolean(prodSnap?.payload || cliSnap?.payload || routeCliSnap?.payload),
    clients: cliSnap?.payload,
    routeClients: routeCliSnap?.payload,
    products,
    orders: ordSnap?.payload,
    rubros: rubSnap?.payload,
    vendedorRoutes: routesSnap?.payload,
    todayVisits: visitsSnap?.payload,
    weeklyPromos: promoSnap?.payload,
  };
}

function resolveDefaultRouteId(routesList: SaleRoute[], currentRouteId: number | null): number | null {
  if (currentRouteId) return currentRouteId;
  if (routesList.length === 0) return null;
  const daysMap: Record<number, string> = {
    0: 'DOMINGO', 1: 'LUNES', 2: 'MARTES', 3: 'MIERCOLES', 4: 'JUEVES', 5: 'VIERNES', 6: 'SABADO',
  };
  const todayRoute = routesList.find((r: any) => r.dayOfWeek === daysMap[new Date().getDay()]);
  return todayRoute ? todayRoute.id : routesList[0].id;
}

export async function fetchVendedorTabState(input: VendedorFetchInput): Promise<VendedorFetchOutput> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return readCachedVendedorData(input);
  }

  try {
    if (input.activeTab === 'inicio') {
      const routesData = await api.getSellerSaleRoutes();
      const routesList: SaleRoute[] = routesData.routes || [];
      void saveCatalogSnapshot('seller_routes', routesList).catch(() => {});

      const routeIdToLoad = resolveDefaultRouteId(routesList, input.selectedRouteId);

      return {
        fromCache: false,
        vendedorRoutes: routesList,
        resolvedRouteId: routeIdToLoad,
      };
    }

    if (input.activeTab === 'orders') {
      const [clientData, prodData, rubroData, promoData] = await Promise.all([
        api.getClients(),
        api.getProducts('', false, true),
        api.getRubros(),
        api.getActiveWeeklyPromos().catch(() => null),
      ]);
      const activeClients = clientData.filter((c: any) => c.isActive !== false);
      const resolvedPromos = Array.isArray(promoData)
        ? promoData
        : (await loadCatalogSnapshot<WeeklyPromo[]>('weekly_promos_active'))?.payload || [];

      void Promise.all([
        saveCatalogSnapshot('clients_active', activeClients),
        saveCatalogSnapshot('rubros_all', rubroData),
        Array.isArray(promoData) ? saveCatalogSnapshot('weekly_promos_active', promoData) : Promise.resolve(),
        !input.prodSearchQuery.trim() ? saveCatalogSnapshot('products_full', prodData) : Promise.resolve(),
      ]).catch(() => {});

      return {
        fromCache: false,
        lastCatalogSyncAt: new Date().toISOString(),
        clients: activeClients,
        products: prodData,
        rubros: rubroData,
        weeklyPromos: resolvedPromos,
      };
    }

    if (input.activeTab === 'history') {
      const pageRes = await api.getOrdersPage({ page: 1, limit: VENDEDOR_HISTORY_LIMIT });
      const orderData = pageRes.orders || [];
      void saveCatalogSnapshot('orders_recent', orderData).catch(() => {});
      return {
        fromCache: false,
        orders: orderData,
      };
    }

    if (input.activeTab === 'clients') {
      const preselectedRouteId = input.selectedRouteId;
      const [routesData, visitsData, preloadedRouteDetail] = await Promise.all([
        api.getSellerSaleRoutes(),
        api.getTodayVisits(),
        preselectedRouteId ? api.getSaleRouteById(preselectedRouteId).catch(() => null) : Promise.resolve(null),
      ]);
      const routesList: SaleRoute[] = routesData.routes || [];
      const visitsList = visitsData.visits || [];
      const routeIdToLoad = resolveDefaultRouteId(routesList, preselectedRouteId);

      let routeClients: Persona[] = [];
      if (routeIdToLoad) {
        const routeDetail =
          preloadedRouteDetail && preselectedRouteId === routeIdToLoad
            ? preloadedRouteDetail
            : await api.getSaleRouteById(routeIdToLoad);
        routeClients = routeDetail?.route?.clients || [];
      }

      void Promise.all([
        saveCatalogSnapshot('seller_routes', routesList),
        saveCatalogSnapshot('today_visits', visitsList),
        routeIdToLoad ? saveCatalogSnapshot(`route_clients_${routeIdToLoad}`, routeClients) : Promise.resolve(),
      ]).catch(() => {});

      return {
        fromCache: false,
        vendedorRoutes: routesList,
        todayVisits: visitsList,
        resolvedRouteId: routeIdToLoad,
        routeClients,
      };
    }

    if (input.activeTab === 'products') {
      const [prodData, rubroData, promoData] = await Promise.all([
        api.getProducts('', false, true),
        api.getRubros(),
        api.getActiveWeeklyPromos().catch(() => null),
      ]);
      const syncTs = new Date().toISOString();
      void Promise.all([
        saveCatalogSnapshot('rubros_all', rubroData),
        Array.isArray(promoData)
          ? saveCatalogSnapshot('weekly_promos_active', promoData)
          : Promise.resolve(),
        !input.searchQuery.trim() ? saveCatalogSnapshot('products_full', prodData) : Promise.resolve(),
      ]).catch(() => {});

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
