import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { OrderStatus } from '../utils/types';
import BillingDashboard from './BillingDashboard';
import RepartoDashboard from './RepartoDashboard';
import ComprasDashboard from './ComprasDashboard';
import CrmDashboard from './CrmDashboard';
import PriceListModal from './PriceListModal';
import { 
  Plus, 
  UserPlus, 
  ToggleLeft, 
  ToggleRight, 
  RotateCcw, 
  AlertTriangle, 
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
  const [productModal, setProductModal] = useState({ open: false, mode: 'create', data: { id: 0, sku: '', name: '', description: '', barcode: '', costPrice: 0, listPrice: 0, listPriceB: 0, listPriceC: 0, minStock: 0 } });
  const [userModal, setUserModal] = useState({ open: false, username: '', password: '', role: 'VENDEDOR' });
  const [showPassword, setShowPassword] = useState(false);
  const [clientModal, setClientModal] = useState({ open: false, mode: 'create', data: { id: 0, name: '', cuit: '', address: '', city: '', phone: '', email: '', creditLimit: 0, priceList: 'A', discount: 0, isClient: true, isProvider: false, isSeller: false, isCommissionAgent: false } });
  const [orderDetailsModal, setOrderDetailsModal] = useState<any | null>(null);
  const [editOrderModal, setEditOrderModal] = useState<{ open: boolean; orderId: number; clientId: number; clientName: string; items: { id: number; productId: number; name: string; sku: string; quantity: number; listPrice: number }[] } | null>(null);

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
  const [clientSearchModal, setClientSearchModal] = useState<{ open: boolean; action: 'ledger' | 'payment' | 'order' } | null>(null);
  const [quickClientQuery, setQuickClientQuery] = useState('');
  
  const [createOrderModal, setCreateOrderModal] = useState<{ open: boolean; client: any; cart: { product: any; quantity: number }[]; notes: string } | null>(null);
  const [quickProductQuery, setQuickProductQuery] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [prodSearchQuery, setProdSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [activeReportTab, setActiveReportTab] = useState<string>('finanzas');
  const [configTab, setConfigTab] = useState<string>('general');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados de Personas (Clientes)
  const [personaRoleFilter, setPersonaRoleFilter] = useState<string>('client');

  // Estados de Finanzas (Cajas y Bancos)
  const [activeDrawer, setActiveDrawer] = useState<any | null>(null);
  const [activeDrawers, setActiveDrawers] = useState<any[]>([]);
  const [showJointCloseModal, setShowJointCloseModal] = useState<boolean>(false);
  const [closeRealBalanceA, setCloseRealBalanceA] = useState<string>('');
  const [closeRealBalanceX, setCloseRealBalanceX] = useState<string>('');
  
  // Estados para la Planilla de Rendición de Cobros de Vendedores
  const [showReconciliationModal, setShowReconciliationModal] = useState<boolean>(false);
  const [reconType, setReconType] = useState<string>('VENDEDOR'); // 'VENDEDOR' | 'REPARTO' | 'DEPOSITO'
  const [reconSellerId, setReconSellerId] = useState<string>('');
  const [reconBranch, setReconBranch] = useState<string>('X');
  const [reconCashDeclared, setReconCashDeclared] = useState<string>('');
  const [reconChecksDeclared, setReconChecksDeclared] = useState<string>('');
  const [reconTransfersDeclared, setReconTransfersDeclared] = useState<string>('');
  const [allClientsCache, setAllClientsCache] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  
  interface ReconciliationReceipt {
    id: string;
    personaId: number;
    personaName: string;
    receiptNumber: string;
    paymentMethod: 'CASH' | 'CHECK' | 'BANK_TRANSFER';
    amount: number;
    description: string;
  }
  const [reconReceipts, setReconReceipts] = useState<ReconciliationReceipt[]>([]);

  // Estados de carga de recibo individual
  const [reconSearchClient, setReconSearchClient] = useState<string>('');
  const [reconSelectedClient, setReconSelectedClient] = useState<any | null>(null);
  const [reconReceiptNumber, setReconReceiptNumber] = useState<string>('');
  const [reconReceiptMethod, setReconReceiptMethod] = useState<'CASH' | 'CHECK' | 'BANK_TRANSFER'>('CASH');
  const [reconReceiptAmount, setReconReceiptAmount] = useState<string>('');
  const [reconClientSuggestions, setReconClientSuggestions] = useState<any[]>([]);
  const [showReconClientSuggestions, setShowReconClientSuggestions] = useState<boolean>(false);
  const [reconProcessing, setReconProcessing] = useState<boolean>(false);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('ALL');
  const [selectedDrawerFilter, setSelectedDrawerFilter] = useState<string>('ALL');
  const [showCloseDrawerModal, setShowCloseDrawerModal] = useState<boolean>(false);
  const [closeRealBalance, setCloseRealBalance] = useState<string>('');
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferBankAccountId, setTransferBankAccountId] = useState<string>('');
  const [transferDescription, setTransferDescription] = useState<string>('');
  const [showCreateBankModal, setShowCreateBankModal] = useState<boolean>(false);
  const [createBankName, setCreateBankName] = useState<string>('');
  const [createBankAccountNumber, setCreateBankAccountNumber] = useState<string>('');
  const [createBankBalance, setCreateBankBalance] = useState<string>('0');

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
  }, [activeTab, searchQuery, orderStatusFilter, auditPage, configTab, personaRoleFilter, selectedBranchFilter, selectedBankFilter, selectedDrawerFilter]);

  // Efecto para buscar y filtrar sugerencias de clientes locales en el reconciliador de vendedores
  useEffect(() => {
    if (!reconSearchClient.trim()) {
      setReconClientSuggestions([]);
      return;
    }
    const query = reconSearchClient.toLowerCase();
    const suggestions = allClientsCache.filter((c: any) => 
      c.name.toLowerCase().includes(query) || (c.cuit && c.cuit.includes(query))
    );
    setReconClientSuggestions(suggestions.slice(0, 8));
  }, [reconSearchClient, allClientsCache]);

  const handleOpenReconciliation = async () => {
    setErrorMsg(null);
    try {
      const allUsers = await api.getUsers();
      const sellersList = allUsers.filter((u: any) => u.isActive);
      setSellers(sellersList);
      if (sellersList.length > 0) {
        setReconSellerId(sellersList[0].id.toString());
      }

      const allClients = await api.getPersonas('client');
      setAllClientsCache(allClients);

      setReconType('VENDEDOR');
      setReconBranch('X');
      setReconCashDeclared('');
      setReconChecksDeclared('');
      setReconTransfersDeclared('');
      setReconReceipts([]);
      setReconSearchClient('');
      setReconSelectedClient(null);
      setReconReceiptNumber('');
      setReconReceiptMethod('CASH');
      setReconReceiptAmount('');
      
      setShowReconciliationModal(true);
    } catch (err: any) {
      setErrorMsg('Error al inicializar la planilla de rendición: ' + (err.message || err));
    }
  };

  const handleAddReconReceipt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!reconSelectedClient) {
      alert('Por favor, selecciona un cliente de la lista de sugerencias.');
      return;
    }
    if (!reconReceiptNumber.trim()) {
      alert('Por favor, ingresa el número de recibo.');
      return;
    }
    const amt = Number(reconReceiptAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Por favor, ingresa un monto mayor a cero.');
      return;
    }

    const newRec: ReconciliationReceipt = {
      id: Math.random().toString(36).substring(2, 9),
      personaId: reconSelectedClient.id,
      personaName: reconSelectedClient.name,
      receiptNumber: reconReceiptNumber.trim(),
      paymentMethod: reconReceiptMethod,
      amount: amt,
      description: reconType === 'VENDEDOR'
        ? `Rendición Vendedor: ${sellers.find(s => s.id.toString() === reconSellerId)?.username || 'Vendedor'} - Recibo N° ${reconReceiptNumber.trim()}`
        : reconType === 'REPARTO'
        ? `Rendición Reparto: ${sellers.find(s => s.id.toString() === reconSellerId)?.username || 'Repartidor'} - Recibo N° ${reconReceiptNumber.trim()}`
        : `Recibo Depósito N° ${reconReceiptNumber.trim()}`
    };

    setReconReceipts([...reconReceipts, newRec]);
    
    // Limpiar campos individuales
    setReconSearchClient('');
    setReconSelectedClient(null);
    setReconReceiptNumber('');
    setReconReceiptAmount('');
    
    // Devolver el foco al buscador para carga rápida
    setTimeout(() => {
      const clientInput = document.getElementById('reconClientSearchInput');
      if (clientInput) clientInput.focus();
    }, 50);
  };

  const handleRemoveReconReceipt = (id: string) => {
    setReconReceipts(reconReceipts.filter(r => r.id !== id));
  };

  const handleProcessReconciliation = async () => {
    if (reconReceipts.length === 0) {
      alert('No hay recibos cargados en la planilla.');
      return;
    }
    
    setReconProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const agentName = sellers.find(s => s.id.toString() === reconSellerId)?.username || 'Operador';
    let processedCount = 0;
    
    try {
      for (const rec of reconReceipts) {
        await api.registerPayment(rec.personaId, {
          amount: rec.amount,
          paymentMethod: rec.paymentMethod,
          description: rec.description,
          branch: reconBranch
        });
        processedCount++;
      }

      // Calcular diferencias finales
      const totalCashLoaded = reconReceipts.filter(r => r.paymentMethod === 'CASH').reduce((sum, r) => sum + r.amount, 0);
      const totalChecksLoaded = reconReceipts.filter(r => r.paymentMethod === 'CHECK').reduce((sum, r) => sum + r.amount, 0);
      const totalTransfersLoaded = reconReceipts.filter(r => r.paymentMethod === 'BANK_TRANSFER').reduce((sum, r) => sum + r.amount, 0);
      
      const cashDiff = Number(reconCashDeclared || 0) - totalCashLoaded;
      const checkDiff = Number(reconChecksDeclared || 0) - totalChecksLoaded;
      const transDiff = Number(reconTransfersDeclared || 0) - totalTransfersLoaded;

      const typeLabel = reconType === 'VENDEDOR' ? 'Vendedor' : reconType === 'REPARTO' ? 'Reparto' : 'Depósito';
      let msg = `✨ Planilla de Rendición (${typeLabel}) procesada para "${agentName}". Se registraron ${processedCount} recibos correctamente.`;
      if (cashDiff !== 0 || checkDiff !== 0 || transDiff !== 0) {
        msg += '\nSe detectaron las siguientes diferencias que impactarán en el arqueo diario:';
        if (cashDiff !== 0) msg += `\n- Efectivo: ${cashDiff > 0 ? `Faltante de $${cashDiff.toLocaleString()}` : `Sobrante de $${Math.abs(cashDiff).toLocaleString()}`}`;
        if (checkDiff !== 0) msg += `\n- Cheques: ${checkDiff > 0 ? `Faltante de $${checkDiff.toLocaleString()}` : `Sobrante de $${Math.abs(checkDiff).toLocaleString()}`}`;
        if (transDiff !== 0) msg += `\n- Transferencias: ${transDiff > 0 ? `Faltante de $${transDiff.toLocaleString()}` : `Sobrante de $${Math.abs(transDiff).toLocaleString()}`}`;
      } else {
        msg += '\n¡Valores y recibos consolidados perfectamente! ($0 diferencia)';
      }

      setSuccessMsg(msg);
      setShowReconciliationModal(false);
      fetchData();
    } catch (err: any) {
      setErrorMsg(`Error al procesar rendición (completados ${processedCount} de ${reconReceipts.length} recibos): ` + (err.message || err));
    } finally {
      setReconProcessing(false);
    }
  };

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
      } else if (activeTab === 'reports') {
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
        // Filtrar orders localmente según el estado seleccionado
        if (orderStatusFilter !== 'ALL') {
          setOrders(data.filter((o: any) => o.status === orderStatusFilter));
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
      } else if (activeTab === 'finanzas') {
        const stats = await api.getFinancialReports();
        setFinancialReport(stats);
        const activeList = await api.getActiveDrawers();
        setActiveDrawers(activeList);
        setActiveDrawer(activeList[0] || null);
        const accounts = await api.getBankAccounts();
        setBankAccounts(accounts);
        
        const filters: any = {};
        if (selectedBranchFilter !== 'ALL') filters.branch = selectedBranchFilter;
        if (selectedBankFilter !== 'ALL') filters.bankAccountId = selectedBankFilter;
        if (selectedDrawerFilter !== 'ALL') filters.cashDrawerId = selectedDrawerFilter;
        const txs = await api.getTransactions(filters);
        setTransactions(txs);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener datos.');
    }
  };

  // --- CSV IMPORT / EXPORT DE PRECIOS ---
  const handleExportCSV = () => {
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

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          minStock: Number(data.minStock)
        });
      }
      setProductModal({ ...productModal, open: false });
      setSuccessMsg('Producto guardado correctamente.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar producto.');
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
        listPrice: i.price
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
        quantity: item.quantity
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
            <div class="logo">DV DISTRIBUIDORA</div>
            <div>Mayorista de Alimentos & Bebidas</div>
            <div>CUIT: 30-71717171-9</div>
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
  const pendingOrders = orders.filter(o => o.status === OrderStatus.PENDING).length;
  const preparingOrders = orders.filter(o => o.status === OrderStatus.PREPARING).length;
  const preparedOrders = orders.filter(o => o.status === OrderStatus.PREPARED).length;
  const deliveredOrders = orders.filter(o => o.status === OrderStatus.DELIVERED).length;
  const cancelledOrders = orders.filter(o => o.status === OrderStatus.CANCELLED).length;

  const successRate = totalOrders > 0 
    ? Math.round((deliveredOrders / (totalOrders - cancelledOrders || 1)) * 100) 
    : 100;

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
          {/* Grilla de Métricas de Pedidos */}
          <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            <div className="card stat-card" style={{ borderLeft: '4px solid var(--accent-color)' }}>
              <div className="stat-label">Pedidos Recibidos</div>
              <div className="stat-value" style={{ color: 'var(--accent-color)' }}>
                {totalOrders}
              </div>
              <div className="stat-desc">Cantidad total de pedidos registrados</div>
            </div>

            <div className="card stat-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
              <div className="stat-label">Pedidos Entregados</div>
              <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                {deliveredOrders}
              </div>
              <div className="stat-desc">Operación completada con éxito</div>
            </div>

            <div className="card stat-card" style={{ borderLeft: '4px solid #F59E0B' }}>
              <div className="stat-label">Pedidos en Proceso</div>
              <div className="stat-value" style={{ color: '#F59E0B' }}>
                {pendingOrders + preparingOrders + preparedOrders}
              </div>
              <div className="stat-desc">Pendientes, picking o listos</div>
            </div>
          </div>

          {/* Accesos Directos (Acciones Rápidas) */}
          <div style={{ marginTop: '24px' }}>
            <style>{`
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
                  title: 'Mirar un Precio',
                  desc: 'Consulta rápida de precios',
                  icon: <Search size={20} style={{ color: 'var(--text-secondary)' }} />,
                  onClick: () => setIsPriceListModalOpen(true)
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

          {/* Notas de Resumen */}
          <div className="card" style={{ marginTop: '24px', padding: '24px' }}>
            <h3 className="card-title" style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Notas de Resumen</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                <span style={{ fontSize: '1.25rem' }}>📦</span>
                <span>Hay <strong>{pendingOrders}</strong> {pendingOrders === 1 ? 'pedido pendiente' : 'pedidos pendientes'} de picking y preparación en depósito.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                <span style={{ fontSize: '1.25rem' }}>⚙️</span>
                <span>Actualmente <strong>{preparingOrders}</strong> {preparingOrders === 1 ? 'pedido está' : 'pedidos están'} en proceso de picking en las estanterías.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                <span style={{ fontSize: '1.25rem' }}>🚛</span>
                <span>Se registran <strong>{preparedOrders}</strong> {preparedOrders === 1 ? 'pedido listo' : 'pedidos listos'} esperando distribución o retiro.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                <span style={{ fontSize: '1.25rem' }}>✅</span>
                <span>Un total de <strong>{deliveredOrders}</strong> {deliveredOrders === 1 ? 'pedido ha sido entregado' : 'pedidos han sido entregados'} de manera exitosa (tasa de efectividad: <strong>{successRate}%</strong>).</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                <span style={{ fontSize: '1.25rem' }}>❌</span>
                <span>Hay <strong>{cancelledOrders}</strong> {cancelledOrders === 1 ? 'pedido cancelado' : 'pedidos cancelados'} en el sistema.</span>
              </div>
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
                  <th>Límite de Crédito</th>
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
                        <td style={{ fontWeight: 600 }}>
                          ${Number(c.creditLimit || 0).toLocaleString()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => handleViewClientProfile(c)}>
                              Ver Ficha
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
              <option value="PENDING">Pendientes de picking</option>
              <option value="PREPARING">En preparación</option>
              <option value="PREPARED">Listos para facturar</option>
              <option value="DELIVERED">Facturados y Entregados</option>
              <option value="CANCELLED">Cancelados</option>
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
                        <span className={`badge badge-${o.status.toLowerCase()}`}>
                          {o.status === 'PENDING' ? 'Pendiente' : o.status === 'PREPARING' ? 'En Picking' : o.status === 'PREPARED' ? 'Armado/Listo' : o.status === 'DELIVERED' ? 'Facturado' : 'Cancelado'}
                        </span>
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
          4. CATÁLOGO DE PRODUCTOS
          ==================================================================== */}
      {activeTab === 'products' && (
        <div>
          <div className="actions-bar" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-input-wrapper" style={{ flex: 1, minWidth: '250px' }}>
              <input
                type="text"
                className="input"
                placeholder="Buscar SKU, nombre o código de barra..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={handleExportCSV}>
                Descargar Planilla
              </button>
              
              <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center' }}>
                Subir Planilla
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleImportCSV} 
                  style={{ display: 'none' }} 
                />
              </label>

              <button className="btn btn-primary" onClick={() => setProductModal({ open: true, mode: 'create', data: { id: 0, sku: '', name: '', description: '', barcode: '', costPrice: 0, listPrice: 0, listPriceB: 0, listPriceC: 0, minStock: 0 } })}>
                <Plus size={16} />
                <span>Nuevo Producto</span>
              </button>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Costo</th>
                  <th>P. Lista</th>
                  <th>Stock Físico</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0' }}>No se encontraron productos.</td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.sku}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.description}</div>
                      </td>
                      <td>${p.costPrice}</td>
                      <td style={{ fontWeight: 600 }}>${p.listPrice}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600 }}>{p.stock} u.</span>
                          {p.stock <= p.minStock && (
                            <span title="Bajo stock mínimo" style={{ color: 'var(--color-warning)', display: 'inline-flex' }}>
                              <AlertTriangle size={14} />
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setProductModal({ open: true, mode: 'edit', data: { id: p.id, sku: p.sku, name: p.name, description: p.description || '', barcode: p.barcode || '', costPrice: p.costPrice, listPrice: p.listPrice, listPriceB: p.listPriceB || 0, listPriceC: p.listPriceC || 0, minStock: p.minStock } })}>
                          Editar
                        </button>
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
        <RepartoDashboard />
      )}

      {/* ====================================================================
          7. CAJAS Y TESORERÍA
          ==================================================================== */}
      {activeTab === 'finanzas' && financialReport && (() => {
        // 1. Filtrar transacciones por categorías
        const localTxs = transactions.filter((t: any) => 
          !t.description?.includes('Rendición Vendedor') && 
          !t.description?.includes('Rendición Reparto')
        );

        const sellerTxs = transactions.filter((t: any) => 
          t.description?.includes('Rendición Vendedor')
        );

        const repartoTxs = transactions.filter((t: any) => 
          t.description?.includes('Rendición Reparto')
        );

        // Calcular caja vendedores
        let sellerEfectivo = 0;
        let sellerCheques = 0;
        sellerTxs.forEach((t: any) => {
          if (t.paymentMethod === 'CASH') {
            if (t.type === 'INCOME') sellerEfectivo += Number(t.amount);
            else sellerEfectivo -= Number(t.amount);
          } else if (t.paymentMethod === 'CHECK') {
            if (t.type === 'INCOME') sellerCheques += Number(t.amount);
            else sellerCheques -= Number(t.amount);
          }
        });

        // Calcular caja reparto
        let repartoEfectivo = 0;
        let repartoCheques = 0;
        repartoTxs.forEach((t: any) => {
          if (t.paymentMethod === 'CASH') {
            if (t.type === 'INCOME') repartoEfectivo += Number(t.amount);
            else repartoEfectivo -= Number(t.amount);
          } else if (t.paymentMethod === 'CHECK') {
            if (t.type === 'INCOME') repartoCheques += Number(t.amount);
            else repartoCheques -= Number(t.amount);
          }
        });

        // Calcular cheques locales
        const localCheques = localTxs.filter((t: any) => t.paymentMethod === 'CHECK' && t.type === 'INCOME')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        // Calcular total en bancos
        const totalBancos = bankAccounts.reduce((sum: number, acc: any) => sum + Number(acc.balance || 0), 0);

        return (
          <div>
            {/* Controles de Apertura para Cajas Cerradas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              {(() => {
                const isAOpen = activeDrawers.some(d => d.branch === 'A' && d.status === 'OPEN');
                const isXOpen = activeDrawers.some(d => d.branch === 'X' && d.status === 'OPEN');

                if (isAOpen && isXOpen) return null; // Ambas están abiertas

                return (
                  <div className="card" style={{ padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px' }}>Apertura de Caja Operativa</h3>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      Declarar los fondos iniciales para habilitar el cobro en efectivo. Podés abrir Sucursal A y Sucursal X de forma paralela.
                    </p>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      {!isAOpen && (
                        <div style={{ border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'flex-end', backgroundColor: '#fdfdfd' }}>
                          <div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Sucursal A (Oficial)</span>
                            <input
                              type="number"
                              className="input"
                              placeholder="Efectivo Inicial..."
                              style={{ width: '160px', padding: '8px 12px' }}
                              id="openBalanceA"
                              defaultValue="0"
                            />
                          </div>
                          <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.8rem' }} onClick={async () => {
                            const val = (document.getElementById('openBalanceA') as HTMLInputElement)?.value || '0';
                            try {
                              await api.openDrawer('A', Number(val));
                              setSuccessMsg(`Caja abierta para Sucursal A correctamente.`);
                              fetchData();
                            } catch (err: any) {
                              setErrorMsg(err.message || 'Error al abrir la caja A.');
                            }
                          }}>
                            Abrir Suc A
                          </button>
                        </div>
                      )}

                      {!isXOpen && (
                        <div style={{ border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'flex-end', backgroundColor: '#fdfdfd' }}>
                          <div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Sucursal X (Interno)</span>
                            <input
                              type="number"
                              className="input"
                              placeholder="Efectivo Inicial..."
                              style={{ width: '160px', padding: '8px 12px' }}
                              id="openBalanceX"
                              defaultValue="0"
                            />
                          </div>
                          <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.8rem' }} onClick={async () => {
                            const val = (document.getElementById('openBalanceX') as HTMLInputElement)?.value || '0';
                            try {
                              await api.openDrawer('X', Number(val));
                              setSuccessMsg(`Caja abierta para Sucursal X correctamente.`);
                              fetchData();
                            } catch (err: any) {
                              setErrorMsg(err.message || 'Error al abrir la caja X.');
                            }
                          }}>
                            Abrir Suc X
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* BOTONERA GENERAL DE FINANZAS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Cajas & Tesorería Unificada</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                  onClick={handleOpenReconciliation}
                >
                  Planilla de Rendición de Cobros
                </button>
                {activeDrawers.length > 0 && (
                  <button
                    className="btn btn-primary"
                    style={{ backgroundColor: '#E30613', borderColor: '#E30613', padding: '8px 16px', fontSize: '0.85rem' }}
                    onClick={() => {
                      setCloseRealBalanceA('');
                      setCloseRealBalanceX('');
                      setShowJointCloseModal(true);
                    }}
                  >
                    Cierre de Caja Conjunto (A + X)
                  </button>
                )}
              </div>
            </div>

            {/* PANEL PRINCIPAL EN CUATRO COLUMNAS (GRID DE CUENTAS Y CAJAS) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              
              {/* COLUMNA 1: CAJA OPERATIVA DIARIA (DEPÓSITO LOCAL) */}
              <div className="card" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>🏪 Caja Diaria Depósito</span>
                  <span className="badge" style={{ backgroundColor: '#eaf9ee', color: '#137333', fontSize: '0.7rem', fontWeight: 600 }}>Local</span>
                </div>
                
                {activeDrawers.length === 0 ? (
                  <div style={{ padding: '12px 0', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    Cajas operativas cerradas.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activeDrawers.map((drawer) => {
                      const drawerTxs = localTxs.filter((t: any) => t.cashDrawerId === drawer.id);
                      let localIncome = 0;
                      let localOutcome = 0;
                      drawerTxs.forEach((t: any) => {
                        if (t.type === 'INCOME') localIncome += Number(t.amount);
                        else localOutcome += Number(t.amount);
                      });
                      const theoretical = Number(drawer.openingBalance) + localIncome - localOutcome;

                      return (
                        <div key={drawer.id} style={{ fontSize: '0.8rem', borderBottom: '1px solid #f9f9f9', paddingBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '4px' }}>
                            <span>Sucursal {drawer.branch === 'A' ? 'A (Oficial)' : 'X (Interno)'}</span>
                            <span>${theoretical.toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            <span>Apertura: ${Number(drawer.openingBalance).toLocaleString()}</span>
                            <span style={{ textAlign: 'right' }}>Cobros: +${localIncome.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <div style={{ marginTop: 'auto', borderTop: '1px solid #f0f0f0', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cheques en Cartera:</span>
                  <span style={{ fontWeight: 600 }}>${localCheques.toLocaleString()}</span>
                </div>
              </div>

              {/* COLUMNA 2: BANCOS Y DIGITAL WALLETS */}
              <div className="card" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>🏦 Bancos y Cuentas</span>
                  <span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', fontSize: '0.7rem', fontWeight: 600 }}>Digital</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {bankAccounts.map((acc: any) => (
                    <div key={acc.id} style={{ fontSize: '0.8rem', borderBottom: '1px solid #f9f9f9', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 600, display: 'block' }}>{acc.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Cta: {acc.accountNumber}</span>
                      </div>
                      <span style={{ fontWeight: 700 }}>${Number(acc.balance || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 'auto', borderTop: '1px solid #f0f0f0', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700 }}>
                  <span>Total Bancos:</span>
                  <span style={{ color: '#1a73e8' }}>${totalBancos.toLocaleString()}</span>
                </div>
              </div>

              {/* COLUMNA 3: CAJA VENTA VENDEDORES (CALLE) */}
              <div className="card" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>💼 Caja Venta Vendedores</span>
                  <span className="badge" style={{ backgroundColor: '#fdf4e7', color: '#b06000', fontSize: '0.7rem', fontWeight: 600 }}>Calle</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center', height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Efectivo Rendido:</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>${sellerEfectivo.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Cheques Rendidos:</span>
                    <span style={{ fontWeight: 600 }}>${sellerCheques.toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', borderTop: '1px solid #f0f0f0', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700 }}>
                  <span>Total Vendedores:</span>
                  <span style={{ color: '#b06000' }}>${(sellerEfectivo + sellerCheques).toLocaleString()}</span>
                </div>
              </div>

              {/* COLUMNA 4: CAJA REPARTO (LOGÍSTICA) */}
              <div className="card" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>🚚 Caja Reparto</span>
                  <span className="badge" style={{ backgroundColor: '#f3e8fd', color: '#681da8', fontSize: '0.7rem', fontWeight: 600 }}>Reparto</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center', height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Efectivo Rendido:</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>${repartoEfectivo.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Cheques Rendidos:</span>
                    <span style={{ fontWeight: 600 }}>${repartoCheques.toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', borderTop: '1px solid #f0f0f0', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700 }}>
                  <span>Total Reparto:</span>
                  <span style={{ color: '#681da8' }}>${(repartoEfectivo + repartoCheques).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* 3. TIMELINE Y HISTORIAL DE TRANSACCIONES */}
            <div className="card" style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="card-title" style={{ margin: '0' }}>Historial y Timeline de Fondos</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select className="input" style={{ width: '160px', padding: '4px 8px', fontSize: '0.8rem' }} value={selectedBranchFilter} onChange={(e) => setSelectedBranchFilter(e.target.value)}>
                    <option value="ALL">Todas las Sucursales</option>
                    <option value="A">Sucursal A (Oficial)</option>
                    <option value="X">Sucursal X (Interno)</option>
                  </select>

                  <select className="input" style={{ width: '160px', padding: '4px 8px', fontSize: '0.8rem' }} value={selectedBankFilter} onChange={(e) => setSelectedBankFilter(e.target.value)}>
                    <option value="ALL">Todos los Bancos</option>
                    {bankAccounts.map((account: any) => (
                      <option key={account.id} value={account.id.toString()}>{account.name}</option>
                    ))}
                  </select>

                  <select className="input" style={{ width: '160px', padding: '4px 8px', fontSize: '0.8rem' }} value={selectedDrawerFilter} onChange={(e) => setSelectedDrawerFilter(e.target.value)}>
                    <option value="ALL">Todas las Cajas</option>
                    {activeDrawer && (
                      <option value={activeDrawer.id.toString()}>Caja Activa (ID: {activeDrawer.id})</option>
                    )}
                  </select>
                </div>
              </div>
              
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha / Hora</th>
                      <th>Operador</th>
                      <th>Destino / Origen</th>
                      <th>Método</th>
                      <th>Tipo</th>
                      <th>Monto</th>
                      <th>Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-secondary)' }}>No se registraron movimientos en este período.</td>
                      </tr>
                    ) : (
                      transactions.map((t) => (
                        <tr key={t.id}>
                          <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {new Date(t.createdAt).toLocaleString('es-AR')}
                          </td>
                          <td style={{ fontWeight: 600 }}>{t.user?.username}</td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {t.cashDrawer ? (
                              <span className="badge" style={{ backgroundColor: '#ECEFF1', color: '#37474F', fontWeight: 600, fontSize: '0.7rem' }}>
                                Caja Suc. {t.cashDrawer.branch}
                              </span>
                            ) : t.bankAccount ? (
                              <span className="badge" style={{ backgroundColor: '#E8F0FE', color: '#1A73E8', fontWeight: 600, fontSize: '0.7rem' }}>
                                {t.bankAccount.name}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>Cuenta Corriente</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                            {t.paymentMethod === 'CASH' ? 'Efectivo' : t.paymentMethod === 'BANK_TRANSFER' ? 'Transferencia' : t.paymentMethod === 'CHECK' ? 'Cheque' : 'Otro'}
                          </td>
                          <td>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: t.type === 'INCOME' ? 'var(--color-success)' : '#E30613',
                              backgroundColor: t.type === 'INCOME' ? '#E6F4EA' : '#FCE8E6',
                              padding: '2px 6px',
                              borderRadius: '3px'
                            }}>
                              {t.type === 'INCOME' ? 'INGRESO' : 'EGRESO'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: t.type === 'INCOME' ? 'var(--color-success)' : '#E30613' }}>
                            {t.type === 'INCOME' ? '+' : '-'}${Number(t.amount).toLocaleString()}
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t.description}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ====================================================================
          FACTURACION & IMPUESTOS (BILLING)
          ==================================================================== */}
      {activeTab === 'billing' && (
        <BillingDashboard activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

      {/* ====================================================================
          8. COMPRAS (COMPRAS DASHBOARD)
          ==================================================================== */}
      {activeTab === 'compras' && (
        <ComprasDashboard />
      )}

      {/* ====================================================================
          9. REPORTES Y MARGENES (REPORTES)
          ==================================================================== */}
      {/* ====================================================================
          9. REPORTES Y MARGENES (BUSINESS INTELLIGENCE)
          ==================================================================== */}
      {activeTab === 'reports' && financialReport && (() => {
        // --- 1. CÁLCULOS DE FINANZAS Y MÁRGENES ---
        const deliveredOrders = orders.filter((o: any) => o.status === 'DELIVERED');
        const totalSalesSum = deliveredOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0);
        const ticketAverage = deliveredOrders.length > 0 ? totalSalesSum / deliveredOrders.length : 0;
        
        const officialSales = financialReport.sales.official;
        const internalSales = financialReport.sales.internal;
        const totalFacturado = officialSales + internalSales;
        const totalCostoEstimado = (officialSales * 0.65) + (internalSales * 0.60);
        const totalMargenNeto = totalFacturado - totalCostoEstimado;
        const pctMargenConsolidado = totalFacturado > 0 ? Math.round((totalMargenNeto / totalFacturado) * 100) : 0;

        // --- 2. CÁLCULOS DE RENDIMIENTO DE VENDEDORES ---
        const sellerUsers = users.filter((u: any) => u.role === 'VENDEDOR');
        const sellerPerformance = sellerUsers.map((seller: any) => {
          const sellerOrders = orders.filter((o: any) => o.sellerId === seller.id);
          const completedOrders = sellerOrders.filter((o: any) => o.status === 'DELIVERED');
          const totalSales = completedOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0);
          const avgTicket = completedOrders.length > 0 ? totalSales / completedOrders.length : 0;
          
          const assignedClients = clients.filter((c: any) => c.sellerId === seller.id && c.isClient);
          const visitedClients = assignedClients.filter((c: any) => 
            orders.some((o: any) => (o.personaId === c.id || o.clientId === c.id) && o.sellerId === seller.id)
          );
          
          const visitEffectiveness = assignedClients.length > 0 
            ? Math.round((visitedClients.length / assignedClients.length) * 100) 
            : 0;

          // Simulación de última actividad
          let lastActivity = 'Sin actividad reciente';
          if (completedOrders.length > 0) {
            const sorted = [...completedOrders].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const lastOrder = sorted[0];
            const clientName = lastOrder.client?.name || clients.find((c: any) => c.id === lastOrder.clientId)?.name || 'Cliente';
            lastActivity = `Visita exitosa en ${clientName} (hace ${Math.floor(Math.random() * 40) + 5}m)`;
          }

          return {
            id: seller.id,
            username: seller.username,
            totalSales,
            ordersCount: sellerOrders.length,
            completedCount: completedOrders.length,
            avgTicket,
            assignedCount: assignedClients.length,
            visitedCount: visitedClients.length,
            effectiveness: visitEffectiveness,
            lastActivity,
            commission: totalSales * 0.05 // 5% de comisión
          };
        }).sort((a: any, b: any) => b.totalSales - a.totalSales);

        // --- 3. CÁLCULOS DE ROTACIÓN DE PRODUCTOS ---
        const productStatsMap: { [key: number]: { qty: number; revenue: number; name: string; sku: string; stock: number } } = {};
        
        // Inicializar con todos los productos
        products.forEach((p: any) => {
          productStatsMap[p.id] = { qty: 0, revenue: 0, name: p.name, sku: p.sku, stock: p.stock };
        });

        // Sumar ventas de órdenes completadas
        deliveredOrders.forEach((o: any) => {
          if (o.items && Array.isArray(o.items)) {
            o.items.forEach((item: any) => {
              const pId = item.productId;
              if (productStatsMap[pId]) {
                productStatsMap[pId].qty += Number(item.quantity);
                productStatsMap[pId].revenue += Number(item.subtotal || (item.quantity * (item.unitPrice || 0)));
              }
            });
          }
        });

        const productStatsList = Object.keys(productStatsMap).map((key: any) => ({
          id: Number(key),
          ...productStatsMap[key]
        }));

        const topProducts = [...productStatsList]
          .filter(p => p.qty > 0)
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5);

        const deadStockProducts = [...productStatsList]
          .filter(p => p.qty === 0 && p.stock > 0)
          .sort((a, b) => b.stock - a.stock);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Navegación horizontal de reportes */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '24px', paddingBottom: '2px', marginBottom: '8px' }}>
              <button 
                type="button"
                className={`tab-btn ${activeReportTab === 'finanzas' ? 'active' : ''}`}
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  padding: '8px 4px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: activeReportTab === 'finanzas' ? '#E30613' : 'var(--text-secondary)',
                  borderBottom: activeReportTab === 'finanzas' ? '2px solid #E30613' : 'none',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setActiveReportTab('finanzas')}
              >
                📊 Ventas y Rentabilidad
              </button>
              
              <button 
                type="button"
                className={`tab-btn ${activeReportTab === 'vendedores' ? 'active' : ''}`}
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  padding: '8px 4px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: activeReportTab === 'vendedores' ? '#E30613' : 'var(--text-secondary)',
                  borderBottom: activeReportTab === 'vendedores' ? '2px solid #E30613' : 'none',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setActiveReportTab('vendedores')}
              >
                💼 Rendimiento de Vendedores
              </button>
              
              <button 
                type="button"
                className={`tab-btn ${activeReportTab === 'productos' ? 'active' : ''}`}
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  padding: '8px 4px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: activeReportTab === 'productos' ? '#E30613' : 'var(--text-secondary)',
                  borderBottom: activeReportTab === 'productos' ? '2px solid #E30613' : 'none',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setActiveReportTab('productos')}
              >
                📦 Rotación de Productos
              </button>
            </div>

            {/* SECCIÓN 1: FINANZAS Y RENTABILIDAD */}
            {activeReportTab === 'finanzas' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* KPIs principales */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  
                  <div className="card" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>VENTAS FACTURADAS</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700 }}>${totalFacturado.toLocaleString()}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
                      {deliveredOrders.length} pedidos entregados
                    </span>
                  </div>

                  <div className="card" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>COSTO ESTIMADO</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#3c4043' }}>${totalCostoEstimado.toLocaleString()}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
                      Costo ponderado de mercadería
                    </span>
                  </div>

                  <div className="card" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>MARGEN NETO</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#137333' }}>${totalMargenNeto.toLocaleString()}</span>
                    <span className="badge" style={{ backgroundColor: '#e6f4ea', color: '#137333', fontSize: '0.7rem', fontWeight: 600, marginLeft: '8px', verticalAlign: 'middle' }}>
                      {pctMargenConsolidado}%
                    </span>
                  </div>

                  <div className="card" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>TICKET PROMEDIO</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a73e8' }}>${Math.round(ticketAverage).toLocaleString()}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
                      Valor neto de compra medio
                    </span>
                  </div>

                </div>

                {/* Tabla de Márgenes por Canal */}
                <div className="card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
                  <h4 style={{ fontSize: '0.925rem', fontWeight: 700, marginTop: 0, marginBottom: '16px' }}>Rentabilidad por Sucursal/Canal</h4>
                  <div className="table-container" style={{ border: '1px solid var(--border-color)' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Sucursal</th>
                          <th>Vendido (Facturado)</th>
                          <th>Costo Estimado</th>
                          <th>Margen Neto</th>
                          <th>Porcentaje Margen</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Sucursal A (Oficial)</td>
                          <td>${officialSales.toLocaleString()}</td>
                          <td>${(officialSales * 0.65).toLocaleString()}</td>
                          <td style={{ fontWeight: 600, color: '#137333' }}>${(officialSales * 0.35).toLocaleString()}</td>
                          <td><span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', fontSize: '0.72rem', fontWeight: 600 }}>35%</span></td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Sucursal X (Interno)</td>
                          <td>${internalSales.toLocaleString()}</td>
                          <td>${(internalSales * 0.60).toLocaleString()}</td>
                          <td style={{ fontWeight: 600, color: '#137333' }}>${(internalSales * 0.40).toLocaleString()}</td>
                          <td><span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', fontSize: '0.72rem', fontWeight: 600 }}>40%</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* SECCIÓN 2: DESEMPEÑO DE VENDEDORES */}
            {activeReportTab === 'vendedores' && (
              <div className="card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '0.925rem', fontWeight: 700, margin: 0 }}>Desempeño y Seguimiento de Preventistas</h4>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Comisión configurada: <strong>5% neto</strong></span>
                </div>

                <div className="table-container" style={{ border: '1px solid var(--border-color)' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Vendedor</th>
                        <th>Ventas Totales</th>
                        <th>Ticket Promedio</th>
                        <th>Pedidos (Entregados)</th>
                        <th>Efectividad de Visitas</th>
                        <th>Comisiones Est.</th>
                        <th>Última Actividad / Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellerPerformance.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)' }}>No hay preventistas registrados.</td>
                        </tr>
                      ) : (
                        sellerPerformance.map((perf: any) => (
                          <tr key={perf.id}>
                            <td style={{ fontWeight: 600 }}>{perf.username}</td>
                            <td style={{ fontWeight: 700 }}>${perf.totalSales.toLocaleString()}</td>
                            <td>${Math.round(perf.avgTicket).toLocaleString()}</td>
                            <td>{perf.completedCount} / {perf.ordersCount}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, backgroundColor: '#f0f0f0', height: '6px', borderRadius: '3px', width: '80px', overflow: 'hidden' }}>
                                  <div style={{
                                    backgroundColor: perf.effectiveness >= 80 ? 'var(--color-success)' : perf.effectiveness >= 50 ? '#f2994a' : '#E30613',
                                    height: '100%',
                                    width: `${perf.effectiveness}%`
                                  }} />
                                </div>
                                <span style={{ fontWeight: 600, fontSize: '0.78rem' }}>{perf.effectiveness}%</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>({perf.visitedCount}/{perf.assignedCount})</span>
                              </div>
                            </td>
                            <td style={{ fontWeight: 600, color: '#137333' }}>${Math.round(perf.commission).toLocaleString()}</td>
                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              <span className="badge" style={{ 
                                display: 'inline-block',
                                width: '8px', 
                                height: '8px', 
                                borderRadius: '50%', 
                                backgroundColor: perf.completedCount > 0 ? '#137333' : '#f2994a', 
                                marginRight: '6px',
                                padding: 0
                              }} />
                              {perf.lastActivity}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECCIÓN 3: ROTACIÓN DE PRODUCTOS */}
            {activeReportTab === 'productos' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
                
                {/* Top 5 Más Vendidos */}
                <div className="card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
                  <h4 style={{ fontSize: '0.925rem', fontWeight: 700, marginTop: 0, marginBottom: '16px', color: '#137333' }}>🔥 Productos Estrella (Más Vendidos)</h4>
                  
                  {topProducts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: '0.825rem' }}>No hay ventas registradas todavía.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {topProducts.map((p: any, idx: number) => (
                        <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', borderBottom: '1px solid #f9f9f9', paddingBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                            <span>#{idx + 1} {p.name}</span>
                            <span>{p.qty} bultos / u</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            <span>SKU: {p.sku} | Stock actual: {p.stock}</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Recaudación: ${p.revenue.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stock Muerto / Baja Rotación */}
                <div className="card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
                  <h4 style={{ fontSize: '0.925rem', fontWeight: 700, marginTop: 0, marginBottom: '16px', color: '#E30613' }}>⚠️ Alerta de Stock Muerto (Cero Ventas)</h4>
                  
                  {deadStockProducts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: '0.825rem' }}>Buen control. No hay stock inmovilizado sin rotación.</div>
                  ) : (
                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.25' }}>
                        Los siguientes productos tienen stock disponible en depósito pero no registran ventas en el sistema. Considere realizar promociones.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '220px', overflowY: 'auto' }}>
                        {deadStockProducts.map((p: any) => (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px solid #fcfcfc', paddingBottom: '6px' }}>
                            <div>
                              <span style={{ fontWeight: 600, display: 'block' }}>{p.name}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>SKU: {p.sku}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span className="badge" style={{ backgroundColor: '#FCE8E6', color: '#E30613', fontWeight: 700 }}>{p.stock} u en depósito</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        );
      })()}

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
              ⚙️ General
            </button>
            <button 
              type="button"
              className="btn" 
              style={{ 
                backgroundColor: configTab === 'empresa' ? 'var(--color-primary)' : 'transparent',
                color: configTab === 'empresa' ? '#fff' : 'var(--text-primary)',
                border: configTab === 'empresa' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                fontWeight: 600,
                fontSize: '0.85rem',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setConfigTab('empresa')}
            >
              🏢 Datos Empresa
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
                backgroundColor: configTab === 'crm' ? 'var(--color-primary)' : 'transparent',
                color: configTab === 'crm' ? '#fff' : 'var(--text-primary)',
                border: configTab === 'crm' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                fontWeight: 600,
                fontSize: '0.85rem',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setConfigTab('crm')}
            >
              ✨ CRM + IA
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

          {/* Sub-tab 1: General */}
          {configTab === 'general' && (
            <div className="card">
              <h3 className="card-title">Configuración General del Sistema</h3>
              <p style={{ fontSize: '0.85rem', marginBottom: '20px', color: 'var(--text-secondary)' }}>Parámetros generales de la distribuidora para la AFIP y emisión de comprobantes oficiales.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label>CUIT del Emisor</label>
                  <input type="text" className="input" defaultValue="30-71717171-9" />
                </div>
                <div className="form-group">
                  <label>Punto de Venta Oficial (Factura Electrónica)</label>
                  <input type="number" className="input" defaultValue={1} />
                </div>
                <div className="form-group">
                  <label>IVA por defecto (%)</label>
                  <input type="number" className="input" defaultValue={21} />
                </div>
                <div className="form-group">
                  <label>Certificado Homologación AFIP</label>
                  <div style={{ fontSize: '0.75rem', padding: '10px', backgroundColor: '#F1F3F4', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    🔑 certificado_produccion.crt (Cargado en backend/certs/)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 2: Empresa */}
          {configTab === 'empresa' && (
            <div className="card">
              <h3 className="card-title">Datos de la Empresa</h3>
              <p style={{ fontSize: '0.85rem', marginBottom: '20px', color: 'var(--text-secondary)' }}>Información que aparecerá en los encabezados de facturas y remitos.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label>Razón Social</label>
                  <input type="text" className="input" defaultValue="Distribuidora de Bebidas SRL" />
                </div>
                <div className="form-group">
                  <label>Nombre de Fantasía</label>
                  <input type="text" className="input" defaultValue="Bebidas del Sur" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Dirección Comercial</label>
                  <input type="text" className="input" defaultValue="Av. San Martín 1234, Ciudad Autónoma de Buenos Aires" />
                </div>
                <div className="form-group">
                  <label>Teléfono de Contacto</label>
                  <input type="text" className="input" defaultValue="011-4567-8900" />
                </div>
                <div className="form-group">
                  <label>Email de Contacto</label>
                  <input type="email" className="input" defaultValue="ventas@bebidasdelsur.com" />
                </div>
              </div>
            </div>
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

          {/* Sub-tab 5: CRM */}
          {configTab === 'crm' && (
            <CrmDashboard />
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
      {/* 1. Detalles de pedido */}
      {orderDetailsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Pedido #{orderDetailsModal.id}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setOrderDetailsModal(null)}>✕</button>
            </div>
            
            {/* Barra de progreso de preparación de pedidos (Fase 2) */}
            {orderDetailsModal.status !== 'CANCELLED' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                {[
                  { status: 'PENDING', label: 'Cargado' },
                  { status: 'PREPARING', label: 'En Picking' },
                  { status: 'PREPARED', label: 'Armado' },
                  { status: 'DELIVERED', label: 'Facturado' }
                ].map((step, idx, arr) => {
                  const orderStatus = orderDetailsModal.status;
                  const statusOrder = ['PENDING', 'PREPARING', 'PREPARED', 'DELIVERED'];
                  const currentIdx = statusOrder.indexOf(orderStatus);
                  const stepIdx = statusOrder.indexOf(step.status);
                  const isCompleted = stepIdx <= currentIdx;
                  const isActive = step.status === orderStatus;
                  
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
              <p><strong>Estado:</strong> <span className={`badge badge-${orderDetailsModal.status.toLowerCase()}`}>{orderDetailsModal.status}</span></p>
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
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>${item.listPrice} c/u</div>
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
                    <span>${editOrderModal.items.reduce((acc, i) => acc + (i.listPrice * i.quantity), 0).toLocaleString()}</span>
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
                  👤 Ficha de Cliente: {clientProfileModal.client.name}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span>CUIT: {clientProfileModal.client.cuit || 'S/D'}</span>
                  <span>|</span>
                  <span>Dirección: {clientProfileModal.client.address || 'S/D'}</span>
                  <span>|</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Tel: {clientProfileModal.client.phone || 'S/D'}</span>
                    {clientProfileModal.client.phone && (
                      <a href={getWhatsAppLink(clientProfileModal.client.phone)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="#25D366">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                        </svg>
                      </a>
                    )}
                  </span>
                </span>
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
              
              {/* Columna Derecha: Libro Diario / Ledger */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>📋 Extracto de Cuenta Corriente (Libro Diario)</h4>
                <div style={{ overflowY: 'auto', maxHeight: '50vh', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Fecha</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Concepto</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Debe</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Haber</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientProfileModal.ledger.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>
                            No hay movimientos registrados en la cuenta corriente.
                          </td>
                        </tr>
                      ) : (
                        clientProfileModal.ledger.map((item: any) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{new Date(item.date).toLocaleDateString('es-AR')}</td>
                            <td style={{ padding: '8px' }}>
                              <div style={{ fontWeight: 500 }}>{item.description}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Ref: {item.reference}</div>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', color: 'var(--color-danger)', fontWeight: item.type === 'DEBIT' ? 600 : 400 }}>
                              {item.type === 'DEBIT' ? `$${item.amount.toLocaleString()}` : '-'}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', color: 'var(--color-success)', fontWeight: item.type === 'CREDIT' ? 600 : 400 }}>
                              {item.type === 'CREDIT' ? `$${item.amount.toLocaleString()}` : '-'}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                              ${item.balance.toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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

      {/* Cierre de Caja Modal */}
      {showCloseDrawerModal && activeDrawer && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Cierre y Arqueo de Caja</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowCloseDrawerModal(false)}>✕</button>
            </div>
            {(() => {
              let cashIncome = 0;
              let cashOutcome = 0;
              const cashTransactions = transactions.filter((t: any) => t.cashDrawerId === activeDrawer.id);
              cashTransactions.forEach((t: any) => {
                if (t.type === 'INCOME') cashIncome += Number(t.amount);
                else cashOutcome += Number(t.amount);
              });
              const theoretical = Number(activeDrawer.openingBalance) + cashIncome - cashOutcome;

              return (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const closed = await api.closeDrawer(activeDrawer.id, Number(closeRealBalance));
                    const diff = Number(closeRealBalance) - Number(closed.closingBalance);
                    if (diff === 0) {
                      setSuccessMsg('Caja cerrada con arqueo perfecto.');
                    } else if (diff > 0) {
                      setSuccessMsg(`Caja cerrada con sobrante de $${diff.toLocaleString()}.`);
                    } else {
                      setSuccessMsg(`Caja cerrada con faltante de $${Math.abs(diff).toLocaleString()}.`);
                    }
                    setShowCloseDrawerModal(false);
                    setCloseRealBalance('');
                    fetchData();
                  } catch (err: any) {
                    setErrorMsg(err.message || 'Error al cerrar la caja.');
                  }
                }}>
                  <div style={{ marginBottom: '16px', backgroundColor: '#F8F9FA', padding: '12px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Saldo Inicial:</span>
                      <span style={{ fontWeight: 600 }}>${Number(activeDrawer.openingBalance).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ventas Efectivo:</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>+${cashIncome.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', paddingTop: '6px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Saldo Teórico:</span>
                      <span style={{ fontWeight: 700 }}>${theoretical.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Efectivo Contado Real ($)</label>
                    <input
                      type="number"
                      className="input"
                      required
                      placeholder="Ingresá el monto real contado..."
                      value={closeRealBalance}
                      onChange={(e) => setCloseRealBalance(e.target.value)}
                    />
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowCloseDrawerModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#E30613', borderColor: '#E30613' }}>Cerrar Caja</button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal: Cierre de Caja Conjunto */}
      {showJointCloseModal && activeDrawers.length > 0 && (() => {
        const activeA = activeDrawers.find(d => d.branch === 'A');
        const activeX = activeDrawers.find(d => d.branch === 'X');

        let cashIncomeA = 0;
        let cashOutcomeA = 0;
        if (activeA) {
          const txsA = transactions.filter((t: any) => t.cashDrawerId === activeA.id);
          txsA.forEach((t: any) => {
            if (t.type === 'INCOME') cashIncomeA += Number(t.amount);
            else cashOutcomeA += Number(t.amount);
          });
        }
        const theoreticalA = activeA ? Number(activeA.openingBalance) + cashIncomeA - cashOutcomeA : 0;

        let cashIncomeX = 0;
        let cashOutcomeX = 0;
        if (activeX) {
          const txsX = transactions.filter((t: any) => t.cashDrawerId === activeX.id);
          txsX.forEach((t: any) => {
            if (t.type === 'INCOME') cashIncomeX += Number(t.amount);
            else cashOutcomeX += Number(t.amount);
          });
        }
        const theoreticalX = activeX ? Number(activeX.openingBalance) + cashIncomeX - cashOutcomeX : 0;

        // Calcular transferencias y cheques de hoy (o de las sesiones activas)
        const todayStr = new Date().toISOString().split('T')[0];
        const bankTransfersToday = transactions.filter((t: any) => 
          t.paymentMethod === 'BANK_TRANSFER' && 
          t.type === 'INCOME' &&
          t.createdAt && t.createdAt.split('T')[0] === todayStr
        ).reduce((sum: number, t: any) => sum + Number(t.amount), 0);

        const checksToday = transactions.filter((t: any) => 
          t.paymentMethod === 'CHECK' && 
          t.type === 'INCOME' &&
          t.createdAt && t.createdAt.split('T')[0] === todayStr
        ).reduce((sum: number, t: any) => sum + Number(t.amount), 0);

        return (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px', padding: '24px' }}>
              <div className="modal-header" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Cierre de Caja Conjunto (A + X)</h3>
                <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowJointCloseModal(false)}>✕</button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const res = await api.closeJointDrawers({
                    realBalanceA: activeA ? Number(closeRealBalanceA || theoreticalA) : 0,
                    realBalanceX: activeX ? Number(closeRealBalanceX || theoreticalX) : 0,
                  });

                  // Armar mensaje consolidado de arqueo
                  let msg = '✨ Cierre de caja conjunto realizado.';
                  if (activeA && res.drawers) {
                    const closedA = res.drawers.find((d: any) => d.branch === 'A');
                    if (closedA) {
                      const diffA = Number(closeRealBalanceA || theoreticalA) - Number(closedA.closingBalance);
                      msg += `\n- Sucursal A: ${diffA === 0 ? 'Arqueo perfecto.' : diffA > 0 ? `Sobrante de $${diffA.toLocaleString()}` : `Faltante de $${Math.abs(diffA).toLocaleString()}`}`;
                    }
                  }
                  if (activeX && res.drawers) {
                    const closedX = res.drawers.find((d: any) => d.branch === 'X');
                    if (closedX) {
                      const diffX = Number(closeRealBalanceX || theoreticalX) - Number(closedX.closingBalance);
                      msg += `\n- Sucursal X: ${diffX === 0 ? 'Arqueo perfecto.' : diffX > 0 ? `Sobrante de $${diffX.toLocaleString()}` : `Faltante de $${Math.abs(diffX).toLocaleString()}`}`;
                    }
                  }

                  setSuccessMsg(msg);
                  setShowJointCloseModal(false);
                  setCloseRealBalanceA('');
                  setCloseRealBalanceX('');
                  fetchData();
                } catch (err: any) {
                  setErrorMsg(err.message || 'Error al realizar el cierre de caja conjunto.');
                }
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Resumen de cobros electrónicos/cheques */}
                  <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.825rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.85rem' }}>Cobros Consolidados de Hoy</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Transferencias Bancarias:</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-info)' }}>${bankTransfersToday.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Cheques Recibidos:</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>${checksToday.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Sucursal A */}
                  {activeA ? (
                    <div style={{ border: '1px solid var(--border-color)', padding: '14px', borderRadius: '8px', backgroundColor: '#fcfcfc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#137333' }}>Sucursal A (Oficial)</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Saldo Teórico: <strong>${theoreticalA.toLocaleString()}</strong></span>
                      </div>
                      
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.78rem' }}>Efectivo Real Contado ($)</label>
                        <input
                          type="number"
                          className="input"
                          placeholder={`Teórico: ${theoreticalA}`}
                          value={closeRealBalanceA}
                          onChange={(e) => setCloseRealBalanceA(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '10px', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Caja de Sucursal A está cerrada. No requiere arqueo.
                    </div>
                  )}

                  {/* Sucursal X */}
                  {activeX ? (
                    <div style={{ border: '1px solid var(--border-color)', padding: '14px', borderRadius: '8px', backgroundColor: '#fcfcfc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#3c4043' }}>Sucursal X (Interno)</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Saldo Teórico: <strong>${theoreticalX.toLocaleString()}</strong></span>
                      </div>
                      
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.78rem' }}>Efectivo Real Contado ($)</label>
                        <input
                          type="number"
                          className="input"
                          placeholder={`Teórico: ${theoreticalX}`}
                          value={closeRealBalanceX}
                          onChange={(e) => setCloseRealBalanceX(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '10px', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Caja de Sucursal X está cerrada. No requiere arqueo.
                    </div>
                  )}

                </div>

                <div className="modal-footer" style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowJointCloseModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#E30613', borderColor: '#E30613', color: '#ffffff' }}>
                    Confirmar Cierre de Caja
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal: Planilla de Rendición de Cobros de Vendedores */}
      {showReconciliationModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '1200px', width: '95vw', padding: '24px', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}>
            
            {/* Header */}
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Planilla de Rendición de Cobros de Vendedores</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Carga rápida de recibos de calle y consolidación de valores entregados</p>
              </div>
              <button type="button" className="btn btn-ghost" style={{ padding: '6px' }} onClick={() => setShowReconciliationModal(false)} disabled={reconProcessing}>✕</button>
            </div>

            {/* Form Body - Split Column layout */}
            <div style={{ display: 'flex', gap: '24px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
              
              {/* Left Column: Form & Add Receipts (60%) */}
              <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '4px' }}>
                
                {/* Seller & Branch config card */}
                <div className="card" style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', border: '1px solid var(--border-color)' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Origen / Canal</label>
                    <select
                      className="input"
                      value={reconType}
                      onChange={(e) => setReconType(e.target.value)}
                      disabled={reconReceipts.length > 0}
                    >
                      <option value="VENDEDOR">Venta Vendedores (Calle)</option>
                      <option value="REPARTO">Rendición Reparto (Choferes)</option>
                      <option value="DEPOSITO">Venta Depósito (Local)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Responsable</label>
                    <select 
                      className="input" 
                      value={reconSellerId} 
                      onChange={(e) => setReconSellerId(e.target.value)}
                      disabled={reconReceipts.length > 0 || reconType === 'DEPOSITO'}
                    >
                      {reconType === 'DEPOSITO' ? (
                        <option value="">Depósito Local (No requerido)</option>
                      ) : (
                        sellers.map((u: any) => (
                          <option key={u.id} value={u.id.toString()}>{u.username} ({u.role})</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Caja Destino (Efectivo)</label>
                    <select 
                      className="input" 
                      value={reconBranch} 
                      onChange={(e) => setReconBranch(e.target.value)}
                      disabled={reconReceipts.length > 0}
                    >
                      <option value="X">Sucursal X (Interno / Depósito)</option>
                      <option value="A">Sucursal A (Oficial)</option>
                    </select>
                  </div>
                </div>

                {/* Declared values (What vendor physically entregó) */}
                <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>1. Conteo de Valores Entregados por Vendedor</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.78rem' }}>Efectivo / Contado Físico ($)</label>
                      <input
                        type="number"
                        className="input"
                        placeholder="ej: 45000"
                        value={reconCashDeclared}
                        onChange={(e) => setReconCashDeclared(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.78rem' }}>Cheques Físicos ($)</label>
                      <input
                        type="number"
                        className="input"
                        placeholder="ej: 30000"
                        value={reconChecksDeclared}
                        onChange={(e) => setReconChecksDeclared(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.78rem' }}>Transferencias Declaradas ($)</label>
                      <input
                        type="number"
                        className="input"
                        placeholder="ej: 15000"
                        value={reconTransfersDeclared}
                        onChange={(e) => setReconTransfersDeclared(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Receipts Loader Form */}
                <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', position: 'relative' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>2. Carga Rápida de Recibos de Papel</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '12px' }}>
                    {/* Client Autocomplete Search */}
                    <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                      <label style={{ fontSize: '0.78rem' }}>Cliente (Buscar por Nombre/CUIT)</label>
                      <input
                        type="text"
                        id="reconClientSearchInput"
                        className="input"
                        placeholder="Escribí nombre o CUIT..."
                        value={reconSearchClient}
                        onChange={(e) => {
                          setReconSearchClient(e.target.value);
                          setShowReconClientSuggestions(true);
                        }}
                        onFocus={() => setShowReconClientSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowReconClientSuggestions(false), 250)}
                      />
                      {showReconClientSuggestions && reconClientSuggestions.length > 0 && (
                        <div className="suggestions-list" style={{ width: '100%' }}>
                          {reconClientSuggestions.map(c => (
                            <div
                              key={c.id}
                              className="suggestion-item"
                              onMouseDown={() => {
                                setReconSelectedClient(c);
                                setReconSearchClient(c.name);
                                setShowReconClientSuggestions(false);
                                setTimeout(() => document.getElementById('reconReceiptNoInput')?.focus(), 50);
                              }}
                            >
                              <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{c.name}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                CUIT: {c.cuit || 'S/D'} | Saldo CC: ${Number(c.outstandingBalance || 0).toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.78rem' }}>N° de Recibo</label>
                      <input
                        type="text"
                        id="reconReceiptNoInput"
                        className="input"
                        placeholder="ej: 0002-00001234"
                        value={reconReceiptNumber}
                        onChange={(e) => setReconReceiptNumber(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            document.getElementById('reconReceiptAmountInput')?.focus();
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.78rem' }}>Medio de Pago</label>
                      <select
                        className="input"
                        value={reconReceiptMethod}
                        onChange={(e) => setReconReceiptMethod(e.target.value as any)}
                      >
                        <option value="CASH">Efectivo (Contado)</option>
                        <option value="CHECK">Cheque de Terceros</option>
                        <option value="BANK_TRANSFER">Transferencia Bancaria</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.78rem' }}>Monto Cobrado ($)</label>
                      <input
                        type="number"
                        id="reconReceiptAmountInput"
                        className="input"
                        placeholder="ej: 15000"
                        value={reconReceiptAmount}
                        onChange={(e) => setReconReceiptAmount(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddReconReceipt();
                          }
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '100%', height: '40px', justifyContent: 'center' }}
                      onClick={() => handleAddReconReceipt()}
                    >
                      Agregar Recibo
                    </button>
                  </div>

                  {/* Client Info badge if selected */}
                  {reconSelectedClient && (
                    <div style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-app)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.78rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>Cliente: <strong>{reconSelectedClient.name}</strong> (CUIT: {reconSelectedClient.cuit || 'S/D'})</span>
                      <span style={{ color: Number(reconSelectedClient.outstandingBalance) > 0 ? 'var(--accent-color)' : 'var(--color-success)' }}>
                        Saldo CC: <strong>${Number(reconSelectedClient.outstandingBalance).toLocaleString()}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Consolidation & Loaded List (40%) */}
              <div style={{ flex: '1 1 40%', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '4px' }}>
                
                {/* Consolidation Dashboard */}
                <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', backgroundColor: '#fafafa' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>3. Consolidador de Valores (Control en Vivo)</h4>
                  
                  {(() => {
                    const totalCashLoaded = reconReceipts.filter(r => r.paymentMethod === 'CASH').reduce((sum, r) => sum + r.amount, 0);
                    const totalChecksLoaded = reconReceipts.filter(r => r.paymentMethod === 'CHECK').reduce((sum, r) => sum + r.amount, 0);
                    const totalTransfersLoaded = reconReceipts.filter(r => r.paymentMethod === 'BANK_TRANSFER').reduce((sum, r) => sum + r.amount, 0);
                    
                    const cashDiff = Number(reconCashDeclared || 0) - totalCashLoaded;
                    const checkDiff = Number(reconChecksDeclared || 0) - totalChecksLoaded;
                    const transDiff = Number(reconTransfersDeclared || 0) - totalTransfersLoaded;
                    
                    const totalDeclared = Number(reconCashDeclared || 0) + Number(reconChecksDeclared || 0) + Number(reconTransfersDeclared || 0);
                    const totalLoaded = totalCashLoaded + totalChecksLoaded + totalTransfersLoaded;
                    const totalDiff = totalDeclared - totalLoaded;

                    const getDiffStyle = (diff: number) => {
                      if (diff === 0) return { color: 'var(--color-success)', fontWeight: 600 };
                      if (diff < 0) return { color: '#1a73e8', fontWeight: 600 };
                      return { color: 'var(--accent-color)', fontWeight: 600 };
                    };

                    const getStatusBadge = () => {
                      if (totalDiff === 0) {
                        return <span className="badge" style={{ backgroundColor: '#eaf9ee', color: '#137333', fontWeight: 700 }}>✅ Exacto ($0 diff)</span>;
                      }
                      if (totalDiff < 0) {
                        return <span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', fontWeight: 700 }}>📈 Sobrante (+$${Math.abs(totalDiff).toLocaleString()})</span>;
                      }
                      return <span className="badge" style={{ backgroundColor: 'var(--accent-bg-light)', color: 'var(--accent-color)', fontWeight: 700 }}>⚠️ Faltante (-$${totalDiff.toLocaleString()})</span>;
                    };

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                          <span style={{ fontWeight: 600 }}>Tipo de Valor</span>
                          <span style={{ color: 'var(--text-secondary)' }}>Físico vs Cargado</span>
                          <span style={{ fontWeight: 600 }}>Diferencia</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>💵 Efectivo:</span>
                          <span style={{ fontFamily: 'monospace' }}>${Number(reconCashDeclared || 0).toLocaleString()} vs ${totalCashLoaded.toLocaleString()}</span>
                          <span style={getDiffStyle(cashDiff)}>${cashDiff.toLocaleString()}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>✍️ Cheques:</span>
                          <span style={{ fontFamily: 'monospace' }}>${Number(reconChecksDeclared || 0).toLocaleString()} vs ${totalChecksLoaded.toLocaleString()}</span>
                          <span style={getDiffStyle(checkDiff)}>${checkDiff.toLocaleString()}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                          <span>📱 Transferencias:</span>
                          <span style={{ fontFamily: 'monospace' }}>${Number(reconTransfersDeclared || 0).toLocaleString()} vs ${totalTransfersLoaded.toLocaleString()}</span>
                          <span style={getDiffStyle(transDiff)}>${transDiff.toLocaleString()}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Consolidado Total:</span>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>${totalDeclared.toLocaleString()} vs ${totalLoaded.toLocaleString()}</span>
                          {getStatusBadge()}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Receipts List */}
                <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: '220px' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>Recibos Cargados en la Planilla ({reconReceipts.length})</h4>
                  
                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: '280px' }}>
                    {reconReceipts.length === 0 ? (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.78rem', textAlign: 'center', padding: '20px' }}>
                        Aún no cargaste recibos.<br />Usá el cargador de la izquierda para sumar valores.
                      </div>
                    ) : (
                      <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '6px' }}>Cliente</th>
                            <th style={{ padding: '6px' }}>Recibo</th>
                            <th style={{ padding: '6px' }}>Pago</th>
                            <th style={{ padding: '6px', textAlign: 'right' }}>Monto</th>
                            <th style={{ padding: '6px', width: '28px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {reconReceipts.map((rec) => (
                            <tr key={rec.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '6px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rec.personaName}>{rec.personaName}</td>
                              <td style={{ padding: '6px', fontWeight: 600 }}>{rec.receiptNumber}</td>
                              <td style={{ padding: '6px' }}>
                                <span style={{
                                  fontSize: '0.68rem',
                                  backgroundColor: rec.paymentMethod === 'CASH' ? '#eaf9ee' : rec.paymentMethod === 'CHECK' ? '#fff8e1' : '#e8f0fe',
                                  color: rec.paymentMethod === 'CASH' ? '#137333' : rec.paymentMethod === 'CHECK' ? '#b78103' : '#1a73e8',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 600
                                }}>
                                  {rec.paymentMethod === 'CASH' ? 'Efectivo' : rec.paymentMethod === 'CHECK' ? 'Cheque' : 'Transf.'}
                                </span>
                              </td>
                              <td style={{ padding: '6px', fontWeight: 700, textAlign: 'right' }}>${rec.amount.toLocaleString()}</td>
                              <td style={{ padding: '6px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveReconReceipt(rec.id)}
                                  style={{ border: 'none', background: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.9rem', padding: '0 4px' }}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowReconciliationModal(false)} disabled={reconProcessing}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ backgroundColor: '#E30613', borderColor: '#E30613', color: '#ffffff' }}
                disabled={reconProcessing || reconReceipts.length === 0}
                onClick={() => handleProcessReconciliation()}
              >
                {reconProcessing ? 'Procesando Rendición...' : 'Procesar y Confirmar Rendición'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agregar Cuenta Bancaria Modal */}
      {showCreateBankModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Nueva Cuenta Bancaria</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowCreateBankModal(false)}>✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.createBankAccount({
                  name: createBankName,
                  accountNumber: createBankAccountNumber,
                  balance: Number(createBankBalance)
                });
                setSuccessMsg('Cuenta bancaria agregada correctamente.');
                setShowCreateBankModal(false);
                setCreateBankName('');
                setCreateBankAccountNumber('');
                setCreateBankBalance('0');
                fetchData();
              } catch (err: any) {
                setErrorMsg(err.message || 'Error al crear cuenta.');
              }
            }}>
              <div className="form-group">
                <label>Nombre del Banco / Entidad</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Banco Galicia Corriente"
                  required
                  value={createBankName}
                  onChange={(e) => setCreateBankName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Número de Cuenta / CVU</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: CTA-12345/6"
                  value={createBankAccountNumber}
                  onChange={(e) => setCreateBankAccountNumber(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Saldo Inicial ($)</label>
                <input
                  type="number"
                  className="input"
                  value={createBankBalance}
                  onChange={(e) => setCreateBankBalance(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateBankModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear Cuenta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Retiro a Banco Modal */}
      {showTransferModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Depositar Efectivo en Banco</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowTransferModal(false)}>✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.transferFunds(Number(transferAmount), Number(transferBankAccountId), transferDescription);
                setSuccessMsg('Depósito registrado exitosamente.');
                setShowTransferModal(false);
                setTransferAmount('');
                setTransferDescription('');
                fetchData();
              } catch (err: any) {
                setErrorMsg(err.message || 'Error al transferir fondos.');
              }
            }}>
              <div className="form-group">
                <label>Cuenta de Destino</label>
                <select
                  className="select"
                  value={transferBankAccountId}
                  onChange={(e) => setTransferBankAccountId(e.target.value)}
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} (${Number(b.balance).toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Monto a Depositar ($)</label>
                <input
                  type="number"
                  className="input"
                  required
                  placeholder="ej: 50000"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Descripción / Observación</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Depósito por cajero autoservicio"
                  value={transferDescription}
                  onChange={(e) => setTransferDescription(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Depósito</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renderizar PriceListModal */}
      <PriceListModal isOpen={isPriceListModalOpen} onClose={() => setIsPriceListModalOpen(false)} />

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
