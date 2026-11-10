import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';
import { getOrderStatusInfo } from '../../utils/orderStatusHelper';
import type { Product, User, Persona, Order, Rubro, SaleRoute } from '../../types';

export function useAdminController(activeTab: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Persona[]>([]);
  const [availableSellers, setAvailableSellers] = useState<User[]>([]);
  const [availableSaleRoutes, setAvailableSaleRoutes] = useState<SaleRoute[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [financialReport, setFinancialReport] = useState<any | null>(null);
  const [rubrosList, setRubrosList] = useState<Rubro[]>([]);
  const [providersList, setProvidersList] = useState<Persona[]>([]);

  const [productModal, setProductModal] = useState({
    open: false, mode: 'create',
    data: { id: 0, sku: '', name: '', description: '', barcode: '', costPrice: 0, listPrice: 0, listPriceB: 0, listPriceC: 0, profitMargin: 25 as string | number, minStock: 0, isPesable: false, approximateWeight: 0, unitsPerBox: 1, rubroId: '' as string | number, commercialCategory: '', providerId: '' as string | number, imageUrl: null as string | null },
  });
  const [importZipModalOpen, setImportZipModalOpen] = useState(false);
  const [userModal, setUserModal] = useState({ open: false, username: '', password: '', role: 'VENDEDOR' });
  const [clientModal, setClientModal] = useState({
    open: false, mode: 'create',
    data: { id: 0, name: '', cuit: '', address: '', city: '', phone: '', email: '', creditLimit: 0, maxUnpaidInvoices: 0, priceList: 'A', discount: 0, isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false, route: '', saleRouteId: null as number | null, sellerId: null as number | null, isActive: true },
  });
  const [clientsVersion, setClientsVersion] = useState(0);
  const [showResumenModal, setShowResumenModal] = useState<any>(null);
  const [orderDetailsModal, setOrderDetailsModal] = useState<any | null>(null);
  const [editOrderModal, setEditOrderModal] = useState<{ open: boolean; orderId: number; clientId: number; clientName: string; items: any[] } | null>(null);

  const [clientProfileModal, setClientProfileModal] = useState<{ open: boolean; client: any; ledger: any[] } | null>(null);
  const [sellerProfileModal, setSellerProfileModal] = useState<{ open: boolean; sellerId: number } | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; clientId: number; clientName: string } | null>(null);
  const [fastInvoiceOrder, setFastInvoiceOrder] = useState<any | null>(null);

  const [isPriceListModalOpen, setIsPriceListModalOpen] = useState(false);
  const [isQuickSearchModalOpen, setIsQuickSearchModalOpen] = useState(false);
  const [clientSearchModal, setClientSearchModal] = useState<{ open: boolean; action: 'ledger' | 'payment' | 'order' } | null>(null);
  const [quickClientQuery, setQuickClientQuery] = useState('');
  const [createOrderModal, setCreateOrderModal] = useState<{ open: boolean; client: any; cart: { product: any; quantity: number; isEmergencyOverride?: boolean }[]; salesChannel?: string; notes: string } | null>(null);
  const [summaryCardModal, setSummaryCardModal] = useState<{ open: boolean; cardKey: string; cardLabel: string } | null>(null);

  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [cajasSubTab, setCajasSubTab] = useState<'general' | 'rendiciones' | 'gastos' | 'reportes'>('general');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'reportes' || activeTab === 'reports') setCajasSubTab('reportes');
  }, [activeTab]);

  const fetchData = useCallback(async () => {
    setErrorMsg(null);
    try {
      if (activeTab === 'dashboard') {
        const [stats, allOrders, allClients, allProducts] = await Promise.all([
          api.getFinancialReports(),
          api.getOrders(),
          api.getPersonas('client'),
          api.getProducts('', true),
        ]);
        setFinancialReport(stats);
        setOrders(allOrders);
        setClients(allClients);
        setProducts(allProducts);
      } else if (activeTab === 'reportes' || activeTab === 'reports') {
        const [stats, dataUsers, allOrders, allProducts, allClients] = await Promise.all([
          api.getFinancialReports(),
          api.getUsers(),
          api.getOrders(),
          api.getProducts(''),
          api.getPersonas('client'),
        ]);
        setFinancialReport(stats);
        setUsers(dataUsers);
        setOrders(allOrders);
        setProducts(allProducts);
        setClients(allClients);
      } else if (activeTab === 'products' || activeTab === 'catalog' || activeTab === 'stock') {
        const data = await api.getProducts('', true);
        setProducts(data);
        try {
          const [rList, pList] = await Promise.all([api.getRubros(), api.getPersonas('provider')]);
          setRubrosList(rList || []);
          setProvidersList(pList || []);
        } catch (e) { console.error('Error al cargar rubros o proveedores:', e); }
      } else if (activeTab === 'users' || activeTab === 'personal') {
        setUsers(await api.getUsers());
      } else if (activeTab === 'clients') {
        try {
          const [sellers, routesRes, data] = await Promise.all([api.getSellersList(), api.getSaleRoutes(), api.getPersonas('client')]);
          setAvailableSellers(sellers || []);
          setAvailableSaleRoutes(routesRes.routes || []);
          setClients(data);
        } catch (e) { console.error('Error al cargar datos de preventa:', e); }
      } else if (activeTab === 'orders') {
        const data = await api.getOrders();
        if (orderStatusFilter !== 'ALL') {
          setOrders(data.filter((o: any) => {
            const logicalKey = getOrderStatusInfo(o).label.toUpperCase().replace(' ', '_');
            return orderStatusFilter === 'RECIBIDO' ? logicalKey === 'RECIBIDO' || logicalKey === 'EN_PICKING' : logicalKey === orderStatusFilter;
          }));
        } else setOrders(data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión');
    }
  }, [activeTab, orderStatusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setSuccessMsg(null); setErrorMsg(null); }, [activeTab]);

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
      fetchData();
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
      fetchData();
      setSuccessMsg('Producto actualizado correctamente.');
    } catch (err: any) { setErrorMsg(err.message || 'Error al actualizar producto.'); }
  };

  const handleOpenEditOrder = async (order: any) => {
    try {
      const prods = await api.getProducts();
      setProducts(prods);
      const items = order.items.map((i: any) => ({
        id: i.id, productId: i.productId, name: i.product?.name || 'Artículo', sku: i.product?.sku || '',
        quantity: i.quantity, weight: i.weight, isPesable: i.product?.isPesable, approximateWeight: i.product?.approximateWeight,
        listPrice: i.price || i.unitPrice || (i.product ? i.product.listPrice : 0),
      }));
      setEditOrderModal({ open: true, orderId: order.id, clientId: order.clientId, clientName: order.client?.name || 'Cliente', items });
    } catch { setErrorMsg('Error al cargar datos para edición.'); }
  };

  return {
    products, users, clients, availableSellers, availableSaleRoutes, orders, financialReport, rubrosList, providersList,
    productModal, setProductModal, importZipModalOpen, setImportZipModalOpen, userModal, setUserModal, clientModal, setClientModal,
    clientsVersion, setClientsVersion, showResumenModal, setShowResumenModal, orderDetailsModal, setOrderDetailsModal,
    editOrderModal, setEditOrderModal, clientProfileModal, setClientProfileModal, sellerProfileModal, setSellerProfileModal,
    paymentModal, setPaymentModal, fastInvoiceOrder, setFastInvoiceOrder, isPriceListModalOpen, setIsPriceListModalOpen,
    isQuickSearchModalOpen, setIsQuickSearchModalOpen, clientSearchModal, setClientSearchModal, quickClientQuery, setQuickClientQuery,
    createOrderModal, setCreateOrderModal, summaryCardModal, setSummaryCardModal, orderStatusFilter, setOrderStatusFilter,
    cajasSubTab, setCajasSubTab, errorMsg, setErrorMsg, successMsg, setSuccessMsg,
    fetchData, handleViewClientProfile, handleRefreshClientProfile, handleUploadImage, handleUpdateProductInline, handleOpenEditOrder,
  };
}
