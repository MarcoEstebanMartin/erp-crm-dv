import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { isBonusOrderItem } from '../../utils/weeklyPromoCartEvaluator';
import {
  resolveOrderPersona,
} from '../../utils/orderSearchAndStatus.helper';
import {
  CATALOG_META_FRESHNESS_TTL_MS,
  CLIENTS_FRESHNESS_TTL_MS,
  PRODUCTS_FRESHNESS_TTL_MS,
  shouldFetchAdminResource,
} from '../../utils/adminFetchPolicy';
import {
  CLIENTS_QUERY_KEYS,
  HOME_QUERY_KEYS,
  ORDERS_QUERY_KEYS,
  PRODUCTS_QUERY_KEYS,
} from '../../hooks/queries';
import type { Product, User, Persona, Order, Rubro, SaleRoute } from '../../types';

export function useAdminController(activeTab: string) {
  const queryClient = useQueryClient();
  const [products, setProducts] = useState<Product[]>(
    () => queryClient.getQueryData<Product[]>(PRODUCTS_QUERY_KEYS.adminList) || [],
  );
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Persona[]>(
    () => queryClient.getQueryData<Persona[]>(CLIENTS_QUERY_KEYS.list('client')) || [],
  );
  const [availableSellers, setAvailableSellers] = useState<User[]>(
    () => queryClient.getQueryData<User[]>(CLIENTS_QUERY_KEYS.sellers) || [],
  );
  const [availableSaleRoutes, setAvailableSaleRoutes] = useState<SaleRoute[]>(
    () => queryClient.getQueryData<SaleRoute[]>(CLIENTS_QUERY_KEYS.saleRoutes) || [],
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersSummary, setOrdersSummary] = useState<{
    recibidosCount: number;
    armadosCount: number;
    facturadosCount: number;
  } | null>(() => queryClient.getQueryData(ORDERS_QUERY_KEYS.summary) || null);
  const [ordersVersion, setOrdersVersion] = useState(0);
  const [financialReport, setFinancialReport] = useState<any | null>(null);
  const [rubrosList, setRubrosList] = useState<Rubro[]>(
    () => queryClient.getQueryData<Rubro[]>(PRODUCTS_QUERY_KEYS.rubros) || [],
  );
  const [providersList, setProvidersList] = useState<Persona[]>(
    () => queryClient.getQueryData<Persona[]>(CLIENTS_QUERY_KEYS.list('provider')) || [],
  );

  const freshnessRef = useRef({
    productsAt: 0,
    hasProducts: false,
    clientsAt: 0,
    hasClients: false,
    rubrosAt: 0,
    hasRubros: false,
    providersAt: 0,
    hasProviders: false,
    sellersAt: 0,
    hasSellers: false,
    saleRoutesAt: 0,
    hasSaleRoutes: false,
  });

  const [productModal, setProductModal] = useState({
    open: false, mode: 'create',
    data: { id: 0, sku: '', name: '', description: '', barcode: '', costPrice: 0, listPrice: 0, listPriceB: 0, listPriceC: 0, profitMargin: 25 as string | number, minStock: 0, isPesable: false, approximateWeight: 0, unitsPerBox: 1, rubroId: '' as string | number, commercialCategory: '', providerId: '' as string | number, imageUrl: null as string | null },
  });
  const [importZipModalOpen, setImportZipModalOpen] = useState(false);
  const [clientModal, setClientModal] = useState({
    open: false, mode: 'create',
    data: { id: 0, name: '', cuit: '', address: '', city: '', phone: '', email: '', creditLimit: 0, maxUnpaidInvoices: 0, priceList: 'A', discount: 0, isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false, route: '', saleRouteId: null as number | null, sellerId: null as number | null, isActive: true },
  });
  const [clientsVersion, setClientsVersion] = useState(0);
  const [showResumenModal, setShowResumenModal] = useState<any>(null);
  const [orderDetailsModal, setOrderDetailsModal] = useState<any | null>(null);
  const [editOrderModal, setEditOrderModal] = useState<{
    open: boolean;
    orderId: number;
    clientId: number;
    clientName: string;
    client?: any;
    items: any[];
  } | null>(null);

  const [clientProfileModal, setClientProfileModal] = useState<{ open: boolean; client: any; ledger: any[] } | null>(null);
  const [sellerProfileModal, setSellerProfileModal] = useState<{ open: boolean; sellerId: number } | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; clientId: number; clientName: string } | null>(null);
  const [fastInvoiceOrder, setFastInvoiceOrder] = useState<any | null>(null);

  const [isPriceListModalOpen, setIsPriceListModalOpen] = useState(false);
  const [isQuickSearchModalOpen, setIsQuickSearchModalOpen] = useState(false);
  const [isDirectInvoiceModalOpen, setIsDirectInvoiceModalOpen] = useState(false);
  const [clientSearchModal, setClientSearchModal] = useState<{ open: boolean; action: 'ledger' | 'payment' | 'order' } | null>(null);
  const [quickClientQuery, setQuickClientQuery] = useState('');
  const [createOrderModal, setCreateOrderModal] = useState<{ open: boolean; client: any; cart: { product: any; quantity: number; isEmergencyOverride?: boolean }[]; salesChannel?: string; notes: string } | null>(null);
  const [summaryCardModal, setSummaryCardModal] = useState<{ open: boolean; cardKey: string; cardLabel: string } | null>(null);

  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [cajasSubTab, setCajasSubTab] = useState<'general' | 'rendiciones' | 'field-receipts' | 'gastos' | 'reportes'>(() =>
    api.getCurrentUser()?.role === 'ADMIN' ? 'general' : 'rendiciones',
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const isAdmin = api.getCurrentUser()?.role === 'ADMIN';
    if ((activeTab === 'reportes' || activeTab === 'reports') && isAdmin) {
      setCajasSubTab('reportes');
    } else if (!isAdmin && (cajasSubTab === 'general' || cajasSubTab === 'gastos' || cajasSubTab === 'reportes')) {
      setCajasSubTab('rendiciones');
    }
  }, [activeTab, cajasSubTab]);

  const loadProductsIfNeeded = useCallback(async (force: boolean) => {
    if (
      !shouldFetchAdminResource({
        lastFetchedAt: freshnessRef.current.productsAt,
        hasData: freshnessRef.current.hasProducts,
        ttlMs: PRODUCTS_FRESHNESS_TTL_MS,
        force,
      })
    ) {
      return;
    }
    const allProducts = await queryClient.fetchQuery({
      queryKey: PRODUCTS_QUERY_KEYS.adminList,
      queryFn: () => api.getProducts('', true),
      staleTime: force ? 0 : PRODUCTS_FRESHNESS_TTL_MS,
    });
    setProducts(allProducts);
    freshnessRef.current.productsAt = Date.now();
    freshnessRef.current.hasProducts = Array.isArray(allProducts) && allProducts.length > 0;
  }, [queryClient]);

  const loadClientsIfNeeded = useCallback(async (force: boolean) => {
    if (
      !shouldFetchAdminResource({
        lastFetchedAt: freshnessRef.current.clientsAt,
        hasData: freshnessRef.current.hasClients,
        ttlMs: CLIENTS_FRESHNESS_TTL_MS,
        force,
      })
    ) {
      return;
    }
    const allClients = await queryClient.fetchQuery({
      queryKey: CLIENTS_QUERY_KEYS.list('client'),
      queryFn: () => api.getPersonas('client'),
      staleTime: force ? 0 : CLIENTS_FRESHNESS_TTL_MS,
    });
    setClients(allClients);
    freshnessRef.current.clientsAt = Date.now();
    freshnessRef.current.hasClients = Array.isArray(allClients) && allClients.length > 0;
  }, [queryClient]);

  const loadClientMetaIfNeeded = useCallback(async (force: boolean) => {
    const needSellers = shouldFetchAdminResource({
      lastFetchedAt: freshnessRef.current.sellersAt,
      hasData: freshnessRef.current.hasSellers,
      ttlMs: CATALOG_META_FRESHNESS_TTL_MS,
      force,
    });
    const needRoutes = shouldFetchAdminResource({
      lastFetchedAt: freshnessRef.current.saleRoutesAt,
      hasData: freshnessRef.current.hasSaleRoutes,
      ttlMs: CATALOG_META_FRESHNESS_TTL_MS,
      force,
    });
    if (!needSellers && !needRoutes) return;

    await Promise.all([
      needSellers
        ? queryClient
            .fetchQuery({
              queryKey: CLIENTS_QUERY_KEYS.sellers,
              queryFn: () => api.getSellersList(),
              staleTime: force ? 0 : CATALOG_META_FRESHNESS_TTL_MS,
            })
            .then((sellers) => {
              setAvailableSellers(sellers || []);
              freshnessRef.current.sellersAt = Date.now();
              freshnessRef.current.hasSellers = Array.isArray(sellers);
            })
        : Promise.resolve(),
      needRoutes
        ? queryClient
            .fetchQuery({
              queryKey: CLIENTS_QUERY_KEYS.saleRoutes,
              queryFn: async () => (await api.getSaleRoutes())?.routes || [],
              staleTime: force ? 0 : CATALOG_META_FRESHNESS_TTL_MS,
            })
            .then((routes) => {
              setAvailableSaleRoutes(routes || []);
              freshnessRef.current.saleRoutesAt = Date.now();
              freshnessRef.current.hasSaleRoutes = Array.isArray(routes);
            })
        : Promise.resolve(),
    ]);
  }, [queryClient]);

  const runTabFetch = useCallback(async (force: boolean) => {
    setErrorMsg(null);
    try {
      if (activeTab === 'dashboard') {
        // Prioriza contadores livianos (3 COUNT SQL) con caché React Query y precalienta catálogo/clientes
        const summaryPromise = queryClient
          .fetchQuery({
            queryKey: ORDERS_QUERY_KEYS.summary,
            queryFn: () => api.getOrdersSummary(),
            staleTime: force ? 0 : 20_000,
          })
          .then((summary) => setOrdersSummary(summary));
        void Promise.all([loadClientsIfNeeded(force), loadProductsIfNeeded(force)]).catch((e) =>
          console.error('Error al precalentar catálogo/clientes:', e),
        );
        await summaryPromise;
      } else if (
        activeTab === 'reportes' ||
        activeTab === 'reports' ||
        (activeTab === 'rendiciones' && cajasSubTab === 'reportes')
      ) {
        if (api.getCurrentUser()?.role !== 'ADMIN') return;
        const [stats, dataUsers, allOrders] = await Promise.all([
          api.getFinancialReports(),
          api.getUsers(),
          api.getOrders(),
          loadProductsIfNeeded(force),
          loadClientsIfNeeded(force),
        ]);
        setFinancialReport(stats);
        setUsers(dataUsers);
        setOrders(allOrders);
      } else if (activeTab === 'products' || activeTab === 'catalog' || activeTab === 'stock') {
        const needRubros = shouldFetchAdminResource({
          lastFetchedAt: freshnessRef.current.rubrosAt,
          hasData: freshnessRef.current.hasRubros,
          ttlMs: CATALOG_META_FRESHNESS_TTL_MS,
          force,
        });
        const needProviders = shouldFetchAdminResource({
          lastFetchedAt: freshnessRef.current.providersAt,
          hasData: freshnessRef.current.hasProviders,
          ttlMs: CATALOG_META_FRESHNESS_TTL_MS,
          force,
        });

        await Promise.all([
          loadProductsIfNeeded(force),
          needRubros
            ? api.getRubros().then((rList) => {
                setRubrosList(rList || []);
                freshnessRef.current.rubrosAt = Date.now();
                freshnessRef.current.hasRubros = true;
              }).catch((e) => console.error('Error al cargar rubros:', e))
            : Promise.resolve(),
          needProviders
            ? api.getPersonas('provider').then((pList) => {
                setProvidersList(pList || []);
                freshnessRef.current.providersAt = Date.now();
                freshnessRef.current.hasProviders = true;
              }).catch((e) => console.error('Error al cargar proveedores:', e))
            : Promise.resolve(),
        ]);
      } else if (activeTab === 'users' || activeTab === 'personal') {
        setUsers(await api.getUsers());
      } else if (activeTab === 'clients') {
        try {
          await Promise.all([loadClientMetaIfNeeded(force), loadClientsIfNeeded(force)]);
        } catch (e) { console.error('Error al cargar datos de preventa:', e); }
      } else if (activeTab === 'orders') {
        if (force) {
          setOrdersVersion((prev) => prev + 1);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión');
    }
  }, [activeTab, cajasSubTab, orderStatusFilter, loadClientsIfNeeded, loadClientMetaIfNeeded, loadProductsIfNeeded, queryClient]);

  // Refresco explícito tras mutaciones (invalida React Query + consulta datos frescos del servidor)
  const fetchData = useCallback(async () => {
    freshnessRef.current.providersAt = 0;
    freshnessRef.current.hasProviders = false;
    freshnessRef.current.productsAt = 0;
    freshnessRef.current.clientsAt = 0;
    void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEYS.all });
    void queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEYS.all });
    void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEYS.all });
    void queryClient.invalidateQueries({ queryKey: HOME_QUERY_KEYS.all });
    await runTabFetch(true);
  }, [queryClient, runTabFetch]);

  // Navegación entre pestañas (usa memoria fresca para cambio en 0ms)
  useEffect(() => {
    void runTabFetch(false);
  }, [runTabFetch]);

  useEffect(() => { setSuccessMsg(null); setErrorMsg(null); }, [activeTab]);

  useEffect(() => {
    if (!clientModal.open) return;
    void loadClientMetaIfNeeded(false).catch((e) =>
      console.error('Error al cargar vendedores/rutas:', e),
    );
  }, [clientModal.open, loadClientMetaIfNeeded]);

  const handleViewClientProfile = async (client: any) => {
    setErrorMsg(null);
    try {
      const data = await api.getPersonaLedger(client.id);
      setClientProfileModal({ open: true, client: data.persona || client, ledger: data.ledger || [] });
    } catch (err: any) { setErrorMsg(err.message || 'Error al obtener extracto de cuenta corriente.'); }
  };

  const handleRefreshClientProfile = async (clientId: number) => {
    try {
      const data = await api.getPersonaLedger(clientId);
      setClientProfileModal({ open: true, client: data.persona, ledger: data.ledger });
    } catch (err) { console.error(err); }
  };

  const handleUploadImage = async (productId: number, file: File) => {
    try {
      await api.uploadProductImage(productId, file);
      await fetchData();
    } catch (error: any) { alert(error.message || 'Error al subir la imagen'); }
  };

  const handleUpdateProductInline = async (updatedProduct: any) => {
    try {
      await api.updateProduct(updatedProduct.id, {
        name: updatedProduct.name,
        description: updatedProduct.description,
        barcode: updatedProduct.barcode || null,
        costPrice: Number(updatedProduct.costPrice),
        listPrice: Number(updatedProduct.listPrice),
        listPriceB: Number(updatedProduct.listPriceB || 0),
        listPriceC: Number(updatedProduct.listPriceC || 0),
        profitMargin: updatedProduct.profitMargin !== undefined ? (updatedProduct.profitMargin ? Number(updatedProduct.profitMargin) : null) : undefined,
        rubroId: updatedProduct.rubroId !== undefined ? (updatedProduct.rubroId ? Number(updatedProduct.rubroId) : null) : undefined,
        providerId: updatedProduct.providerId !== undefined ? (updatedProduct.providerId ? Number(updatedProduct.providerId) : null) : undefined,
        minStock: Number(updatedProduct.minStock),
        isPesable: Boolean(updatedProduct.isPesable),
        isActive: updatedProduct.isActive,
        unitsPerBox: Number(updatedProduct.unitsPerBox || 1),
        approximateWeight: updatedProduct.approximateWeight ? Number(updatedProduct.approximateWeight) : 0,
      });
      setProducts((prev) => prev.map((item) => (item.id === updatedProduct.id ? { ...item, ...updatedProduct } : item)));
      await fetchData();
      setSuccessMsg('Producto actualizado correctamente.');
    } catch (err: any) { setErrorMsg(err.message || 'Error al actualizar producto.'); }
  };

  const handleOpenEditOrder = async (order: any) => {
    try {
      await Promise.all([loadProductsIfNeeded(false), loadClientsIfNeeded(false)]);
      const persona =
        resolveOrderPersona(order) ||
        clients.find((cl) => cl.id === (order.personaId || order.clientId)) ||
        null;
      const items = (order.items || [])
        .filter((i: any) => !isBonusOrderItem(i))
        .map((i: any) => ({
          id: i.id,
          productId: i.productId,
          name: i.product?.name || 'Artículo',
          sku: i.product?.sku || '',
          quantity: i.quantity,
          weight: i.weight,
          isPesable: i.product?.isPesable,
          approximateWeight: i.product?.approximateWeight,
          listPrice: Number(i.unitPrice ?? i.price ?? i.product?.listPrice ?? 0),
        }));
      setEditOrderModal({
        open: true,
        orderId: order.id,
        clientId: persona?.id || order.personaId || order.clientId || 0,
        clientName: persona?.name || 'Cliente',
        client: persona,
        items,
      });
    } catch {
      setErrorMsg('Error al cargar datos para edición.');
    }
  };

  return {
    products, users, clients, setClients, availableSellers, availableSaleRoutes, orders, ordersSummary, ordersVersion, financialReport, rubrosList, providersList,
    productModal, setProductModal, importZipModalOpen, setImportZipModalOpen, clientModal, setClientModal,
    clientsVersion, setClientsVersion, showResumenModal, setShowResumenModal, orderDetailsModal, setOrderDetailsModal,
    editOrderModal, setEditOrderModal, clientProfileModal, setClientProfileModal, sellerProfileModal, setSellerProfileModal,
    paymentModal, setPaymentModal, fastInvoiceOrder, setFastInvoiceOrder, isPriceListModalOpen, setIsPriceListModalOpen,
    isQuickSearchModalOpen, setIsQuickSearchModalOpen, isDirectInvoiceModalOpen, setIsDirectInvoiceModalOpen, clientSearchModal, setClientSearchModal, quickClientQuery, setQuickClientQuery,
    createOrderModal, setCreateOrderModal, summaryCardModal, setSummaryCardModal, orderStatusFilter, setOrderStatusFilter,
    cajasSubTab, setCajasSubTab, errorMsg, setErrorMsg, successMsg, setSuccessMsg,
    fetchData, handleViewClientProfile, handleRefreshClientProfile, handleUploadImage, handleUpdateProductInline, handleOpenEditOrder,
  };
}
