import React, { useState, useEffect, lazy, Suspense } from 'react';
import { api } from '../utils/api';
import { OrderStatus } from '../utils/types';
import { getOrderStatusInfo } from '../utils/orderStatusHelper';
import PriceListModal from './PriceListModal';
import HomeTab from './admin/HomeTab';
import ClientsTab from './admin/ClientsTab';
import OrdersTab from './admin/OrdersTab';
import ProductsTab from './admin/ProductsTab';
import ConfigTab from './admin/ConfigTab';

const OFFICIAL_CITIES = [
  "GENERAL VILLEGAS",
  "EMILIO V. BUNGE",
  "BANDERALÓ",
  "BERNARDO LARROUDÉ",
  "PIEDRITAS",
  "CORONEL CHARLONE",
  "BUCHARDO",
  "TRES ALGARROBOS",
  "CARLOS TEJEDOR",
  "FLORENTINO AMEGHINO",
  "BLAQUIER",
  "RIVADAVIA",
  "FORTÍN OLAVARRÍA",
  "INTENDENTE ALVEAR",
  "RUFINO",
  "CEBALLOS",
  "REALICÓ",
  "VILLA SAUZE",
  "SANSINENA",
  "SANTA ELEODORA",
  "SANTA REGINA",
  "VILLA SABOYA",
  "CAÑADA SECA",
  "CABA"
];

const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
};


// Carga diferida de sub-dashboards pesados
const UnifiedReportsDashboard = lazy(() => import('./UnifiedReportsDashboard'));
const RendicionesDashboard = lazy(() => import('./RendicionesDashboard'));
const LogisticaDashboard = lazy(() => import('./LogisticaDashboard'));
const ComprasDashboard = lazy(() => import('./ComprasDashboard'));
const FinanzasDashboard = lazy(() => import('./FinanzasDashboard'));
const BillingDashboard = lazy(() => import('./BillingDashboard'));
const DepositoDashboard = lazy(() => import('./DepositoDashboard'));

const LoadingDashboard = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', padding: '40px', backgroundColor: 'var(--background-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
    <div style={{
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      border: '2px solid rgba(var(--color-corp-red-rgb), 0.1)',
      borderTopColor: 'var(--color-corp-red)',
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
  DollarSign,
  Truck
} from 'lucide-react';

interface AdminDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function AdminDashboard({ activeTab, setActiveTab }: AdminDashboardProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [debtorsReport, setDebtorsReport] = useState<any[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [availableSellers, setAvailableSellers] = useState<any[]>([]);
  const [availableSaleRoutes, setAvailableSaleRoutes] = useState<any[]>([]);
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('ALL');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('ALL');
  const [showCityDropdown, setShowCityDropdown] = useState<boolean>(false);
  const [citySearchQuery, setCitySearchQuery] = useState<string>('');
  const [orders, setOrders] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('ALL');
  const [financialReport, setFinancialReport] = useState<any | null>(null);
  
  // Listas de Rubros y Proveedores para el catálogo
  const [rubrosList, setRubrosList] = useState<any[]>([]);
  const [providersList, setProvidersList] = useState<any[]>([]);
  
  // Modales
  const [productModal, setProductModal] = useState({ open: false, mode: 'create', data: { id: 0, sku: '', name: '', description: '', barcode: '', costPrice: 0, listPrice: 0, listPriceB: 0, listPriceC: 0, profitMargin: 25 as string | number, minStock: 0, isPesable: false, approximateWeight: 0, unitsPerBox: 1, rubroId: '' as string | number, providerId: '' as string | number } });
  const [userModal, setUserModal] = useState({ open: false, username: '', password: '', role: 'VENDEDOR' });
  const [showPassword, setShowPassword] = useState(false);
  const [clientModal, setClientModal] = useState({ open: false, mode: 'create', data: { id: 0, name: '', cuit: '', address: '', city: '', phone: '', email: '', creditLimit: 0, priceList: 'A', discount: 0, isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false, route: '', saleRouteId: null as number | null, sellerId: null as number | null, isActive: true } });
  const [clientsVersion, setClientsVersion] = useState(0);
  const [showResumenModal, setShowResumenModal] = useState<any>(null);
  const [orderDetailsModal, setOrderDetailsModal] = useState<any | null>(null);
  const [editOrderModal, setEditOrderModal] = useState<{ open: boolean; orderId: number; clientId: number; clientName: string; items: { id: number; productId: number; name: string; sku: string; quantity: number; listPrice: number; weight?: number | null; isPesable?: boolean; approximateWeight?: number | null }[] } | null>(null);

  // Estados para cuenta corriente y cobros
  const [clientProfileModal, setClientProfileModal] = useState<{ open: boolean; client: any; ledger: any[] } | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; clientId: number; clientName: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentPendingInvoices, setPaymentPendingInvoices] = useState<any[]>([]);
  const [paymentSelectedInvoiceId, setPaymentSelectedInvoiceId] = useState<number | null>(null);

  // Retenciones sufridas/recibidas en el cobro
  const [paymentRetencionGananciasAmount, setPaymentRetencionGananciasAmount] = useState('');
  const [paymentRetencionGananciasNumber, setPaymentRetencionGananciasNumber] = useState('');
  const [paymentRetencionIibbAmount, setPaymentRetencionIibbAmount] = useState('');
  const [paymentRetencionIibbNumber, setPaymentRetencionIibbNumber] = useState('');

  useEffect(() => {
    if (paymentModal && paymentModal.open) {
      fetchPaymentPendingInvoices(paymentModal.clientId);
    } else {
      setPaymentPendingInvoices([]);
      setPaymentSelectedInvoiceId(null);
      setPaymentRetencionGananciasAmount('');
      setPaymentRetencionGananciasNumber('');
      setPaymentRetencionIibbAmount('');
      setPaymentRetencionIibbNumber('');
    }
  }, [paymentModal]);

  const fetchPaymentPendingInvoices = async (clientId: number) => {
    try {
      const res = await api.getPersonaPendingInvoices(clientId);
      if (res?.invoices && Array.isArray(res.invoices)) {
        setPaymentPendingInvoices(res.invoices);
      } else {
        setPaymentPendingInvoices([]);
      }
    } catch (err) {
      console.error('Error fetching pending invoices:', err);
    }
  };

  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', role: '' });
  const [showAddContact, setShowAddContact] = useState(false);

  // Estados para accesos directos y acciones rápidas
  const [isPriceListModalOpen, setIsPriceListModalOpen] = useState(false);
  const [isQuickSearchModalOpen, setIsQuickSearchModalOpen] = useState(false);
  const [catalogTab, setCatalogTab] = useState<'products'|'rubros'|'stock'>('products');
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
  const [cajasSubTab, setCajasSubTab] = useState<'general' | 'rendiciones'>('general');
  
  // Estados para Reglas de Precios y Descuentos
  const [pricingRules, setPricingRules] = useState<{ discountRules: any[]; splitConfigs: any[] }>({ discountRules: [], splitConfigs: [] });
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [discountRuleForm, setDiscountRuleForm] = useState({
    name: '',
    personaId: '' as any,
    priceList: '',
    rubroId: '' as any,
    productId: '' as any,
    billingType: '',
    discount: 0
  });
  const [splitConfigForm, setSplitConfigForm] = useState({
    personaId: '' as any,
    rubroId: '' as any,
    percentageOfficial: 50.00,
    percentageInternal: 50.00
  });

  // Estados para Percepciones e Impuestos
  const [perceptions, setPerceptions] = useState<any[]>([]);
  const [editingPerception, setEditingPerception] = useState<any | null>(null);
  const [showPerceptionModal, setShowPerceptionModal] = useState(false);
  const [perceptionForm, setPerceptionForm] = useState({ name: '', aliquot: 0, affectsIvaBook: false, jurisdiction: '' });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [reconcileMismatches, setReconcileMismatches] = useState<any[]>([]);
  const [loadingReconcile, setLoadingReconcile] = useState(false);

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

  const handleCreateDiscountRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.createDiscountRule({
        name: discountRuleForm.name || '',
        personaId: discountRuleForm.personaId ? Number(discountRuleForm.personaId) : null,
        priceList: discountRuleForm.priceList || null,
        rubroId: discountRuleForm.rubroId ? Number(discountRuleForm.rubroId) : null,
        productId: discountRuleForm.productId ? Number(discountRuleForm.productId) : null,
        billingType: discountRuleForm.billingType || null,
        discount: Number(discountRuleForm.discount)
      });
      setSuccessMsg('Regla de descuento creada con éxito.');
      setDiscountRuleForm({
        name: '',
        personaId: '' as any,
        priceList: '',
        rubroId: '' as any,
        productId: '' as any,
        billingType: '',
        discount: 0
      });
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear la regla de descuento.');
    }
  };

  const handleDeleteDiscountRule = async (id: number) => {
    if (!window.confirm('¿Estás seguro de eliminar esta regla de descuento?')) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.deleteDiscountRule(id);
      setSuccessMsg('Regla de descuento eliminada.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar la regla.');
    }
  };

  const handleCreateSplitConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.createSplitBillingConfig({
        personaId: Number(splitConfigForm.personaId),
        rubroId: Number(splitConfigForm.rubroId),
        percentageOfficial: Number(splitConfigForm.percentageOfficial),
        percentageInternal: Number(splitConfigForm.percentageInternal)
      });
      setSuccessMsg('Configuración de división de facturación creada.');
      setSplitConfigForm({
        personaId: '' as any,
        rubroId: '' as any,
        percentageOfficial: 50.00,
        percentageInternal: 50.00
      });
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear la configuración de división.');
    }
  };

  const handleDeleteSplitConfig = async (id: number) => {
    if (!window.confirm('¿Estás seguro de eliminar esta configuración de división?')) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.deleteSplitBillingConfig(id);
      setSuccessMsg('Configuración de división eliminada.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar la configuración.');
    }
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
    if (paymentLoading) return;

    // Advertencia de sobrepago si la ficha del cliente está abierta
    if (clientProfileModal && clientProfileModal.client.id === paymentModal!.clientId) {
      const balance = Number(clientProfileModal.client.outstandingBalance || 0);
      const parsedAmount = Number(paymentAmount);
      if (parsedAmount > balance) {
        const confirmOverpayment = window.confirm(
          `El monto a cobrar ($${parsedAmount.toLocaleString()}) supera el saldo pendiente del cliente ($${balance.toLocaleString()}). El cliente quedará con saldo a favor. ¿Deseas continuar?`
        );
        if (!confirmOverpayment) return;
      }
    }

    try {
      setPaymentLoading(true);
      setErrorMsg(null);

      const retencionesToSend = [];
      if (paymentRetencionGananciasAmount && Number(paymentRetencionGananciasAmount) > 0) {
        retencionesToSend.push({
          taxType: 'GANANCIAS' as const,
          number: paymentRetencionGananciasNumber || `RET-GAN-${Date.now()}`,
          amount: Number(paymentRetencionGananciasAmount)
        });
      }
      if (paymentRetencionIibbAmount && Number(paymentRetencionIibbAmount) > 0) {
        retencionesToSend.push({
          taxType: 'IIBB' as const,
          number: paymentRetencionIibbNumber || `RET-IIBB-${Date.now()}`,
          amount: Number(paymentRetencionIibbAmount)
        });
      }

      await api.registerPayment(paymentModal!.clientId, {
        amount: Number(paymentAmount),
        paymentMethod,
        description: paymentDescription,
        orderId: paymentSelectedInvoiceId || undefined,
        retenciones: retencionesToSend.length > 0 ? retencionesToSend : undefined
      });
      setPaymentModal(null);
      setPaymentAmount('');
      setPaymentDescription('');
      setPaymentRetencionGananciasAmount('');
      setPaymentRetencionGananciasNumber('');
      setPaymentRetencionIibbAmount('');
      setPaymentRetencionIibbNumber('');
      setSuccessMsg('Cobro registrado exitosamente en cuenta corriente.');
      
      if (clientProfileModal && clientProfileModal.client.id === paymentModal!.clientId) {
        await handleRefreshClientProfile(paymentModal!.clientId);
      }
      
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar cobro.');
    } finally {
      setPaymentLoading(false);
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
        try {
          const rList = await api.getRubros();
          setRubrosList(rList || []);
          const pList = await api.getPersonas('provider');
          setProvidersList(pList || []);
        } catch (e) {
          console.error("Error al cargar rubros o proveedores:", e);
        }
      } else if (activeTab === 'users' || activeTab === 'personal') {
        const data = await api.getUsers();
        setUsers(data);
      } else if (activeTab === 'clients') {
        try {
          const sellers = await api.getSellersList();
          setAvailableSellers(sellers || []);
          const routesRes = await api.getSaleRoutes();
          setAvailableSaleRoutes(routesRes.routes || []);
        } catch (e) {
          console.error("Error al cargar datos de preventa:", e);
        }

        if (personaRoleFilter === 'debtors_by_city') {
          const report = await api.getDebtorsReport();
          setDebtorsReport(report.debtors);
          const cities = [...(report.availableCities || [])] as string[];
          const sortedCities = cities.sort();
          setAvailableCities(sortedCities);
          setSelectedCities(sortedCities);
        } else {
          const data = await api.getPersonas(personaRoleFilter, searchQuery);
          setClients(data);
        }
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
        } else if (configTab === 'percepciones') {
          const response = await api.getPerceptions();
          setPerceptions(response.perceptions || []);
        } else if (configTab === 'reconcile') {
          setLoadingReconcile(true);
          try {
            const res = await api.checkBalances();
            setReconcileMismatches(res.mismatches || []);
          } catch (err: any) {
            setErrorMsg(err.message || 'Error al obtener la auditoría de saldos.');
          } finally {
            setLoadingReconcile(false);
          }
        } else if (configTab === 'prices') {
          setLoadingPricing(true);
          try {
            const res = await api.getPricingRules();
            setPricingRules(res || { discountRules: [], splitConfigs: [] });
            
            const allClients = await api.getPersonas('client');
            setClients(allClients.filter((c: any) => c.isActive !== false));
            const allProducts = await api.getProducts('');
            setProducts(allProducts);
            const allRubros = await api.getRubros();
            setRubrosList(allRubros);
          } catch (err: any) {
            setErrorMsg(err.message || 'Error al obtener reglas de precios.');
          } finally {
            setLoadingPricing(false);
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener datos.');
    }
  };

  const handleSyncBalance = async (personaId?: number) => {
    if (!window.confirm(personaId ? '¿Deseas conciliar el saldo de esta cuenta?' : '¿Deseas conciliar TODOS los saldos inconsistentes del sistema?')) {
      return;
    }
    setLoadingReconcile(true);
    try {
      const res = await api.syncBalances(personaId);
      alert(personaId ? 'Saldo conciliado exitosamente.' : `Conciliación completada. Se corrigieron ${res.count || 0} cuentas.`);
      const checkRes = await api.checkBalances();
      setReconcileMismatches(checkRes.mismatches || []);
    } catch (err: any) {
      alert(err.message || 'Error al conciliar saldos.');
    } finally {
      setLoadingReconcile(false);
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

  const handleModalPriceChange = (field: string, valueStr: string) => {
    const value = valueStr === '' ? '' : Number(valueStr);
    const updatedData = { ...productModal.data, [field]: value };

    const cost = Number(updatedData.costPrice) || 0;
    const rentPercentage = updatedData.profitMargin !== '' && updatedData.profitMargin !== undefined ? Number(updatedData.profitMargin) : 25;
    const margin = 1 + (rentPercentage / 100);

    if (field === 'costPrice') {
      // Cost changed -> update selling prices
      const listPrice = cost * margin;
      updatedData.listPrice = Math.max(0, Math.round(listPrice * 100) / 100);
      
      const ratioB = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceB) > 0
        ? Number(productModal.data.listPriceB) / Number(productModal.data.listPrice) : 0.95;
      const ratioC = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceC) > 0
        ? Number(productModal.data.listPriceC) / Number(productModal.data.listPrice) : 0.90;
      updatedData.listPriceB = Math.max(0, Math.round(updatedData.listPrice * ratioB * 100) / 100);
      updatedData.listPriceC = Math.max(0, Math.round(updatedData.listPrice * ratioC * 100) / 100);

    } else if (field === 'profitMargin') {
      // Rentabilidad changed -> update selling prices based on cost
      const newMargin = valueStr === '' ? 1 : 1 + (Number(valueStr) / 100);
      const listPrice = cost * newMargin;
      updatedData.listPrice = Math.max(0, Math.round(listPrice * 100) / 100);

      const ratioB = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceB) > 0
        ? Number(productModal.data.listPriceB) / Number(productModal.data.listPrice) : 0.95;
      const ratioC = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceC) > 0
        ? Number(productModal.data.listPriceC) / Number(productModal.data.listPrice) : 0.90;
      updatedData.listPriceB = Math.max(0, Math.round(updatedData.listPrice * ratioB * 100) / 100);
      updatedData.listPriceC = Math.max(0, Math.round(updatedData.listPrice * ratioC * 100) / 100);

    } else if (field === 'priceSinIva') {
      // Price without VAT changed -> update listPrice and cost
      const finalPrice = (Number(value) || 0) * 1.21;
      updatedData.listPrice = Math.max(0, Math.round(finalPrice * 100) / 100);
      updatedData.costPrice = Math.max(0, Math.round((updatedData.listPrice / margin) * 100) / 100);

      const ratioB = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceB) > 0
        ? Number(productModal.data.listPriceB) / Number(productModal.data.listPrice) : 0.95;
      const ratioC = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceC) > 0
        ? Number(productModal.data.listPriceC) / Number(productModal.data.listPrice) : 0.90;
      updatedData.listPriceB = Math.max(0, Math.round(updatedData.listPrice * ratioB * 100) / 100);
      updatedData.listPriceC = Math.max(0, Math.round(updatedData.listPrice * ratioC * 100) / 100);

    } else if (field === 'listPrice') {
      // Final listPrice changed -> update cost
      const listPriceVal = Number(value) || 0;
      updatedData.costPrice = Math.max(0, Math.round((listPriceVal / margin) * 100) / 100);

      const ratioB = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceB) > 0
        ? Number(productModal.data.listPriceB) / Number(productModal.data.listPrice) : 0.95;
      const ratioC = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceC) > 0
        ? Number(productModal.data.listPriceC) / Number(productModal.data.listPrice) : 0.90;
      updatedData.listPriceB = Math.max(0, Math.round(listPriceVal * ratioB * 100) / 100);
      updatedData.listPriceC = Math.max(0, Math.round(listPriceVal * ratioC * 100) / 100);
    }

    setProductModal({
      ...productModal,
      data: updatedData
    });
  };

  const handleModalRubroChange = (rubroIdVal: string) => {
    const rubroId = rubroIdVal === '' ? '' : Number(rubroIdVal);
    const updatedData = { ...productModal.data, rubroId };

    if (rubroId) {
      const selectedRubro = rubrosList.find(r => Number(r.id) === rubroId);
      if (selectedRubro) {
        const marginFactor = Number(selectedRubro.profitMargin) || 1.25;
        const rentPercent = Math.round((marginFactor - 1) * 100);
        updatedData.profitMargin = rentPercent;

        const cost = Number(updatedData.costPrice) || 0;
        const listPrice = cost * marginFactor;
        updatedData.listPrice = Math.max(0, Math.round(listPrice * 100) / 100);

        const ratioB = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceB) > 0
          ? Number(productModal.data.listPriceB) / Number(productModal.data.listPrice) : 0.95;
        const ratioC = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceC) > 0
          ? Number(productModal.data.listPriceC) / Number(productModal.data.listPrice) : 0.90;
        updatedData.listPriceB = Math.max(0, Math.round(updatedData.listPrice * ratioB * 100) / 100);
        updatedData.listPriceC = Math.max(0, Math.round(updatedData.listPrice * ratioC * 100) / 100);
      }
    }

    setProductModal({
      ...productModal,
      data: updatedData
    });
  };

  // --- OPERACIONES DE PRODUCTO ---
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { mode, data } = productModal;
    if (!data.sku || !data.name || data.costPrice === undefined || data.listPrice === undefined) {
      setErrorMsg('Completar SKU, Nombre, Costo y Lista.');
      return;
    }

    const payload = {
      sku: data.sku,
      name: data.name,
      description: data.description,
      barcode: data.barcode || null,
      costPrice: Number(data.costPrice),
      listPrice: Number(data.listPrice),
      listPriceB: Number(data.listPriceB || 0),
      listPriceC: Number(data.listPriceC || 0),
      profitMargin: data.profitMargin !== undefined && data.profitMargin !== '' ? (1 + Number(data.profitMargin) / 100) : null,
      rubroId: data.rubroId ? Number(data.rubroId) : null,
      providerId: data.providerId ? Number(data.providerId) : null,
      minStock: Number(data.minStock || 0),
      isPesable: Boolean(data.isPesable),
      unitsPerBox: Number(data.unitsPerBox || 1),
      approximateWeight: data.approximateWeight ? Number(data.approximateWeight) : 0
    };

    try {
      if (mode === 'create') {
        await api.createProduct(payload);
      } else {
        await api.updateProduct(data.id, payload);
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
        profitMargin: updatedProduct.profitMargin !== undefined ? (updatedProduct.profitMargin ? Number(updatedProduct.profitMargin) : null) : undefined,
        rubroId: updatedProduct.rubroId !== undefined ? (updatedProduct.rubroId ? Number(updatedProduct.rubroId) : null) : undefined,
        providerId: updatedProduct.providerId !== undefined ? (updatedProduct.providerId ? Number(updatedProduct.providerId) : null) : undefined,
        minStock: Number(updatedProduct.minStock),
        isPesable: Boolean(updatedProduct.isPesable),
        unitsPerBox: Number(updatedProduct.unitsPerBox || 1),
        approximateWeight: updatedProduct.approximateWeight ? Number(updatedProduct.approximateWeight) : 0
      });
      fetchData();
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
          route: data.route,
          saleRouteId: data.saleRouteId ? Number(data.saleRouteId) : null,
          creditLimit: Number(data.creditLimit || 0),
          priceList: data.priceList || 'A',
          discount: Number(data.discount || 0),
          isClient: !!data.isClient,
          isProvider: !!data.isProvider,
          isSeller: !!data.isSeller,
          isCommissionAgent: !!data.isCommissionAgent,
          sellerId: data.sellerId ? Number(data.sellerId) : null,
          isActive: data.isActive !== false
        });
      } else {
        await api.updatePersona(data.id, {
          name: data.name,
          cuit: data.cuit,
          address: data.address,
          city: data.city,
          phone: data.phone,
          email: data.email,
          route: data.route,
          saleRouteId: data.saleRouteId ? Number(data.saleRouteId) : null,
          creditLimit: Number(data.creditLimit || 0),
          priceList: data.priceList || 'A',
          discount: Number(data.discount || 0),
          isClient: !!data.isClient,
          isProvider: !!data.isProvider,
          isSeller: !!data.isSeller,
          isCommissionAgent: !!data.isCommissionAgent,
          sellerId: data.sellerId ? Number(data.sellerId) : null,
          isActive: data.isActive !== false
        });
      }
      setClientModal({ ...clientModal, open: false });
      setSuccessMsg('Persona guardada exitosamente.');
      fetchData();
      setClientsVersion(prev => prev + 1);
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
                const isPesable = item.product?.isPesable || (item.weight && Number(item.weight) > 0);
                const subtotal = item.subtotal ? Number(item.subtotal) : (isPesable ? item.quantity * (item.product?.approximateWeight || 1) * price : item.quantity * price);
                const cantDisplay = isPesable && item.weight ? `${item.quantity} u (${Number(item.weight).toFixed(2)} kg)` : (isPesable ? `${item.quantity} u (${(item.quantity * (item.product?.approximateWeight || 1)).toLocaleString()} kg aprox)` : `${item.quantity} u`);
                return `
                  <tr>
                    <td>${item.product?.name || 'Artículo'}</td>
                    <td class="text-right">${cantDisplay}</td>
                    <td class="text-right">$${Math.round(price).toLocaleString('es-AR')}${isPesable ? '/Kg' : ''}</td>
                    <td class="text-right">$${Math.round(subtotal).toLocaleString('es-AR')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem;">
            <span>TOTAL A PAGAR:</span>
            <span>$${Math.round(Number(order.totalAmount)).toLocaleString('es-AR')}</span>
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
    if (client.priceList === 'B') {
      price = Number(product.listPriceB) > 0 ? Number(product.listPriceB) : Number(product.listPrice);
    } else if (client.priceList === 'C') {
      price = Number(product.listPriceC) > 0 ? Number(product.listPriceC) : Number(product.listPrice);
    }

    let discount = Number(client.discount || 0);
    const isQuesoRemottiOrMelincue = product.rubro?.name === 'REMOTTI' || product.description?.toUpperCase() === 'REMOTTI' || product.name?.toUpperCase().includes('REMOTTI') || product.description?.toUpperCase() === 'MELINCUE' || product.name?.toUpperCase().includes('MELINCUE');

    const isFanberlian = client.name?.toUpperCase().includes('FANBERLIAN');
    if (isFanberlian) {
      if (isQuesoRemottiOrMelincue) {
        discount = 3; // 3% de descuento en quesos
      } else {
        discount = 4; // 4% de descuento general en el resto
      }
    } else if (client.priceList === 'ESPECIAL_QUESOS') {
      if (isQuesoRemottiOrMelincue) {
        discount = 3; // 3% de descuento en quesos
      } else {
        discount = 0;
      }
    } else if (client.priceList === 'B') {
      const isMelincue = product.description?.toUpperCase() === 'MELINCUE' || product.name?.toUpperCase().includes('MELINCUE');
      if (isMelincue) {
        discount = 3;
      } else {
        discount = 0;
      }
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
    // Filtrar deudores localmente con las mismas condiciones de la UI
    const filteredDebtors = debtorsReport.filter(d => {
      // Filtro de localidad
      const matchesCity = selectedCities.includes(d.city || 'Sin Localidad');

      // Filtro de sucursal
      let matchesBranch = true;
      if (selectedBranchFilter === 'A') {
        matchesBranch = d.debtA > 0;
      } else if (selectedBranchFilter === 'X') {
        matchesBranch = d.debtX > 0;
      }

      // Filtro de vendedor
      let matchesSeller = true;
      if (selectedSellerFilter !== 'ALL') {
        matchesSeller = d.sellerId?.toString() === selectedSellerFilter;
      }

      return matchesCity && matchesBranch && matchesSeller;
    });

    // Agrupar por localidad
    const groups: { [key: string]: typeof debtorsReport } = {};
    filteredDebtors.forEach(d => {
      const city = d.city || 'Sin Localidad';
      if (!groups[city]) groups[city] = [];
      groups[city].push(d);
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // const totalA = filteredDebtors.reduce((acc, d) => acc + d.debtA, 0);
    // const totalX = filteredDebtors.reduce((acc, d) => acc + d.debtX, 0);
    // const totalConsolidado = filteredDebtors.reduce((acc, d) => acc + d.outstandingBalance, 0);

    const formatCityName = (name: string) => {
      return name
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    let reportTitle = 'Reporte de Deudores';
    if (selectedCities.length === 1) {
      reportTitle = `Reporte de Deudores de ${formatCityName(selectedCities[0])}`;
    } else if (selectedCities.length > 1 && selectedCities.length <= 3) {
      reportTitle = `Reporte de Deudores de ${selectedCities.map(formatCityName).join(' / ')}`;
    } else {
      reportTitle = 'Reporte de Deudores por Localidad';
    }

    let htmlContent = `
      <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1f2937;
              padding: 20px;
              font-size: 12px;
              line-height: 1.5;
            }
            .header-container {
              border-bottom: 2px solid #111827;
              padding-bottom: 12px;
              margin-bottom: 20px;
            }
            h1 {
              font-size: 20px;
              font-weight: 700;
              margin: 0 0 6px 0;
              color: #111827;
              letter-spacing: -0.02em;
            }
            .date {
              font-size: 11px;
              color: #6b7280;
            }
            .route-section {
              margin-bottom: 25px;
              page-break-inside: avoid;
            }
            .route-title {
              font-size: 14px;
              font-weight: 700;
              color: #111827;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 4px;
              margin-bottom: 12px;
              text-transform: uppercase;
            }
            .branch-container {
              margin-bottom: 20px;
            }
            .branch-header {
              font-size: 11px;
              font-weight: 700;
              color: #374151;
              background-color: #f3f4f6;
              padding: 4px 8px;
              border-radius: 4px;
              margin-bottom: 6px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              display: inline-block;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 10px;
            }
            th {
              text-align: left;
              border-bottom: 1px solid #e5e7eb;
              padding: 4px 6px;
              font-size: 10px;
              font-weight: 600;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            td {
              padding: 6px;
              font-size: 11px;
              color: #1f2937;
              border-bottom: 1px solid #f3f4f6;
              vertical-align: middle;
            }
            .client-name {
              font-weight: 600;
              color: #111827;
            }
            .client-badge {
              font-size: 9px;
              color: var(--color-corp-red);
              font-weight: 600;
              margin-left: 6px;
              background-color: #fef2f2;
              padding: 2px 6px;
              border-radius: 4px;
              border: 1px solid #fee2e2;
              display: inline-block;
            }
            .client-contact {
              color: #4b5563;
            }
            .amount {
              font-weight: 600;
              text-align: right;
              color: #111827;
            }
            .text-right {
              text-align: right;
            }
            .divider {
              border-top: 1px solid #e5e7eb;
              margin: 20px 0;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <h1>${reportTitle}</h1>
            <div class="date">Generado el ${new Date().toLocaleDateString('es-AR')} a las ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
    `;

    Object.keys(groups).sort().forEach(city => {
      const debtorsA = groups[city].filter(c => Math.round(c.debtA) > 0);
      const debtorsX = groups[city].filter(c => Math.round(c.debtX) > 0);

      const totalCityA = debtorsA.reduce((acc, d) => acc + d.debtA, 0);
      const totalCityX = debtorsX.reduce((acc, d) => acc + d.debtX, 0);
      const groupTotal = groups[city].reduce((acc, d) => acc + d.outstandingBalance, 0);

      htmlContent += `
        <div class="route-section">
          ${selectedCities.length > 1 ? `
            <div class="route-title">📍 Localidad: ${city} (Total: $${Math.round(groupTotal).toLocaleString('es-AR')})</div>
          ` : ''}
          
          <!-- SUCURSAL A -->
          ${debtorsA.length > 0 ? `
            <div class="branch-container">
              <div class="branch-header">Sucursal A (Oficial) - Subtotal: $${Math.round(totalCityA).toLocaleString('es-AR')}</div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 45%">Cliente</th>
                    <th style="width: 40%">Contacto</th>
                    <th style="width: 15%" class="text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  ${debtorsA.map(c => `
                    <tr>
                      <td>
                        <span class="client-name">${c.name}</span>
                        ${c.pendingInvoicesCount > 1 ? `<span class="client-badge">Debe ${c.pendingInvoicesCount} bol.</span>` : ''}
                      </td>
                      <td class="client-contact">
                        ${c.address || 'S/D'}${c.phone ? ` - Tel: ${c.phone}` : ''}
                      </td>
                      <td class="amount">$${Math.round(c.debtA).toLocaleString('es-AR')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- SUCURSAL X -->
          ${debtorsX.length > 0 ? `
            <div class="branch-container">
              <div class="branch-header">Sucursal X (Interna) - Subtotal: $${Math.round(totalCityX).toLocaleString('es-AR')}</div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 45%">Cliente</th>
                    <th style="width: 40%">Contacto</th>
                    <th style="width: 15%" class="text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  ${debtorsX.map(c => `
                    <tr>
                      <td>
                        <span class="client-name">${c.name}</span>
                        ${c.pendingInvoicesCount > 1 ? `<span class="client-badge">Debe ${c.pendingInvoicesCount} bol.</span>` : ''}
                      </td>
                      <td class="client-contact">
                        ${c.address || 'S/D'}${c.phone ? ` - Tel: ${c.phone}` : ''}
                      </td>
                      <td class="amount">$${Math.round(c.debtX).toLocaleString('es-AR')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>
      `;
    });

    htmlContent += `
          <div class="divider"></div>
          <div style="text-align: center; font-size: 10px; margin-top: 30px; color: #9ca3af;">
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
  // const totalOrders = orders.length;
  const recibidosOrdersCount = orders.filter(o => o.status === 'PENDING' || o.status === 'PREPARING').length;
  const armadosOrdersCount = orders.filter(o => o.status === 'PREPARED' && !o.invoiceNumber).length;
  const facturadosOrdersCount = orders.filter(o => o.invoiceNumber && (!o.deliveryRoute || o.deliveryRoute.status === 'PENDING')).length;
  const enViajeOrdersCount = orders.filter(o => o.deliveryRoute && o.deliveryRoute.status === 'IN_TRANSIT').length;
  const entregadosOrdersCount = orders.filter(o => (o.status === 'DELIVERED' && !o.deliveryRouteId) || (o.deliveryRoute && o.deliveryRoute.status === 'COMPLETED')).length;



  const filteredQuickClients = clients.filter(c => {
    if (!c.isClient || c.isActive === false) return false;
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
          border: '1px solid rgba(var(--color-corp-red-rgb), 0.15)'
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
        <HomeTab
          orders={orders}
          setActiveTab={setActiveTab}
          setSummaryCardModal={setSummaryCardModal}
          setClientModal={setClientModal}
          setClientSearchModal={setClientSearchModal}
          setQuickClientQuery={setQuickClientQuery}
          setIsPriceListModalOpen={setIsPriceListModalOpen}
          setIsQuickSearchModalOpen={setIsQuickSearchModalOpen}
        />
      )}

      {/* ====================================================================
          2. FICHERO DE PERSONAS
          ==================================================================== */}
      {(activeTab === 'clients') && (
        <ClientsTab
          setActiveTab={setActiveTab}
          setClientModal={setClientModal}
          setShowResumenModal={setShowResumenModal}
          setPaymentModal={setPaymentModal}
          handleViewClientProfile={handleViewClientProfile}
          clientsVersion={clientsVersion}
        />
      )}

      {/* ====================================================================
          3. VISOR COMPLETO DE PEDIDOS
          ==================================================================== */}
      {activeTab === 'orders' && (
        <OrdersTab
          orders={orders}
          fetchData={fetchData}
          setOrderDetailsModal={setOrderDetailsModal}
          handleOpenEditOrder={handleOpenEditOrder}
          setErrorMsg={setErrorMsg}
          setSuccessMsg={setSuccessMsg}
        />
      )}

      {/* ====================================================================
          4. CATÁLOGO (PRODUCTOS Y RUBROS)
          ==================================================================== */}
      {activeTab === 'products' && (
        <ProductsTab
          products={products}
          fetchData={fetchData}
          setProductModal={setProductModal}
          handleUpdateProductInline={handleUpdateProductInline}
        />
      )}


      {/* ====================================================================
          6. LOGÍSTICA Y FLOTA (MÓDULO UNIFICADO)
          ==================================================================== */}
      {activeTab === 'logistica' && (
        <Suspense fallback={<LoadingDashboard />}>
          <LogisticaDashboard />
        </Suspense>
      )}

      {/* ====================================================================
          OPERACIONES & DEPOSITO (PICKING LIST)
          ==================================================================== */}
      {activeTab === 'deposito' && (
        <Suspense fallback={<LoadingDashboard />}>
          <DepositoDashboard activeTab="deposito" setActiveTab={setActiveTab} />
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
                backgroundColor: cajasSubTab === 'general' ? 'var(--color-primary)' : 'transparent',
                color: cajasSubTab === 'general' ? '#fff' : 'var(--text-primary)',
                border: cajasSubTab === 'general' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                fontWeight: 600,
                fontSize: '0.85rem',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setCajasSubTab('general')}
            >
              💼 General
            </button>
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
          </div>

          <Suspense fallback={<LoadingDashboard />}>
            {cajasSubTab === 'general' ? (
              <FinanzasDashboard />
            ) : (
              <RendicionesDashboard />
            )}
          </Suspense>
        </div>
      )}



      {/* ====================================================================
          10. CONFIGURACIÓN UNIFICADA (General, Empresa, Impresión, Empleados, CRM, Auditoría)
          ==================================================================== */}
      {activeTab === 'config' && (
        <ConfigTab
          setErrorMsg={setErrorMsg}
          setSuccessMsg={setSuccessMsg}
        />
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
                            <td className="text-right" style={{ fontWeight: 600 }}>${Math.round(Number(o.totalAmount)).toLocaleString('es-AR')}</td>
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
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {orderDetailsModal.items.map((item: any, idx: number) => {
                    const price = Number(item.unitPrice ?? item.price ?? 0);
                    const isPesable = item.product?.isPesable || (item.weight && Number(item.weight) > 0);
                    const subtotal = item.subtotal ? Number(item.subtotal) : (isPesable ? item.quantity * (item.product?.approximateWeight || 1) * price : item.quantity * price);
                    return (
                      <tr key={idx}>
                        <td>{item.product?.name}</td>
                        <td className="text-right">
                          {item.quantity} u.
                          {isPesable && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginLeft: '4px' }}>
                              ({item.weight ? `${Number(item.weight).toFixed(2)} Kg` : `${(item.quantity * (item.product?.approximateWeight || 1)).toLocaleString()} Kg aprox`})
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          ${Math.round(price).toLocaleString('es-AR')}
                          {isPesable && ' / Kg'}
                        </td>
                        <td className="text-right">${Math.round(subtotal).toLocaleString('es-AR')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: 'right', marginTop: '20px', fontWeight: 'bold', fontSize: '1.1rem' }}>
              Monto Total: ${Math.round(Number(orderDetailsModal.totalAmount)).toLocaleString('es-AR')}
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
                    placeholder="ej: 0001"
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Rubro (Categoría)</label>
                  <select
                    className="select"
                    value={productModal.data.rubroId || ''}
                    onChange={(e) => handleModalRubroChange(e.target.value)}
                    style={{ width: '100%', borderRadius: '8px', padding: '10px 14px' }}
                  >
                    <option value="">-- Sin Rubro --</option>
                    {rubrosList.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Proveedor</label>
                  <select
                    className="select"
                    value={productModal.data.providerId || ''}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, providerId: e.target.value === '' ? '' : Number(e.target.value) } })}
                    style={{ width: '100%', borderRadius: '8px', padding: '10px 14px' }}
                  >
                    <option value="">-- Sin Proveedor --</option>
                    {providersList.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
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
                  <label>Precio Costo (C/IVA)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={productModal.data.costPrice !== undefined ? productModal.data.costPrice : ''}
                    onChange={(e) => handleModalPriceChange('costPrice', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Rentabilidad (%)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="ej: 25"
                    value={productModal.data.profitMargin !== undefined ? productModal.data.profitMargin : ''}
                    onChange={(e) => handleModalPriceChange('profitMargin', e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Precio Venta Sin IVA</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={productModal.data.listPrice ? Math.round((Number(productModal.data.listPrice) / 1.21) * 100) / 100 : ''}
                    onChange={(e) => handleModalPriceChange('priceSinIva', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Precio Venta Final (Lista A - C/IVA)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={productModal.data.listPrice !== undefined ? productModal.data.listPrice : ''}
                    onChange={(e) => handleModalPriceChange('listPrice', e.target.value)}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Stock Mínimo (Alerta de reposición)</label>
                  <input
                    type="number"
                    className="input"
                    value={productModal.data.minStock || ''}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, minStock: Number(e.target.value) } })}
                  />
                </div>
                <div className="form-group">
                  <label>Unidades por Caja (Fraccionado)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="ej: 12"
                    min={1}
                    value={productModal.data.unitsPerBox || 1}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, unitsPerBox: Number(e.target.value) } })}
                  />
                </div>
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
        <div className="modal-overlay" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '950px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px', borderRadius: '12px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                👤 {clientModal.mode === 'create' ? 'Registrar Nuevo Cliente' : `Editar Cliente: ${clientModal.data.name}`}
              </h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setClientModal({ ...clientModal, open: false })}>✕</button>
            </div>
            
            <form onSubmit={handleClientSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '6px', paddingBottom: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  
                  {/* Columna Izquierda: Identificación y Contacto */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Tarjeta 1: Datos Identificatorios */}
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', backgroundColor: 'rgba(249, 250, 251, 0.3)', boxShadow: 'var(--shadow-sm)' }}>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        📋 Identificación Básica
                      </h4>
                      
                      <div className="form-group" style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Nombre Comercial / Razón Social *</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="ej: Almacén San Roque"
                          value={clientModal.data.name}
                          onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, name: e.target.value } })}
                          required
                          style={{ width: '100%', height: '38px' }}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>CUIT (Sin guiones)</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="ej: 20222334449"
                          value={clientModal.data.cuit}
                          onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, cuit: e.target.value } })}
                          style={{ width: '100%', height: '38px' }}
                        />
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Teléfono</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="ej: 11-4567-8901"
                            value={clientModal.data.phone}
                            onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, phone: e.target.value } })}
                            style={{ width: '100%', height: '38px' }}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Email</label>
                          <input
                            type="email"
                            className="input"
                            placeholder="ej: contacto@cliente.com"
                            value={clientModal.data.email}
                            onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, email: e.target.value } })}
                            style={{ width: '100%', height: '38px' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta 2: Roles de la Persona */}
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', backgroundColor: 'rgba(249, 250, 251, 0.3)', boxShadow: 'var(--shadow-sm)' }}>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        👥 Roles y Estado en Sistema
                      </h4>
                      
                      <div className="form-group" style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Roles de la Persona</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            padding: '10px 12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: clientModal.data.isClient ? 'rgba(17, 24, 39, 0.03)' : 'transparent',
                            transition: 'var(--transition-fast)'
                          }}>
                            <input
                              type="checkbox"
                              checked={!!clientModal.data.isClient}
                              onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, isClient: e.target.checked } })}
                            />
                            <span style={{ fontWeight: clientModal.data.isClient ? 600 : 400 }}>Cliente</span>
                          </label>
                          
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            padding: '10px 12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: clientModal.data.isProvider ? 'rgba(17, 24, 39, 0.03)' : 'transparent',
                            transition: 'var(--transition-fast)'
                          }}>
                            <input
                              type="checkbox"
                              checked={!!clientModal.data.isProvider}
                              onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, isProvider: e.target.checked } })}
                            />
                            <span style={{ fontWeight: clientModal.data.isProvider ? 600 : 400 }}>Proveedor</span>
                          </label>

                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            padding: '10px 12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: clientModal.data.isSeller ? 'rgba(17, 24, 39, 0.03)' : 'transparent',
                            transition: 'var(--transition-fast)'
                          }}>
                            <input
                              type="checkbox"
                              checked={!!clientModal.data.isSeller}
                              onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, isSeller: e.target.checked } })}
                            />
                            <span style={{ fontWeight: clientModal.data.isSeller ? 600 : 400 }}>Vendedor</span>
                          </label>

                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            padding: '10px 12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: clientModal.data.isCommissionAgent ? 'rgba(17, 24, 39, 0.03)' : 'transparent',
                            transition: 'var(--transition-fast)'
                          }}>
                            <input
                              type="checkbox"
                              checked={!!clientModal.data.isCommissionAgent}
                              onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, isCommissionAgent: e.target.checked } })}
                            />
                            <span style={{ fontWeight: clientModal.data.isCommissionAgent ? 600 : 400 }}>Comisionista</span>
                          </label>
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Estado de la Persona</label>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          padding: '10px 12px',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: clientModal.data.isActive !== false ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                          borderColor: clientModal.data.isActive !== false ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-color)',
                          transition: 'var(--transition-fast)'
                        }}>
                          <input
                            type="checkbox"
                            checked={clientModal.data.isActive !== false}
                            onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, isActive: e.target.checked } })}
                          />
                          <span style={{ fontWeight: clientModal.data.isActive !== false ? 600 : 400 }}>
                            Persona Activa (Habilitada para facturación/reparto)
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Columna Derecha: Ubicación y Condiciones Comerciales */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Tarjeta 3: Ubicación y Logística */}
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', backgroundColor: 'rgba(249, 250, 251, 0.3)', boxShadow: 'var(--shadow-sm)' }}>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        📍 Dirección y Despacho
                      </h4>
                      
                      <div className="form-group" style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Dirección de Entrega</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="ej: Belgrano 1200, CABA"
                          value={clientModal.data.address}
                          onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, address: e.target.value } })}
                          style={{ width: '100%', height: '38px' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Localidad</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="ej: General Villegas"
                            value={clientModal.data.city || ''}
                            onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, city: e.target.value } })}
                            style={{ width: '100%', height: '38px' }}
                          />
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Zona de Reparto (Chofer)</label>
                          <input
                            type="text"
                            list="route-suggestions"
                            className="input"
                            placeholder="ej: CENTRO 1, TROCHA..."
                            value={clientModal.data.route || ''}
                            onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, route: e.target.value } })}
                            style={{ width: '100%', height: '38px' }}
                          />
                          <datalist id="route-suggestions">
                            {(() => {
                              const cleanCity = (clientModal.data.city || '').toUpperCase().trim();
                              const isVillegas = cleanCity === 'GENERAL VILLEGAS' || cleanCity === 'GRAL VILLEGAS' || cleanCity === 'VILLEGAS' || cleanCity === '';
                              const routes = isVillegas 
                                ? ['FEDERAL', 'PARQUE', 'CENTRO 1', 'CENTRO 2', 'CENTRO 3', 'CENTRO 4', 'FONAVI', 'PROGRESO', 'TROCHA', 'CICLON', 'CRUCE']
                                : ['EMILIO V. BUNGE Y BUCHARDO', 'EMILIO V. BUNGE Y CORONEL CHARLONE', 'BANDERALÓ Y LARROUDÉ', 'VILLA SAUZE Y SANSINENA', 'FLORENTINO AMEGHINO Y BLAQUIER', 'RIVADAVIA Y FORTÍN OLAVARRÍA', 'PIEDRITAS', 'TRES ALGARROBOS', 'CARLOS TEJEDOR', 'INTENDENTE ALVEAR', 'RUFINO'];
                              return routes.map(r => <option key={r} value={r} />);
                            })()}
                          </datalist>
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta 4: Configuración Comercial */}
                    <div style={{ 
                      border: '1px solid var(--border-color)', 
                      borderRadius: 'var(--radius-md)', 
                      padding: '16px', 
                      backgroundColor: 'rgba(249, 250, 251, 0.3)',
                      boxShadow: 'var(--shadow-sm)',
                      opacity: clientModal.data.isClient ? 1 : 0.65,
                      transition: 'var(--transition-medium)'
                    }}>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>💼 Condiciones Comerciales</span>
                        {!clientModal.data.isClient && <small style={{ textTransform: 'none', color: 'var(--text-muted)', fontSize: '0.75rem' }}>(Solo aplica a Cliente)</small>}
                      </h4>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Vendedor Asignado</label>
                          <select
                            className="select"
                            value={clientModal.data.sellerId || ''}
                            onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, sellerId: e.target.value ? Number(e.target.value) : null } })}
                            disabled={!clientModal.data.isClient}
                            style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', width: '100%', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                          >
                            <option value="">Sin Vendedor</option>
                            {availableSellers.map(s => (
                              <option key={s.id} value={s.id}>{s.username.replace('_', ' ').toUpperCase()}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Ruta de Venta (Vendedor)</label>
                          <select
                            className="select"
                            value={clientModal.data.saleRouteId || ''}
                            onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, saleRouteId: e.target.value ? Number(e.target.value) : null } })}
                            disabled={!clientModal.data.isClient}
                            style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', width: '100%', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                          >
                            <option value="">Sin Ruta de Venta</option>
                            {availableSaleRoutes.map(r => (
                              <option key={r.id} value={r.id}>{r.name} ({r.seller?.username || 'Sin Vendedor'})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '10px' }}>
                        <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', height: '18px', display: 'block', whiteSpace: 'nowrap' }}>Límite Crédito CC ($)</label>
                          <input
                            type="number"
                            className="input"
                            value={clientModal.data.creditLimit}
                            onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, creditLimit: Number(e.target.value) } })}
                            disabled={!clientModal.data.isClient}
                            style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', width: '100%' }}
                          />
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', height: '18px', display: 'block', whiteSpace: 'nowrap' }}>Lista de Precios</label>
                          <select
                            className="select"
                            value={clientModal.data.priceList}
                            onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, priceList: e.target.value } })}
                            disabled={!clientModal.data.isClient}
                            style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', width: '100%', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                          >
                            <option value="A">Lista Estándar A</option>
                            <option value="B">Lista Especial B</option>
                            <option value="C">Lista Distribuidor C</option>
                            <option value="ESPECIAL_QUESOS">Lista Especial Quesos (3%)</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', height: '18px', display: 'block', whiteSpace: 'nowrap' }}>Desc. Fijo (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            placeholder="ej: 5"
                            value={clientModal.data.discount || 0}
                            onChange={(e) => setClientModal({ ...clientModal, data: { ...clientModal.data, discount: Number(e.target.value) } })}
                            disabled={!clientModal.data.isClient}
                            style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', width: '100%' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: 0, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setClientModal({ ...clientModal, open: false })}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', backgroundColor: 'var(--accent-color)', borderColor: 'var(--accent-color)', color: '#fff', fontWeight: 600 }}>
                  {clientModal.mode === 'create' ? 'Crear Cliente' : 'Guardar Cambios'}
                </button>
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
        <div className="modal-overlay" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '950px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px', borderRadius: '12px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  👤 Ficha de {clientProfileModal.client.isProvider && !clientProfileModal.client.isClient ? 'Proveedor' : 'Cliente'}: {clientProfileModal.client.name}
                </h3>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '20px',
                  backgroundColor: clientProfileModal.client.isActive !== false ? '#E6F4EA' : '#FCE8E6',
                  color: clientProfileModal.client.isActive !== false ? '#137333' : '#C5221F',
                  border: '1px solid currentColor'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
                  {clientProfileModal.client.isActive !== false ? 'Activo' : 'Inactivo'}
                </span>
                
                <div style={{ display: 'flex', gap: '6px' }}>
                  {clientProfileModal.client.isClient && <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--accent-bg-light)', fontWeight: 500, color: 'var(--text-secondary)' }}>Cliente</span>}
                  {clientProfileModal.client.isProvider && <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--accent-bg-light)', fontWeight: 500, color: 'var(--text-secondary)' }}>Proveedor</span>}
                  {clientProfileModal.client.isSeller && <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--accent-bg-light)', fontWeight: 500, color: 'var(--text-secondary)' }}>Vendedor</span>}
                  {clientProfileModal.client.isCommissionAgent && <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--accent-bg-light)', fontWeight: 500, color: 'var(--text-secondary)' }}>Comisionista</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                  onClick={() => {
                    setClientModal({
                      open: true,
                      mode: 'edit',
                      data: {
                        id: clientProfileModal.client.id,
                        name: clientProfileModal.client.name,
                        cuit: clientProfileModal.client.cuit || '',
                        address: clientProfileModal.client.address || '',
                        city: clientProfileModal.client.city || '',
                        phone: clientProfileModal.client.phone || '',
                        email: clientProfileModal.client.email || '',
                        creditLimit: clientProfileModal.client.creditLimit ? Number(clientProfileModal.client.creditLimit) : 0,
                        priceList: clientProfileModal.client.priceList || 'A',
                        discount: clientProfileModal.client.discount ? Number(clientProfileModal.client.discount) : 0,
                        isClient: !!clientProfileModal.client.isClient,
                        isProvider: !!clientProfileModal.client.isProvider,
                        isSeller: !!clientProfileModal.client.isSeller,
                        isCommissionAgent: !!clientProfileModal.client.isCommissionAgent,
                        route: clientProfileModal.client.route || '',
                        saleRouteId: clientProfileModal.client.saleRouteId || null,
                        sellerId: clientProfileModal.client.sellerId || null,
                        isActive: clientProfileModal.client.isActive !== false
                      }
                    });
                    setClientProfileModal(null);
                  }}
                >
                  ✏️ Editar Datos
                </button>
                <button className="btn btn-ghost" style={{ padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setClientProfileModal(null)}>✕</button>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '24px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
              {/* Columna Izquierda: Información Financiera y Contactos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderRight: '1px solid var(--border-color)', paddingRight: '20px' }}>
                
                {/* Tarjeta Financiera */}
                <div style={{ border: '1px solid var(--border-color)', padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(249, 250, 251, 0.4)' }}>
                  <h4 style={{ margin: '0 0 14px 0', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    📊 Resumen de Cuenta
                  </h4>
                  
                  {(() => {
                    const balance = Number(clientProfileModal.client.outstandingBalance || 0);
                    const limit = Number(clientProfileModal.client.creditLimit || 0);
                    const used = Math.max(0, balance);
                    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                    const available = limit - balance;
                    
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '4px', 
                          padding: '12px 14px', 
                          borderRadius: '8px', 
                          backgroundColor: balance > 0 ? 'rgba(239, 68, 68, 0.04)' : balance < 0 ? 'rgba(16, 185, 129, 0.04)' : 'rgba(243, 244, 246, 0.5)', 
                          border: '1px solid', 
                          borderColor: balance > 0 ? 'rgba(239, 68, 68, 0.15)' : balance < 0 ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-color)' 
                        }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Saldo Actual</span>
                          <span style={{ fontSize: '1.6rem', fontWeight: 700, color: balance > 0 ? 'var(--color-danger)' : balance < 0 ? 'var(--color-success)' : 'var(--text-primary)' }}>
                            {balance < 0 ? `$${Math.abs(balance).toLocaleString()} (A Favor)` : `$${balance.toLocaleString()}`}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Límite de Crédito:</span>
                            <span style={{ fontWeight: 600 }}>${limit.toLocaleString()}</span>
                          </div>
                          
                          {clientProfileModal.client.isClient && limit > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '4px 0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span>Crédito Usado ({pct}%)</span>
                                <span>${used.toLocaleString()}</span>
                              </div>
                              <div style={{ height: '6px', width: '100%', backgroundColor: '#E5E7EB', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, backgroundColor: pct > 85 ? 'var(--color-danger)' : pct > 50 ? 'var(--color-warning)' : 'var(--color-success)', borderRadius: '3px' }} />
                              </div>
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Crédito Disponible:</span>
                            <span style={{ fontWeight: 600, color: available < 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                              ${available.toLocaleString()}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Lista de Precios:</span>
                            <span style={{ fontWeight: 600 }}>
                              {clientProfileModal.client.priceList === 'C' ? 'Lista Distribuidor C' : clientProfileModal.client.priceList === 'B' ? 'Lista Especial B' : clientProfileModal.client.priceList === 'ESPECIAL_QUESOS' ? 'Lista Especial Quesos (3%)' : 'Lista Estándar A'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Descuento Fijo:</span>
                            <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                              {clientProfileModal.client.discount || 0}%
                            </span>
                          </div>
                        </div>
                        
                        {clientProfileModal.client.isClient && (
                          <button 
                            type="button"
                            className="btn btn-primary" 
                            style={{ width: '100%', marginTop: '6px', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', color: '#fff', fontWeight: 600, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} 
                            onClick={() => setPaymentModal({ open: true, clientId: clientProfileModal.client.id, clientName: clientProfileModal.client.name })}
                          >
                            💰 Registrar Cobro CC
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
                
                {/* Contactos */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>👥 Contactos Asociados</h4>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.78rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} onClick={() => setShowAddContact(!showAddContact)}>
                      {showAddContact ? 'Cancelar' : '+ Agregar'}
                    </button>
                  </div>

                  {showAddContact && (
                    <form onSubmit={handleAddContact} style={{ padding: '12px', backgroundColor: 'rgba(243, 244, 246, 0.4)', borderRadius: '8px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)' }}>
                      <input type="text" className="input" placeholder="Nombre" style={{ padding: '6px 10px', fontSize: '0.8rem', height: '32px' }} value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} required />
                      <input type="text" className="input" placeholder="Cargo/Rol" style={{ padding: '6px 10px', fontSize: '0.8rem', height: '32px' }} value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} />
                      <input type="text" className="input" placeholder="Teléfono" style={{ padding: '6px 10px', fontSize: '0.8rem', height: '32px' }} value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
                      <input type="email" className="input" placeholder="Email" style={{ padding: '6px 10px', fontSize: '0.8rem', height: '32px' }} value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
                      <button type="submit" className="btn btn-primary" style={{ padding: '6px', fontSize: '0.8rem', fontWeight: 600 }}>Guardar Contacto</button>
                    </form>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {(!clientProfileModal.client.contacts || clientProfileModal.client.contacts.length === 0) ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '8px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>No hay contactos asociados.</span>
                    ) : (
                      clientProfileModal.client.contacts.map((contact: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {contact.name} {contact.role && <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({contact.role})</small>}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                              {contact.phone && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  📞 {contact.phone}
                                  <a href={getWhatsAppLink(contact.phone)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center' }}>
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="#25D366">
                                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                                    </svg>
                                  </a>
                                </span>
                              )}
                              {contact.email && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>✉️ {contact.email}</span>}
                            </div>
                          </div>
                          <button type="button" className="btn btn-ghost text-danger" style={{ padding: '4px', borderRadius: '50%' }} onClick={() => handleRemoveContact(idx)}>✕</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              
              {/* Columna Derecha: Datos de la Cuenta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ border: '1px solid var(--border-color)', padding: '20px', borderRadius: '10px', backgroundColor: 'rgba(249, 250, 251, 0.4)' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    📋 Datos del Perfil y Despacho
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Razón Social / Nombre</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>{clientProfileModal.client.name}</div>
                    </div>
                    
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>CUIT / Identificación</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>{clientProfileModal.client.cuit || 'S/D'}</div>
                    </div>
                    
                    <div style={{ gridColumn: 'span 2', borderTop: '1px dashed var(--border-color)', margin: '4px 0' }} />
                    
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Teléfono Principal</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {clientProfileModal.client.phone || 'S/D'}
                        {clientProfileModal.client.phone && (
                          <a href={getWhatsAppLink(clientProfileModal.client.phone)} target="_blank" rel="noopener noreferrer">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="#25D366">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Email Principal</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px', wordBreak: 'break-all' }}>{clientProfileModal.client.email || 'S/D'}</div>
                    </div>
                    
                    <div style={{ gridColumn: 'span 2', borderTop: '1px dashed var(--border-color)', margin: '4px 0' }} />
                    
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Dirección de Entrega</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>{clientProfileModal.client.address || 'S/D'}</div>
                    </div>
                    
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Localidad</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>{clientProfileModal.client.city || 'S/D'}</div>
                    </div>
                    
                    <div style={{ gridColumn: 'span 2', borderTop: '1px dashed var(--border-color)', margin: '4px 0' }} />
                    
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Zona de Reparto (Chofer)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {clientProfileModal.client.route ? `🚛 ${clientProfileModal.client.route}` : 'Sin Zona de Reparto'}
                      </div>
                    </div>
                    
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Vendedor Asignado</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {clientProfileModal.client.seller?.username ? `👤 ${clientProfileModal.client.seller.username.replace('_', ' ').toUpperCase()}` : 'Sin Vendedor'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
              <button className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setClientProfileModal(null)}>Cerrar Ficha</button>
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

              {paymentPendingInvoices.length > 0 && (
                <div className="form-group">
                  <label>Imputar a Factura</label>
                  <select
                    className="select"
                    value={paymentSelectedInvoiceId || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setPaymentSelectedInvoiceId(null);
                        if (clientProfileModal && clientProfileModal.client.id === paymentModal.clientId) {
                          setPaymentAmount(clientProfileModal.client.outstandingBalance.toString());
                        } else {
                          setPaymentAmount('');
                        }
                      } else {
                        const invId = Number(val);
                        setPaymentSelectedInvoiceId(invId);
                        const inv = paymentPendingInvoices.find(i => i.id === invId);
                        if (inv) {
                          setPaymentAmount(inv.pendingAmount.toString());
                        }
                      }
                    }}
                  >
                    <option value="">Entrega a cuenta general (sin factura específica)</option>
                    {paymentPendingInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} (Pendiente: ${inv.pendingAmount.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Monto del Cobro ($)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="Monto"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  disabled={paymentLoading}
                />
              </div>
              <div className="form-group">
                <label>Método de Pago</label>
                <select
                  className="select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  disabled={paymentLoading}
                >
                  <option value="CASH">Efectivo</option>
                  <option value="BANK_TRANSFER">Transferencia Bancaria</option>
                  <option value="CHECK">Cheque</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>

              {/* Sección de Retenciones Sufridas/Recibidas */}
              <div style={{ borderTop: '1px dashed var(--border-color)', marginTop: '14px', paddingTop: '10px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 600 }}>🏷️ Retenciones Recibidas (Opcional)</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Monto Ganancias ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      className="input"
                      placeholder="Monto"
                      style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                      value={paymentRetencionGananciasAmount}
                      onChange={(e) => setPaymentRetencionGananciasAmount(e.target.value)}
                      disabled={paymentLoading}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nro Cert. Ganancias</label>
                    <input 
                      type="text"
                      className="input"
                      placeholder="Nro Certificado"
                      style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                      value={paymentRetencionGananciasNumber}
                      onChange={(e) => setPaymentRetencionGananciasNumber(e.target.value)}
                      disabled={paymentLoading}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Monto IIBB BsAs ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      className="input"
                      placeholder="Monto"
                      style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                      value={paymentRetencionIibbAmount}
                      onChange={(e) => setPaymentRetencionIibbAmount(e.target.value)}
                      disabled={paymentLoading}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nro Cert. IIBB BsAs</label>
                    <input 
                      type="text"
                      className="input"
                      placeholder="Nro Certificado"
                      style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                      value={paymentRetencionIibbNumber}
                      onChange={(e) => setPaymentRetencionIibbNumber(e.target.value)}
                      disabled={paymentLoading}
                    />
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Descripción / Observaciones</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Cobro factura de Quilmes"
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                  disabled={paymentLoading}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentModal(null)} disabled={paymentLoading}>Cancelar</button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                  disabled={paymentLoading || !paymentAmount || Number(paymentAmount) <= 0}
                >
                  {paymentLoading ? 'Procesando...' : 'Confirmar Cobro'}
                </button>
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
                        setShowResumenModal(c);
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
                        color: (c.outstandingBalance || 0) > 0 
                          ? 'var(--color-danger)' 
                          : (c.outstandingBalance || 0) < 0 
                            ? 'var(--color-success)' 
                            : 'var(--text-primary)'
                      }}>
                        {Number(c.outstandingBalance || 0) < 0 
                          ? `$${Math.abs(Number(c.outstandingBalance)).toLocaleString()} (A Favor)` 
                          : `$${Number(c.outstandingBalance || 0).toLocaleString()}`}
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
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {item.product.name}
                                  {item.product.isPesable && (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-danger)', marginLeft: '6px', fontWeight: 500 }}>
                                      ({(item.quantity * (item.product.approximateWeight || 1)).toLocaleString()} Kg aprox.)
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  {item.product.isPesable ? (
                                    <>${price.toLocaleString()} / Kg x {(item.quantity * (item.product.approximateWeight || 1)).toLocaleString()} Kg = ${Math.round(price * item.quantity * (item.product.approximateWeight || 1)).toLocaleString()}</>
                                  ) : (
                                    <>${price.toLocaleString()} x {item.quantity} = ${(price * item.quantity).toLocaleString()}</>
                                  )}
                                </div>
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
                      ${createOrderModal.cart.reduce((acc, curr) => {
                        const price = getQuickItemPrice(curr.product, createOrderModal.client);
                        const qtyOrWeight = curr.product.isPesable 
                          ? curr.quantity * (curr.product.approximateWeight || 1)
                          : curr.quantity;
                        return acc + Math.round(price * qtyOrWeight);
                      }, 0).toLocaleString()}
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
