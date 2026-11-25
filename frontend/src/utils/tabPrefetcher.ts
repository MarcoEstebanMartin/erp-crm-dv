/**
 * Precarga silenciosa (prefetch) de chunks lazy al apoyar el mouse o enfocar una pestaña del Sidebar.
 * Deduplica cada pestaña en memoria para descargar el bundle una sola vez antes del clic.
 */

type ChunkLoader = () => Promise<unknown>;

const ADMIN_TAB_LOADERS: Record<string, ChunkLoader> = {
  products: () => import('../components/admin/ProductsTab'),
  clients: () => import('../components/admin/ClientsTab'),
  fulfillment: () => import('../components/admin/FulfillmentDashboard'),
  orders: () => import('../components/admin/OrdersTab'),
  billing: () => import('../components/BillingDashboard'),
  entregas: () => import('../components/RepartoDashboard'),
  logistica: () => import('../components/LogisticaDashboard'),
  rendiciones: () => import('../components/admin/CajaHubSection'),
  config: () => import('../components/admin/ConfigTab'),
  deposito: () => import('../components/DepositoDashboard'),
  crm: () => import('../components/CrmDashboard'),
  compras: () => import('../components/ComprasDashboard'),
};

const DEPOSITO_TAB_LOADERS: Record<string, ChunkLoader> = {
  pedidos: () => import('../components/DepositoDashboard'),
  stock: () => import('../components/DepositoDashboard'),
  mapa: () => import('../components/deposito/WarehouseMap'),
  reparto: () => import('../components/RepartoDashboard'),
  cobrar: () => import('../components/field-receipts/FieldCollectionPage'),
};

const prefetchedKeys = new Set<string>();

export function resetPrefetchedTabsForTest(): void {
  prefetchedKeys.clear();
}

export function prefetchTabChunk(
  role: string,
  tabId: string,
  customLoaders?: Record<string, ChunkLoader>,
): boolean {
  const key = `${role}:${tabId}`;
  if (prefetchedKeys.has(key)) return false;

  const loaders =
    customLoaders ||
    (role === 'ADMIN' || role === 'FACTURACION'
      ? ADMIN_TAB_LOADERS
      : role === 'DEPOSITO'
        ? DEPOSITO_TAB_LOADERS
        : null);

  const loader = loaders?.[tabId];
  if (!loader) return false;

  prefetchedKeys.add(key);
  try {
    void Promise.resolve(loader()).catch(() => {
      // Si falló por microcorte de red, permitir reintento en el próximo hover
      prefetchedKeys.delete(key);
    });
  } catch {
    prefetchedKeys.delete(key);
  }
  return true;
}
