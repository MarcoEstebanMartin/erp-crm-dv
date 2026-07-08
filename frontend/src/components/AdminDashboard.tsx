import React, { useState, useEffect, lazy, Suspense } from 'react';
import { api } from '../utils/api';
import { OrderStatus } from '../utils/types';
import { getOrderStatusInfo } from '../utils/orderStatusHelper';
import PriceListModal from './PriceListModal';
import ProductsList from './ProductsList';
import RubrosList from './RubrosList';

// Carga diferida de sub-dashboards pesados
const UnifiedReportsDashboard = lazy(() => import('./UnifiedReportsDashboard'));
const RendicionesDashboard = lazy(() => import('./RendicionesDashboard'));
const RepartoDashboard = lazy(() => import('./RepartoDashboard'));
const ComprasDashboard = lazy(() => import('./ComprasDashboard'));
const CajasDashboard = lazy(() => import('./CajasDashboard'));
const FinanzasDashboard = lazy(() => import('./FinanzasDashboard'));
const BillingDashboard = lazy(() => import('./BillingDashboard'));

const LoadingDashboard = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', padding: '40px', backgroundColor: 'var(--background-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
    <div style={{
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      border: '2px solid rgba(227, 6, 19, 0.1)',
      borderTopColor: '#E30613',
      animation: 'spin 0.8s linear infinite'
    }} />
    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando sección...</span>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);
import ResumenCuentaModal from './modals/ResumenCuentaModal';
import QuickPriceSearchModal from './modals/QuickPriceSearchModal';
import { 
  UserPlus, 
  ToggleLeft, 
  ToggleRight, 
  RotateCcw, 
  Eye,
  EyeOff, 
  Trash2, 
  Printer, 
  RefreshCw, 
  Edit,
  ShoppingCart,
  BookOpen,
  Receipt,
  Search,
  DollarSign
} from 'lucide-react';

interface AdminDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function AdminDashboard({ activeTab, setActiveTab }: AdminDashboardProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [financialReport, setFinancialReport] = useState<any | null>(null);
  
  // Modales
  const [productModal, setProductModal] = useState({ open: false, mode: 'create', data: { id: 0, sku: '', name: '', description: '', barcode: '', costPrice: 0, listPrice: 0, listPriceB: 0, listPriceC: 0, minStock: 0, isPesable: false, approximateWeight: 0 } });
  const [userModal, setUserModal] = useState({ open: false, username: '', password: '', role: 'VENDEDOR' });
  const [showPassword, setShowPassword] = useState(false);
  const [clientModal, setClientModal] = useState({ open: false, mode: 'create', data: { id: 0, name: '', cuit: '', address: '', city: '', phone: '', email: '', creditLimit: 0, priceList: 'A', discount: 0, isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false } });
  const [showResumenModal, setShowResumenModal] = useState<any>(null);
  const [orderDetailsModal, setOrderDetailsModal] = useState<any | null>(null);
  const [editOrderModal, setEditOrderModal] = useState<{ open: boolean; orderId: number; clientId: number; clientName: string; items: { id: number; productId: number; name: string; sku: string; quantity: number; listPrice: number; weight?: number | null; isPesable?: boolean; approximateWeight?: number | null }[] } | null>(null);

  // Estados para cuenta corriente y cobros
  const [clientProfileModal, setClientProfileModal] = useState<{ open: boolean; client: any; ledger: any[] } | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; clientId: number; clientName: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', role: '' });
  const [showAddContact, setShowAddContact] = useState(false);

  // Estados para accesos directos y acciones rápidas
  const [isPriceListModalOpen, setIsPriceListModalOpen] = useState(false);
  const [isQuickSearchModalOpen, setIsQuickSearchModalOpen] = useState(false);
  const [catalogTab, setCatalogTab] = useState<'products'|'rubros'>('products');
  const [clientSearchModal, setClientSearchModal] = useState<{ open: boolean; action: 'ledger' | 'payment' | 'order' } | null>(null);
  const [quickClientQuery, setQuickClientQuery] = useState('');
  
  const [createOrderModal, setCreateOrderModal] = useState<{ open: boolean; client: any; cart: { product: any; quantity: number }[]; notes: string } | null>(null);
  const [quickProductQuery, setQuickProductQuery] = useState('');
  const [summaryCardModal, setSummaryCardModal] = useState<{ open: boolean; cardKey: string; cardLabel: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [prodSearchQuery, setProdSearchQuery] = useState('');

  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
    const [configTab, setConfigTab] = useState<string>('general');
  const [cajasSubTab, setCajasSubTab] = useState<'rendiciones' | 'diarias'>('rendiciones');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados de Configuración de la Empresa (Persistidos en localStorage)
  const [companyRazonSocial, setCompanyRazonSocial] = useState<string>(() => localStorage.getItem('company_razon_social') || 'Distribuidora de Bebidas SRL');
  const [companyNombreFantasia, setCompanyNombreFantasia] = useState<string>(() => localStorage.getItem('company_nombre_fantasia') || 'Bebidas del Sur');
  const [companyCuit, setCompanyCuit] = useState<string>(() => localStorage.getItem('company_cuit') || '30-71717171-9');
  const [companyDireccion, setCompanyDireccion] = useState<string>(() => localStorage.getItem('company_direccion') || 'Av. San Martín 1234, Ciudad Autónoma de Buenos Aires');
  const [companyTelefono, setCompanyTelefono] = useState<string>(() => localStorage.getItem('company_telefono') || '011-4567-8900');
  const [companyEmail, setCompanyEmail] = useState<string>(() => localStorage.getItem('company_email') || 'ventas@bebidasdelsur.com');
  const [companyPos, setCompanyPos] = useState<string>(() => localStorage.getItem('company_pos') || '1');
  const [companyDefaultIva, setCompanyDefaultIva] = useState<string>(() => localStorage.getItem('company_default_iva') || '21');

  const [ignoreStockCheck, setIgnoreStockCheck] = useState<boolean>(() => {
    return api.getServerConfig()?.ignoreStock || false;
  });

  const handleSaveCompanyConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('company_razon_social', companyRazonSocial);
    localStorage.setItem('company_nombre_fantasia', companyNombreFantasia);
    localStorage.setItem('company_cuit', companyCuit);
    localStorage.setItem('company_direccion', companyDireccion);
    localStorage.setItem('company_telefono', companyTelefono);
    localStorage.setItem('company_email', companyEmail);
    localStorage.setItem('company_pos', companyPos);
    localStorage.setItem('company_default_iva', companyDefaultIva);
    
    try {
      await api.updateServerConfig({ ignoreStockCheck });
      setSuccessMsg('Configuración de la empresa y servidor guardada exitosamente.');
    } catch {
      setErrorMsg('Error al guardar configuración del servidor.');
    }
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Estados de Personas (Clientes)
  // @ts-ignore
  const [personaRoleFilter, setPersonaRoleFilter] = useState<string>('client');

  // Estados de Finanzas (Cajas y Bancos)
            
  
                      
                      
  const handleViewClientProfile = async (client: any) => {
    setErrorMsg(null);
    try {
      const data = await api.getPersonaLedger(client.id);
      setClientProfileModal({
        open: true,
        client: data.persona || client,
        ledger: data.ledger || []
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener extracto de cuenta corriente.');
    }
  };

  const handleRefreshClientProfile = async (clientId: number) => {
    try {
      const data = await api.getPersonaLedger(clientId);
      setClientProfileModal({
        open: true,
        client: data.persona,
        ledger: data.ledger
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setErrorMsg('Monto inválido.');
      return;
    }

    try {
      await api.registerPayment(paymentModal!.clientId, {
        amount: Number(paymentAmount),
        paymentMethod,
        description: paymentDescription
      });
      setPaymentModal(null);
      setPaymentAmount('');
      setPaymentDescription('');
      setSuccessMsg('Cobro registrado exitosamente en cuenta corriente.');
      
      if (clientProfileModal && clientProfileModal.client.id === paymentModal!.clientId) {
        await handleRefreshClientProfile(paymentModal!.clientId);
      }
      
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar cobro.');
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name) return;

    try {
      const currentContacts = clientProfileModal!.client.contacts || [];
      const updatedContacts = [...currentContacts, newContact];

      const updatedClient = await api.updateClient(clientProfileModal!.client.id, {
        contacts: updatedContacts
      });

      setClientProfileModal({
        ...clientProfileModal!,
        client: updatedClient
      });

      setNewContact({ name: '', phone: '', email: '', role: '' });
      setShowAddContact(false);
      setSuccessMsg('Contacto agregado con éxito.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al agregar contacto.');
    }
  };

  const handleRemoveContact = async (index: number) => {
    try {
      const currentContacts = [...(clientProfileModal!.client.contacts || [])];
      currentContacts.splice(index, 1);

      const updatedClient = await api.updateClient(clientProfileModal!.client.id, {
        contacts: currentContacts
      });

      setClientProfileModal({
        ...clientProfileModal!,
        client: updatedClient
      });
      setSuccessMsg('Contacto eliminado.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar contacto.');
    }
  };

  // Carga de datos según pestaña activa
  useEffect(() => {
    fetchData();
  }, [activeTab, searchQuery, orderStatusFilter, auditPage, configTab, personaRoleFilter]);

  // Limpiar mensajes al cambiar de pestaña principal
  useEffect(() => {
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [activeTab]);

  


  const fetchData = async () => {
    setErrorMsg(null);
    try {
      if (activeTab === 'dashboard') {
        const stats = await api.getFinancialReports();
        setFinancialReport(stats);
        const latestLogs = await api.getAuditLogs(1, 5);
        setAuditLogs(latestLogs.logs);
        const allOrders = await api.getOrders();
        setOrders(allOrders);
        const allClients = await api.getPersonas('client');
        setClients(allClients);
        const allProducts = await api.getProducts('');
        setProducts(allProducts);
      } else if (activeTab === 'reportes') {
        const stats = await api.getFinancialReports();
        setFinancialReport(stats);
        const dataUsers = await api.getUsers();
        setUsers(dataUsers);
        const allOrders = await api.getOrders();
        setOrders(allOrders);
        const allProducts = await api.getProducts('');
        setProducts(allProducts);
        const allClients = await api.getPersonas('client');
        setClients(allClients);
      } else if (activeTab === 'products') {
        const data = await api.getProducts(searchQuery);
        setProducts(data);
      } else if (activeTab === 'users' || activeTab === 'personal') {
        const data = await api.getUsers();
        setUsers(data);
      } else if (activeTab === 'clients') {
        const roleParam = personaRoleFilter === 'debtors_by_city' ? 'client' : personaRoleFilter;
        const data = await api.getPersonas(roleParam, searchQuery);
        setClients(data);
      } else if (activeTab === 'orders') {
        const data = await api.getOrders();
        // Filtrar orders localmente según el estado lógico seleccionado
        if (orderStatusFilter !== 'ALL') {
          setOrders(data.filter((o: any) => {
            const statusInfo = getOrderStatusInfo(o);
            const logicalKey = statusInfo.label.toUpperCase().replace(' ', '_');
            if (orderStatusFilter === 'RECIBIDO') {
              return logicalKey === 'RECIBIDO' || logicalKey === 'EN_PICKING';
            }
            return logicalKey === orderStatusFilter;
          }));
        } else {
          setOrders(data);
        }
      } else if (activeTab === 'audit') {
        const data = await api.getAuditLogs(auditPage, 10);
        setAuditLogs(data.logs);
        setAuditTotalPages(data.pagination.totalPages);
      } else if (activeTab === 'config') {
        if (configTab === 'personal') {
          const data = await api.getUsers();
          setUsers(data);
        } else if (configTab === 'audit') {
          const data = await api.getAuditLogs(auditPage, 10);
          setAuditLogs(data.logs);
          setAuditTotalPages(data.pagination.totalPages);
        }
            }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener datos.');
    }
  };

  // --- CSV IMPORT / EXPORT DE PRECIOS ---
  // @ts-ignore
  const _handleExportCSV = () => {
    const headers = 'sku,name,costPrice,listPrice,listPriceB,listPriceC,barcode\n';
    const rows = products.map((p: any) => 
      `"${p.sku}","${p.name.replace(/"/g, '""')}",${p.costPrice},${p.listPrice},${p.listPriceB || 0},${p.listPriceC || 0},"${p.barcode || ''}"`
    ).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `planilla_precios_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // @ts-ignore
  const _handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        
        const productsData: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
          const fields = matches.map(f => f.trim().replace(/^["']|["']$/g, '').replace(/""/g, '"'));

          const rowData: any = {};
          headers.forEach((header, index) => {
            rowData[header] = fields[index];
          });

          if (rowData.sku) {
            productsData.push({
              sku: rowData.sku,
              name: rowData.name,
              costPrice: rowData.costPrice ? Number(rowData.costPrice) : undefined,
              listPrice: rowData.listPrice ? Number(rowData.listPrice) : undefined,
              listPriceB: rowData.listPriceB ? Number(rowData.listPriceB) : undefined,
              listPriceC: rowData.listPriceC ? Number(rowData.listPriceC) : undefined,
              barcode: rowData.barcode || null
            });
          }
        }

        if (productsData.length === 0) {
          throw new Error('No se encontraron filas válidas en el archivo CSV.');
        }

        const result = await api.importPrices(productsData);
        setSuccessMsg(`Planilla procesada con éxito: ${result.updatedCount} actualizados, ${result.createdCount} creados.`);
        if (result.failedItems && result.failedItems.length > 0) {
          setErrorMsg(`Errores en la carga: ${result.failedItems.map((f: any) => `${f.sku}: ${f.error}`).join(' | ')}`);
        }
        fetchData();
      } catch (err: any) {
        setErrorMsg(err.message || 'Error al parsear el archivo CSV. Asegurate de usar el formato correcto.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- OPERACIONES DE PRODUCTO ---
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { mode, data } = productModal;
    if (!data.sku || !data.name || !data.costPrice || !data.listPrice) {
      setErrorMsg('Completar SKU, Nombre, Costo y Lista.');
      return;
    }

    try {
      if (mode === 'create') {
        await api.createProduct(data);
      } else {
        await api.updateProduct(data.id, {
          name: data.name,
          description: data.description,
          barcode: data.barcode || null,
          costPrice: Number(data.costPrice),
          listPrice: Number(data.listPrice),
          listPriceB: Number(data.listPriceB || 0),
          listPriceC: Number(data.listPriceC || 0),
          minStock: Number(data.minStock),
          isPesable: Boolean(data.isPesable),
          approximateWeight: data.approximateWeight ? Number(data.approximateWeight) : 0
        });
      }
      setProductModal({ ...productModal, open: false });
      setSuccessMsg('Producto guardado correctamente.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar producto.');
    }
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
        minStock: Number(updatedProduct.minStock),
        isPesable: Boolean(updatedProduct.isPesable),
        approximateWeight: updatedProduct.approximateWeight ? Number(updatedProduct.approximateWeight) : 0
      });
      // Update local state directly to reflect changes immediately
      setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
      setSuccessMsg('Producto actualizado correctamente.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar producto.');
    }
  };

  // --- OPERACIONES DE USUARIO ---
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userModal.username || !userModal.password) {
      setErrorMsg('Usuario y contraseña son requeridos.');
      return;
    }

    try {
      await api.createUser({
        username: userModal.username,
        password: userModal.password,
        role: userModal.role
      });
      setUserModal({ open: false, username: '', password: '', role: 'VENDEDOR' });
      setSuccessMsg('Usuario creado con éxito.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear usuario.');
    }
  };

  const handleToggleUser = async (id: number) => {
    try {
      await api.toggleUserStatus(id);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cambiar estado del usuario.');
    }
  };

  // --- OPERACIONES DE PERSONAS ---
  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { mode, data } = clientModal;
    if (!data.name) {
      setErrorMsg('El nombre es obligatorio.');
      return;
    }

    try {
      if (mode === 'create') {
        await api.createPersona({
          name: data.name,
          cuit: data.cuit,
          address: data.address,
          city: data.city,
          phone: data.phone,
          email: data.email,
          creditLimit: Number(data.creditLimit || 0),
          priceList: data.priceList || 'A',
          discount: Number(data.discount || 0),
          isClient: !!data.isClient,
          isProvider: !!data.isProvider,
          isSeller: !!data.isSeller,
          isCommissionAgent: !!data.isCommissionAgent
        });
      } else {
        await api.updatePersona(data.id, {
          name: data.name,
          cuit: data.cuit,
          address: data.address,
          city: data.city,
          phone: data.phone,
          email: data.email,
          creditLimit: Number(data.creditLimit || 0),
          priceList: data.priceList || 'A',
          discount: Number(data.discount || 0),
          isClient: !!data.isClient,
          isProvider: !!data.isProvider,
          isSeller: !!data.isSeller,
          isCommissionAgent: !!data.isCommissionAgent
        });
      }
      setClientModal({ ...clientModal, open: false });
      setSuccessMsg('Persona guardada exitosamente.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar persona.');
    }
  };

  // --- OPERACIONES DE PEDIDOS (ADMIN) ---
  const handleCancelOrder = async (id: number) => {
    if (!window.confirm('¿Está seguro de que desea cancelar este pedido? Se restaurará el stock físico.')) return;
    try {
      await api.updateOrderStatus(id, OrderStatus.CANCELLED);
      setSuccessMsg(`Pedido #${id} cancelado correctamente.`);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cancelar pedido.');
    }
  };

  const handleOpenEditOrder = async (order: any) => {
    try {
      const prods = await api.getProducts();
      setProducts(prods);
      
      const items = order.items.map((i: any) => ({
        id: i.id,
        productId: i.productId,
        name: i.product?.name || 'Artículo',
        sku: i.product?.sku || '',
        quantity: i.quantity,
        weight: i.weight,
        isPesable: i.product?.isPesable,
        approximateWeight: i.product?.approximateWeight,
        listPrice: i.price || i.unitPrice || (i.product ? i.product.listPrice : 0)
      }));
      
      setEditOrderModal({
        open: true,
        orderId: order.id,
        clientId: order.clientId,
        clientName: order.client?.name || 'Cliente',
        items
      });
    } catch (err: any) {
      setErrorMsg('Error al cargar datos para edición.');
    }
  };

  const handleEditOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrderModal) return;
    
    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      const itemsPayload = editOrderModal.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        weight: item.weight || null
      }));
      
      await api.updateOrder(editOrderModal.orderId, { items: itemsPayload });
      setEditOrderModal(null);
      setSuccessMsg(`Pedido #${editOrderModal.orderId} actualizado con éxito.`);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar el pedido.');
    }
  };

  // Impresión nativa del comprobante
  const printTicket = (order: any) => {
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) return;

    const companyLogo = localStorage.getItem('company_nombre_fantasia') || 'DV DISTRIBUIDORA';
    const companySub = localStorage.getItem('company_razon_social') || 'Mayorista de Alimentos & Bebidas';
    const companyCuitVal = localStorage.getItem('company_cuit') || '30-71717171-9';

    printWindow.document.write(`
      <html>
        <head>
          <title>Comprobante Pedido #${order.id}</title>
          <style>
            body { font-family: monospace; padding: 20px; color: #000; font-size: 13px; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { font-size: 1.6rem; font-weight: bold; margin-bottom: 4px; }
            .divider { border-top: 1px dashed #000; margin: 12px 0; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 4px; }
            td { padding: 4px 0; }
            .text-right { text-align: right; }
            .footer { text-align: center; margin-top: 30px; font-size: 0.85rem; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">${companyLogo}</div>
            <div>${companySub}</div>
            <div>CUIT: ${companyCuitVal}</div>
            <div>Fecha: ${new Date(order.createdAt || Date.now()).toLocaleString('es-AR')}</div>
            <div><strong>PEDIDO NRO: ${order.id}</strong></div>
          </div>
          <div class="divider"></div>
          <div><strong>Cliente:</strong> ${order.client?.name}</div>
          <div><strong>CUIT:</strong> ${order.client?.cuit || 'Consumidor Final'}</div>
          <div><strong>Dirección:</strong> ${order.client?.address || 'Retira en local'}</div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th>Articulo</th>
                <th class="text-right">Cant</th>
                <th class="text-right">Unit</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item: any) => {
                const price = Number(item.unitPrice ?? item.price ?? 0);
                return `
                  <tr>
                    <td>${item.product?.name || 'Artículo'}</td>
                    <td class="text-right">${item.quantity}</td>
                    <td class="text-right">$${price.toLocaleString()}</td>
                    <td class="text-right">$${(item.quantity * price).toLocaleString()}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem;">
            <span>TOTAL A PAGAR:</span>
            <span>$${order.totalAmount.toLocaleString()}</span>
          </div>
          <div style="margin-top: 6px;"><strong>Canal Facturación:</strong> ${order.billingType === 'OFFICIAL' ? 'Sucursal A (Con CAE/AFIP)' : 'Sucursal X (Presupuesto Interno)'}</div>
          <div><strong>Nro Comprobante:</strong> ${order.invoiceNumber || 'No Facturado (Pendiente)'}</div>
          <div class="divider"></div>
          <div class="footer">
            <p>¡Muchas gracias por su compra!</p>
            <p>Para reclamos o logística conserve este ticket</p>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) return '';
    const formatted = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`;
    return `https://wa.me/${formatted}`;
  };

  const getQuickItemPrice = (product: any, client: any) => {
    if (!client) return Math.round(Number(product.listPrice));
    let price = Number(product.listPrice);
    let discount = Number(client.discount || 0);
    if (client.priceList === 'B') {
      price = Number(product.listPriceB) > 0 ? Number(product.listPriceB) : Number(product.listPrice);
      const isMelincue = product.description?.toUpperCase() === 'MELINCUE' || product.name?.toUpperCase().includes('MELINCUE');
      if (isMelincue) {
        discount = 3;
      } else {
        discount = 0;
      }
    } else if (client.priceList === 'C') {
      price = Number(product.listPriceC) > 0 ? Number(product.listPriceC) : Number(product.listPrice);
    }
    return Math.round(price * (1 - discount / 100));
  };

  const handleAddProductToQuickCart = (product: any) => {
    if (!createOrderModal) return;
    const existing = createOrderModal.cart.find(item => item.product.id === product.id);
    if (existing) {
      if (product.stock < existing.quantity + 1) {
        alert(`Stock insuficiente para "${product.name}".`);
        return;
      }
      setCreateOrderModal({
        ...createOrderModal,
        cart: createOrderModal.cart.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      });
    } else {
      if (product.stock < 1) {
        alert(`Stock insuficiente para "${product.name}".`);
        return;
      }
      setCreateOrderModal({
        ...createOrderModal,
        cart: [...createOrderModal.cart, { product, quantity: 1 }]
      });
    }
  };

  const handleUpdateQuickCartQty = (productId: number, qty: number) => {
    if (!createOrderModal) return;
    if (qty <= 0) {
      setCreateOrderModal({
        ...createOrderModal,
        cart: createOrderModal.cart.filter(item => item.product.id !== productId)
      });
      return;
    }
    const item = createOrderModal.cart.find(i => i.product.id === productId);
    if (item && item.product.stock < qty) {
      alert(`Stock insuficiente para "${item.product.name}" (Disponible: ${item.product.stock}).`);
      return;
    }
    setCreateOrderModal({
      ...createOrderModal,
      cart: createOrderModal.cart.map(i =>
        i.product.id === productId ? { ...i, quantity: qty } : i
      )
    });
  };

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createOrderModal || createOrderModal.cart.length === 0) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const payload = {
        clientId: createOrderModal.client.id,
        items: createOrderModal.cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity
        })),
        notes: createOrderModal.notes
      };
      await api.createOrder(payload);
      setSuccessMsg(`Pedido registrado exitosamente para ${createOrderModal.client.name}.`);
      setCreateOrderModal(null);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear el pedido.');
    }
  };

  // @ts-ignore
  const handlePrintDebtorsReport = () => {
    // Agrupar deudores por ciudad
    const debtors = clients.filter(c => Number(c.outstandingBalance || 0) > 0);
    const groups: { [key: string]: typeof clients } = {};
    debtors.forEach(c => {
      const city = c.city || 'Sin Localidad';
      if (!groups[city]) groups[city] = [];
      groups[city].push(c);
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalDeuda = debtors.reduce((acc, c) => acc + Number(c.outstandingBalance || 0), 0);

    let htmlContent = `
      <html>
        <head>
          <title>Reporte de Deudores por Localidad</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; color: #000; padding: 20px; font-size: 13px; }
            h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
            .date { text-align: center; margin-bottom: 20px; font-size: 11px; }
            .totals { border: 1px dashed #000; padding: 10px; margin-bottom: 20px; }
            .city-section { margin-bottom: 25px; }
            .city-title { font-weight: bold; font-size: 15px; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 10px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; }
            th { text-align: left; border-bottom: 1px dashed #000; padding: 5px 0; font-size: 12px; }
            td { padding: 6px 0; font-size: 12px; vertical-align: top; }
            .text-right { text-align: right; }
            .divider { border-top: 1px dashed #000; margin: 15px 0; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>DISTRIBUIDORA DV - REPORTE DE DEUDORES</h1>
          <div class="date">Generado el: ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR')}</div>
          
          <div class="totals">
            <strong>TOTAL DEUDORES:</strong> ${debtors.length}<br>
            <strong>TOTAL DEUDA ACUMULADA:</strong> $${totalDeuda.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
    `;

    Object.keys(groups).sort().forEach(city => {
      htmlContent += `
        <div class="city-section">
          <div class="city-title">📍 Localidad: ${city}</div>
          <table>
            <thead>
              <tr>
                <th style="width: 40%">Cliente</th>
                <th style="width: 35%">Dirección / Teléfono</th>
                <th style="width: 25%" class="text-right">Saldo Deudor</th>
              </tr>
            </thead>
            <tbody>
      `;

      groups[city].forEach(c => {
        htmlContent += `
          <tr>
            <td>
              <strong>${c.name}</strong><br>
              <span style="font-size: 10px; color: #555;">CUIT: ${c.cuit || 'S/D'}</span>
            </td>
            <td>
              ${c.address || 'Sin dirección'}<br>
              Tel: ${c.phone || 'S/D'}
            </td>
            <td class="text-right" style="font-weight: bold;">
              $${Number(c.outstandingBalance || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        `;
      });

      htmlContent += `
            </tbody>
          </table>
        </div>
      `;
    });

    htmlContent += `
          <div class="divider"></div>
          <div style="text-align: center; font-size: 10px; margin-top: 30px;">
            Fin del reporte - Distribuidora DV
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Pedidos por estado para el Panel Principal
  const totalOrders = orders.length;
  const recibidosOrdersCount = orders.filter(o => o.status === 'PENDING' || o.status === 'PREPARING').length;
  const armadosOrdersCount = orders.filter(o => o.status === 'PREPARED' && !o.invoiceNumber).length;
  const facturadosOrdersCount = orders.filter(o => o.invoiceNumber && (!o.deliveryRoute || o.deliveryRoute.status === 'PENDING')).length;
  const enViajeOrdersCount = orders.filter(o => o.deliveryRoute && o.deliveryRoute.status === 'IN_TRANSIT').length;
  const entregadosOrdersCount = orders.filter(o => (o.status === 'DELIVERED' && !o.deliveryRouteId) || (o.deliveryRoute && o.deliveryRoute.status === 'COMPLETED')).length;



  const filteredQuickClients = clients.filter(c => {
    if (!c.isClient) return false;
    const query = quickClientQuery.toLowerCase();
    return c.name.toLowerCase().includes(query) || (c.cuit && c.cuit.includes(query));
  });

  return (
    <div style={{ width: '100%' }}>
      {/* Alertas de error y éxito */}
      {errorMsg && (
        <div style={{
          backgroundColor: 'var(--accent-bg-light)',
          color: 'var(--accent-color)',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          marginBottom: '20px',
          border: '1px solid rgba(227, 6, 19, 0.15)'
        }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{
          backgroundColor: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          marginBottom: '20px',
          border: '1px solid rgba(52, 199, 89, 0.15)'
        }} onClick={() => setSuccessMsg(null)}>
          {successMsg}
        </div>
      )}

      {/* ====================================================================
          1. DASHBOARD GENERAL (PRINCIPAL)
          ==================================================================== */}
      {activeTab === 'dashboard' && (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              {(() => {
                const hour = new Date().getHours();
                const greeting = hour >= 6 && hour < 12 ? '¡Buen día' : hour >= 12 && hour < 20 ? '¡Buenas tardes' : '¡Buenas noches';
                const user = api.getCurrentUser();
                return `${greeting}, ${user ? user.username : 'Usuario'}!`;
              })()}
            </h1>
          </div>

          {/* Grilla de Métricas de Pedidos */}
          <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div className="card stat-card" style={{ borderLeft: '4px solid var(--accent-color)' }} onClick={() => setSummaryCardModal({ open: true, cardKey: 'RECIBIDO', cardLabel: 'Pedidos Recibidos' })}>
              <div className="stat-label">Pedidos Recibidos</div>
              <div className="stat-value" style={{ color: 'var(--accent-color)', fontSize: '1.8rem' }}>
                {recibidosOrdersCount}
              </div>
              <div className="stat-desc">Toma de pedidos (vendedores)</div>
            </div>

            <div className="card stat-card" style={{ borderLeft: '4px solid #F59E0B' }} onClick={() => setSummaryCardModal({ open: true, cardKey: 'ARMADO', cardLabel: 'Pedidos Armados' })}>
              <div className="stat-label">Pedidos Armados</div>
              <div className="stat-value" style={{ color: '#F59E0B', fontSize: '1.8rem' }}>
                {armadosOrdersCount}
              </div>
              <div className="stat-desc">Pendientes de facturación</div>
            </div>

            <div className="card stat-card" style={{ borderLeft: '4px solid #10B981' }} onClick={() => setSummaryCardModal({ open: true, cardKey: 'FACTURADO', cardLabel: 'Pedidos Facturados' })}>
              <div className="stat-label">Pedidos Facturados</div>
              <div className="stat-value" style={{ color: '#10B981', fontSize: '1.8rem' }}>
                {facturadosOrdersCount}
              </div>
              <div className="stat-desc">Listos para cargar al viaje</div>
            </div>

            <div className="card stat-card" style={{ borderLeft: '4px solid #8B5CF6' }} onClick={() => setSummaryCardModal({ open: true, cardKey: 'EN_VIAJE', cardLabel: 'Pedidos en Viaje' })}>
              <div className="stat-label">Pedidos en Viaje</div>
              <div className="stat-value" style={{ color: '#8B5CF6', fontSize: '1.8rem' }}>
                {enViajeOrdersCount}
              </div>
              <div className="stat-desc">Repartos activos en calle</div>
            </div>

            <div className="card stat-card" style={{ borderLeft: '4px solid var(--color-success)' }} onClick={() => setSummaryCardModal({ open: true, cardKey: 'ENTREGADO', cardLabel: 'Pedidos Entregados' })}>
              <div className="stat-label">Pedidos Entregados</div>
              <div className="stat-value" style={{ color: 'var(--color-success)', fontSize: '1.8rem' }}>
                {entregadosOrdersCount}
              </div>
              <div className="stat-desc">Operación completada con éxito</div>
            </div>
          </div>

          {/* Accesos Directos (Acciones Rápidas) */}
          <div style={{ marginTop: '24px' }}>
            <style>{`
              .stat-card {
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
              }
              .stat-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
              }
              .quick-action-card:hover {
                transform: translateY(-2px);
                border-color: #a1a1a6 !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
                background-color: var(--bg-hover, #fbfbfd) !important;
              }
              .quick-action-card:active {
                transform: translateY(0);
              }
            `}</style>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              Accesos Directos
            </h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
              gap: '16px' 
            }}>
              {[
                {
                  title: 'Facturar Directo',
                  desc: 'Emitir comprobante de venta',
                  icon: <Receipt size={20} style={{ color: 'var(--text-secondary)' }} />,
                  onClick: () => {
                    localStorage.setItem('preselected_billing_client', 'direct');
                    setActiveTab('billing');
                  }
                },
                {
                  title: 'Agregar Cliente',
                  desc: 'Registrar nueva persona',
                  icon: <UserPlus size={20} style={{ color: 'var(--text-secondary)' }} />,
                  onClick: () => {
                    setActiveTab('clients');
                    setClientModal({ 
                      open: true, 
                      mode: 'create', 
                      data: { 
                        id: 0, 
                        name: '', 
                        cuit: '', 
                        address: '', 
                        city: '', 
                        phone: '', 
                        email: '', 
                        creditLimit: 0, 
                        priceList: 'A', 
                        discount: 0, 
                        isClient: true, 
                        isProvider: false, 
                        isSeller: false, 
                        isCommissionAgent: false 
                      } 
                    });
                  }
                },
                {
                  title: 'Tomar Pedido',
                  desc: 'Registrar nuevo pedido',
                  icon: <ShoppingCart size={20} style={{ color: 'var(--text-secondary)' }} />,
                  onClick: () => {
                    setClientSearchModal({ open: true, action: 'order' });
                    setQuickClientQuery('');
                  }
                },
                {
                  title: 'Lista de Precios',
                  desc: 'Generar PDF general',
                  icon: <Printer size={20} style={{ color: 'var(--text-secondary)' }} />,
                  onClick: () => setIsPriceListModalOpen(true)
                },
                {
                  title: 'Buscar Precio',
                  desc: 'Consulta rápida (Lupa)',
                  icon: <Search size={20} style={{ color: 'var(--text-secondary)' }} />,
                  onClick: () => setIsQuickSearchModalOpen(true)
                },
                {
                  title: 'Cuenta Corriente',
                  desc: 'Estado y movimientos de CC',
                  icon: <BookOpen size={20} style={{ color: 'var(--text-secondary)' }} />,
                  onClick: () => {
                    setClientSearchModal({ open: true, action: 'ledger' });
                    setQuickClientQuery('');
                  }
                },
                {
                  title: 'Cargar Recibo',
                  desc: 'Registrar cobro de cliente',
                  icon: <DollarSign size={20} style={{ color: 'var(--text-secondary)' }} />,
                  onClick: () => {
                    setClientSearchModal({ open: true, action: 'payment' });
                    setQuickClientQuery('');
                  }
                }
              ].map((act) => (
                <button
                  key={act.title}
                  onClick={act.onClick}
                  className="quick-action-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '16px',
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--border-color, #e5e5e7)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    gap: '8px',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-light, #f5f5f7)',
                    border: '1px solid var(--border-color, #e5e5e7)'
                  }}>
                    {act.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{act.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{act.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>


        </div>
      )}

      {/* ====================================================================
          2. FICHERO DE PERSONAS
          ==================================================================== */}
      {(activeTab === 'clients') && (
        <div>
          {/* Filtros de roles */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {[
              { id: 'client', label: 'Clientes' },
              { id: 'provider', label: 'Proveedores' },
              { id: 'seller', label: 'Vendedores' },
              { id: 'commission_agent', label: 'Comisionistas' },
              { id: 'debtors_by_city', label: '📊 Deudores por Localidad' }
            ].map((tab) => (
              <button
                key={tab.id}
                className={`btn ${personaRoleFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.82rem', borderRadius: '20px' }}
                onClick={() => { setPersonaRoleFilter(tab.id); setClients([]); }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {personaRoleFilter === 'debtors_by_city' ? (
            <div>
              {/* Reporte de Deudores */}
              <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Resumen de Deudores por Localidad</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      Planilla de deudores agrupados para el recorrido de cobranzas.
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={handlePrintDebtorsReport}>
                    <Printer size={16} />
                    <span style={{ marginLeft: '6px' }}>Imprimir Planilla</span>
                  </button>
                </div>

                <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                  <div className="card stat-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
                    <div className="stat-label">Clientes en Mora</div>
                    <div className="stat-value" style={{ color: 'var(--color-danger)' }}>
                      {clients.filter(c => Number(c.outstandingBalance || 0) > 0).length}
                    </div>
                    <div className="stat-desc">Clientes con saldo deudor activo</div>
                  </div>
                  <div className="card stat-card" style={{ borderLeft: '4px solid #E30613' }}>
                    <div className="stat-label">Total Deuda Acumulada</div>
                    <div className="stat-value" style={{ color: '#E30613' }}>
                      ${clients.filter(c => Number(c.outstandingBalance || 0) > 0).reduce((acc, c) => acc + Number(c.outstandingBalance || 0), 0).toLocaleString()}
                    </div>
                    <div className="stat-desc">Saldo a cobrar en calle</div>
                  </div>
                </div>

                {(() => {
                  const debtors = clients.filter(c => Number(c.outstandingBalance || 0) > 0);
                  if (debtors.length === 0) {
                    return <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>No hay deudores registrados actualmente.</div>;
                  }

                  // Agrupar
                  const groups: { [key: string]: typeof clients } = {};
                  debtors.forEach(c => {
                    const city = c.city || 'Sin Localidad';
                    if (!groups[city]) groups[city] = [];
                    groups[city].push(c);
                  });

                  return Object.keys(groups).sort().map(city => (
                    <div key={city} style={{ marginBottom: '24px' }}>
                      <div style={{ 
                        fontSize: '1rem', 
                        fontWeight: 700, 
                        padding: '8px 12px', 
                        backgroundColor: 'var(--bg-light)', 
                        borderLeft: '4px solid var(--accent-color)',
                        borderRadius: '0 6px 6px 0',
                        marginBottom: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>📍 {city}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Total: ${groups[city].reduce((acc, c) => acc + Number(c.outstandingBalance || 0), 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="table-container" style={{ marginTop: '0', border: 'none' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Cliente</th>
                              <th>Dirección</th>
                              <th>Teléfono</th>
                              <th style={{ textAlign: 'right' }}>Saldo Deudor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groups[city].map(c => (
                              <tr key={c.id}>
                                <td style={{ fontWeight: 600 }}>{c.name}</td>
                                <td>{c.address || 'S/D'}</td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{c.phone || 'S/D'}</span>
                                    {c.phone && (
                                      <a href={getWhatsAppLink(c.phone)} target="_blank" rel="noopener noreferrer" title="Escribir por WhatsApp">
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366">
                                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                                        </svg>
                                      </a>
                                    )}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-danger)' }}>
                                  ${Number(c.outstandingBalance || 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          ) : (
            <>
              <div className="actions-bar">
            <div className="search-input-wrapper">
              <input
                type="text"
                className="input"
                placeholder="Buscar por nombre o CUIT..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={() => setClientModal({ 
              open: true, 
              mode: 'create', 
              data: { 
                id: 0, 
                name: '', 
                cuit: '', 
                address: '', 
                city: '',
                phone: '', 
                email: '', 
                creditLimit: 0, 
                priceList: 'A', 
                discount: 0,
                isClient: personaRoleFilter === 'client',
                isProvider: personaRoleFilter === 'provider',
                isSeller: personaRoleFilter === 'seller',
                isCommissionAgent: personaRoleFilter === 'commission_agent'
              } 
            })}>
              <UserPlus size={16} />
              <span>Registrar {personaRoleFilter === 'client' ? 'Cliente' : personaRoleFilter === 'provider' ? 'Proveedor' : personaRoleFilter === 'seller' ? 'Vendedor' : 'Comisionista'}</span>
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre Comercial / Razón Social</th>
                  <th>CUIT</th>
                  <th>Contacto</th>
                  <th>Saldo C/C</th>
                  <th>Vendedor</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0' }}>No se encontraron personas registradas.</td>
                  </tr>
                ) : (
                  clients.map((c) => {
                    const balance = Number(c.outstandingBalance || 0);
                    let balanceText = '';
                    let balanceColor = 'var(--text-secondary)';
                    
                    if (balance > 0) {
                      balanceText = `Saldo Deudor: $${balance.toLocaleString()}`;
                      balanceColor = 'var(--color-danger)';
                    } else if (balance < 0) {
                      balanceText = `A Pagar: $${Math.abs(balance).toLocaleString()}`;
                      balanceColor = '#E30613';
                    } else {
                      balanceText = '$0';
                    }

                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.address || 'Sin dirección'}</div>
                        </td>
                        <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{c.cuit || ''}</td>
                        <td>
                          {c.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{c.phone}</span>
                              <a 
                                href={getWhatsAppLink(c.phone)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                title="Enviar mensaje de WhatsApp"
                                style={{ display: 'inline-flex', alignItems: 'center' }}
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366">
                                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                                </svg>
                              </a>
                            </div>
                          )}
                          {c.email && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.email}</div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600, color: balanceColor }}>
                          {balanceText}
                        </td>
                        <td style={{ fontWeight: 500 }}>
                          {c.seller?.username || 'Sin vendedor'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => handleViewClientProfile(c)}>
                              Ver Ficha
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => setShowResumenModal(c)}>
                              Resumen de Cta
                            </button>
                            {c.isClient && (
                              <button 
                                className="btn btn-primary" 
                                style={{ padding: '6px 10px', fontSize: '0.8rem', backgroundColor: 'var(--text-primary)', color: '#fff', borderColor: 'var(--text-primary)' }} 
                                onClick={() => {
                                  localStorage.setItem('preselected_billing_client', String(c.id));
                                  setActiveTab('billing');
                                }}
                              >
                                Facturar
                              </button>
                            )}
                            <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => setClientModal({ 
                              open: true, 
                              mode: 'edit', 
                              data: { 
                                id: c.id, 
                                name: c.name, 
                                cuit: c.cuit || '', 
                                address: c.address || '', 
                                city: c.city || '',
                                phone: c.phone || '', 
                                email: c.email || '', 
                                creditLimit: c.creditLimit || 0, 
                                priceList: c.priceList || 'A', 
                                discount: c.discount || 0,
                                isClient: !!c.isClient,
                                isProvider: !!c.isProvider,
                                isSeller: !!c.isSeller,
                                isCommissionAgent: !!c.isCommissionAgent
                              } 
                            })}>
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
        </div>
      )}

      {/* ====================================================================
          3. VISOR COMPLETO DE PEDIDOS
          ==================================================================== */}
      {activeTab === 'orders' && (
        <div>
          <div className="actions-bar" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px' }}>
            <div className="search-input-wrapper">
              <input
                type="text"
                className="input"
                placeholder="Buscar pedidos por cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <select className="select" value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
              <option value="ALL">Todos los Estados</option>
              <option value="RECIBIDO">Pedidos Recibidos</option>
              <option value="ARMADO">Pedidos Armados (Pend. Facturación)</option>
              <option value="FACTURADO">Pedidos Facturados</option>
              <option value="EN_VIAJE">Pedidos en Viaje</option>
              <option value="ENTREGADO">Pedidos Entregados</option>
              <option value="CANCELADO">Cancelados</option>
            </select>

            <button className="btn btn-secondary" onClick={() => fetchData()}>
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nro Pedido</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Monto Total</th>
                  <th>Canal</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0' }}>No se encontraron pedidos.</td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 700 }}>#{o.id}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{o.client?.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Items: {o.items.length}</div>
                      </td>
                      <td>{new Date(o.createdAt).toLocaleDateString('es-AR')}</td>
                      <td style={{ fontWeight: 600 }}>${o.totalAmount.toLocaleString()}</td>
                      <td>
                        <span className={o.billingType === 'OFFICIAL' ? 'badge badge-official' : 'badge badge-internal'}>
                          {o.billingType === 'OFFICIAL' ? 'Sucursal A' : 'Sucursal X'}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const statusInfo = getOrderStatusInfo(o);
                          return (
                            <span 
                              className={`badge badge-${statusInfo.badgeClass}`}
                              style={{
                                backgroundColor: statusInfo.color + '15',
                                color: statusInfo.color,
                                border: `1px solid ${statusInfo.color}30`,
                                fontWeight: 600
                              }}
                            >
                              {statusInfo.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px' }} title="Ver Detalle" onClick={() => setOrderDetailsModal(o)}>
                          <Eye size={14} />
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px' }} title="Imprimir Ticket" onClick={() => printTicket(o)}>
                          <Printer size={14} />
                        </button>
                        {o.status === 'PENDING' && (
                          <button className="btn btn-secondary" style={{ padding: '6px 10px' }} title="Editar Pedido" onClick={() => handleOpenEditOrder(o)}>
                            <Edit size={14} />
                          </button>
                        )}
                        {o.status !== 'CANCELLED' && o.status !== 'DELIVERED' && (
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', color: 'var(--color-danger)' }} title="Cancelar" onClick={() => handleCancelOrder(o.id)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================================
          4. CATÁLOGO (PRODUCTOS Y RUBROS)
          ==================================================================== */}
      {activeTab === 'products' && (
        <div className="card">
          <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div 
              style={{ cursor: 'pointer', fontWeight: catalogTab === 'products' ? 600 : 400, color: catalogTab === 'products' ? 'var(--color-primary)' : 'var(--text-secondary)', position: 'relative' }}
              onClick={() => setCatalogTab('products')}
            >
              Lista de Productos
              {catalogTab === 'products' && <div style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-primary)' }} />}
            </div>
            <div 
              style={{ cursor: 'pointer', fontWeight: catalogTab === 'rubros' ? 600 : 400, color: catalogTab === 'rubros' ? 'var(--color-primary)' : 'var(--text-secondary)', position: 'relative' }}
              onClick={() => setCatalogTab('rubros')}
            >
              Gestión de Rubros
              {catalogTab === 'rubros' && <div style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-primary)' }} />}
            </div>
          </div>

          {catalogTab === 'products' && (
            <ProductsList 
              products={products} 
              searchQuery={searchQuery} 
              setSearchQuery={setSearchQuery} 
              setProductModal={setProductModal}
              onUpdateProduct={handleUpdateProductInline}
            />
          )}


          {catalogTab === 'rubros' && (
            <RubrosList 
              onRubroUpdated={fetchData} 
            />
          )}
        </div>
      )}

      {/* ====================================================================
          5. DEPOSITOS (PICKING & STOCK CONTROL)
          ==================================================================== */}
      {activeTab === 'deposito' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 className="card-title" style={{ margin: '0' }}>Armado y Picking de Pedidos</h3>
            <span className="badge badge-official">Depósito Central</span>
          </div>
          <p style={{ fontSize: '0.9rem', marginBottom: '24px' }}>
            Los pedidos cargados por vendedores se procesan aquí antes de facturarse.
          </p>

          <div className="table-container" style={{ border: '1px solid var(--border-color)' }}>
            <table>
              <thead>
                <tr>
                  <th>Nro Pedido</th>
                  <th>Cliente</th>
                  <th>Bultos estimados</th>
                  <th>Estado de Picking</th>
                </tr>
              </thead>
              <tbody>
                {orders.filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.PREPARING || o.status === OrderStatus.PREPARED).map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 700 }}>#{o.id}</td>
                    <td style={{ fontWeight: 500 }}>{o.client?.name}</td>
                    <td>{o.items.length} packs/bultos</td>
                    <td>
                      <span className={`badge badge-${o.status.toLowerCase()}`}>
                        {o.status === 'PENDING' ? 'Pendiente' : o.status === 'PREPARING' ? 'En picking' : 'Listo para facturar'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================================
          6. LOGÍSTICA & REPARTO (REPARTO DASHBOARD)
          ==================================================================== */}
      {activeTab === 'reparto' && (
        <Suspense fallback={<LoadingDashboard />}>
          <RepartoDashboard />
        </Suspense>
      )}

      {/* ====================================================================
          7. CAJAS Y TESORERÍA (FINANZAS)
          ==================================================================== */}
      {activeTab === 'finanzas' && (
        <Suspense fallback={<LoadingDashboard />}>
          <FinanzasDashboard />
        </Suspense>
      )}

      {/* ====================================================================
          FACTURACION & IMPUESTOS (BILLING)
          ==================================================================== */}
      {activeTab === 'billing' && (
        <Suspense fallback={<LoadingDashboard />}>
          <BillingDashboard activeTab={activeTab} setActiveTab={setActiveTab} />
        </Suspense>
      )}

      {/* ====================================================================
          8. COMPRAS (COMPRAS DASHBOARD)
          ==================================================================== */}
      {activeTab === 'compras' && (
        <Suspense fallback={<LoadingDashboard />}>
          <ComprasDashboard />
        </Suspense>
      )}

            {/* ====================================================================
          9. REPORTES Y MARGENES (UNIFIED REPORTS)
          ==================================================================== */}
      {activeTab === 'reportes' && (
        <Suspense fallback={<LoadingDashboard />}>
          <UnifiedReportsDashboard orders={orders} users={users} clients={clients} products={products} financialReport={financialReport} />
        </Suspense>
      )}

      {/* ====================================================================
          9b. CAJAS Y RENDICIONES (UNIFICADO)
          ==================================================================== */}
      {activeTab === 'rendiciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Sub-tab Navigation */}
          <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px', overflowX: 'auto' }}>
            <button 
              type="button"
              className="btn" 
              style={{ 
                backgroundColor: cajasSubTab === 'rendiciones' ? 'var(--color-primary)' : 'transparent',
                color: cajasSubTab === 'rendiciones' ? '#fff' : 'var(--text-primary)',
                border: cajasSubTab === 'rendiciones' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                fontWeight: 600,
                fontSize: '0.85rem',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setCajasSubTab('rendiciones')}
            >
              📊 Rendiciones y Arqueos
            </button>
            <button 
              type="button"
              className="btn" 
              style={{ 
                backgroundColor: cajasSubTab === 'diarias' ? 'var(--color-primary)' : 'transparent',
                color: cajasSubTab === 'diarias' ? '#fff' : 'var(--text-primary)',
                border: cajasSubTab === 'diarias' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                fontWeight: 600,
                fontSize: '0.85rem',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setCajasSubTab('diarias')}
            >
              📅 Cajas Diarias
            </button>
          </div>

          <Suspense fallback={<LoadingDashboard />}>
            {cajasSubTab === 'rendiciones' ? (
              <RendicionesDashboard />
            ) : (
              <CajasDashboard />
            )}
          </Suspense>
        </div>
      )}

      {/* ====================================================================
          10. CONFIGURACIÓN UNIFICADA (General, Empresa, Impresión, Empleados, CRM, Auditoría)
          ==================================================================== */}
      {activeTab === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Sub-tab Navigation */}
          <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px', overflowX: 'auto', paddingRight: '4px' }}>
            <button 
              type="button"
              className="btn" 
              style={{ 
                backgroundColor: configTab === 'general' ? 'var(--color-primary)' : 'transparent',
                color: configTab === 'general' ? '#fff' : 'var(--text-primary)',
                border: configTab === 'general' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                fontWeight: 600,
                fontSize: '0.85rem',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setConfigTab('general')}
            >
              🏢 General & Empresa
            </button>
            <button 
              type="button"
              className="btn" 
              style={{ 
                backgroundColor: configTab === 'impresion' ? 'var(--color-primary)' : 'transparent',
                color: configTab === 'impresion' ? '#fff' : 'var(--text-primary)',
                border: configTab === 'impresion' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                fontWeight: 600,
                fontSize: '0.85rem',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setConfigTab('impresion')}
            >
              🖨️ Impresión
            </button>
            <button 
              type="button"
              className="btn" 
              style={{ 
                backgroundColor: configTab === 'personal' ? 'var(--color-primary)' : 'transparent',
                color: configTab === 'personal' ? '#fff' : 'var(--text-primary)',
                border: configTab === 'personal' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                fontWeight: 600,
                fontSize: '0.85rem',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setConfigTab('personal')}
            >
              👥 Empleados
            </button>
            <button 
              type="button"
              className="btn" 
              style={{ 
                backgroundColor: configTab === 'audit' ? 'var(--color-primary)' : 'transparent',
                color: configTab === 'audit' ? '#fff' : 'var(--text-primary)',
                border: configTab === 'audit' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                fontWeight: 600,
                fontSize: '0.85rem',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setConfigTab('audit')}
            >
              📜 Auditoría (Logs)
            </button>
          </div>

          {/* Sub-tab 1: General & Empresa Unificado */}
          {configTab === 'general' && (
            <form onSubmit={handleSaveCompanyConfig} className="card" style={{ padding: '24px' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 4px 0' }}>
                🏢 Datos de la Empresa & Configuración
              </h3>
              <p style={{ fontSize: '0.85rem', marginBottom: '20px', color: 'var(--text-secondary)' }}>
                Configure la información comercial y los parámetros fiscales del emisor para la facturación.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label>Razón Social</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={companyRazonSocial} 
                    onChange={(e) => setCompanyRazonSocial(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Nombre de Fantasía (Logo)</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={companyNombreFantasia} 
                    onChange={(e) => setCompanyNombreFantasia(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>CUIT del Emisor</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={companyCuit} 
                    onChange={(e) => setCompanyCuit(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Dirección Comercial</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={companyDireccion} 
                    onChange={(e) => setCompanyDireccion(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Teléfono de Contacto</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={companyTelefono} 
                    onChange={(e) => setCompanyTelefono(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Email de Contacto</label>
                  <input 
                    type="email" 
                    className="input" 
                    value={companyEmail} 
                    onChange={(e) => setCompanyEmail(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Punto de Venta Oficial (Factura Electrónica)</label>
                  <input 
                    type="number" 
                    className="input" 
                    value={companyPos} 
                    onChange={(e) => setCompanyPos(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>IVA por defecto (%)</label>
                  <input 
                    type="number" 
                    className="input" 
                    value={companyDefaultIva} 
                    onChange={(e) => setCompanyDefaultIva(e.target.value)} 
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={ignoreStockCheck}
                      onChange={(e) => setIgnoreStockCheck(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Desactivar control de stock por lotes (Venta libre)</span>
                  </label>
                </div>
                
                <button type="submit" className="btn btn-primary" style={{ height: '40px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  💾 Guardar Configuración
                </button>
              </div>
            </form>
          )}

          {/* Sub-tab 3: Impresión */}
          {configTab === 'impresion' && (
            <div className="card">
              <h3 className="card-title">Preferencias de Impresión</h3>
              <p style={{ fontSize: '0.85rem', marginBottom: '20px', color: 'var(--text-secondary)' }}>Configuración de tickets y comprobantes impresos.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label>Formato por defecto</label>
                  <select className="select">
                    <option>Ticket 80mm</option>
                    <option>A4</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Mensaje al pie del ticket</label>
                  <input type="text" className="input" defaultValue="¡Gracias por su compra!" />
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 4: Empleados */}
          {configTab === 'personal' && (
            <div>
              <div className="actions-bar" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => setUserModal({ open: true, username: '', password: '', role: 'VENDEDOR' })}>
                  <UserPlus size={16} />
                  <span>Agregar Empleado</span>
                </button>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Rol / Permiso</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600 }}>{u.username}</td>
                        <td>
                          <span className={`badge ${u.role === 'ADMIN' ? 'badge-official' : 'badge-internal'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 500,
                            color: u.isActive ? 'var(--color-success)' : 'var(--color-danger)'
                          }}>
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: u.isActive ? 'var(--color-success)' : 'var(--color-danger)'
                            }} />
                            {u.isActive ? 'Activo' : 'Suspendido'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', gap: '4px', fontSize: '0.8rem' }}
                            onClick={() => handleToggleUser(u.id)}
                          >
                            {u.isActive ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                            <span>{u.isActive ? 'Desactivar' : 'Activar'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 6: Auditoría */}
          {configTab === 'audit' && (
            <div>
              <div className="actions-bar" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => { setAuditPage(1); fetchData(); }}>
                  <RotateCcw size={16} />
                  <span>Recargar Logs</span>
                </button>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha/Hora</th>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Acción</th>
                      <th>Entidad</th>
                      <th>Detalles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0' }}>No se registraron logs de auditoría aún.</td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {new Date(log.createdAt).toLocaleString('es-AR')}
                          </td>
                          <td style={{ fontWeight: 600 }}>{log.user?.username || 'Sistema'}</td>
                          <td>
                            <span className="badge badge-internal" style={{ fontSize: '0.7rem' }}>
                              {log.user?.role || 'SYSTEM'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{log.action}</td>
                          <td>
                            {log.entityType} (ID: {log.entityId})
                          </td>
                          <td style={{ fontSize: '0.75rem', fontFamily: 'monospace', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {log.oldValues && (
                              <div style={{ color: 'var(--text-secondary)' }}>
                                <strong>Antes:</strong> {JSON.stringify(log.oldValues)}
                              </div>
                            )}
                            {log.newValues && (
                              <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>
                                <strong>Ahora:</strong> {JSON.stringify(log.newValues)}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px', alignItems: 'center' }}>
                <button className="btn btn-secondary" disabled={auditPage === 1} onClick={() => setAuditPage(p => p - 1)}>Anterior</button>
                <span style={{ fontSize: '0.85rem' }}>Página {auditPage} de {auditTotalPages}</span>
                <button className="btn btn-secondary" disabled={auditPage === auditTotalPages} onClick={() => setAuditPage(p => p + 1)}>Siguiente</button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ====================================================================
          MODALES
          ==================================================================== */}
      {/* 0. Resumen de tarjeta del panel */}
      {summaryCardModal && summaryCardModal.open && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '90vw' }}>
            <div className="modal-header">
              <h3>{summaryCardModal.cardLabel}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setSummaryCardModal(null)}>✕</button>
            </div>
            
            <div style={{ padding: '16px 0' }}>
              {(() => {
                const cardOrders = orders.filter(o => {
                  const statusInfo = getOrderStatusInfo(o);
                  const logicalKey = statusInfo.label.toUpperCase().replace(' ', '_');
                  if (summaryCardModal.cardKey === 'RECIBIDO') {
                    return logicalKey === 'RECIBIDO' || logicalKey === 'EN_PICKING';
                  }
                  return logicalKey === summaryCardModal.cardKey;
                });

                if (cardOrders.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
                      No hay pedidos en esta categoría actualmente.
                    </div>
                  );
                }

                return (
                  <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th>Nro Pedido</th>
                          <th>Cliente</th>
                          <th>Fecha</th>
                          <th>Vendedor</th>
                          <th className="text-right">Monto</th>
                          <th>Estado Real</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cardOrders.map(o => (
                          <tr key={o.id}>
                            <td style={{ fontWeight: 700 }}>#{o.id}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{o.client?.name || o.persona?.name}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Items: {o.items?.length || 0}</div>
                            </td>
                            <td>{new Date(o.createdAt).toLocaleDateString('es-AR')} {new Date(o.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                            <td>{o.seller?.username || 'Sistema'}</td>
                            <td className="text-right" style={{ fontWeight: 600 }}>${o.totalAmount.toLocaleString()}</td>
                            <td>
                              {(() => {
                                const statusInfo = getOrderStatusInfo(o);
                                return (
                                  <span 
                                    className={`badge badge-${statusInfo.badgeClass}`}
                                    style={{
                                      backgroundColor: statusInfo.color + '15',
                                      color: statusInfo.color,
                                      border: `1px solid ${statusInfo.color}30`,
                                      fontSize: '0.7rem',
                                      padding: '2px 6px',
                                      fontWeight: 600
                                    }}
                                  >
                                    {statusInfo.label}
                                  </span>
                                );
                              })()}
                            </td>
                            <td>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => {
                                  setOrderDetailsModal(o);
                                  setSummaryCardModal(null);
                                }}
                              >
                                <Eye size={12} /> Ver Detalle
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
            
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  setOrderStatusFilter(summaryCardModal.cardKey);
                  setActiveTab('orders');
                  setSummaryCardModal(null);
                }}
              >
                Ver en Listado Completo
              </button>
              <button className="btn btn-secondary" onClick={() => setSummaryCardModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Detalles de pedido */}
      {orderDetailsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Pedido #{orderDetailsModal.id}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setOrderDetailsModal(null)}>✕</button>
            </div>
            
            {/* Barra de progreso de preparación de pedidos */}
            {orderDetailsModal.status !== 'CANCELLED' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                {[
                  { status: 'RECIBIDO', label: 'Recibido' },
                  { status: 'EN_PICKING', label: 'En Picking' },
                  { status: 'ARMADO', label: 'Armado' },
                  { status: 'FACTURADO', label: 'Facturado' },
                  { status: 'EN_VIAJE', label: 'En Viaje' },
                  { status: 'ENTREGADO', label: 'Entregado' }
                ].map((step, idx, arr) => {
                  const logicalStatus = getOrderStatusInfo(orderDetailsModal).label.toUpperCase().replace(' ', '_');
                  const statusOrder = ['RECIBIDO', 'EN_PICKING', 'ARMADO', 'FACTURADO', 'EN_VIAJE', 'ENTREGADO'];
                  const currentIdx = statusOrder.indexOf(logicalStatus);
                  const stepIdx = statusOrder.indexOf(step.status);
                  const isCompleted = stepIdx <= currentIdx;
                  const isActive = step.status === logicalStatus;
                  
                  return (
                    <React.Fragment key={step.status}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: isCompleted ? 'var(--color-success)' : 'var(--border-color)',
                          color: isCompleted ? '#fff' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          border: isActive ? '2px solid var(--text-primary)' : 'none',
                          transition: 'all 0.3s'
                        }}>
                          {isCompleted ? '✓' : idx + 1}
                        </div>
                        <span style={{ fontSize: '0.7rem', marginTop: '6px', fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {step.label}
                        </span>
                      </div>
                      {idx < arr.length - 1 && (
                        <div style={{
                          height: '2px',
                          flex: 1,
                          backgroundColor: stepIdx < currentIdx ? 'var(--color-success)' : 'var(--border-color)',
                          margin: '0 -10px',
                          transform: 'translateY(-10px)'
                        }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '8px 12px', backgroundColor: '#FFF2F2', color: 'var(--color-danger)', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 500, marginBottom: '16px', display: 'inline-block' }}>
                🚫 Este pedido ha sido CANCELADO.
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <p><strong>Cliente:</strong> {orderDetailsModal.client?.name}</p>
              <p><strong>CUIT:</strong> {orderDetailsModal.client?.cuit || 'S/D'}</p>
              <p><strong>Estado:</strong> {(() => {
                const statusInfo = getOrderStatusInfo(orderDetailsModal);
                return (
                  <span 
                    className={`badge badge-${statusInfo.badgeClass}`}
                    style={{
                      backgroundColor: statusInfo.color + '15',
                      color: statusInfo.color,
                      border: `1px solid ${statusInfo.color}30`,
                      fontWeight: 600
                    }}
                  >
                    {statusInfo.label}
                  </span>
                );
              })()}</p>
              <p><strong>Fecha de Carga:</strong> {new Date(orderDetailsModal.createdAt).toLocaleString('es-AR')}</p>
            </div>

            <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Artículo</th>
                    <th className="text-right">Cantidad</th>
                    <th className="text-right">Precio Unit.</th>
                  </tr>
                </thead>
                <tbody>
                  {orderDetailsModal.items.map((item: any, idx: number) => {
                    const price = Number(item.unitPrice ?? item.price ?? 0);
                    return (
                      <tr key={idx}>
                        <td>{item.product?.name}</td>
                        <td className="text-right">{item.quantity} u.</td>
                        <td className="text-right">${price.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: 'right', marginTop: '20px', fontWeight: 'bold', fontSize: '1.1rem' }}>
              Monto Total: ${orderDetailsModal.totalAmount.toLocaleString()}
            </div>
            
            <div className="modal-footer" style={{ marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => { printTicket(orderDetailsModal); setOrderDetailsModal(null); }}>
                <Printer size={16} />
                <span>Imprimir Ticket</span>
              </button>
              <button className="btn btn-primary" onClick={() => setOrderDetailsModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal Editar Pedido (Fase 2) */}
      {editOrderModal && editOrderModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div className="modal-header">
              <h3>Editar Pedido #{editOrderModal.orderId} - {editOrderModal.clientName}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setEditOrderModal(null)}>✕</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '20px', overflowY: 'auto', flex: 1, padding: '10px 0' }}>
              {/* Catálogo de Productos */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ marginBottom: '10px', fontSize: '0.9rem' }}>Añadir Artículos</h4>
                <div className="search-input-wrapper" style={{ marginBottom: '10px' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Buscar producto..."
                    value={prodSearchQuery}
                    onChange={(e) => setProdSearchQuery(e.target.value)}
                  />
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '300px', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '10px' }}>
                  {products
                    .filter(p => p.name.toLowerCase().includes(prodSearchQuery.toLowerCase()) || p.sku.toLowerCase().includes(prodSearchQuery.toLowerCase()))
                    .map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Stock: {p.stock} | ${p.listPrice}</div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => {
                            const existing = editOrderModal.items.find(item => item.productId === p.id);
                            if (existing) {
                              setEditOrderModal({
                                ...editOrderModal,
                                items: editOrderModal.items.map(item =>
                                  item.productId === p.id ? { ...item, quantity: item.quantity + 1 } : item
                                )
                              });
                            } else {
                              setEditOrderModal({
                                ...editOrderModal,
                                items: [...editOrderModal.items, {
                                  id: Date.now(),
                                  productId: p.id,
                                  name: p.name,
                                  sku: p.sku,
                                  quantity: 1,
                                  isPesable: p.isPesable,
                                  approximateWeight: p.approximateWeight,
                                  listPrice: p.listPrice
                                }]
                              });
                            }
                          }}
                        >
                          + Agregar
                        </button>
                      </div>
                    ))}
                </div>
              </div>
              
              {/* Artículos del pedido */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ marginBottom: '10px', fontSize: '0.9rem' }}>Detalle Actual del Pedido</h4>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '350px', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '10px' }}>
                  {editOrderModal.items.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No hay artículos en el pedido.</p>
                  ) : (
                    editOrderModal.items.map(item => (
                      <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ flex: 1, marginRight: '10px' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>${item.listPrice} c/u {item.isPesable && '(Por Kg)'}</div>
                          {item.isPesable && (
                            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Peso Exacto (Kg):</span>
                              <input 
                                type="number" 
                                step="0.01"
                                className="input" 
                                style={{ width: '80px', padding: '2px 6px', fontSize: '0.8rem' }}
                                value={item.weight || ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setEditOrderModal({
                                    ...editOrderModal,
                                    items: editOrderModal.items.map(i => 
                                      i.productId === item.productId ? { ...i, weight: isNaN(val) ? null : val } : i
                                    )
                                  });
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '2px 6px' }}
                            onClick={() => {
                              const newQty = item.quantity - 1;
                              if (newQty <= 0) {
                                setEditOrderModal({
                                  ...editOrderModal,
                                  items: editOrderModal.items.filter(i => i.productId !== item.productId)
                                });
                              } else {
                                setEditOrderModal({
                                  ...editOrderModal,
                                  items: editOrderModal.items.map(i =>
                                    i.productId === item.productId ? { ...i, quantity: newQty } : i
                                  )
                                });
                              }
                            }}
                          >
                            -
                          </button>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.quantity}</span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '2px 6px' }}
                            onClick={() => {
                              setEditOrderModal({
                                ...editOrderModal,
                                items: editOrderModal.items.map(i =>
                                  i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i
                                )
                              });
                            }}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost text-danger"
                            style={{ padding: '4px' }}
                            onClick={() => {
                              setEditOrderModal({
                                ...editOrderModal,
                                items: editOrderModal.items.filter(i => i.productId !== item.productId)
                              });
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.05rem', marginBottom: '12px' }}>
                    <span>Nuevo Total:</span>
                    <span>${editOrderModal.items.reduce((acc, i) => acc + (i.listPrice * (i.isPesable ? (i.weight || (i.quantity * (i.approximateWeight || 1))) : i.quantity)), 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditOrderModal(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={handleEditOrderSubmit}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Producto */}
      {productModal.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{productModal.mode === 'create' ? 'Cargar Nuevo Producto' : 'Editar Producto'}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setProductModal({ ...productModal, open: false })}>✕</button>
            </div>
            <form onSubmit={handleProductSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>SKU (Código interno)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ej: PROD-COCA-02"
                    value={productModal.data.sku}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, sku: e.target.value } })}
                    disabled={productModal.mode === 'edit'}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Código de Barras (EAN)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ej: 7799876543210"
                    value={productModal.data.barcode || ''}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, barcode: e.target.value } })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Nombre del Producto</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Gaseosa Coca Cola 1.5L"
                  value={productModal.data.name}
                  onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, name: e.target.value } })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Descripción corta</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Pack x6 botellas sabor original"
                  value={productModal.data.description}
                  onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, description: e.target.value } })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '14px', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={productModal.data.isPesable || false}
                      onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, isPesable: e.target.checked } })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    Es Producto Pesable
                  </label>
                </div>
                {productModal.data.isPesable && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Peso Aproximado de Horma (Kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      placeholder="ej: 4.5"
                      value={productModal.data.approximateWeight || ''}
                      onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, approximateWeight: Number(e.target.value) } })}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Precio Costo ($ ARS)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={productModal.data.costPrice || ''}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, costPrice: Number(e.target.value) } })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Precio Lista A ($ ARS)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={productModal.data.listPrice || ''}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, listPrice: Number(e.target.value) } })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Precio Lista B (Especial - Opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="Fallback a Lista A"
                    value={productModal.data.listPriceB || ''}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, listPriceB: Number(e.target.value) } })}
                  />
                </div>
                <div className="form-group">
                  <label>Precio Lista C (Distribuidor - Opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="Fallback a Lista A"
                    value={productModal.data.listPriceC || ''}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, listPriceC: Number(e.target.value) } })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Stock Mínimo (Alerta de reposición)</label>
                <input
                  type="number"
                  className="input"
                  value={productModal.data.minStock || ''}
                  onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, minStock: Number(e.target.value) } })}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setProductModal({ ...productModal, open: false })}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal Cliente */}
      {showResumenModal && (
        <ResumenCuentaModal client={showResumenModal} onClose={() => setShowResumenModal(null)} />
      )}
      {clientModal.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{clientModal.mode === 'create' ? 'Registrar Nuevo Cliente' : 'Editar Cliente'}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setClientModal({ ...clientModal, open: false })}>✕</button>
            </div>
            <form onSubmit={handleClientSubmit}>
              <div className="form-group">
                <label>Nombre Comercial / Razón Social</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Almacén San Roque"
                  value={clientModal.data.name}
                  onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, name: e.target.value } })}
                  required
                />
              </div>

              <div className="form-group">
                <label>CUIT (Sin guiones)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: 20222334449"
                  value={clientModal.data.cuit}
                  onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, cuit: e.target.value } })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Roles de la Persona</label>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!clientModal.data.isClient}
                      onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, isClient: e.target.checked } })}
                    />
                    <span>Cliente</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!clientModal.data.isProvider}
                      onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, isProvider: e.target.checked } })}
                    />
                    <span>Proveedor</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!clientModal.data.isSeller}
                      onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, isSeller: e.target.checked } })}
                    />
                    <span>Vendedor</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!clientModal.data.isCommissionAgent}
                      onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, isCommissionAgent: e.target.checked } })}
                    />
                    <span>Comisionista</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Dirección de Entrega</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Belgrano 1200, CABA"
                  value={clientModal.data.address}
                  onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, address: e.target.value } })}
                />
              </div>

              <div className="form-group">
                <label>Localidad</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: General Villegas"
                  value={clientModal.data.city || ''}
                  onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, city: e.target.value } })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ej: 11-4567-8901"
                    value={clientModal.data.phone}
                    onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, phone: e.target.value } })}
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="ej: contacto@cliente.com"
                    value={clientModal.data.email}
                    onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, email: e.target.value } })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Límite de Crédito CC ($)</label>
                  <input
                    type="number"
                    className="input"
                    value={clientModal.data.creditLimit}
                    onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, creditLimit: Number(e.target.value) } })}
                  />
                </div>
                <div className="form-group">
                  <label>Lista de Precios</label>
                  <select
                    className="select"
                    value={clientModal.data.priceList}
                    onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, priceList: e.target.value } })}
                  >
                    <option value="A">Lista Estándar A</option>
                    <option value="B">Lista Especial B</option>
                    <option value="C">Lista Distribuidor C</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Descuento Fijo (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="ej: 5"
                    value={clientModal.data.discount || 0}
                    onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, discount: Number(e.target.value) } })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setClientModal({ ...clientModal, open: false })}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal Empleado */}
      {userModal.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Registrar Empleado</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setUserModal({ ...userModal, open: false })}>✕</button>
            </div>
            <form onSubmit={handleUserSubmit}>
              <div className="form-group">
                <label>Nombre de usuario</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: juan.perez"
                  value={userModal.username}
                  onChange={(e) => setUserModal({ ...userModal, username: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Contraseña inicial</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input"
                    placeholder="••••••••"
                    value={userModal.password}
                    onChange={(e) => setUserModal({ ...userModal, password: e.target.value })}
                    required
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#6b7280'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Rol y Nivel de Acceso (RBAC)</label>
                <select
                  className="select"
                  value={userModal.role}
                  onChange={(e) => setUserModal({ ...userModal, role: e.target.value })}
                >
                  <option value="VENDEDOR">Vendedor (Toma pedidos calle, solo ve sus clientes)</option>
                  <option value="DEPOSITO">Operario de Depósito (Control físico de stock y armado de pedidos)</option>
                  <option value="FACTURACION">Auxiliar de Facturación (Factura pedidos y cobra caja)</option>
                  <option value="ADMIN">Administrador (Acceso financiero completo, auditoría y personal)</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setUserModal({ ...userModal, open: false })}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear Usuario</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Ficha de Cliente y Extracto de Cuenta Corriente */}
      {clientProfileModal && clientProfileModal.open && (
        <div className="modal-overlay" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="modal-content" style={{ maxWidth: '850px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                  👤 Ficha de {clientProfileModal.client.isProvider && !clientProfileModal.client.isClient ? 'Proveedor' : 'Cliente'}: {clientProfileModal.client.name}
                </h3>
              </div>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setClientProfileModal(null)}>✕</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '20px', padding: '16px', overflowY: 'auto', flex: 1 }}>
              {/* Columna Izquierda: Información Financiera y Contactos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderRight: '1px solid var(--border-color)', paddingRight: '20px' }}>
                <div style={{ backgroundColor: 'var(--bg-light)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Resumen de Cuenta</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem' }}>Saldo Actual:</span>
                      <span style={{
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: (clientProfileModal.client.outstandingBalance || 0) > 0 ? 'var(--color-danger)' : (clientProfileModal.client.outstandingBalance || 0) < 0 ? 'var(--color-success)' : 'var(--text-secondary)'
                      }}>
                        ${Number(clientProfileModal.client.outstandingBalance || 0).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem' }}>Límite de Crédito:</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        ${Number(clientProfileModal.client.creditLimit || 0).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem' }}>Crédito Disponible:</span>
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: (Number(clientProfileModal.client.creditLimit || 0) - Number(clientProfileModal.client.outstandingBalance || 0)) < 0 ? 'var(--color-danger)' : 'var(--text-primary)'
                      }}>
                        ${(Number(clientProfileModal.client.creditLimit || 0) - Number(clientProfileModal.client.outstandingBalance || 0)).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem' }}>Lista de Precios:</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {clientProfileModal.client.priceList === 'C' ? 'Lista Distribuidor C' : clientProfileModal.client.priceList === 'B' ? 'Lista Especial B' : 'Lista Estándar A'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem' }}>Descuento Fijo:</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-success)' }}>
                        {clientProfileModal.client.discount || 0}%
                      </span>
                    </div>
                  </div>
                  
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: '14px', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }} 
                    onClick={() => setPaymentModal({ open: true, clientId: clientProfileModal.client.id, clientName: clientProfileModal.client.name })}
                  >
                    💰 Registrar Cobro
                  </button>
                </div>
                
                {/* Contactos */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>👥 Contactos</h4>
                    <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => setShowAddContact(!showAddContact)}>
                      {showAddContact ? 'Cancelar' : '+ Agregar'}
                    </button>
                  </div>

                  {showAddContact && (
                    <form onSubmit={handleAddContact} style={{ padding: '10px', backgroundColor: 'var(--bg-light)', borderRadius: '6px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)' }}>
                      <input type="text" className="input" placeholder="Nombre" style={{ padding: '4px 8px', fontSize: '0.8rem' }} value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} required />
                      <input type="text" className="input" placeholder="Cargo/Rol" style={{ padding: '4px 8px', fontSize: '0.8rem' }} value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} />
                      <input type="text" className="input" placeholder="Teléfono" style={{ padding: '4px 8px', fontSize: '0.8rem' }} value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
                      <input type="email" className="input" placeholder="Email" style={{ padding: '4px 8px', fontSize: '0.8rem' }} value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
                      <button type="submit" className="btn btn-primary" style={{ padding: '4px', fontSize: '0.8rem' }}>Guardar Contacto</button>
                    </form>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {(!clientProfileModal.client.contacts || clientProfileModal.client.contacts.length === 0) ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No hay contactos asociados.</span>
                    ) : (
                      clientProfileModal.client.contacts.map((contact: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px', backgroundColor: 'var(--bg-light)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{contact.name} <small style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>({contact.role || 'Sin cargo'})</small></span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>📞 {contact.phone || 'S/D'}</span>
                              {contact.phone && (
                                <a href={getWhatsAppLink(contact.phone)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center' }}>
                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="#25D366">
                                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                                  </svg>
                                </a>
                              )}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>✉️ {contact.email || 'S/D'}</span>
                          </div>
                          <button type="button" className="btn btn-ghost text-danger" style={{ padding: '2px' }} onClick={() => handleRemoveContact(idx)}>
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              
              {/* Columna Derecha: Datos de la Cuenta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ backgroundColor: 'var(--bg-light)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', flex: 1 }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    Información General
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Razón Social / Nombre</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{clientProfileModal.client.name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CUIT / DNI</div>
                      <div style={{ fontSize: '0.95rem' }}>{clientProfileModal.client.cuit || 'S/D'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Localidad / Zona</div>
                      <div style={{ fontSize: '0.95rem' }}>{clientProfileModal.client.city || 'S/D'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Dirección</div>
                      <div style={{ fontSize: '0.95rem' }}>{clientProfileModal.client.address || 'S/D'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Teléfono Principal</div>
                        <div style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {clientProfileModal.client.phone || 'S/D'}
                          {clientProfileModal.client.phone && (
                            <a href={getWhatsAppLink(clientProfileModal.client.phone)} target="_blank" rel="noopener noreferrer">
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="#25D366">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Email Principal</div>
                        <div style={{ fontSize: '0.95rem' }}>{clientProfileModal.client.email || 'S/D'}</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Vendedor Asignado</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--color-primary)' }}>
                        {clientProfileModal.client.seller?.username || 'S/D'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)' }}>
              <button className="btn btn-secondary" onClick={() => setClientProfileModal(null)}>Cerrar Ficha</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Cobro */}
      {paymentModal && paymentModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Registrar Cobro CC</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setPaymentModal(null)}>✕</button>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div style={{ fontSize: '0.85rem', marginBottom: '14px', padding: '10px', backgroundColor: 'var(--bg-light)', borderRadius: '6px' }}>
                Registrando pago para: <strong>{paymentModal.clientName}</strong>
              </div>
              <div className="form-group">
                <label>Monto del Cobro ($)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="Monto"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Método de Pago</label>
                <select
                  className="select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="CASH">Efectivo</option>
                  <option value="BANK_TRANSFER">Transferencia Bancaria</option>
                  <option value="CHECK">Cheque</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Descripción / Observaciones</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Cobro factura de Quilmes"
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>Confirmar Cobro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renderizar PriceListModal */}
      <PriceListModal isOpen={isPriceListModalOpen} onClose={() => setIsPriceListModalOpen(false)} />
      <QuickPriceSearchModal isOpen={isQuickSearchModalOpen} onClose={() => setIsQuickSearchModalOpen(false)} />

      {/* Modal de búsqueda rápida de cliente */}
      {clientSearchModal && clientSearchModal.open && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h3>
                {clientSearchModal.action === 'ledger' && '📋 Consultar Cuenta Corriente'}
                {clientSearchModal.action === 'payment' && '💵 Cargar Recibo / Registrar Pago'}
                {clientSearchModal.action === 'order' && '🛒 Iniciar Nuevo Pedido'}
              </h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setClientSearchModal(null)}>✕</button>
            </div>
            <div className="form-group" style={{ marginTop: '10px' }}>
              <label>Buscar Cliente (por Nombre o CUIT)</label>
              <input
                type="text"
                className="input"
                autoFocus
                placeholder="Escriba para buscar..."
                value={quickClientQuery}
                onChange={(e) => setQuickClientQuery(e.target.value)}
              />
            </div>
            <div style={{ 
              maxHeight: '300px', 
              overflowY: 'auto', 
              border: '1px solid var(--border-color)', 
              borderRadius: '6px',
              marginTop: '12px',
              backgroundColor: '#ffffff'
            }}>
              {filteredQuickClients.length === 0 ? (
                <div style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem' }}>
                  No se encontraron clientes.
                </div>
              ) : (
                filteredQuickClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      const action = clientSearchModal.action;
                      setClientSearchModal(null);
                      if (action === 'ledger') {
                        handleViewClientProfile(c);
                      } else if (action === 'payment') {
                        setPaymentModal({ open: true, clientId: c.id, clientName: c.name });
                        setPaymentAmount('');
                      } else if (action === 'order') {
                        setCreateOrderModal({ open: true, client: c, cart: [], notes: '' });
                        setQuickProductQuery('');
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: 'none',
                      borderBottom: '1px solid #f0f0f2',
                      background: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-light, #f5f5f7)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{c.name}</div>
                      {c.cuit && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>CUIT: {c.cuit}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontSize: '0.85rem', 
                        fontWeight: 600,
                        color: (c.outstandingBalance || 0) > 0 ? 'var(--color-danger)' : 'var(--text-primary)'
                      }}>
                        ${Number(c.outstandingBalance || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Saldo CC</div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="modal-footer" style={{ marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setClientSearchModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de creación rápida de pedido */}
      {createOrderModal && createOrderModal.open && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '850px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3>🛒 Registrar Nuevo Pedido</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setCreateOrderModal(null)}>✕</button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1.2fr 1fr', 
                gap: '20px', 
                overflowY: 'auto', 
                flex: 1, 
                padding: '10px 0' 
              }}>
                {/* Panel de Artículos */}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div className="form-group" style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Añadir Artículos al Pedido</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Buscar producto por nombre o SKU..."
                      value={quickProductQuery}
                      onChange={(e) => setQuickProductQuery(e.target.value)}
                    />
                  </div>

                  <div style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '6px', 
                    padding: '10px',
                    backgroundColor: '#ffffff'
                  }}>
                    {products
                      .filter(p => p.name.toLowerCase().includes(quickProductQuery.toLowerCase()) || p.sku.toLowerCase().includes(quickProductQuery.toLowerCase()))
                      .slice(0, 15)
                      .map(p => {
                        const price = getQuickItemPrice(p, createOrderModal.client);
                        return (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f2' }}>
                            <div style={{ marginRight: '10px', flex: 1 }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                SKU: {p.sku} | Stock: <span style={{ fontWeight: 600, color: p.stock <= 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>{p.stock}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                ${price.toLocaleString()}
                              </span>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                disabled={p.stock <= 0}
                                onClick={() => handleAddProductToQuickCart(p)}
                              >
                                + Añadir
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Panel de Resumen del Pedido */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
                  {/* Resumen del Cliente */}
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-light)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Cliente Seleccionado</div>
                    <div><strong>Nombre:</strong> {createOrderModal.client.name}</div>
                    <div><strong>Lista:</strong> {createOrderModal.client.priceList === 'C' ? 'Distribuidor C' : createOrderModal.client.priceList === 'B' ? 'Especial B' : 'Estándar A'}</div>
                    {Number(createOrderModal.client.discount || 0) > 0 && <div style={{ color: 'var(--color-success)' }}><strong>Desc. Fijo:</strong> {createOrderModal.client.discount}%</div>}
                    <div>
                      <strong>Saldo CC:</strong> <span style={{ fontWeight: 600, color: (createOrderModal.client.outstandingBalance || 0) > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>${Number(createOrderModal.client.outstandingBalance || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Detalle del Carrito */}
                  <div style={{ flex: 1, minHeight: '180px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Artículos Cargados ({createOrderModal.cart.length})</div>
                    {createOrderModal.cart.length === 0 ? (
                      <div style={{ padding: '24px 0', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                        No hay artículos en el pedido.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                        {createOrderModal.cart.map(item => {
                          const price = getQuickItemPrice(item.product, createOrderModal.client);
                          return (
                            <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#ffffff' }}>
                              <div style={{ flex: 1, marginRight: '8px' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.product.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>${price.toLocaleString()} x {item.quantity} = ${(price * item.quantity).toLocaleString()}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '2px 6px', fontSize: '0.75rem', minWidth: '24px' }}
                                  onClick={() => handleUpdateQuickCartQty(item.product.id, item.quantity - 1)}
                                >
                                  -
                                </button>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '2px 6px', fontSize: '0.75rem', minWidth: '24px' }}
                                  onClick={() => handleUpdateQuickCartQty(item.product.id, item.quantity + 1)}
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '4px', marginLeft: '4px', color: 'var(--color-danger)' }}
                                  onClick={() => handleUpdateQuickCartQty(item.product.id, 0)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Notas y Total */}
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem' }}>Observaciones del Pedido (opcional)</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="ej: Entregar por la mañana..."
                      value={createOrderModal.notes}
                      onChange={(e) => setCreateOrderModal({ ...createOrderModal, notes: e.target.value })}
                    />
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '12px', 
                    backgroundColor: 'var(--bg-light)', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border-color)' 
                  }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Total del Pedido:</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      ${createOrderModal.cart.reduce((acc, curr) => acc + (getQuickItemPrice(curr.product, createOrderModal.client) * curr.quantity), 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCreateOrderModal(null)}>Cancelar</button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={createOrderModal.cart.length === 0}
                >
                  Confirmar y Guardar Pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
