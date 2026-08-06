import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { 
  Plus, 
  X, 
  Truck,
  Eye,
  Search,
  UserPlus,
  Edit,
  Trash2
} from 'lucide-react';
import { PurchaseScannerModal } from './PurchaseScannerModal';
import { useConfirm } from '../context/ConfirmContext';

export default function ComprasDashboard() {
  const currentUser = api.getCurrentUser();
  const isAdmin = currentUser?.role === 'ADMIN';
  const confirm = useConfirm();

  // Subpestañas del módulo unificado
  const [activeSubTab, setActiveSubTab] = useState<'ordenes' | 'recepciones' | 'facturas' | 'proveedores'>('ordenes');

  // Listas generales de datos
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<any[]>([]);

  // Filtros
  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplierStartDate, setSupplierStartDate] = useState('');
  const [supplierEndDate, setSupplierEndDate] = useState('');
  const [branchFilter, setBranchFilter] = useState<'ALL' | 'OFFICIAL' | 'INTERNAL'>('ALL');
  const [providerSearch, setProviderSearch] = useState('');

  // Modales de Órdenes
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState<any | null>(null);
  const [viewDetailsModal, setViewDetailsModal] = useState<any | null>(null);
  const [scannerFile, setScannerFile] = useState<File | null>(null);
  const [showScannerModal, setShowScannerModal] = useState(false);

  // Formulario Crear Orden de Compra
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [cart, setCart] = useState<{ productId: number; name: string; sku: string; quantity: number; costPrice: number }[]>([]);
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<any | null>(null);
  const [quantityToAdd, setQuantityToAdd] = useState('10');
  const [costPriceToAdd, setCostPriceToAdd] = useState('');

  // Formulario Recibir Orden de Compra
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lotAssignments, setLotAssignments] = useState<{ [key: number]: { lotNumber: string; expirationDate: string } }>({});

  // Modal para Cargar Factura Manual de Proveedor
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    personaId: '',
    invoiceNumber: '',
    invoiceType: 'FACTURA_A',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
    netAmount: '',
    taxAmount: '',
    percepcionAmount: '',
    percepcionPampa: '',
    percepcionBsAs: '',
    percepcionIva: '',
    percepcionIva5329: '',
    impuestosInternos: '',
    totalAmount: '',
    billingType: 'OFFICIAL'
  });

  // Modal para Crear/Editar Proveedor
  const [providerModal, setProviderModal] = useState<{ open: boolean; mode: 'create' | 'edit'; data: any } | null>(null);

  // Modal para Ver Resumen de Cuenta del Proveedor
  const [accountSummaryModal, setAccountSummaryModal] = useState<any | null>(null);
  const [ledgerData, setLedgerData] = useState<any[]>([]);


  // Feedback states
  const [_loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const orders = await api.getPurchaseOrders();
      setPurchaseOrders(orders);

      const personas = await api.getPersonas('provider', '');
      setProviders(personas.filter((p: any) => p.isActive !== false));

      const allProducts = await api.getProducts('');
      setProducts(allProducts);

      const invoices = await api.getSupplierInvoices({
        startDate: supplierStartDate,
        endDate: supplierEndDate,
        query: supplierQuery
      });
      setSupplierInvoices(invoices);
    } catch (err: any) {
      setErrorMsg('Error al cargar datos del módulo de compras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supplierStartDate, supplierEndDate, supplierQuery]);

  // Limpiar alertas al cambiar de pestaña
  useEffect(() => {
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [activeSubTab]);

  const filteredInvoices = supplierInvoices.filter(inv => {
    if (branchFilter === 'ALL') return true;
    return inv.billingType === branchFilter;
  });

  // --- MÉTRIAS DE COMPRAS Y DEUDAS ---
  const supplierMetrics = useMemo(() => {
    let totalDeuda = 0;
    let vencidasCount = 0;
    let totalVencidas = 0;
    let proximasCount = 0;
    let totalProximas = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date();
    in7Days.setDate(today.getDate() + 7);
    in7Days.setHours(23, 59, 59, 999);

    filteredInvoices.forEach((inv) => {
      if (inv.status === 'PAID') return;

      const total = Number(inv.totalAmount || 0);
      const paid = Number(inv.paidAmount || 0);
      const pending = total - paid;
      totalDeuda += pending;

      if (inv.dueDate) {
        const due = new Date(inv.dueDate);
        if (due < today) {
          vencidasCount++;
          totalVencidas += pending;
        } else if (due >= today && due <= in7Days) {
          proximasCount++;
          totalProximas += pending;
        }
      }
    });

    return { totalDeuda, vencidasCount, totalVencidas, proximasCount, totalProximas };
  }, [filteredInvoices]);

  // --- CARRITO ORDEN DE COMPRA ---
  const handleSelectProduct = (prod: any) => {
    setSelectedProductToAdd(prod);
    setCostPriceToAdd(String(prod.costPrice));
  };

  const handleAddToCart = () => {
    if (!selectedProductToAdd || !quantityToAdd || !costPriceToAdd) return;
    
    const qty = Number(quantityToAdd);
    const cost = Number(costPriceToAdd);

    if (qty <= 0 || cost <= 0) {
      alert('Cantidad y costo deben ser mayores a 0.');
      return;
    }

    const existingIdx = cart.findIndex(i => i.productId === selectedProductToAdd.id);
    if (existingIdx !== -1) {
      const updated = [...cart];
      updated[existingIdx].quantity += qty;
      updated[existingIdx].costPrice = cost;
      setCart(updated);
    } else {
      setCart(prev => [...prev, {
        productId: selectedProductToAdd.id,
        name: selectedProductToAdd.name,
        sku: selectedProductToAdd.sku,
        quantity: qty,
        costPrice: cost
      }]);
    }

    setSelectedProductToAdd(null);
    setQuantityToAdd('10');
    setCostPriceToAdd('');
    setSearchProductQuery('');
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.quantity * item.costPrice), 0);
  }, [cart]);

  // Filtrar productos
  const filteredProductsForAdd = useMemo(() => {
    if (!searchProductQuery) return [];
    const q = searchProductQuery.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [searchProductQuery, products]);

  // Filtrar proveedores en tabla
  const filteredProviders = useMemo(() => {
    if (!providerSearch) return providers;
    const q = providerSearch.toLowerCase();
    return providers.filter(p => p.name.toLowerCase().includes(q) || (p.cuit && p.cuit.includes(q)));
  }, [providerSearch, providers]);

  // --- GUARDAR ORDEN DE COMPRA ---
  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedProviderId) {
      setErrorMsg('Debe seleccionar un proveedor.');
      return;
    }
    if (cart.length === 0) {
      setErrorMsg('El carrito está vacío.');
      return;
    }

    try {
      setLoading(true);
      await api.createPurchaseOrder({
        personaId: Number(selectedProviderId),
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          costPrice: item.costPrice
        }))
      });

      setSuccessMsg('✨ Orden de compra creada con éxito en estado Pendiente.');
      setShowCreateModal(false);
      setSelectedProviderId('');
      setCart([]);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la orden de compra.');
    } finally {
      setLoading(false);
    }
  };

  // --- RECEPCION DE OC ---
  const handleOpenReceiveModal = (order: any) => {
    setInvoiceNumber('');
    const initialAssignments: typeof lotAssignments = {};
    order.items.forEach((item: any) => {
      initialAssignments[item.productId] = {
        lotNumber: `LOTE-PO-${order.id}`,
        expirationDate: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0]
      };
    });
    setLotAssignments(initialAssignments);
    setShowReceiveModal(order);
  };

  const handleLotAssignmentChange = (productId: number, field: 'lotNumber' | 'expirationDate', value: string) => {
    setLotAssignments(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  const handleReceiveOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!showReceiveModal) return;

    try {
      setLoading(true);
      await api.receivePurchaseOrder(showReceiveModal.id, {
        invoiceNumber,
        lotAssignments
      });

      setSuccessMsg(`✨ Orden de compra #${showReceiveModal.id} recibida con éxito. Stock ingresado al depósito.`);
      setShowReceiveModal(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar la recepción de mercadería.');
    } finally {
      setLoading(false);
    }
  };

  // --- FACTURA PROVEEDOR MANUAL ---
  const autoCalculatedTotal = useMemo(() => {
    const net = Number(supplierForm.netAmount) || 0;
    const tax = Number(supplierForm.taxAmount) || 0;
    const pampa = Number(supplierForm.percepcionPampa) || 0;
    const bsas = Number(supplierForm.percepcionBsAs) || 0;
    const iva = Number(supplierForm.percepcionIva) || 0;
    const internos = Number(supplierForm.impuestosInternos) || 0;
    return (net + tax + pampa + bsas + iva + internos).toFixed(2);
  }, [supplierForm.netAmount, supplierForm.taxAmount, supplierForm.percepcionPampa, supplierForm.percepcionBsAs, supplierForm.percepcionIva, supplierForm.impuestosInternos]);

  const handleNetChange = (val: string) => {
    const net = Number(val) || 0;
    const tax = (net * 0.21).toFixed(2);
    const pampa = Number(supplierForm.percepcionPampa) || 0;
    const bsas = Number(supplierForm.percepcionBsAs) || 0;
    const iva = Number(supplierForm.percepcionIva) || 0;
    const internos = Number(supplierForm.impuestosInternos) || 0;
    setSupplierForm(prev => ({
      ...prev,
      netAmount: val,
      taxAmount: tax,
      totalAmount: (net + Number(tax) + pampa + bsas + iva + internos).toFixed(2)
    }));
  };

  const handleCreateSupplierInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const { personaId, invoiceNumber, invoiceType, issueDate, dueDate, netAmount, taxAmount, percepcionPampa, percepcionBsAs, percepcionIva, impuestosInternos, totalAmount, billingType } = supplierForm;

    if (!personaId || !invoiceNumber || !invoiceType || !issueDate || !netAmount || !taxAmount || !totalAmount) {
      setErrorMsg('Por favor complete todos los campos obligatorios.');
      return;
    }

    const pampaVal = Number(percepcionPampa || 0);
    const bsasVal = Number(percepcionBsAs || 0);
    const ivaVal = Number(percepcionIva || 0);
    const internosVal = Number(impuestosInternos || 0);

    const expectedTotal = Number(netAmount) + Number(taxAmount) + pampaVal + bsasVal + ivaVal + internosVal;
    if (Math.abs(Number(totalAmount) - expectedTotal) > 1.00) {
      if (!await confirm(`⚠️ El total ($${totalAmount}) no coincide con Neto + IVA + Percepciones + Imp. Internos ($${expectedTotal.toFixed(2)}). ¿Desea guardar de todas formas?`, { type: 'warning' })) {
        return;
      }
    }

    try {
      setLoading(true);
      await api.createSupplierInvoice({
        personaId: Number(personaId),
        invoiceNumber,
        invoiceType,
        issueDate: new Date(issueDate).toISOString(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : new Date(new Date(issueDate).getTime() + 30 * 24 * 3600 * 1000).toISOString(),
        netAmount: Number(netAmount),
        taxAmount: Number(taxAmount),
        percepcionAmount: pampaVal + bsasVal, // Guardamos la suma en el campo IIBB
        percepcionPampa: pampaVal,
        percepcionBsAs: bsasVal,
        percepcionIva: ivaVal,
        impuestosInternos: internosVal,
        totalAmount: Number(totalAmount),
        billingType: billingType || 'OFFICIAL'
      });

      setSuccessMsg('✅ Factura de compra registrada con éxito en la cuenta corriente del proveedor.');
      setShowSupplierModal(false);
      setSupplierForm({
        personaId: '',
        invoiceNumber: '',
        invoiceType: 'FACTURA_A',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
        netAmount: '',
        taxAmount: '',
        percepcionAmount: '',
        percepcionPampa: '',
        percepcionBsAs: '',
        percepcionIva: '',
        impuestosInternos: '',
        totalAmount: '',
        billingType: 'OFFICIAL'
      });
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la factura de compra.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvoice = async (id: number, invoiceNumber: string) => {
    if (!await confirm(`⚠️ ¿Está seguro que desea eliminar/anular la factura Nro ${invoiceNumber}? \n\nEsta acción es irreversible y revertirá la deuda en la cuenta corriente del proveedor, además de borrar las percepciones de AFIP vinculadas.`, { type: 'danger' })) {
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      await api.deleteSupplierInvoice(id);
      setSuccessMsg('✅ Factura de compra eliminada con éxito y cuenta corriente del proveedor recalculada.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar la factura de compra.');
    } finally {
      setLoading(false);
    }
  };

  // --- CRUD PROVEEDORES ---
  const handleOpenCreateProvider = () => {
    setProviderModal({
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
        paymentTermDays: 30,
        rubro: '',
        contacts: []
      }
    });
  };

  const handleOpenEditProvider = (p: any) => {
    setProviderModal({
      open: true,
      mode: 'edit',
      data: { 
        ...p,
        rubro: p.rubro || '',
        contacts: Array.isArray(p.contacts) ? p.contacts : []
      }
    });
  };

  const handleProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerModal) return;
    const { mode, data } = providerModal;

    if (!data.name) {
      setErrorMsg('El nombre/razón social es obligatorio.');
      return;
    }

    try {
      setLoading(true);
      if (mode === 'create') {
        await api.createPersona({
          ...data,
          isClient: false,
          isProvider: true,
          isSeller: false,
          isCommissionAgent: false
        });
      } else {
        await api.updatePersona(data.id, {
          ...data,
          isClient: false,
          isProvider: true,
          isSeller: false,
          isCommissionAgent: false
        });
      }
      setProviderModal(null);
      setSuccessMsg('✨ Proveedor guardado correctamente.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el proveedor.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProvider = async (id: number, name: string) => {
    if (!await confirm(`⚠️ ¿Está seguro que desea eliminar al proveedor ${name}?\n\nEsta acción no se puede deshacer y solo será posible si el proveedor no tiene órdenes de compra, facturas ni transacciones vinculadas.`, { type: 'danger' })) {
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      await api.deletePersona(id);
      setSuccessMsg('✅ Proveedor eliminado con éxito.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar el proveedor.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAccountSummary = async (p: any) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.getPersonaLedger(p.id);
      setAccountSummaryModal(p);
      setLedgerData(res.ledger);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener el resumen de cuenta.');
    } finally {
      setLoading(false);
    }
  };

  // WhatsApp helper
  const getWhatsAppLink = (phone: any) => {
    if (!phone) return '';
    const cleanPhone = String(phone).replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Alertas de Feedback */}
      {successMsg && (
        <div style={{
          backgroundColor: 'var(--color-success-bg)',
          borderLeft: '4px solid var(--color-success)',
          color: 'var(--text-primary)',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '0.88rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{successMsg}</span>
          <button className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => setSuccessMsg(null)}>✖</button>
        </div>
      )}

      {errorMsg && (
        <div style={{
          backgroundColor: '#FFF2F2',
          borderLeft: '4px solid var(--color-danger)',
          color: 'var(--text-primary)',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '0.88rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{errorMsg}</span>
          <button className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => setErrorMsg(null)}>✖</button>
        </div>
      )}

      {/* Navegación Horizontal de Subpestañas */}
      <div style={{
        display: 'flex',
        gap: '4px',
        backgroundColor: '#EAEAEA',
        padding: '4px',
        borderRadius: '8px',
        width: 'fit-content'
      }}>
        {[
          { id: 'ordenes', label: '📋 Órdenes de Compra' },
          { id: 'recepciones', label: '📦 Recepción e Ingresos' },
          { id: 'facturas', label: '📥 Facturas de Compra' },
          { id: 'proveedores', label: '👥 Fichero de Proveedores' }
        ].map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              className="btn"
              onClick={() => setActiveSubTab(tab.id as any)}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? '#1C1C1E' : '#5E5E62',
                border: 'none',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ====================================================================
          SUB-TAB 1: ÓRDENES DE COMPRA
          ==================================================================== */}
      {activeSubTab === 'ordenes' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="card-title" style={{ margin: '0' }}>📋 Órdenes de Compra a Proveedores</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Control de abastecimiento impositivo y comercial con actualización automática de costos.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <label className="btn" style={{ backgroundColor: 'var(--color-corp-red)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', borderRadius: '8px', height: '38px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>📸 Escanear Factura (IA)</span>
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setScannerFile(e.target.files[0]);
                      setShowScannerModal(true);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ height: '38px' }}>
                <Plus size={16} />
                Nueva Orden de Compra
              </button>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fecha Emisión</th>
                  <th>Proveedor</th>
                  <th>Monto Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center' }}>No hay órdenes de compra registradas.</td></tr>
                ) : (
                  purchaseOrders.map(order => (
                    <tr key={order.id}>
                      <td style={{ fontWeight: 600 }}>#{order.id}</td>
                      <td>{new Date(order.createdAt).toLocaleDateString('es-AR')}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{order.persona?.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CUIT: {order.persona?.cuit}</div>
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        ${Number(order.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: order.status === 'RECEIVED' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                          color: order.status === 'RECEIVED' ? 'var(--color-success)' : 'var(--color-warning)'
                        }}>
                          {order.status === 'PENDING' ? 'Pendiente' : 'Recibida'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => setViewDetailsModal(order)}
                          >
                            <Eye size={12} />
                            Detalles
                          </button>
                          {order.status === 'PENDING' && (
                            <button 
                              className="btn btn-primary"
                              style={{ padding: '4px 8px', fontSize: '0.78rem', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => handleOpenReceiveModal(order)}
                            >
                              <Truck size={12} />
                              Recibir Mercadería
                            </button>
                          )}
                        </div>
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
          SUB-TAB 2: RECEPCIONES E INGRESOS FÍSICOS DE STOCK
          ==================================================================== */}
      {activeSubTab === 'recepciones' && (
        <div className="card">
          <div style={{ marginBottom: '16px' }}>
            <h3 className="card-title" style={{ margin: '0' }}>📦 Auditoría de Ingreso de Mercadería</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Historial detallado de mercancía física recibida con trazabilidad de lotes y fechas de vencimiento.</p>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>OC ID</th>
                  <th>Fecha de Recepción</th>
                  <th>Proveedor</th>
                  <th>Artículos Recibidos</th>
                  <th>Lotes Asignados</th>
                  <th>Estado Físico</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.filter(o => o.status === 'RECEIVED').length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center' }}>No hay ingresos de mercadería registrados.</td></tr>
                ) : (
                  purchaseOrders.filter(o => o.status === 'RECEIVED').map(order => (
                    <tr key={order.id}>
                      <td style={{ fontWeight: 600 }}>#{order.id}</td>
                      <td>{new Date(order.updatedAt || order.createdAt).toLocaleDateString('es-AR')}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{order.persona?.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>CUIT: {order.persona?.cuit}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {order.items?.map((item: any) => (
                            <span key={item.id} style={{ fontSize: '0.78rem' }}>
                              • {item.product?.name}: <strong style={{ color: 'var(--text-primary)' }}>{item.quantity} u.</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {order.items?.map((item: any) => (
                            <span key={item.id} style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                              Lote PO-{order.id} (Vto: {item.expirationDate ? new Date(item.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '6 meses'})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--color-success-bg)',
                          color: 'var(--color-success)'
                        }}>
                          Ingresado a Depósito
                        </span>
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
          SUB-TAB 3: FACTURAS DE COMPRA
          ==================================================================== */}
      {activeSubTab === 'facturas' && (
        <div>
          {/* Tarjetas de Métricas de Deuda Proveedores */}
          {isAdmin && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '20px'
            }}>
              <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Deuda Pendiente Total</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  ${supplierMetrics.totalDeuda.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Monto amortizable con proveedores</span>
              </div>

              <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--color-danger)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-danger)', fontWeight: 600 }}>⚠️ Facturas Vencidas</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-danger)' }}>
                  ${supplierMetrics.totalVencidas.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {supplierMetrics.vencidasCount} {supplierMetrics.vencidasCount === 1 ? 'comprobante vencido' : 'comprobantes vencidos'}
                </span>
              </div>

              <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--color-warning)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.78rem', color: '#B78103', fontWeight: 600 }}>⏳ Próximos Vencimientos (7d)</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#B78103' }}>
                  ${supplierMetrics.totalProximas.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {supplierMetrics.proximasCount} {supplierMetrics.proximasCount === 1 ? 'comprobante por vencer' : 'comprobantes por vencer'}
                </span>
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 className="card-title" style={{ margin: '0' }}>📥 Comprobantes y Facturas de Compra</h3>
                <p style={{ fontSize: '0.8rem', marginTop: '2px' }}>Historial impositivo y contable de compras vinculadas al IVA Crédito Fiscal.</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input 
                    type="text" 
                    placeholder="Buscar factura o proveedor..." 
                    className="input" 
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    value={supplierQuery}
                    onChange={(e) => setSupplierQuery(e.target.value)}
                  />
                  <input 
                    type="date" 
                    className="input" 
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    value={supplierStartDate}
                    onChange={(e) => setSupplierStartDate(e.target.value)}
                  />
                  <input 
                    type="date" 
                    className="input" 
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    value={supplierEndDate}
                    onChange={(e) => setSupplierEndDate(e.target.value)}
                  />
                  <select
                    className="input"
                    style={{ fontSize: '0.8rem', padding: '6px 12px', width: '150px', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value as any)}
                  >
                    <option value="ALL">🏢 Sucursal (Todas)</option>
                    <option value="OFFICIAL">Sucursal A</option>
                    <option value="INTERNAL">Sucursal X</option>
                  </select>
                </div>
                <button className="btn btn-primary" onClick={() => setShowSupplierModal(true)}>
                  <Plus size={16} />
                  Cargar Factura Manual
                </button>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Fecha Emisión</th>
                    <th>Fecha Vto.</th>
                    <th>Tipo</th>
                    <th>Sucursal</th>
                    <th>Nro Comprobante</th>
                    <th>Proveedor</th>
                    <th>Neto Gravado</th>
                    <th>IVA</th>
                    <th>Total Factura</th>
                    <th>Pagado</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr><td colSpan={12} style={{ textAlign: 'center' }}>No se encontraron comprobantes de compra.</td></tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'PAID';
                      return (
                        <tr key={inv.id} style={isOverdue ? { backgroundColor: '#FFF5F5' } : undefined}>
                          <td>{new Date(inv.issueDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</td>
                          <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : 'S/D'}</td>
                          <td style={{ fontWeight: 600 }}>{inv.invoiceType?.replace('_', ' ')}</td>
                          <td>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: inv.billingType === 'OFFICIAL' ? '#E8F5E9' : '#ECEFF1',
                              color: inv.billingType === 'OFFICIAL' ? '#2E7D32' : '#37474F'
                            }}>
                              {inv.billingType === 'OFFICIAL' ? 'Suc. A (Ofi)' : 'Suc. X (Int)'}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{inv.persona?.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>CUIT: {inv.persona?.cuit}</div>
                          </td>
                          <td>${Number(inv.netAmount || 0).toLocaleString('es-AR')}</td>
                          <td>${Number(inv.taxAmount || 0).toLocaleString('es-AR')}</td>
                          <td style={{ fontWeight: 700 }}>${Number(inv.totalAmount || 0).toLocaleString('es-AR')}</td>
                          <td>${Number(inv.paidAmount || 0).toLocaleString('es-AR')}</td>
                          <td>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: inv.status === 'PAID' ? 'var(--color-success-bg)' : isOverdue ? '#FFF0F0' : 'var(--color-warning-bg)',
                              color: inv.status === 'PAID' ? 'var(--color-success)' : isOverdue ? 'var(--color-danger)' : 'var(--color-warning)'
                            }}>
                              {inv.status === 'PAID' ? 'Saldada' : isOverdue ? 'Vencida' : 'Pendiente'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNumber)}
                              className="btn-icon"
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                padding: '4px', 
                                cursor: 'pointer', 
                                color: 'var(--color-danger)',
                                transition: 'color 0.2s',
                              }}
                              title="Anular/Eliminar Factura"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          SUB-TAB 4: FICHERO DE PROVEEDORES
          ==================================================================== */}
      {activeSubTab === 'proveedores' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="card-title" style={{ margin: '0' }}>👥 Fichero de Proveedores</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Administración de cuentas corrientes, datos de facturación y contacto directo de proveedores.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 10px', gap: '6px' }}>
                <Search size={14} className="text-muted" />
                <input 
                  type="text" 
                  placeholder="Buscar CUIT o nombre..." 
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '0.8rem', width: '180px' }}
                />
              </div>
              <button className="btn btn-primary" onClick={handleOpenCreateProvider}>
                <UserPlus size={16} />
                Registrar Proveedor
              </button>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Proveedor / Razón Social</th>
                  <th>Rubro / Marcas Provistas</th>
                  <th>Contactos y Vendedores</th>
                  <th style={{ width: '100px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProviders.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center' }}>No se encontraron proveedores.</td></tr>
                ) : (
                  filteredProviders.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          📍 {p.address ? `${p.address} (${p.city || 'S/D'})` : 'Sin Dirección'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                          {p.cuit ? `CUIT: ${p.cuit}` : 'Sin CUIT'}{p.email ? ` | ✉️ ${p.email}` : ''}
                        </div>
                      </td>
                      <td>
                        {p.rubro ? (
                          <span style={{ 
                            backgroundColor: 'rgba(227, 6, 19, 0.05)', 
                            color: 'var(--color-corp-red)', 
                            padding: '4px 8px', 
                            borderRadius: '6px', 
                            fontSize: '0.78rem',
                            fontWeight: 500,
                            border: '1px solid rgba(227, 6, 19, 0.1)',
                            display: 'inline-block'
                          }}>
                            {p.rubro}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>Sin especificar</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {Array.isArray(p.contacts) && p.contacts.length > 0 ? (
                            p.contacts.map((c: any, idx: number) => (
                              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: '4px 8px', backgroundColor: '#fcfcfc', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>{c.name}</span>
                                  {c.role && <span style={{ fontSize: '0.68rem', fontWeight: 400, color: 'var(--text-muted)', backgroundColor: 'var(--bg-app)', padding: '1px 4px', borderRadius: '4px' }}>{c.role}</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  {c.phone && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      📞 {c.phone}
                                      <a href={getWhatsAppLink(c.phone)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignSelf: 'center' }}>
                                        <svg viewBox="0 0 24 24" width="12" height="12" fill="#25D366">
                                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                                        </svg>
                                      </a>
                                    </span>
                                  )}
                                  {c.email && <span>✉️ {c.email}</span>}
                                </div>
                              </div>
                            ))
                          ) : p.phone || p.email ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {p.phone && (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  📞 {p.phone}
                                  <a href={getWhatsAppLink(p.phone)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignSelf: 'center' }}>
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="#25D366">
                                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                                    </svg>
                                  </a>
                                </span>
                              )}
                              {p.email && <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>✉️ {p.email}</span>}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>Sin datos de contacto</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', width: '100%', justifyContent: 'center' }}
                            onClick={() => handleOpenAccountSummary(p)}
                          >
                            <Eye size={12} />
                            Resumen
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', width: '100%', justifyContent: 'center' }}
                            onClick={() => handleOpenEditProvider(p)}
                          >
                            <Edit size={12} />
                            Editar
                          </button>
                          {isAdmin && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', width: '100%', justifyContent: 'center', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                              onClick={() => handleDeleteProvider(p.id, p.name)}
                            >
                              <Trash2 size={12} />
                              Eliminar
                            </button>
                          )}
                        </div>
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
          MODAL: CREAR ORDEN DE COMPRA
          ==================================================================== */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h3>Registrar Orden de Compra</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleCreateOrderSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
                
                {/* Panel Izquierdo: Selección Proveedor y Búsqueda */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label>Proveedor (Obligatorio)</label>
                    <select
                      className="select"
                      value={selectedProviderId}
                      onChange={(e) => setSelectedProviderId(e.target.value)}
                      required
                    >
                      <option value="">Seleccione proveedor...</option>
                      {providers.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (CUIT: {p.cuit})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ position: 'relative' }}>
                    <label>Buscar Producto a Comprar</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Escriba SKU o Nombre..."
                      value={searchProductQuery}
                      onChange={(e) => setSearchProductQuery(e.target.value)}
                    />
                    
                    {filteredProductsForAdd.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: '65px',
                        backgroundColor: '#fff',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        maxHeight: '150px',
                        overflowY: 'auto',
                        zIndex: 100
                      }}>
                        {filteredProductsForAdd.map(p => (
                          <div 
                            key={p.id}
                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: '0.8rem' }}
                            onClick={() => handleSelectProduct(p)}
                          >
                            <strong>{p.sku}</strong> - {p.name} (Costo actual: ${p.costPrice})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedProductToAdd && (
                    <div style={{ backgroundColor: '#F8F8FA', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px' }}>
                        Añadir: {selectedProductToAdd.name} ({selectedProductToAdd.sku})
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div className="form-group">
                          <label>Cantidad</label>
                          <input 
                            type="number" 
                            className="input" 
                            value={quantityToAdd} 
                            onChange={(e) => setQuantityToAdd(e.target.value)} 
                          />
                        </div>
                        <div className="form-group">
                          <label>Costo Unitario ($)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            className="input" 
                            value={costPriceToAdd} 
                            onChange={(e) => setCostPriceToAdd(e.target.value)} 
                          />
                        </div>
                      </div>

                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ width: '100%', marginTop: '10px', fontSize: '0.8rem' }}
                        onClick={handleAddToCart}
                      >
                        Añadir al Carrito de Compra
                      </button>
                    </div>
                  )}
                </div>

                {/* Panel Derecho: Carrito de Compra */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>
                    Artículos en la Orden
                  </label>
                  <div style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '8px',
                    minHeight: '220px',
                    maxHeight: '260px',
                    overflowY: 'auto'
                  }}>
                    {cart.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
                        No hay artículos agregados todavía.
                      </div>
                    ) : (
                      cart.map(item => (
                        <div 
                          key={item.productId}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 10px',
                            borderBottom: '1px solid #f0f0f0',
                            fontSize: '0.8rem'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{item.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Cant: {item.quantity} u. @ ${item.costPrice}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontWeight: 700 }}>${(item.quantity * item.costPrice).toLocaleString()}</span>
                            <button 
                              type="button" 
                              className="btn btn-ghost" 
                              style={{ padding: '2px', color: 'var(--color-danger)' }}
                              onClick={() => handleRemoveFromCart(item.productId)}
                            >
                              ✖
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {cart.length > 0 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '12px',
                      padding: '8px',
                      backgroundColor: '#F8F8FA',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.95rem'
                    }}>
                      <span>Monto Neto Total:</span>
                      <span style={{ color: 'var(--accent-color)' }}>${cartTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                    </div>
                  )}
                </div>

              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                  disabled={cart.length === 0}
                >
                  Registrar Orden de Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: RECEPCION DE MERCADERIA (CREACION DE LOTES Y COSTEO)
          ==================================================================== */}
      {showReceiveModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Recibir Órden de Compra #{showReceiveModal.id}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowReceiveModal(null)}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleReceiveOrderSubmit}>
              <div className="form-group">
                <label>Número de Factura del Proveedor (Comprobante de Compra)</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="ej: 0005-00045612" 
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  required
                />
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px', backgroundColor: '#F8F8FA', padding: '10px', borderRadius: '6px' }}>
                <strong>⚠️ Información Impositiva:</strong> Se autogenerará una Factura de Compra A en la cuenta corriente del proveedor por el total neto (${showReceiveModal.totalAmount}) + IVA 21%.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Asignación de Lotes en Depósito:</label>
                {showReceiveModal.items.map((item: any) => (
                  <div 
                    key={item.productId}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '12px',
                      backgroundColor: '#fff',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                      {item.product?.name || `Producto ID #${item.productId}`} (Cantidad: {item.quantity} u.)
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label>Nro Lote a Crear / Buscar</label>
                        <input 
                          type="text" 
                          className="input" 
                          value={lotAssignments[item.productId]?.lotNumber || ''} 
                          onChange={(e) => handleLotAssignmentChange(item.productId, 'lotNumber', e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Fecha Vencimiento Lote</label>
                        <input 
                          type="date" 
                          className="input" 
                          value={lotAssignments[item.productId]?.expirationDate || ''} 
                          onChange={(e) => handleLotAssignmentChange(item.productId, 'expirationDate', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReceiveModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                  Confirmar Recepción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: DETALLES DE ORDEN DE COMPRA
          ==================================================================== */}
      {viewDetailsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>Detalles de Orden de Compra #{viewDetailsModal.id}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setViewDetailsModal(null)}><X size={18} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
              <div>
                <strong>Proveedor:</strong> {viewDetailsModal.persona?.name} (CUIT: {viewDetailsModal.persona?.cuit})
              </div>
              <div>
                <strong>Fecha Emisión:</strong> {new Date(viewDetailsModal.createdAt).toLocaleDateString('es-AR')}
              </div>
              <div>
                <strong>Estado:</strong> 
                <span className="badge" style={{ 
                  marginLeft: '6px', 
                  backgroundColor: viewDetailsModal.status === 'RECEIVED' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                  color: viewDetailsModal.status === 'RECEIVED' ? 'var(--color-success)' : 'var(--color-warning)'
                }}>
                  {viewDetailsModal.status === 'PENDING' ? 'Pendiente' : 'Recibida'}
                </span>
              </div>

              <div className="table-container" style={{ borderRadius: '6px' }}>
                <table style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Artículo</th>
                      <th style={{ textAlign: 'right' }}>Cant</th>
                      <th style={{ textAlign: 'right' }}>Costo</th>
                      <th style={{ textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewDetailsModal.items?.map((item: any) => (
                      <tr key={item.id}>
                        <td>{item.product?.name || `Producto ID #${item.productId}`}</td>
                        <td style={{ textAlign: 'right' }}>{item.quantity} u.</td>
                        <td style={{ textAlign: 'right' }}>${Number(item.costPrice).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</td>
                        <td style={{ textAlign: 'right' }}>${Number(item.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#F8F8FA', borderRadius: '6px', fontWeight: 700, fontSize: '0.95rem' }}>
                <span>Total de Compra (Neto):</span>
                <span>${Number(viewDetailsModal.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setViewDetailsModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: INGRESO MANUAL DE FACTURA DE PROVEEDOR
          ==================================================================== */}
      {showSupplierModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Ingresar Factura de Proveedor</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowSupplierModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateSupplierInvoiceSubmit}>
              <div className="form-group">
                <label>Proveedor (Obligatorio)</label>
                <select
                  className="select"
                  value={supplierForm.personaId}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, personaId: e.target.value }))}
                  required
                >
                  <option value="">Seleccione un proveedor...</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (CUIT: {p.cuit})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Tipo Factura</label>
                  <select
                    className="select"
                    value={supplierForm.invoiceType}
                    onChange={(e) => setSupplierForm(prev => ({ ...prev, invoiceType: e.target.value }))}
                  >
                    <option value="FACTURA_A">Factura A</option>
                    <option value="FACTURA_B">Factura B</option>
                    <option value="FACTURA_C">Factura C</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Número Comprobante</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ej: 0001-00012345"
                    value={supplierForm.invoiceNumber}
                    onChange={(e) => setSupplierForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Fecha de Emisión</label>
                  <input
                    type="date"
                    className="input"
                    value={supplierForm.issueDate}
                    onChange={(e) => setSupplierForm(prev => ({ 
                      ...prev, 
                      issueDate: e.target.value,
                      dueDate: new Date(new Date(e.target.value).getTime() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0]
                    }))}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Fecha de Vencimiento</label>
                  <input
                    type="date"
                    className="input"
                    value={supplierForm.dueDate}
                    onChange={(e) => setSupplierForm(prev => ({ ...prev, dueDate: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Destino (Sucursal)</label>
                <select
                  className="select"
                  value={supplierForm.billingType}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, billingType: e.target.value }))}
                >
                  <option value="OFFICIAL">Sucursal A</option>
                  <option value="INTERNAL">Sucursal X</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Costo Neto Gravado ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="0.00"
                    value={supplierForm.netAmount}
                    onChange={(e) => handleNetChange(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>IVA Crédito Fiscal ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="0.00"
                    value={supplierForm.taxAmount}
                    onChange={(e) => setSupplierForm(prev => ({ ...prev, taxAmount: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>IIBB La Pampa ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="0.00"
                    value={supplierForm.percepcionPampa}
                    onChange={(e) => setSupplierForm(prev => ({ 
                      ...prev, 
                      percepcionPampa: e.target.value,
                      totalAmount: (Number(supplierForm.netAmount || 0) + Number(supplierForm.taxAmount || 0) + Number(e.target.value) + Number(prev.percepcionBsAs || 0) + Number(prev.percepcionIva || 0) + Number(prev.impuestosInternos || 0)).toFixed(2)
                    }))}
                  />
                </div>
                <div className="form-group">
                  <label>Percepcion IIBB Bs As ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="0.00"
                    value={supplierForm.percepcionBsAs}
                    onChange={(e) => setSupplierForm(prev => ({ 
                      ...prev, 
                      percepcionBsAs: e.target.value,
                      totalAmount: (Number(supplierForm.netAmount || 0) + Number(supplierForm.taxAmount || 0) + Number(prev.percepcionPampa || 0) + Number(e.target.value) + Number(prev.percepcionIva || 0) + Number(prev.impuestosInternos || 0)).toFixed(2)
                    }))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Percepción IVA RG 3337 ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="0.00"
                    value={supplierForm.percepcionIva}
                    onChange={(e) => setSupplierForm(prev => ({ 
                      ...prev, 
                      percepcionIva: e.target.value,
                      totalAmount: (Number(supplierForm.netAmount || 0) + Number(supplierForm.taxAmount || 0) + Number(prev.percepcionPampa || 0) + Number(prev.percepcionBsAs || 0) + Number(e.target.value) + Number(prev.percepcionIva5329 || 0) + Number(prev.impuestosInternos || 0)).toFixed(2)
                    }))}
                  />
                </div>
                <div className="form-group">
                  <label>Percepción IVA RG 5329 ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="0.00"
                    value={supplierForm.percepcionIva5329}
                    onChange={(e) => setSupplierForm(prev => ({ 
                      ...prev, 
                      percepcionIva5329: e.target.value,
                      totalAmount: (Number(supplierForm.netAmount || 0) + Number(supplierForm.taxAmount || 0) + Number(prev.percepcionPampa || 0) + Number(prev.percepcionBsAs || 0) + Number(prev.percepcionIva || 0) + Number(e.target.value) + Number(prev.impuestosInternos || 0)).toFixed(2)
                    }))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Impuestos Internos ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="0.00"
                    value={supplierForm.impuestosInternos}
                    onChange={(e) => setSupplierForm(prev => ({ 
                      ...prev, 
                      impuestosInternos: e.target.value,
                      totalAmount: (Number(supplierForm.netAmount || 0) + Number(supplierForm.taxAmount || 0) + Number(prev.percepcionPampa || 0) + Number(prev.percepcionBsAs || 0) + Number(prev.percepcionIva || 0) + Number(prev.percepcionIva5329 || 0) + Number(e.target.value)).toFixed(2)
                    }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Total Factura ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder={autoCalculatedTotal}
                  value={supplierForm.totalAmount}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, totalAmount: e.target.value }))}
                  required
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Suma Neto+IVA+Perc+Imp.Int: <span style={{ fontWeight: 600 }}>${autoCalculatedTotal}</span>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSupplierModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>Registrar Compra</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: REGISTRAR / EDITAR PROVEEDOR
          ==================================================================== */}
      {providerModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{providerModal.mode === 'create' ? 'Registrar Nuevo Proveedor' : 'Editar Proveedor'}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setProviderModal(null)}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleProviderSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Razón Social / Nombre Comercial (Obligatorio)</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="ej: Distribuidora Alimentos S.A." 
                    value={providerModal.data.name || ''} 
                    onChange={(e) => setProviderModal(prev => prev ? { ...prev, data: { ...prev.data, name: e.target.value } } : null)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Rubro / Marcas que Provee</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="ej: Aceites Natura" 
                    value={providerModal.data.rubro || ''} 
                    onChange={(e) => setProviderModal(prev => prev ? { ...prev, data: { ...prev.data, rubro: e.target.value } } : null)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>CUIT (Sin guiones)</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="ej: 30712345678" 
                    value={providerModal.data.cuit || ''} 
                    onChange={(e) => setProviderModal(prev => prev ? { ...prev, data: { ...prev.data, cuit: e.target.value } } : null)}
                  />
                </div>
                <div className="form-group">
                  <label>Teléfono Principal</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="ej: 1150607080" 
                    value={providerModal.data.phone || ''} 
                    onChange={(e) => setProviderModal(prev => prev ? { ...prev, data: { ...prev.data, phone: e.target.value } } : null)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Correo Electrónico Principal</label>
                  <input 
                    type="email" 
                    className="input" 
                    placeholder="ej: administracion@proveedor.com" 
                    value={providerModal.data.email || ''} 
                    onChange={(e) => setProviderModal(prev => prev ? { ...prev, data: { ...prev.data, email: e.target.value } } : null)}
                  />
                </div>
                <div className="form-group">
                  <label>Plazo Pago (Días)</label>
                  <input 
                    type="number" 
                    className="input" 
                    placeholder="ej: 30" 
                    value={providerModal.data.paymentTermDays ?? 30} 
                    onChange={(e) => setProviderModal(prev => prev ? { ...prev, data: { ...prev.data, paymentTermDays: Number(e.target.value) } } : null)}
                    min={0}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Dirección Comercial</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="ej: Av. Rivadavia 1234" 
                    value={providerModal.data.address || ''} 
                    onChange={(e) => setProviderModal(prev => prev ? { ...prev, data: { ...prev.data, address: e.target.value } } : null)}
                  />
                </div>
                <div className="form-group">
                  <label>Localidad / Ciudad</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="ej: CABA" 
                    value={providerModal.data.city || ''} 
                    onChange={(e) => setProviderModal(prev => prev ? { ...prev, data: { ...prev.data, city: e.target.value } } : null)}
                  />
                </div>
              </div>

              {/* Subformulario y Gestión de Contactos Adicionales */}
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>👥 Contactos Adicionales (Vendedores, Cobros, etc.)</h4>
                
                {/* Lista de contactos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {(!providerModal.data.contacts || providerModal.data.contacts.length === 0) ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                      No hay contactos adicionales cargados.
                    </div>
                  ) : (
                    providerModal.data.contacts.map((c: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                          <strong>{c.name}</strong> {c.role ? `(${c.role})` : ''} {c.phone ? ` - 📞 ${c.phone}` : ''} {c.email ? ` - ✉️ ${c.email}` : ''}
                        </div>
                        <button 
                          type="button" 
                          className="btn btn-ghost text-danger" 
                          style={{ padding: '2px 6px', fontSize: '0.8rem', cursor: 'pointer' }}
                          onClick={() => {
                            const newContacts = [...providerModal.data.contacts];
                            newContacts.splice(idx, 1);
                            setProviderModal({
                              ...providerModal,
                              data: { ...providerModal.data, contacts: newContacts }
                            });
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Agregar contacto */}
                <div style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                  <h5 style={{ margin: '0 0 8px 0', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>Agregar Contacto</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <input 
                      type="text" 
                      id="new-contact-name"
                      placeholder="Nombre (ej: Juan Pérez)" 
                      className="input" 
                      style={{ fontSize: '0.78rem', padding: '4px 8px', height: '30px' }}
                    />
                    <input 
                      type="text" 
                      id="new-contact-role"
                      placeholder="Rol (ej: Vendedor, Pagos)" 
                      className="input" 
                      style={{ fontSize: '0.78rem', padding: '4px 8px', height: '30px' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <input 
                      type="text" 
                      id="new-contact-phone"
                      placeholder="Teléfono" 
                      className="input" 
                      style={{ fontSize: '0.78rem', padding: '4px 8px', height: '30px' }}
                    />
                    <input 
                      type="email" 
                      id="new-contact-email"
                      placeholder="Email" 
                      className="input" 
                      style={{ fontSize: '0.78rem', padding: '4px 8px', height: '30px' }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.76rem', height: '28px', display: 'block', marginLeft: 'auto', border: '1px solid var(--border-color)', backgroundColor: '#fff', cursor: 'pointer' }}
                    onClick={() => {
                      const nameInput = document.getElementById('new-contact-name') as HTMLInputElement;
                      const roleInput = document.getElementById('new-contact-role') as HTMLInputElement;
                      const phoneInput = document.getElementById('new-contact-phone') as HTMLInputElement;
                      const emailInput = document.getElementById('new-contact-email') as HTMLInputElement;

                      if (!nameInput || !nameInput.value.trim()) {
                        alert('El nombre del contacto es obligatorio.');
                        return;
                      }

                      const newC = {
                        name: nameInput.value.trim(),
                        role: roleInput.value.trim(),
                        phone: phoneInput.value.trim(),
                        email: emailInput.value.trim()
                      };

                      const currentContacts = providerModal.data.contacts || [];
                      setProviderModal({
                        ...providerModal,
                        data: {
                          ...providerModal.data,
                          contacts: [...currentContacts, newC]
                        }
                      });

                      // Limpiar inputs
                      nameInput.value = '';
                      roleInput.value = '';
                      phoneInput.value = '';
                      emailInput.value = '';
                    }}
                  >
                    + Añadir a la lista
                  </button>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setProviderModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                  Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Escáner de Facturas (IA) */}
      <PurchaseScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        file={scannerFile}
        onSuccess={() => {
          setSuccessMsg('✨ Documento procesado correctamente e inyectado en el stock y las facturas.');
          loadData();
        }}
      />

      {/* ====================================================================
          MODAL: RESUMEN DE CUENTA PROVEEDOR
          ==================================================================== */}
      {accountSummaryModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Resumen de Cuenta: {accountSummaryModal.name}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setAccountSummaryModal(null)}><X size={18} /></button>
            </div>
            
            <div style={{ marginBottom: '16px', display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1, backgroundColor: '#F8F8FA', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Deuda Pendiente</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  ${Number(accountSummaryModal.outstandingBalance || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Referencia</th>
                    <th>Descripción</th>
                    <th style={{ textAlign: 'right' }}>Debe</th>
                    <th style={{ textAlign: 'right' }}>Haber</th>
                    <th style={{ textAlign: 'right' }}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center' }}>No hay movimientos registrados.</td></tr>
                  ) : (
                    ledgerData.map((item, index) => (
                      <tr key={index}>
                        <td>{new Date(item.date).toLocaleDateString('es-AR')}</td>
                        <td>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: item.type === 'DEBIT' ? '#FFF0F0' : '#E8F5E9',
                            color: item.type === 'DEBIT' ? 'var(--color-danger)' : '#2E7D32'
                          }}>
                            {item.type === 'DEBIT' ? 'Cargo' : 'Crédito'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', fontWeight: 500 }}>{item.reference}</td>
                        <td style={{ fontSize: '0.8rem' }}>{item.description}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-danger)' }}>
                          {item.type === 'DEBIT' ? `$${Number(item.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : ''}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#2E7D32' }}>
                          {item.type === 'CREDIT' ? `$${Number(item.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : ''}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          ${Number(item.balance).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-footer" style={{ marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setAccountSummaryModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
