import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { api } from '../utils/api';
import { OrderStatus } from '../utils/types';
import { getOrderStatusInfo } from '../utils/orderStatusHelper';
import PriceListModal from './PriceListModal';
import HomeTab from './admin/HomeTab';
import ClientsTab from './admin/ClientsTab';
import OrdersTab from './admin/OrdersTab';
import ProductsTab from './admin/ProductsTab';
import ConfigTab from './admin/ConfigTab';
import ClientProfileModal from './modals/ClientProfileModal';
import EditOrderModal from './modals/EditOrderModal';
import ProductModal from './modals/ProductModal';
import ClientModal from './modals/ClientModal';
import OffersDashboard from './admin/OffersDashboard';
import HrDashboard from './HrDashboard';
import ImportZipModal from './modals/ImportZipModal';
import { useConfirm } from '../context/ConfirmContext';
import type { Product, User, Persona, Order, Rubro, SaleRoute } from '../types';
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
const FulfillmentDashboard = lazy(() => import('./admin/FulfillmentDashboard'));
const RendicionesDashboard = lazy(() => import('./RendicionesDashboard'));
const LogisticaDashboard = lazy(() => import('./LogisticaDashboard'));
const ComprasDashboard = lazy(() => import('./ComprasDashboard'));
const FinanzasDashboard = lazy(() => import('./FinanzasDashboard'));
const BillingDashboard = lazy(() => import('./BillingDashboard'));
const DepositoDashboard = lazy(() => import('./DepositoDashboard'));
const GastosDashboard = lazy(() => import('./GastosDashboard'));
const CrmDashboard = lazy(() => import('./CrmDashboard'));

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
import OrderFulfillmentModal from './modals/OrderFulfillmentModal';
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
  const confirm = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Persona[]>([]);
  const [debtorsReport, setDebtorsReport] = useState<any[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [availableSellers, setAvailableSellers] = useState<User[]>([]);
  const [availableSaleRoutes, setAvailableSaleRoutes] = useState<SaleRoute[]>([]);
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('ALL');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('ALL');
  const [showCityDropdown, setShowCityDropdown] = useState<boolean>(false);
  const [citySearchQuery, setCitySearchQuery] = useState<string>('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('ALL');
  const [financialReport, setFinancialReport] = useState<any | null>(null);
  
  // Listas de Rubros y Proveedores para el catálogo
  const [rubrosList, setRubrosList] = useState<Rubro[]>([]);
  const [providersList, setProvidersList] = useState<Persona[]>([]);
  
  // Modales
  const [productModal, setProductModal] = useState({ open: false, mode: 'create', data: { id: 0, sku: '', name: '', description: '', barcode: '', costPrice: 0, listPrice: 0, listPriceB: 0, listPriceC: 0, profitMargin: 25 as string | number, minStock: 0, isPesable: false, approximateWeight: 0, unitsPerBox: 1, rubroId: '' as string | number, providerId: '' as string | number, imageUrl: null as string | null } });

  const [importZipModalOpen, setImportZipModalOpen] = useState(false);
  const [userModal, setUserModal] = useState({ open: false, username: '', password: '', role: 'VENDEDOR' });
  const [showPassword, setShowPassword] = useState(false);
  const [clientModal, setClientModal] = useState({ open: false, mode: 'create', data: { id: 0, name: '', cuit: '', address: '', city: '', phone: '', email: '', creditLimit: 0, maxUnpaidInvoices: 0, priceList: 'A', discount: 0, isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false, route: '', saleRouteId: null as number | null, sellerId: null as number | null, isActive: true } });
  const [clientsVersion, setClientsVersion] = useState(0);
  const [showResumenModal, setShowResumenModal] = useState<any>(null);
  const [orderDetailsModal, setOrderDetailsModal] = useState<any | null>(null);
  const [editOrderModal, setEditOrderModal] = useState<{ open: boolean; orderId: number; clientId: number; clientName: string; items: { id: number; productId: number; name: string; sku: string; quantity: number; listPrice: number; weight?: number | null; isPesable?: boolean; approximateWeight?: number | null }[] } | null>(null);

  // Estados para cuenta corriente y cobros
  const [clientProfileModal, setClientProfileModal] = useState<{ open: boolean; client: any; ledger: any[] } | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; clientId: number; clientName: string } | null>(null);
  const [fastInvoiceOrder, setFastInvoiceOrder] = useState<any | null>(null);
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


  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
    const [configTab, setConfigTab] = useState<string>('general');
  const [cajasSubTab, setCajasSubTab] = useState<'general' | 'rendiciones' | 'gastos'>('general');
  
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
    if (!await confirm('¿Estás seguro de eliminar esta regla de descuento?', { type: 'danger' })) return;
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
    if (!await confirm('¿Estás seguro de eliminar esta configuración de división?', { type: 'danger' })) return;
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
        const confirmOverpayment = await confirm(
          `El monto a cobrar ($${parsedAmount.toLocaleString()}) supera el saldo pendiente del cliente ($${balance.toLocaleString()}). El cliente quedará con saldo a favor. ¿Deseas continuar?`,
          { type: 'warning' }
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





  


  const fetchData = useCallback(async () => {
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
        const allProducts = await api.getProducts('', true);
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
        const data = await api.getProducts(searchQuery, true);
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
            const allProducts = await api.getProducts('', true);
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
      setErrorMsg(err.message || 'Error de conexión');
    }
  }, [activeTab, searchQuery, orderStatusFilter, auditPage, configTab, personaRoleFilter]);

  // Carga de datos según pestaña activa
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Limpiar mensajes al cambiar de pestaña principal
  useEffect(() => {
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [activeTab]);

  const handleSyncBalance = async (personaId?: number) => {
    if (!await confirm(personaId ? '¿Deseas conciliar el saldo de esta cuenta?' : '¿Deseas conciliar TODOS los saldos inconsistentes del sistema?')) {
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


  const handleUploadImage = async (productId: number, file: File) => {
    try {
      await api.uploadProductImage(productId, file);
      // alert('Imagen subida con éxito');
      fetchData(); // Refrescar catálogo
    } catch (error: any) {
      alert(error.message || 'Error al subir la imagen');
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
        isActive: updatedProduct.isActive,
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

  // --- OPERACIONES DE PEDIDOS (ADMIN) ---
  const handleCancelOrder = async (id: number) => {
    if (!await confirm('¿Está seguro de que desea cancelar este pedido? Se restaurará el stock físico.', { type: 'danger' })) return;
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
      {activeTab === 'fulfillment' && (
        <Suspense fallback={<LoadingDashboard />}>
          <FulfillmentDashboard />
        </Suspense>
      )}

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
          onOpenImportZip={() => setImportZipModalOpen(true)}
          onUploadImage={handleUploadImage}
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
          CRM & WHATSAPP
          ==================================================================== */}
      {activeTab === 'crm' && (
        <Suspense fallback={<LoadingDashboard />}>
          <CrmDashboard />
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

      {activeTab === 'offers' && (
        <OffersDashboard />
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
            <button 
              type="button"
              className="btn" 
              style={{ 
                backgroundColor: cajasSubTab === 'gastos' ? 'var(--color-primary)' : 'transparent',
                color: cajasSubTab === 'gastos' ? '#fff' : 'var(--text-primary)',
                border: cajasSubTab === 'gastos' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                fontWeight: 600,
                fontSize: '0.85rem',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setCajasSubTab('gastos')}
            >
              💸 Control de Gastos
            </button>
          </div>

          <Suspense fallback={<LoadingDashboard />}>
            {cajasSubTab === 'general' ? (
              <FinanzasDashboard />
            ) : cajasSubTab === 'rendiciones' ? (
              <RendicionesDashboard />
            ) : (
              <GastosDashboard />
            )}
          </Suspense>
        </div>
      )}



      {/* ====================================================================
          RECURSOS HUMANOS Y NOMINA
          ==================================================================== */}
      {activeTab === 'rrhh' && <HrDashboard />}

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
              {!orderDetailsModal.invoiceNumber && orderDetailsModal.status !== 'CANCELLED' && (
                <button 
                  className="btn btn-primary" 
                  style={{ backgroundColor: '#4F46E5', borderColor: '#4F46E5', color: 'white' }} 
                  onClick={() => {
                    setFastInvoiceOrder(orderDetailsModal);
                    setOrderDetailsModal(null);
                  }}
                >
                  <DollarSign size={16} />
                  <span>Facturar Directo</span>
                </button>
              )}
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
      <EditOrderModal
        editOrderModal={editOrderModal}
        setEditOrderModal={setEditOrderModal}
        products={products}
        fetchData={fetchData}
        setSuccessMsg={setSuccessMsg}
        setErrorMsg={setErrorMsg}
      />

      {/* 2. Modal Producto */}
      <ProductModal
        productModal={productModal}
        setProductModal={setProductModal}
        rubrosList={rubrosList}
        providersList={providersList}
        fetchData={fetchData}
        setSuccessMsg={setSuccessMsg}
        setErrorMsg={setErrorMsg}
      />

      {/* 3. Modal Cliente */}
      {showResumenModal && (
        <ResumenCuentaModal client={showResumenModal} onClose={() => setShowResumenModal(null)} />
      )}
      <ClientModal
        clientModal={clientModal}
        setClientModal={setClientModal}
        availableSellers={availableSellers}
        availableSaleRoutes={availableSaleRoutes}
        fetchData={fetchData}
        setSuccessMsg={setSuccessMsg}
        setErrorMsg={setErrorMsg}
        setClientsVersion={setClientsVersion}
      />

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

      <ImportZipModal 
        isOpen={importZipModalOpen} 
        onClose={() => { setImportZipModalOpen(false); fetchData(); }} 
      />

      {/* 5. Ficha de Cliente y Extracto de Cuenta Corriente */}
      <ClientProfileModal 
        clientProfileModal={clientProfileModal}
        setClientProfileModal={setClientProfileModal}
        setClientModal={setClientModal}
        setPaymentModal={setPaymentModal}
        fetchData={fetchData}
        setSuccessMsg={setSuccessMsg}
        setErrorMsg={setErrorMsg}
      />

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

      {/* 8. Búsqueda Rápida de Precios (Global) */}
      <QuickPriceSearchModal 
        isOpen={isQuickSearchModalOpen}
        onClose={() => setIsQuickSearchModalOpen(false)}
      />

      {/* 9. Modal Facturación Directa */}
      {fastInvoiceOrder && (
        <OrderFulfillmentModal
          order={fastInvoiceOrder}
          onClose={() => setFastInvoiceOrder(null)}
          onSuccess={() => {
            setFastInvoiceOrder(null);
            fetchData();
          }}
        />
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
                        color: Number(c.outstandingBalance || 0) > 0 
                          ? 'var(--color-danger)' 
                          : Number(c.outstandingBalance || 0) < 0 
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
                    <div><strong>Lista:</strong> {createOrderModal.client.priceList === 'C' ? 'Lista Especial 2' : createOrderModal.client.priceList === 'B' ? 'Lista Especial' : 'Lista 4'}</div>
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
