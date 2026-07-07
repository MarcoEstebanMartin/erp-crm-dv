import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../utils/api';
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  Printer, 
  CheckCircle,
  X
} from 'lucide-react';

interface BillingDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function BillingDashboard({ activeTab: _activeTab, setActiveTab: _setActiveTab }: BillingDashboardProps) {
  const currentUser = api.getCurrentUser();
  const isAdmin = currentUser?.role === 'ADMIN';

  // Sub-pestañas del módulo de facturación
  const [activeSubTab, setActiveSubTab] = useState<'ventas' | 'compras' | 'percepciones' | 'retenciones' | 'libro-ventas' | 'libro-compras' | 'notas-credito'>('ventas');

  // Listas de datos
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<any[]>([]);
  const [taxWithholdings, setTaxWithholdings] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);

  // Estados para Notas de Crédito
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [viewCreditNoteModal, setViewCreditNoteModal] = useState<any | null>(null);
  const [clientOrders, setClientOrders] = useState<any[]>([]);
  const [creditNoteForm, setCreditNoteForm] = useState({
    personaId: '',
    orderId: '',
    billingType: 'INTERNAL',
    reason: 'DEVOLUCION',
    comments: ''
  });
  const [creditNoteCart, setCreditNoteCart] = useState<any[]>([]);
  const [selectedCNProduct, setSelectedCNProduct] = useState('');
  const [cnProductQty, setCnProductQty] = useState('1');
  const [cnProductPrice, setCnProductPrice] = useState('');
  const [cnClientSearchQuery, setCnClientSearchQuery] = useState('');
  const [showCNClientDropdown, setShowCNClientDropdown] = useState(false);
  const [activeCNClientSuggestionIdx, setActiveCNClientSuggestionIdx] = useState(0);
  const [cnProductSearchQuery, setCnProductSearchQuery] = useState('');
  const [showCNProductDropdown, setShowCNProductDropdown] = useState(false);
  const [activeCNProductSuggestionIdx, setActiveCNProductSuggestionIdx] = useState(0);

  // Filtrar personas
  const providersOnly = useMemo(() => {
    return personas.filter(p => p.isProvider);
  }, [personas]);

  const clientsOnly = useMemo(() => {
    return personas.filter(p => p.isClient);
  }, [personas]);

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

    supplierInvoices.forEach((inv) => {
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
  }, [supplierInvoices]);

  // Estados para facturación directa
  const [showDirectInvoiceModal, setShowDirectInvoiceModal] = useState(false);
  const [directInvoiceForm, setDirectInvoiceForm] = useState({
    personaId: '',
    billingType: 'INTERNAL',
    immediatePayment: false,
    paymentMethod: 'CASH',
    cashDrawerId: '',
    checkNumber: '',
    checkIssuer: '',
    isEcheq: false
  });
  const [directCart, setDirectCart] = useState<any[]>([]);
  const [selectedDirectProduct, setSelectedDirectProduct] = useState('');
  const [directProductQty, setDirectProductQty] = useState('1');
  
  // Soporte de cajas múltiples y buscadores inteligentes
  const [activeDrawers, setActiveDrawers] = useState<any[]>([]);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [activeProductSuggestionIdx, setActiveProductSuggestionIdx] = useState<number>(0);

  const productSearchInputRef = useRef<HTMLInputElement>(null);
  const productQtyInputRef = useRef<HTMLInputElement>(null);

  const [activeClientSuggestionIdx, setActiveClientSuggestionIdx] = useState<number>(0);
  const clientSearchInputRef = useRef<HTMLInputElement>(null);

  // Filtros
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [salesInvoiceTypeFilter, setSalesInvoiceTypeFilter] = useState<'ALL' | 'OFFICIAL' | 'INTERNAL'>('ALL');

  // Modales
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showWithholdingModal, setShowWithholdingModal] = useState(false);
  const [viewInvoiceModal, setViewInvoiceModal] = useState<any | null>(null);

  // Estados para Registro de Pagos a Proveedores
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; invoice: any } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<any>('CASH');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('X');

  // Estados de formularios
  const [supplierForm, setSupplierForm] = useState({
    personaId: '',
    invoiceNumber: '',
    invoiceType: 'FACTURA_A',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
    netAmount: '',
    taxAmount: '',
    percepcionAmount: '',
    totalAmount: ''
  });

  const [withholdingForm, setWithholdingForm] = useState({
    type: 'RETENCION_SUFRIDA',
    taxType: 'IIBB',
    personaId: '',
    number: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    jurisdiction: 'AR-B'
  });

  // Mensajes de feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Cargar datos
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Cargar personas para los selectores de los formularios (Clientes y Proveedores)
      const allPersonas = await api.getPersonas('ALL', '');
      setPersonas(allPersonas);

      // Cargar productos para facturación directa
      const allProducts = await api.getProducts('');
      setProducts(allProducts);

      // Cargar cajas operativas activas
      try {
        const activeList = await api.getActiveDrawers();
        setActiveDrawers(activeList);
      } catch (drawerErr) {
        setActiveDrawers([]);
      }

      // 2. Cargar datos según la sub-tab activa
      const filters: any = {};
      if (startDate && endDate) {
        filters.startDate = startDate;
        filters.endDate = endDate;
      }
      if (query) {
        filters.query = query;
      }

      if (activeSubTab === 'ventas') {
        const data = await api.getSalesInvoices(filters);
        setSalesInvoices(data);
      } else if (activeSubTab === 'compras') {
        const data = await api.getSupplierInvoices(filters);
        setSupplierInvoices(data);
      } else if (activeSubTab === 'percepciones') {
        const data = await api.getTaxWithholdings(filters);
        // Filtrar percepciones sufridas y practicadas
        const perceptions = data.filter((w: any) => w.type.startsWith('PERCEPCION_'));
        setTaxWithholdings(perceptions);
      } else if (activeSubTab === 'retenciones') {
        const data = await api.getTaxWithholdings(filters);
        // Filtrar retenciones sufridas y practicadas
        const retenciones = data.filter((w: any) => w.type.startsWith('RETENCION_'));
        setTaxWithholdings(retenciones);

      } else if (activeSubTab === 'notas-credito') {
        const data = await api.getCreditNotes(filters);
        setCreditNotes(data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar los comprobantes e impuestos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeSubTab, startDate, endDate, query]);

  // Limpiar mensajes al cambiar de pestaña
  useEffect(() => {
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [activeSubTab]);

  // Limpiar filtros
  const handleClearFilters = () => {
    setQuery('');
    setStartDate('');
    setEndDate('');
    setSalesInvoiceTypeFilter('ALL');
  };

  // --- EFECTO PARA CLIENTE PRESELECCIONADO ---
  useEffect(() => {
    const preselected = localStorage.getItem('preselected_billing_client');
    if (preselected) {
      if (preselected === 'direct') {
        localStorage.removeItem('preselected_billing_client');
        setClientSearchQuery('');
        setDirectInvoiceForm(prev => ({
          ...prev,
          personaId: ''
        }));
        setShowDirectInvoiceModal(true);
      } else if (personas.length > 0) {
        localStorage.removeItem('preselected_billing_client');
        const found = personas.find(p => p.id === Number(preselected));
        if (found) {
          setClientSearchQuery(found.name);
        }
        setDirectInvoiceForm(prev => ({
          ...prev,
          personaId: preselected
        }));
        setShowDirectInvoiceModal(true);
      }
    }
  }, [personas]);

  // --- EFECTO PARA REFRESCAR CAJAS AL ABRIR MODAL ---
  useEffect(() => {
    if (showDirectInvoiceModal) {
      api.getActiveDrawers()
        .then(list => setActiveDrawers(list || []))
        .catch(() => setActiveDrawers([]));
    }
  }, [showDirectInvoiceModal]);

  // --- SELECCIONAR CLIENTE ACTIVO ---
  const selectedDirectClient = useMemo(() => {
    return personas.find(p => p.id === Number(directInvoiceForm.personaId));
  }, [personas, directInvoiceForm.personaId]);

  // --- AUTOCOMPLETADO DE CLIENTES ---
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery || (selectedDirectClient && selectedDirectClient.name === clientSearchQuery)) {
      return [];
    }
    const q = clientSearchQuery.toLowerCase();
    return clientsOnly.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.cuit && c.cuit.replace(/-/g, '').includes(q))
    ).slice(0, 10);
  }, [clientSearchQuery, clientsOnly, selectedDirectClient]);

  // --- AUTOCOMPLETADO DE PRODUCTOS ---
  const filteredProductsSuggestions = useMemo(() => {
    const selectedProd = products.find(p => p.id === Number(selectedDirectProduct));
    if (!productSearchQuery || (selectedProd && selectedProd.name === productSearchQuery)) {
      return [];
    }
    const q = productSearchQuery.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [productSearchQuery, products, selectedDirectProduct]);

  useEffect(() => {
    setActiveProductSuggestionIdx(0);
  }, [productSearchQuery]);

  useEffect(() => {
    setActiveClientSuggestionIdx(0);
  }, [clientSearchQuery]);

  // --- CLIENTE ACTIVO EN NOTA DE CREDITO ---
  const selectedCNClient = useMemo(() => {
    return personas.find(p => p.id === Number(creditNoteForm.personaId));
  }, [personas, creditNoteForm.personaId]);

  // --- AUTOCOMPLETADO DE CLIENTES EN NOTA DE CREDITO ---
  const filteredCNClients = useMemo(() => {
    if (!cnClientSearchQuery || (selectedCNClient && selectedCNClient.name === cnClientSearchQuery)) {
      return [];
    }
    const q = cnClientSearchQuery.toLowerCase();
    return clientsOnly.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.cuit && c.cuit.replace(/-/g, '').includes(q))
    ).slice(0, 10);
  }, [cnClientSearchQuery, clientsOnly, selectedCNClient]);

  // --- AUTOCOMPLETADO DE PRODUCTOS EN NOTA DE CREDITO ---
  const filteredCNProductsSuggestions = useMemo(() => {
    const selectedProd = products.find(p => p.id === Number(selectedCNProduct));
    if (!cnProductSearchQuery || (selectedProd && selectedProd.name === cnProductSearchQuery)) {
      return [];
    }
    const q = cnProductSearchQuery.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [cnProductSearchQuery, products, selectedCNProduct]);

  useEffect(() => {
    setActiveCNProductSuggestionIdx(0);
  }, [cnProductSearchQuery]);

  useEffect(() => {
    setActiveCNClientSuggestionIdx(0);
  }, [cnClientSearchQuery]);

  const handleSelectCNClient = async (client: any) => {
    setCnClientSearchQuery(client.name);
    setCreditNoteForm(prev => ({
      ...prev,
      personaId: String(client.id),
      orderId: '',
      billingType: client.cuit ? 'OFFICIAL' : 'INTERNAL'
    }));
    setShowCNClientDropdown(false);
    
    try {
      setLoading(true);
      const orders = await api.getOrders(undefined, 'DELIVERED');
      const filtered = orders.filter((o: any) => o.personaId === client.id || o.clientId === client.id);
      setClientOrders(filtered);
    } catch (err) {
      console.error('Error fetching client orders:', err);
      setClientOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCNOrder = (orderIdStr: string) => {
    setCreditNoteForm(prev => ({
      ...prev,
      orderId: orderIdStr
    }));

    if (!orderIdStr) {
      setCreditNoteCart([]);
      return;
    }

    const order = clientOrders.find(o => o.id === Number(orderIdStr));
    if (order && order.items) {
      const itemsToDev = order.items.map((item: any) => {
        const prod = products.find(p => p.id === item.productId);
        const qty = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        return {
          productId: item.productId,
          name: prod ? prod.name : (item.product ? item.product.name : `Producto #${item.productId}`),
          sku: prod ? prod.sku : (item.product ? item.product.sku : ''),
          orderQuantity: qty,
          quantity: qty, // Precompletar con cantidad completa original
          unitPrice: unitPrice,
          subtotal: qty * unitPrice
        };
      });
      setCreditNoteCart(itemsToDev);
    }
  };

  const handleAddCNItemManual = () => {
    const prod = products.find(p => p.id === Number(selectedCNProduct));
    if (!prod) return;

    const qty = Number(cnProductQty);
    const price = Number(cnProductPrice || prod.listPrice || 0);

    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('La cantidad debe ser mayor a cero.');
      return;
    }
    if (isNaN(price) || price < 0) {
      setErrorMsg('El precio no puede ser negativo.');
      return;
    }

    const existingIdx = creditNoteCart.findIndex(item => item.productId === prod.id);
    if (existingIdx !== -1) {
      const updated = [...creditNoteCart];
      updated[existingIdx].quantity += qty;
      updated[existingIdx].subtotal = updated[existingIdx].quantity * updated[existingIdx].unitPrice;
      setCreditNoteCart(updated);
    } else {
      setCreditNoteCart(prev => [...prev, {
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        orderQuantity: null,
        quantity: qty,
        unitPrice: price,
        subtotal: qty * price
      }]);
    }

    setSelectedCNProduct('');
    setCnProductSearchQuery('');
    setCnProductQty('1');
    setCnProductPrice('');
  };

  const handleCreateCreditNoteFromInvoice = async (invoice: any) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    
    const pId = invoice.personaId || invoice.clientId;
    const client = personas.find((p: any) => p.id === Number(pId));
    if (!client) {
      setErrorMsg('No se encontró el cliente de la factura.');
      return;
    }

    setCnClientSearchQuery(client.name);
    
    try {
      setLoading(true);
      // Fetch para poblar el dropdown de órdenes del cliente en el modal
      const orders = await api.getOrders(undefined, 'DELIVERED');
      const filtered = orders.filter((o: any) => o.personaId === client.id || o.clientId === client.id);
      setClientOrders(filtered);
      
      setCreditNoteForm({
        personaId: String(client.id),
        orderId: String(invoice.id),
        billingType: invoice.billingType || (client.cuit ? 'OFFICIAL' : 'INTERNAL'),
        reason: 'DEVOLUCION',
        comments: `Devolución de comprobante #${invoice.invoiceNumber || invoice.id}`
      });

      // Si la factura tiene items (los cargamos en el query del backend), los usamos
      if (invoice.items && invoice.items.length > 0) {
        const itemsToDev = invoice.items.map((item: any) => {
          const prod = products.find(p => p.id === item.productId);
          const qty = Number(item.quantity);
          const unitPrice = Number(item.unitPrice);
          return {
            productId: item.productId,
            name: prod ? prod.name : (item.product ? item.product.name : `Producto #${item.productId}`),
            sku: prod ? prod.sku : (item.product ? item.product.sku : ''),
            orderQuantity: qty,
            quantity: qty, // Devolución total por defecto
            unitPrice: unitPrice,
            subtotal: qty * unitPrice
          };
        });
        setCreditNoteCart(itemsToDev);
      } else {
        // En caso de contingencia, buscamos la orden del listado fetched
        const matchedOrder = filtered.find((o: any) => o.id === invoice.id);
        if (matchedOrder && matchedOrder.items) {
          const itemsToDev = matchedOrder.items.map((item: any) => {
            const prod = products.find(p => p.id === item.productId);
            const qty = Number(item.quantity);
            const unitPrice = Number(item.unitPrice);
            return {
              productId: item.productId,
              name: prod ? prod.name : (item.product ? item.product.name : `Producto #${item.productId}`),
              sku: prod ? prod.sku : (item.product ? item.product.sku : ''),
              orderQuantity: qty,
              quantity: qty,
              unitPrice: unitPrice,
              subtotal: qty * unitPrice
            };
          });
          setCreditNoteCart(itemsToDev);
        } else {
          setCreditNoteCart([]);
        }
      }
      
      setShowCreditNoteModal(true);
    } catch (err: any) {
      console.error('Error al preparar nota de crédito desde factura:', err);
      setErrorMsg('Error al preparar nota de crédito: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCreditNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!creditNoteForm.personaId) {
      setErrorMsg('Debe seleccionar un cliente.');
      return;
    }

    const itemsToSend = creditNoteCart.filter(item => item.quantity > 0);
    if (itemsToSend.length === 0) {
      setErrorMsg('Debe agregar al menos un producto con cantidad a devolver/bonificar.');
      return;
    }

    if (creditNoteForm.orderId) {
      for (const item of itemsToSend) {
        if (item.quantity > item.orderQuantity) {
          setErrorMsg(`La cantidad a devolver de ${item.name} (${item.quantity}) no puede superar la cantidad original (${item.orderQuantity}).`);
          return;
        }
      }
    }

    try {
      setLoading(true);
      const payload = {
        personaId: Number(creditNoteForm.personaId),
        orderId: creditNoteForm.orderId ? Number(creditNoteForm.orderId) : null,
        billingType: creditNoteForm.billingType,
        reason: creditNoteForm.reason,
        comments: creditNoteForm.comments,
        items: itemsToSend.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      };

      const result = await api.createCreditNote(payload);
      setSuccessMsg(`Nota de Crédito emitida correctamente (#${result.creditNoteNumber || result.id})`);
      
      setShowCreditNoteModal(false);
      setCreditNoteCart([]);
      setCreditNoteForm({
        personaId: '',
        orderId: '',
        billingType: 'INTERNAL',
        reason: 'DEVOLUCION',
        comments: ''
      });
      setCnClientSearchQuery('');
      setCnProductSearchQuery('');
      loadData();
      
      setViewCreditNoteModal(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al emitir la Nota de Crédito.');
    } finally {
      setLoading(false);
    }
  };

  // --- TOTALES FACTURA DIRECTA ---
  const directBillingTotals = useMemo(() => {
    let subtotalSum = directCart.reduce((sum, item) => sum + item.subtotal, 0);
    let net = subtotalSum;
    let tax = 0;
    let percepcion = 0;
    let total = subtotalSum;

    if (directInvoiceForm.billingType === 'OFFICIAL') {
      net = subtotalSum / 1.21;
      tax = subtotalSum - net;

      const isFacturaA = selectedDirectClient && selectedDirectClient.cuit && selectedDirectClient.cuit.replace(/-/g, '').length === 11;
      if (isFacturaA) {
        const iibbAliquot = Number(selectedDirectClient.iibbAliquot || 0);
        if (iibbAliquot > 0) {
          net = subtotalSum / (1.21 + (iibbAliquot / 100));
          tax = net * 0.21;
          percepcion = net * (iibbAliquot / 100);
        }
      }
    } else {
      net = subtotalSum;
      tax = 0;
      percepcion = 0;
    }

    return {
      net: Number(net.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      percepcion: Number(percepcion.toFixed(2)),
      total: Number(total.toFixed(2))
    };
  }, [directCart, directInvoiceForm.billingType, selectedDirectClient]);

  // --- MANEJADORES DE SELECCION ---
  const handleSelectClient = (c: any) => {
    setDirectInvoiceForm(prev => ({ ...prev, personaId: String(c.id) }));
    setClientSearchQuery(c.name);
    setShowClientDropdown(false);
    setDirectCart([]); // limpiar detalle al cambiar de cliente
    setTimeout(() => {
      productSearchInputRef.current?.focus();
    }, 50);
  };

  const handleSelectProduct = (p: any) => {
    setSelectedDirectProduct(String(p.id));
    setProductSearchQuery(p.name);
    setShowProductDropdown(false);
  };

  // --- AGREGAR PRODUCTO AL DETALLE ---
  const handleAddDirectProduct = () => {
    if (!selectedDirectProduct) return;
    const prod = products.find(p => p.id === Number(selectedDirectProduct));
    if (!prod) return;

    const qty = Number(directProductQty);
    if (isNaN(qty) || qty <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    const existingIdx = directCart.findIndex(item => item.product.id === prod.id);

    let selectedPrice = Number(prod.listPrice);
    let itemDiscount = Number(selectedDirectClient?.discount || 0);

    if (selectedDirectClient) {
      if (selectedDirectClient.priceList === 'B') {
        selectedPrice = Number(prod.listPriceB) > 0 ? Number(prod.listPriceB) : Number(prod.listPrice);
        const isMelincue = prod.description?.toUpperCase() === 'MELINCUE' || prod.name?.toUpperCase().includes('MELINCUE');
        if (isMelincue) {
          itemDiscount = 3;
        } else {
          itemDiscount = 0;
        }
      } else if (selectedDirectClient.priceList === 'C') {
        selectedPrice = Number(prod.listPriceC) > 0 ? Number(prod.listPriceC) : Number(prod.listPrice);
      }
    }

    const finalUnitPrice = selectedPrice * (1 - itemDiscount / 100);

    if (existingIdx !== -1) {
      const newQty = directCart[existingIdx].quantity + qty;

      const newCart = [...directCart];
      newCart[existingIdx].quantity = newQty;
      newCart[existingIdx].weight = prod.isPesable ? (newCart[existingIdx].weight || (newQty * (prod.approximateWeight || 1))) : null;
      newCart[existingIdx].subtotal = Number((finalUnitPrice * (prod.isPesable ? newCart[existingIdx].weight : newQty)).toFixed(2));
      setDirectCart(newCart);
    } else {
      setDirectCart(prev => [
        ...prev,
        {
          product: prod,
          quantity: qty,
          weight: prod.isPesable ? (qty * (prod.approximateWeight || 1)) : null,
          unitPrice: finalUnitPrice,
          subtotal: Number((finalUnitPrice * (prod.isPesable ? (qty * (prod.approximateWeight || 1)) : qty)).toFixed(2))
        }
      ]);
    }

    setSelectedDirectProduct('');
    setProductSearchQuery('');
    setDirectProductQty('1');
  };

  // --- REMOVER PRODUCTO DEL DETALLE ---
  const handleRemoveDirectProduct = (prodId: number) => {
    setDirectCart(prev => prev.filter(item => item.product.id !== prodId));
  };

  // --- CONFIRMAR FACTURACION DIRECTA ---
  const handleCreateDirectInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const { personaId, billingType, immediatePayment, paymentMethod, cashDrawerId } = directInvoiceForm;

    if (!personaId || !billingType || directCart.length === 0) {
      setErrorMsg('Por favor completa todos los campos y añade al menos un producto.');
      return;
    }

    const isDrawerInvalid = immediatePayment && paymentMethod === 'CASH' && (!cashDrawerId || activeDrawers.length === 0);

    if (isDrawerInvalid) {
      setErrorMsg('No se puede cobrar en efectivo. Verifique que la Caja Grande esté abierta.');
      return;
    }

    try {
      setLoading(true);
      const reqData: any = {
        personaId: Number(personaId),
        billingType,
        paymentMethod: immediatePayment ? paymentMethod : undefined,
        cashDrawerId: immediatePayment && paymentMethod === 'CASH' ? Number(cashDrawerId) : undefined,
        items: directCart.map(item => ({ 
          productId: item.product.id, 
          quantity: item.quantity,
          weight: item.weight || null
        }))
      };

      if (immediatePayment && paymentMethod === 'CHECK') {
        reqData.checkNumber = directInvoiceForm.checkNumber;
        reqData.checkIssuer = directInvoiceForm.isEcheq 
          ? `${directInvoiceForm.checkIssuer} (Echeq)` 
          : directInvoiceForm.checkIssuer;
      }

      const res = await api.createDirectInvoice(reqData);

      setSuccessMsg(`✅ Factura directa emitida con éxito. Comprobante: ${res.invoiceNumber}`);
      setShowDirectInvoiceModal(false);
      
      setDirectInvoiceForm({
        personaId: '',
        billingType: 'INTERNAL',
        immediatePayment: false,
        paymentMethod: 'CASH',
        cashDrawerId: '',
        checkNumber: '',
        checkIssuer: '',
        isEcheq: false,
      });
      setClientSearchQuery('');
      setProductSearchQuery('');
      setDirectCart([]);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al emitir factura directa.');
    } finally {
      setLoading(false);
    }
  };

  // --- CALCULAR AUTO-COMPLETADO DE TOTALES DE COMPRA ---
  const autoCalculatedTotal = useMemo(() => {
    const net = Number(supplierForm.netAmount) || 0;
    const tax = Number(supplierForm.taxAmount) || 0;
    const perc = Number(supplierForm.percepcionAmount) || 0;
    return (net + tax + perc).toFixed(2);
  }, [supplierForm.netAmount, supplierForm.taxAmount, supplierForm.percepcionAmount]);

  // Al cambiar neto en compra, auto-calcular IVA 21% por defecto
  const handleNetChange = (val: string) => {
    const net = Number(val) || 0;
    const tax = (net * 0.21).toFixed(2);
    setSupplierForm(prev => ({
      ...prev,
      netAmount: val,
      taxAmount: tax,
      totalAmount: (net + Number(tax) + (Number(prev.percepcionAmount) || 0)).toFixed(2)
    }));
  };

  // --- REGISTRAR FACTURA DE COMPRA ---
  const handleCreateSupplierInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const { personaId, invoiceNumber, invoiceType, issueDate, dueDate, netAmount, taxAmount, percepcionAmount, totalAmount } = supplierForm;

    if (!personaId || !invoiceNumber || !invoiceType || !issueDate || !netAmount || !taxAmount || !totalAmount) {
      setErrorMsg('Por favor complete todos los campos obligatorios.');
      return;
    }

    const expectedTotal = Number(netAmount) + Number(taxAmount) + (Number(percepcionAmount) || 0);
    if (Math.abs(Number(totalAmount) - expectedTotal) > 1.00) {
      if (!window.confirm(`⚠️ El total ($${totalAmount}) no coincide con Neto + IVA + Percepción ($${expectedTotal.toFixed(2)}). ¿Desea guardar de todas formas?`)) {
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
        percepcionAmount: Number(percepcionAmount || 0),
        totalAmount: Number(totalAmount)
      });

      setSuccessMsg('✅ Factura de compra registrada con éxito en cuenta corriente del proveedor.');
      setShowSupplierModal(false);
      // Reset form
      setSupplierForm({
        personaId: '',
        invoiceNumber: '',
        invoiceType: 'FACTURA_A',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
        netAmount: '',
        taxAmount: '',
        percepcionAmount: '',
        totalAmount: ''
      });
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la factura de compra.');
    } finally {
      setLoading(false);
    }
  };

  // --- REGISTRAR PAGO A PROVEEDOR ---
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setErrorMsg('El monto debe ser mayor a cero.');
      return;
    }
    if (!paymentModal || !paymentModal.invoice) return;

    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      await api.registerPayment(paymentModal.invoice.personaId, {
        amount: Number(paymentAmount),
        paymentMethod,
        description: paymentDescription,
        type: 'OUTCOME',
        branch: selectedBranch,
        supplierInvoiceId: paymentModal.invoice.id
      });

      setPaymentModal(null);
      setPaymentAmount('');
      setPaymentDescription('');
      setSuccessMsg('✅ Pago registrado exitosamente en la factura de compra.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar el pago.');
    } finally {
      setLoading(false);
    }
  };

  // --- REGISTRAR RETENCION / PERCEPCION MANUAL ---
  const handleCreateWithholdingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const { type, taxType, personaId, number, date, amount, jurisdiction } = withholdingForm;

    if (!type || !taxType || !personaId || !number || !date || !amount) {
      setErrorMsg('Por favor complete todos los campos obligatorios.');
      return;
    }

    try {
      setLoading(true);
      await api.createTaxWithholding({
        type,
        taxType,
        personaId: Number(personaId),
        number,
        date: new Date(date).toISOString(),
        amount: Number(amount),
        jurisdiction: taxType === 'IIBB' ? jurisdiction : null
      });

      setSuccessMsg('✅ Movimiento de retención/percepción registrado con éxito.');
      setShowWithholdingModal(false);
      // Reset form
      setWithholdingForm({
        type: 'RETENCION_SUFRIDA',
        taxType: 'IIBB',
        personaId: '',
        number: '',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        jurisdiction: 'AR-B'
      });
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar el comprobante impositivo.');
    } finally {
      setLoading(false);
    }
  };





  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Mensajes de Feedback con Micro-Animaciones */}
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
          alignItems: 'center',
          animation: 'slideDown 0.3s ease'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
            {successMsg}
          </span>
          <button className="btn btn-ghost" style={{ padding: '2px', color: 'var(--text-secondary)' }} onClick={() => setSuccessMsg(null)}>✕</button>
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
          alignItems: 'center',
          animation: 'slideDown 0.3s ease'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: 'var(--color-danger)' }} />
            {errorMsg}
          </span>
          <button className="btn btn-ghost" style={{ padding: '2px', color: 'var(--text-secondary)' }} onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}

      {/* Navegación de Sub-Módulos (Tabs) */}
      <div style={{
        display: 'flex',
        gap: '4px',
        backgroundColor: '#EAEAEA',
        padding: '4px',
        borderRadius: '8px',
        width: 'fit-content'
      }}>
        {(['ventas', 'notas-credito', 'compras', 'percepciones', 'retenciones'] as const).map((tab) => {
          const labels = {
            'ventas': 'Comprobantes Venta',
            'notas-credito': 'Notas de Crédito',
            'compras': 'Comprobantes Compra',
            'percepciones': 'Percepciones',
            'retenciones': 'Retenciones'
          };
          const isActive = activeSubTab === tab;
          return (
            <button
              key={tab}
              className="btn"
              onClick={() => setActiveSubTab(tab)}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                transition: 'var(--transition-fast)'
              }}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Barra de Filtros Generales (Se muestra en Ventas, Compras, Percepciones, Retenciones) */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input"
                placeholder="🔍 Buscar por comprobante, persona o CUIT..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: '135px', fontSize: '0.85rem' }}
              />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>a</span>
              <input
                type="date"
                className="input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: '135px', fontSize: '0.85rem' }}
              />
            </div>

            {activeSubTab === 'ventas' && (
              <select
                className="input"
                value={salesInvoiceTypeFilter}
                onChange={(e) => setSalesInvoiceTypeFilter(e.target.value as any)}
                style={{ width: '200px', fontSize: '0.85rem' }}
              >
                <option value="ALL">Todos los Comprobantes</option>
                <option value="OFFICIAL">Solo Facturas</option>
                <option value="INTERNAL">Solo Remitos</option>
              </select>
            )}

            {(query || startDate || endDate || salesInvoiceTypeFilter !== 'ALL') && (
              <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.85rem' }} onClick={handleClearFilters}>
                Limpiar Filtros
              </button>
            )}
          </div>
        </div>


      {/* ====================================================================
          SUB-TAB 1: COMPROBANTES DE VENTA (VENTAS EMITIDAS)
          ==================================================================== */}
      {activeSubTab === 'ventas' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="card-title" style={{ margin: '0' }}>🧾 Facturas y Comprobantes de Venta Emitidos</h3>
              <p style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--text-secondary)' }}>Solo se muestran pedidos con facturación fiscal o presupuestos en estado entregado.</p>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowDirectInvoiceModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              Emitir Factura Directa
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Comprobante / CAE</th>
                  <th>Cliente</th>
                  <th>CUIT</th>
                  <th>Neto Gravado</th>
                  <th>IVA (21%)</th>
                  <th>Percep. IIBB</th>
                  <th>Total</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center' }}>Cargando comprobantes de venta...</td></tr>
                ) : salesInvoices.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center' }}>No se encontraron comprobantes emitidos.</td></tr>
                ) : (
                  salesInvoices
                    .filter(inv => {
                      if (salesInvoiceTypeFilter === 'ALL') return true;
                      const isOfficial = inv.billingType === 'OFFICIAL' || inv.invoiceType === 'FACTURA_A' || inv.invoiceType === 'FACTURA_B' || inv.invoiceType === 'FACTURA_C';
                      if (salesInvoiceTypeFilter === 'OFFICIAL') return isOfficial;
                      return !isOfficial;
                    })
                    .map((inv) => (
                    <tr key={inv.id} style={{ transition: 'background-color 0.2s hover' }}>
                      <td>{new Date(inv.createdAt).toLocaleDateString('es-AR')}</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: inv.invoiceType === 'FACTURA_A' ? '#E1F5FE' : 
                                           inv.invoiceType === 'FACTURA_B' ? '#E8F5E9' : '#ECEFF1',
                          color: inv.invoiceType === 'FACTURA_A' ? '#0288D1' : 
                                 inv.invoiceType === 'FACTURA_B' ? '#2E7D32' : 'var(--text-primary)'
                        }}>
                          {inv.invoiceType === 'FACTURA_A' ? 'Factura A' : 
                           inv.invoiceType === 'FACTURA_B' ? 'Factura B' : 
                           inv.invoiceType === 'FACTURA_C' ? 'Factura C' : 'Remito'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{inv.invoiceNumber}</div>
                        {inv.cae && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>CAE: {inv.cae}</div>
                        )}
                      </td>
                      <td>{inv.persona?.name || 'Consumidor Final'}</td>
                      <td>{inv.persona?.cuit || 'Sin CUIT'}</td>
                      <td>${Number(inv.netAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                      <td>${Number(inv.taxAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                      <td>
                        {Number(inv.percepcionAmount || 0) > 0 ? (
                          <span style={{ color: 'var(--color-warning)', fontWeight: 500 }}>
                            ${Number(inv.percepcionAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        ) : '$0.00'}
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        ${Number(inv.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                            onClick={() => setViewInvoiceModal(inv)}
                          >
                            {inv.invoiceType === 'FACTURA_A' || inv.invoiceType === 'FACTURA_B' || inv.invoiceType === 'FACTURA_C' ? 'Ver Factura' : 'Ver Remito'}
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ 
                              padding: '4px 8px', 
                              fontSize: '0.78rem', 
                              color: 'var(--color-danger, #dc2626)', 
                              borderColor: 'var(--color-danger, #dc2626)',
                              backgroundColor: 'transparent',
                              transition: 'all 0.2s'
                            }}
                            onClick={() => handleCreateCreditNoteFromInvoice(inv)}
                            title="Emitir Nota de Crédito para este comprobante"
                          >
                            Nota Crédito
                          </button>
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
          SUB-TAB: NOTAS DE CRÉDITO Y DEVOLUCIONES (CLIENTES)
          ==================================================================== */}
      {activeSubTab === 'notas-credito' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="card-title" style={{ margin: '0' }}>🔄 Notas de Crédito & Devoluciones de Clientes</h3>
              <p style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--text-secondary)' }}>Comprobantes de crédito emitidos por devolución física de stock o corrección de facturas.</p>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowCreditNoteModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              Emitir Nota de Crédito
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Comprobante / CAE</th>
                  <th>Cliente</th>
                  <th>CUIT</th>
                  <th>Motivo</th>
                  <th>Neto Gravado</th>
                  <th>IVA (21%)</th>
                  <th>Total Creditado</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center' }}>Cargando notas de crédito...</td></tr>
                ) : creditNotes.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center' }}>No se encontraron notas de crédito emitidas.</td></tr>
                ) : (
                  creditNotes.map((cn) => (
                    <tr key={cn.id} style={{ transition: 'background-color 0.2s hover' }}>
                      <td>{new Date(cn.createdAt).toLocaleDateString('es-AR')}</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: cn.billingType === 'OFFICIAL' ? '#e8f0fe' : '#f4f4f5',
                          color: cn.billingType === 'OFFICIAL' ? '#1a73e8' : '#71717a'
                        }}>
                          {cn.billingType === 'OFFICIAL' ? 'OFICIAL' : 'INTERNA'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{cn.creditNoteNumber || `NC-${cn.id}`}</div>
                        {cn.cae && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            CAE: {cn.cae}
                          </div>
                        )}
                      </td>
                      <td>{cn.persona?.name || 'Consumidor Final'}</td>
                      <td>{cn.persona?.cuit || 'S/D'}</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: cn.reason === 'DEVOLUCION' ? '#e6f4ea' : '#fef7e0',
                          color: cn.reason === 'DEVOLUCION' ? '#137333' : '#b06000'
                        }}>
                          {cn.reason === 'DEVOLUCION' ? 'Devolución' : cn.reason === 'DESCUENTO' ? 'Descuento' : 'Error Fact.'}
                        </span>
                      </td>
                      <td>
                        ${Number(cn.netAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td>
                        ${Number(cn.taxAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                        -${Number(cn.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                          onClick={() => setViewCreditNoteModal(cn)}
                        >
                          Ver Detalle
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
          SUB-TAB 2: COMPROBANTES DE COMPRA (PROVEEDORES)
          ==================================================================== */}
      {activeSubTab === 'compras' && (
        <div>
          {/* Tarjetas de Métricas de Proveedores */}
          {isAdmin && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <div style={{
              backgroundColor: '#FFF',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Deuda Pendiente Total</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                ${supplierMetrics.totalDeuda.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Monto a amortizar con proveedores</span>
            </div>

            <div style={{
              backgroundColor: '#FFF',
              border: '1px solid var(--border-color)',
              borderLeft: '4px solid var(--color-danger)',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-danger)', fontWeight: 600 }}>⚠️ Facturas Vencidas</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-danger)' }}>
                ${supplierMetrics.totalVencidas.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {supplierMetrics.vencidasCount} {supplierMetrics.vencidasCount === 1 ? 'comprobante vencido' : 'comprobantes vencidos'}
              </span>
            </div>

            <div style={{
              backgroundColor: '#FFF',
              border: '1px solid var(--border-color)',
              borderLeft: '4px solid var(--color-warning)',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
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
                <p style={{ fontSize: '0.8rem', marginTop: '2px' }}>Historial de compras registradas a proveedores alimentando el IVA Crédito Fiscal.</p>
              </div>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowSupplierModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} />
                Cargar Factura Proveedor
              </button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Fecha Emisión</th>
                    <th>Fecha Vto.</th>
                    <th>Tipo</th>
                    <th>Nro Comprobante</th>
                    <th>Proveedor</th>
                    <th>Neto Gravado</th>
                    <th>IVA</th>
                    <th>Percep.</th>
                    <th>Total Compra</th>
                    <th>Amortizado</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={12} style={{ textAlign: 'center' }}>Cargando comprobantes de compra...</td></tr>
                  ) : supplierInvoices.length === 0 ? (
                    <tr><td colSpan={12} style={{ textAlign: 'center' }}>No se encontraron comprobantes de compra.</td></tr>
                  ) : (
                    supplierInvoices.map((inv) => {
                      const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'PAID';
                      const pendingAmount = Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0);

                      return (
                        <tr key={inv.id} style={isAdmin && isOverdue ? { backgroundColor: '#FFF5F5' } : undefined}>
                          <td>{new Date(inv.issueDate).toLocaleDateString('es-AR')}</td>
                          <td style={isAdmin && isOverdue ? { color: 'var(--color-danger)', fontWeight: 700 } : { fontWeight: 500 }}>
                            {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('es-AR') : '-'}
                            {isAdmin && isOverdue && <span style={{ marginLeft: '4px', fontSize: '0.65rem', backgroundColor: 'var(--color-danger)', color: '#FFF', padding: '1px 4px', borderRadius: '4px', fontWeight: 600 }}>VENCIDO</span>}
                          </td>
                          <td>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: '#E8F5E9',
                              color: '#2E7D32'
                            }}>
                              {inv.invoiceType === 'FACTURA_A' ? 'Factura A' : inv.invoiceType === 'FACTURA_B' ? 'Factura B' : 'Factura C'}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{inv.invoiceNumber}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{inv.persona?.name || 'Proveedor'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>CUIT: {inv.persona?.cuit || 'Sin CUIT'}</div>
                          </td>
                          <td>${Number(inv.netAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                          <td>${Number(inv.taxAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                          <td>
                            {Number(inv.percepcionAmount || 0) > 0 ? (
                              <span style={{ color: 'var(--color-info)', fontWeight: 500 }}>
                                ${Number(inv.percepcionAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            ) : '$0.00'}
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            ${Number(inv.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                            ${Number(inv.paidAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                          <td>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: '12px',
                              backgroundColor: inv.status === 'PAID' 
                                ? '#E8F5E9' 
                                : inv.status === 'PARTIALLY_PAID' 
                                  ? '#E3F2FD' 
                                  : '#FFFDE7',
                              color: inv.status === 'PAID' 
                                ? '#2E7D32' 
                                : inv.status === 'PARTIALLY_PAID' 
                                  ? '#1565C0' 
                                  : '#F57F17',
                              border: inv.status === 'PAID'
                                ? '1px solid #C8E6C9'
                                : inv.status === 'PARTIALLY_PAID'
                                  ? '1px solid #BBDEFB'
                                  : '1px solid #FFF9C4'
                            }}>
                              {inv.status === 'PAID' 
                                ? 'Pagada' 
                                : inv.status === 'PARTIALLY_PAID' 
                                  ? 'Amortizada' 
                                  : 'Pendiente'}
                            </span>
                          </td>
                          <td>
                            {inv.status !== 'PAID' && (
                              <button
                                className="btn btn-primary"
                                style={{ 
                                  padding: '4px 10px', 
                                  fontSize: '0.75rem', 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '4px',
                                  backgroundColor: 'var(--text-primary)',
                                  color: '#FFF',
                                  borderColor: 'var(--text-primary)'
                                }}
                                onClick={() => {
                                  setPaymentModal({ open: true, invoice: inv });
                                  setPaymentAmount(pendingAmount.toFixed(2));
                                }}
                              >
                                Pagar
                              </button>
                            )}
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
          SUB-TAB 3: PERCEPCIONES (PRACTICADAS Y SUFRIDAS)
          ==================================================================== */}
      {activeSubTab === 'percepciones' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="card-title" style={{ margin: '0' }}>📈 Registro de Percepciones (IIBB / IVA)</h3>
              <p style={{ fontSize: '0.8rem', marginTop: '2px' }}>Percepciones aplicadas en nuestras facturas de venta y sufridas en las facturas de proveedores.</p>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                setWithholdingForm(prev => ({ ...prev, type: 'PERCEPCION_SUFRIDA' }));
                setShowWithholdingModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              Nueva Percepción Manual
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo Movimiento</th>
                  <th>Impuesto</th>
                  <th>Comprobante</th>
                  <th>Persona / CUIT</th>
                  <th>Jurisdicción</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center' }}>Cargando percepciones...</td></tr>
                ) : taxWithholdings.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center' }}>No se encontraron percepciones en el período.</td></tr>
                ) : (
                  taxWithholdings.map((w) => (
                    <tr key={w.id}>
                      <td>{new Date(w.date).toLocaleDateString('es-AR')}</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: w.type === 'PERCEPCION_SUFRIDA' ? 'var(--color-info-bg)' : 'var(--color-warning-bg)',
                          color: w.type === 'PERCEPCION_SUFRIDA' ? 'var(--color-info)' : 'var(--color-warning)'
                        }}>
                          {w.type === 'PERCEPCION_SUFRIDA' ? 'Sufrida (Crédito Proveedor)' : 'Practicada (Venta Cliente)'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{w.taxType}</td>
                      <td style={{ fontFamily: 'monospace' }}>{w.number}</td>
                      <td>
                        <div>{w.persona?.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CUIT: {w.persona?.cuit}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{w.jurisdiction || 'Nacional'}</td>
                      <td style={{ fontWeight: 700, color: w.type === 'PERCEPCION_SUFRIDA' ? 'var(--text-primary)' : 'var(--accent-color)' }}>
                        ${Number(w.amount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
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
          SUB-TAB 4: RETENCIONES (SUFRIDAS Y PRACTICADAS)
          ==================================================================== */}
      {activeSubTab === 'retenciones' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="card-title" style={{ margin: '0' }}>📄 Certificados de Retención</h3>
              <p style={{ fontSize: '0.8rem', marginTop: '2px' }}>Retenciones que nos hicieron los clientes al pagarnos (reducen su saldo deudor) o que practicamos al pagar a proveedores.</p>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                setWithholdingForm(prev => ({ ...prev, type: 'RETENCION_SUFRIDA' }));
                setShowWithholdingModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              Cargar Certificado Retención
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Fecha Certificado</th>
                  <th>Tipo Movimiento</th>
                  <th>Impuesto</th>
                  <th>Nro Certificado</th>
                  <th>Persona / CUIT</th>
                  <th>Jurisdicción</th>
                  <th>Importe Retenido</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center' }}>Cargando retenciones...</td></tr>
                ) : taxWithholdings.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center' }}>No se encontraron certificados de retención.</td></tr>
                ) : (
                  taxWithholdings.map((w) => (
                    <tr key={w.id}>
                      <td>{new Date(w.date).toLocaleDateString('es-AR')}</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: w.type === 'RETENCION_SUFRIDA' ? '#EBF5FB' : '#FDEDEC',
                          color: w.type === 'RETENCION_SUFRIDA' ? '#2980B9' : '#C0392B'
                        }}>
                          {w.type === 'RETENCION_SUFRIDA' ? 'Sufrida (Nos retuvo el Cliente)' : 'Practicada (Retuvimos al Proveedor)'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{w.taxType}</td>
                      <td style={{ fontFamily: 'monospace' }}>{w.number}</td>
                      <td>
                        <div>{w.persona?.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CUIT: {w.persona?.cuit}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{w.jurisdiction || 'No Aplica'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                        ${Number(w.amount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
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
          MODAL: REGISTRAR PAGO A PROVEEDOR
          ==================================================================== */}
      {paymentModal && paymentModal.open && paymentModal.invoice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Registrar Pago de Factura</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setPaymentModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div style={{ backgroundColor: '#F8F9FA', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
                <div><strong>Proveedor:</strong> {paymentModal.invoice.persona?.name}</div>
                <div><strong>Nro Comprobante:</strong> {paymentModal.invoice.invoiceNumber}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontWeight: 600 }}>
                  <span>Total Factura:</span>
                  <span>${Number(paymentModal.invoice.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Ya Pagado:</span>
                  <span>${Number(paymentModal.invoice.paidAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-danger)', borderTop: '1px solid #E5E5EA', paddingTop: '4px', marginTop: '4px', fontWeight: 700 }}>
                  <span>Saldo Pendiente:</span>
                  <span>${(Number(paymentModal.invoice.totalAmount) - Number(paymentModal.invoice.paidAmount || 0)).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              <div className="form-group">
                <label>Monto a Pagar ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
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
                  <option value="CASH">Efectivo (Caja Operativa)</option>
                  <option value="BANK_TRANSFER">Transferencia Bancaria</option>
                  <option value="CHECK">Cheque</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>

              {paymentMethod === 'CASH' && (
                <div className="form-group">
                  <label>Caja Operativa (Sucursal)</label>
                  <select
                    className="select"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                  >
                    <option value="X">Sucursal X (Venta General/Ficticia)</option>
                    <option value="A">Sucursal A (Oficial)</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Notas de Pago / Detalles (Obligatorio)</label>
                <textarea
                  className="input"
                  style={{ minHeight: '80px', paddingTop: '8px', paddingBottom: '8px' }}
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                  placeholder="Ej: Transferencia Banco Galicia - Nro Operación: 849204"
                  required
                />
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: REGISTRAR COMPRA (SUPPLIER INVOICE)
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
                  {providersOnly.map(p => (
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
                  <label>Percepciones Sufridas ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="0.00"
                    value={supplierForm.percepcionAmount}
                    onChange={(e) => setSupplierForm(prev => ({ ...prev, percepcionAmount: e.target.value }))}
                  />
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
                    Suma Neto+IVA+Perc: <span style={{ fontWeight: 600 }}>${autoCalculatedTotal}</span>
                  </div>
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
          MODAL: REGISTRAR RETENCION O PERCEPCION MANUAL
          ==================================================================== */}
      {showWithholdingModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>
                {withholdingForm.type.startsWith('PERCEPCION') ? 'Cargar Percepción Impuesto' : 'Ingresar Certificado de Retención'}
              </h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowWithholdingModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateWithholdingSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Tipo Movimiento</label>
                  <select
                    className="select"
                    value={withholdingForm.type}
                    onChange={(e) => setWithholdingForm(prev => ({ ...prev, type: e.target.value }))}
                    required
                  >
                    <option value="RETENCION_SUFRIDA">Retención Sufrida (Cliente nos retiene)</option>
                    <option value="RETENCION_PRACTICADA">Retención Practicada (Retenemos a Proveedor)</option>
                    <option value="PERCEPCION_SUFRIDA">Percepción Sufrida (Proveedor nos recarga)</option>
                    <option value="PERCEPCION_PRACTICADA">Percepción Practicada (Recargamos en Venta)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Impuesto</label>
                  <select
                    className="select"
                    value={withholdingForm.taxType}
                    onChange={(e) => setWithholdingForm(prev => ({ ...prev, taxType: e.target.value }))}
                    required
                  >
                    <option value="IIBB">Ingresos Brutos (IIBB)</option>
                    <option value="IVA">IVA</option>
                    <option value="GANANCIAS">Ganancias</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>
                  {['RETENCION_SUFRIDA', 'PERCEPCION_PRACTICADA'].includes(withholdingForm.type) ? 'Cliente' : 'Proveedor'}
                </label>
                <select
                  className="select"
                  value={withholdingForm.personaId}
                  onChange={(e) => setWithholdingForm(prev => ({ ...prev, personaId: e.target.value }))}
                  required
                >
                  <option value="">Seleccione Persona...</option>
                  {['RETENCION_SUFRIDA', 'PERCEPCION_PRACTICADA'].includes(withholdingForm.type) ? (
                    clientsOnly.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (CUIT: {p.cuit})</option>
                    ))
                  ) : (
                    providersOnly.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (CUIT: {p.cuit})</option>
                    ))
                  )}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Número Comprobante / Certificado</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ej: RET-10293 o Factura Nro"
                    value={withholdingForm.number}
                    onChange={(e) => setWithholdingForm(prev => ({ ...prev, number: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fecha</label>
                  <input
                    type="date"
                    className="input"
                    value={withholdingForm.date}
                    onChange={(e) => setWithholdingForm(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Importe ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="0.00"
                    value={withholdingForm.amount}
                    onChange={(e) => setWithholdingForm(prev => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>
                {withholdingForm.taxType === 'IIBB' && (
                  <div className="form-group">
                    <label>Jurisdicción (IIBB)</label>
                    <select
                      className="select"
                      value={withholdingForm.jurisdiction}
                      onChange={(e) => setWithholdingForm(prev => ({ ...prev, jurisdiction: e.target.value }))}
                    >
                      <option value="AR-B">Prov. Buenos Aires (ARBA)</option>
                      <option value="AR-C">CABA (AGIP)</option>
                      <option value="AR-S">Santa Fe</option>
                      <option value="AR-X">Córdoba</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowWithholdingModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>Guardar Comprobante</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: VER COMPROBANTE DE VENTA / DETALLE (FACTURA DETALLADA)
          ==================================================================== */}
      {showDirectInvoiceModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ 
            maxWidth: '1550px', 
            width: '96vw', 
            height: '92vh', 
            maxHeight: '92vh', 
            padding: '24px', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--accent-color)' }}>📃</span> Emitir Factura de Venta Directa
              </h2>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => {
                setShowDirectInvoiceModal(false);
                setDirectCart([]);
                setDirectInvoiceForm({
                  personaId: '',
                  billingType: 'INTERNAL',
                  immediatePayment: false,
                  paymentMethod: 'CASH',
                  cashDrawerId: '',
                  checkNumber: '',
                  checkIssuer: '',
                  isEcheq: false,
                });
                setClientSearchQuery('');
                setProductSearchQuery('');
              }}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateDirectInvoiceSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                
                {/* COLUMNA IZQUIERDA: CLIENTE Y PRODUCTOS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden', minHeight: 0 }}>
                  
                  {/* Buscador de Cliente */}
                  <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cliente (Nombre o CUIT)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        ref={clientSearchInputRef}
                        type="text"
                        className="input"
                        placeholder="Escribí para buscar cliente por nombre o CUIT..."
                        value={clientSearchQuery}
                        onChange={(e) => {
                          setClientSearchQuery(e.target.value);
                          setShowClientDropdown(true);
                        }}
                        onFocus={() => setShowClientDropdown(true)}
                        onBlur={() => setTimeout(() => setShowClientDropdown(false), 250)}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setShowClientDropdown(true);
                            setActiveClientSuggestionIdx((prev: number) => 
                              filteredClients.length > 0 
                                ? (prev + 1) % filteredClients.length 
                                : 0
                            );
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setShowClientDropdown(true);
                            setActiveClientSuggestionIdx((prev: number) => 
                              filteredClients.length > 0 
                                ? (prev - 1 + filteredClients.length) % filteredClients.length 
                                : 0
                            );
                          } else if (e.key === 'Enter') {
                            if (showClientDropdown && filteredClients.length > 0) {
                              e.preventDefault();
                              handleSelectClient(filteredClients[activeClientSuggestionIdx]);
                            }
                          }
                        }}
                        style={{ fontSize: '0.9rem' }}
                      />
                      {showClientDropdown && filteredClients.length > 0 && (
                        <div className="suggestions-list">
                          {filteredClients.map((c, idx) => {
                            const isActive = idx === activeClientSuggestionIdx;
                            return (
                              <div
                                key={c.id}
                                className={`suggestion-item ${isActive ? 'active' : ''}`}
                                onMouseDown={() => handleSelectClient(c)}
                                onMouseEnter={() => setActiveClientSuggestionIdx(idx)}
                                style={{
                                  backgroundColor: isActive ? '#e8f0fe' : 'inherit',
                                  cursor: 'pointer'
                                }}
                              >
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  CUIT: {c.cuit || 'S/D'} | Saldo CC: ${Number(c.outstandingBalance || 0).toLocaleString()} | Lista: {c.priceList || 'A'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Detalle / Ficha del cliente seleccionado */}
                  {selectedDirectClient ? (
                    <div style={{
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '12px',
                      fontSize: '0.825rem',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px 16px'
                    }}>
                      <div><strong>Dirección:</strong> {selectedDirectClient.address || 'S/D'}</div>
                      <div><strong>CUIT/DNI:</strong> {selectedDirectClient.cuit || 'S/D'}</div>
                      <div>
                        <strong>Lista de Precios:</strong>{' '}
                        <span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}>
                          Lista {selectedDirectClient.priceList || 'A'}
                        </span>
                      </div>
                      <div>
                        <strong>Descuento Fijo:</strong>{' '}
                        <span style={{ color: Number(selectedDirectClient.discount || 0) > 0 ? 'var(--color-success)' : 'inherit', fontWeight: 600 }}>
                          {selectedDirectClient.discount || 0}%
                        </span>
                      </div>
                      <div>
                        <strong>Saldo Cuenta Corriente:</strong>{' '}
                        <span style={{ color: Number(selectedDirectClient.outstandingBalance || 0) > 0 ? 'var(--color-danger)' : 'inherit', fontWeight: 600 }}>
                          ${Number(selectedDirectClient.outstandingBalance || 0).toLocaleString()}
                        </span>
                      </div>
                      <div><strong>Límite de Crédito:</strong> ${Number(selectedDirectClient.creditLimit || 0).toLocaleString()}</div>
                      
                      {Number(selectedDirectClient.outstandingBalance || 0) > 0 && (
                        <div style={{ gridColumn: 'span 2', color: 'var(--color-danger)', fontWeight: 600, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          ⚠️ Regla Boleta contra Boleta: El cliente tiene saldo pendiente.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      backgroundColor: '#fbfbe4',
                      border: '1px dashed #e6c64c',
                      borderRadius: '6px',
                      padding: '12px',
                      fontSize: '0.825rem',
                      color: '#856404',
                      textAlign: 'center'
                    }}>
                      Debe buscar y seleccionar un cliente para habilitar la carga de productos.
                    </div>
                  )}

                  {/* Selector y Buscador de Productos (Solo si hay cliente seleccionado) */}
                  {selectedDirectClient && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Añadir Producto (Nombre, SKU o Barcode)</label>
                        {selectedDirectProduct && (() => {
                          const prod = products.find(p => p.id === Number(selectedDirectProduct));
                          if (!prod) return null;
                          return (
                            <span style={{ fontSize: '0.78rem', color: 'var(--color-success)', fontWeight: 600 }}>
                              Seleccionado: {prod.name} (Stock: {prod.stock})
                            </span>
                          );
                        })()}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <input
                            ref={productSearchInputRef}
                            type="text"
                            className="input"
                            placeholder="🔍 Buscar por Nombre, SKU o Código de Barras..."
                            value={productSearchQuery}
                            onChange={(e) => {
                              setProductSearchQuery(e.target.value);
                              setShowProductDropdown(true);
                            }}
                            onFocus={() => setShowProductDropdown(true)}
                            onBlur={() => setTimeout(() => setShowProductDropdown(false), 250)}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setShowProductDropdown(true);
                                setActiveProductSuggestionIdx((prev: number) => 
                                  filteredProductsSuggestions.length > 0 
                                    ? (prev + 1) % filteredProductsSuggestions.length 
                                    : 0
                                );
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setShowProductDropdown(true);
                                setActiveProductSuggestionIdx((prev: number) => 
                                  filteredProductsSuggestions.length > 0 
                                    ? (prev - 1 + filteredProductsSuggestions.length) % filteredProductsSuggestions.length 
                                    : 0
                                );
                              } else if (e.key === 'Enter') {
                                if (showProductDropdown && filteredProductsSuggestions.length > 0) {
                                  e.preventDefault();
                                  handleSelectProduct(filteredProductsSuggestions[activeProductSuggestionIdx]);
                                }
                              }
                            }}
                            style={{ fontSize: '0.9rem' }}
                          />
                          {showProductDropdown && filteredProductsSuggestions.length > 0 && (
                            <div className="suggestions-list">
                              {filteredProductsSuggestions.map((p, idx) => {
                                const isActive = idx === activeProductSuggestionIdx;
                                return (
                                  <div
                                    key={p.id}
                                    className={`suggestion-item ${isActive ? 'active' : ''}`}
                                    onMouseDown={() => handleSelectProduct(p)}
                                    onMouseEnter={() => setActiveProductSuggestionIdx(idx)}
                                    style={{ 
                                      opacity: p.stock <= 0 ? 0.5 : 1,
                                      backgroundColor: isActive ? '#e8f0fe' : 'inherit'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                      <span>{p.name}</span>
                                      <span style={{ color: p.stock <= 0 ? 'var(--color-danger)' : 'var(--color-success)', fontSize: '0.8rem' }}>
                                        Stock: {p.stock}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', gap: '12px' }}>
                                      <span>SKU: {p.sku}</span>
                                      {p.barcode && <span>EAN: {p.barcode}</span>}
                                      <span>Precio Ref: ${p.listPrice}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div style={{ width: '90px' }}>
                          <input
                            ref={productQtyInputRef}
                            type="number"
                            className="input"
                            min="1"
                            placeholder="Cant"
                            style={{ fontSize: '0.9rem', textAlign: 'center' }}
                            value={directProductQty}
                            onChange={(e) => setDirectProductQty(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddDirectProduct();
                              }
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0 16px', fontSize: '0.85rem', height: '45px' }}
                          onClick={handleAddDirectProduct}
                          disabled={!selectedDirectProduct}
                        >
                          Añadir
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Detalle del carrito */}
                  {directCart.length > 0 ? (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                      <div style={{ flex: 1, overflowY: 'auto' }}>
                        <table style={{ fontSize: '0.82rem', margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                          <thead style={{ backgroundColor: 'var(--bg-app)', position: 'sticky', top: 0, zIndex: 1 }}>
                            <tr>
                              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Producto</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right', width: '80px' }}>Cant</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right', width: '100px' }}>Peso (Kg)</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right', width: '100px' }}>P. Unit</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right', width: '100px' }}>Subtotal</th>
                              <th style={{ padding: '10px 12px', width: '50px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {directCart.map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                                  <div>{item.product.name}</div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>SKU: {item.product.sku}</div>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.quantity} u.</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                  {item.product.isPesable ? (
                                    <input 
                                      type="number"
                                      step="0.01"
                                      className="input"
                                      style={{ width: '70px', padding: '2px 4px', fontSize: '0.8rem', textAlign: 'right' }}
                                      value={item.weight || ''}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setDirectCart(prev => {
                                          const newCart = [...prev];
                                          const idx = newCart.findIndex(i => i.product.id === item.product.id);
                                          if (idx !== -1) {
                                            const w = isNaN(val) ? null : val;
                                            newCart[idx].weight = w;
                                            newCart[idx].subtotal = Number((item.unitPrice * (w || (item.quantity * (item.product.approximateWeight || 1)))).toFixed(2));
                                          }
                                          return newCart;
                                        });
                                      }}
                                    />
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>${item.unitPrice.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{ padding: '4px 8px', color: 'var(--color-danger)' }}
                                    onClick={() => handleRemoveDirectProduct(item.product.id)}
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : selectedDirectClient ? (
                    <div style={{
                      border: '1px dashed var(--border-color)',
                      borderRadius: '8px',
                      padding: '32px 16px',
                      textAlign: 'center',
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '120px'
                    }}>
                      El carrito de facturación está vacío. Buscá productos arriba para agregarlos.
                    </div>
                  ) : null}
                </div>

                {/* COLUMNA DERECHA: CONFIGURACION DE FACTURA Y PAGO */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '16px', 
                  borderLeft: '1px solid var(--border-color)', 
                  paddingLeft: '24px',
                  overflowY: 'auto',
                  height: '100%'
                }}>
                  
                  {/* Canal de Facturación / Sucursal */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Canal de Facturación (Sucursal)</label>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        type="button"
                        className={`btn ${directInvoiceForm.billingType === 'OFFICIAL' ? 'btn-official' : 'btn-secondary'}`}
                        onClick={() => setDirectInvoiceForm(prev => ({ ...prev, billingType: 'OFFICIAL' }))}
                        style={{ flex: 1, fontSize: '0.8rem', padding: '10px' }}
                      >
                        Sucursal A (Oficial)
                      </button>
                      <button
                        type="button"
                        className={`btn ${directInvoiceForm.billingType === 'INTERNAL' ? 'btn-internal' : 'btn-secondary'}`}
                        onClick={() => setDirectInvoiceForm(prev => ({ ...prev, billingType: 'INTERNAL' }))}
                        style={{ flex: 1, fontSize: '0.8rem', padding: '10px' }}
                      >
                        Sucursal X (Interno)
                      </button>
                    </div>
                  </div>

                  {/* Cobro en el Acto y Medio de Pago */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={directInvoiceForm.immediatePayment}
                          onChange={(e) => setDirectInvoiceForm(prev => ({ ...prev, immediatePayment: e.target.checked }))}
                        />
                        <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>Cobrar en el acto (Efectivo/Transferencia/Cheque)</span>
                      </label>

                      {directInvoiceForm.immediatePayment && (
                        <div>
                          <label style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Método de Pago</label>
                          <select
                            className="select"
                            value={directInvoiceForm.paymentMethod}
                            onChange={(e) => setDirectInvoiceForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                            style={{ fontSize: '0.85rem' }}
                          >
                            <option value="CASH">Efectivo</option>
                            <option value="BANK_TRANSFER">Transferencia Bancaria</option>
                            <option value="CHECK">Cheque de Terceros</option>
                          </select>
                          
                          {directInvoiceForm.paymentMethod === 'CASH' && activeDrawers.length > 0 && (
                            <div style={{ marginTop: '12px' }}>
                              <label style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Caja de Ingreso</label>
                              <select
                                className="select"
                                value={directInvoiceForm.cashDrawerId}
                                onChange={(e) => setDirectInvoiceForm(prev => ({ ...prev, cashDrawerId: e.target.value }))}
                                style={{ fontSize: '0.85rem' }}
                              >
                                <option value="">-- Seleccionar Caja --</option>
                                {activeDrawers.map((drawer: any) => (
                                  <option key={drawer.id} value={drawer.id}>
                                    Caja {drawer.branch}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {directInvoiceForm.paymentMethod === 'CHECK' && (
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <input 
                                type="text" 
                                className="input" 
                                placeholder="Número de Cheque" 
                                value={directInvoiceForm.checkNumber}
                                onChange={(e) => setDirectInvoiceForm(prev => ({...prev, checkNumber: e.target.value}))}
                                style={{ fontSize: '0.85rem' }}
                              />
                              <input 
                                type="text" 
                                className="input" 
                                placeholder="Banco Emisor / Detalles" 
                                value={directInvoiceForm.checkIssuer}
                                onChange={(e) => setDirectInvoiceForm(prev => ({...prev, checkIssuer: e.target.value}))}
                                style={{ fontSize: '0.85rem' }}
                              />
                              <label className="checkbox-container" style={{ marginTop: '4px' }}>
                                <input
                                  type="checkbox"
                                  checked={directInvoiceForm.isEcheq}
                                  onChange={(e) => setDirectInvoiceForm(prev => ({ ...prev, isEcheq: e.target.checked }))}
                                />
                                <span style={{ fontSize: '0.8rem' }}>Es E-Cheq</span>
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Validaciones de caja operativa en efectivo */}
                  {(() => {
                    const isDrawerInvalid = directInvoiceForm.immediatePayment && directInvoiceForm.paymentMethod === 'CASH' && (!directInvoiceForm.cashDrawerId || activeDrawers.length === 0);

                    return (
                      <>
                        {isDrawerInvalid && (
                          <div style={{
                            backgroundColor: '#FDF6F6',
                            color: '#C5221F',
                            border: '1px solid #FAD2D2',
                            borderRadius: '6px',
                            padding: '12px',
                            fontSize: '0.78rem',
                            lineHeight: '1.4'
                          }}>
                            <strong>⚠️ Caja Cerrada:</strong> No tenés una caja operativa abierta.
                            <div style={{ marginTop: '4px' }}>
                              Para cobrar ventas en efectivo, debés abrir la <strong>Caja Grande</strong> en el Panel de Finanzas.
                            </div>
                          </div>
                        )}

                        {/* Desglose de Totales */}
                        <div style={{
                          backgroundColor: 'var(--bg-app)',
                          padding: '16px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.85rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          marginTop: 'auto'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Neto Gravado:</span>
                            <span style={{ fontWeight: 600 }}>${directBillingTotals.net.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>IVA Débito (21%):</span>
                            <span style={{ fontWeight: 600 }}>${directBillingTotals.tax.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                          </div>
                          {directBillingTotals.percepcion > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Percep. IIBB ({selectedDirectClient?.iibbAliquot}%):</span>
                              <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>${directBillingTotals.percepcion.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            </div>
                          )}
                          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700 }}>
                            <span>Total Facturado:</span>
                            <span className={directInvoiceForm.billingType === 'OFFICIAL' ? 'text-official' : 'text-internal'} style={{ fontWeight: 800, fontSize: '1.2rem' }}>${directBillingTotals.total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                          </div>
                        </div>

                        {/* Botón de envío */}
                        <button
                          type="submit"
                          className={`btn ${directInvoiceForm.billingType === 'OFFICIAL' ? 'btn-official' : 'btn-internal'}`}
                          style={{
                            width: '100%',
                            padding: '12px',
                            fontWeight: 600,
                            cursor: (isDrawerInvalid || directCart.length === 0) ? 'not-allowed' : 'pointer',
                            opacity: (isDrawerInvalid || directCart.length === 0) ? 0.5 : 1
                          }}
                          disabled={loading || isDrawerInvalid || directCart.length === 0}
                        >
                          {loading ? 'Emitiendo comprobante...' : 'Emitir Factura y Registrar'}
                        </button>
                      </>
                    );
                  })()}
                </div>

              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: EMITIR NOTA DE CRÉDITO
          ==================================================================== */}
      {showCreditNoteModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ 
            maxWidth: '1550px', 
            width: '96vw', 
            height: '92vh', 
            maxHeight: '92vh', 
            padding: '24px', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--color-success)' }}>🔄</span> Emitir Nota de Crédito / Devolución
              </h2>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => {
                setShowCreditNoteModal(false);
                setCreditNoteCart([]);
                setCreditNoteForm({
                  personaId: '',
                  orderId: '',
                  billingType: 'INTERNAL',
                  reason: 'DEVOLUCION',
                  comments: ''
                });
                setCnClientSearchQuery('');
                setCnProductSearchQuery('');
              }}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateCreditNoteSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                
                {/* COLUMNA IZQUIERDA: CLIENTE Y PRODUCTOS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden', minHeight: 0 }}>
                  
                  {/* Buscador de Cliente */}
                  <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cliente (Nombre o CUIT)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Escribí para buscar cliente por nombre o CUIT..."
                        value={cnClientSearchQuery}
                        onChange={(e) => {
                          setCnClientSearchQuery(e.target.value);
                          setShowCNClientDropdown(true);
                        }}
                        onFocus={() => setShowCNClientDropdown(true)}
                        onBlur={() => setTimeout(() => setShowCNClientDropdown(false), 250)}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setShowCNClientDropdown(true);
                            setActiveCNClientSuggestionIdx((prev: number) => 
                              filteredCNClients.length > 0 ? (prev + 1) % filteredCNClients.length : 0
                            );
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setShowCNClientDropdown(true);
                            setActiveCNClientSuggestionIdx((prev: number) => 
                              filteredCNClients.length > 0 ? (prev - 1 + filteredCNClients.length) % filteredCNClients.length : 0
                            );
                          } else if (e.key === 'Enter') {
                            if (showCNClientDropdown && filteredCNClients.length > 0) {
                              e.preventDefault();
                              handleSelectCNClient(filteredCNClients[activeCNClientSuggestionIdx]);
                            }
                          }
                        }}
                        style={{ fontSize: '0.9rem' }}
                      />
                      {showCNClientDropdown && filteredCNClients.length > 0 && (
                        <div className="suggestions-list">
                          {filteredCNClients.map((c, idx) => {
                            const isActive = idx === activeCNClientSuggestionIdx;
                            return (
                              <div
                                key={c.id}
                                className={`suggestion-item ${isActive ? 'active' : ''}`}
                                onMouseDown={() => handleSelectCNClient(c)}
                                onMouseEnter={() => setActiveCNClientSuggestionIdx(idx)}
                                style={{
                                  backgroundColor: isActive ? '#e8f0fe' : 'inherit',
                                  cursor: 'pointer'
                                }}
                              >
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  CUIT: {c.cuit || 'S/D'} | Saldo CC: ${Number(c.outstandingBalance || 0).toLocaleString()} | Lista: {c.priceList || 'A'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selección de Pedido (Factura) */}
                  {selectedCNClient && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Vincular a Pedido / Factura (Opcional)</label>
                      <select 
                        className="input" 
                        value={creditNoteForm.orderId}
                        onChange={(e) => handleSelectCNOrder(e.target.value)}
                        style={{ fontSize: '0.9rem' }}
                      >
                        <option value="">-- Emisión Libre (Sin vincular factura) --</option>
                        {clientOrders.map(o => (
                          <option key={o.id} value={o.id}>
                            Pedido #{o.id} - {new Date(o.createdAt).toLocaleDateString('es-AR')} - Total: ${Number(o.totalAmount).toLocaleString()} {o.invoiceNumber ? `(Factura: ${o.invoiceNumber})` : '(Presupuesto)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Cargador de Ítems */}
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Artículos en la Nota de Crédito</h4>
                      {creditNoteForm.orderId ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            type="button" 
                            className="btn btn-ghost" 
                            style={{ padding: '2px 8px', fontSize: '0.75rem', color: '#16a34a', fontWeight: 500 }}
                            onClick={() => {
                              setCreditNoteCart(prev => prev.map(item => ({
                                ...item,
                                quantity: item.orderQuantity,
                                subtotal: item.orderQuantity * item.unitPrice
                              })));
                            }}
                          >
                            ✓ Devolución Total
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-ghost" 
                            style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                            onClick={() => {
                              setCreditNoteCart(prev => prev.map(item => ({
                                ...item,
                                quantity: 0,
                                subtotal: 0
                              })));
                            }}
                          >
                            ✗ Poner en cero
                          </button>
                        </div>
                      ) : selectedCNClient && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Modo libre: agregá productos manualmente.</span>
                      )}
                    </div>

                    {/* Selector Manual si no hay orden vinculada */}
                    {!creditNoteForm.orderId && selectedCNClient && (
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '2fr 1fr 1fr auto', 
                        gap: '10px', 
                        alignItems: 'end',
                        backgroundColor: '#f5f5f7',
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '12px'
                      }}>
                        <div style={{ position: 'relative' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Producto</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="🔍 Buscar producto..."
                            value={cnProductSearchQuery}
                            onChange={(e) => {
                              setCnProductSearchQuery(e.target.value);
                              setShowCNProductDropdown(true);
                            }}
                            onFocus={() => setShowCNProductDropdown(true)}
                            onBlur={() => setTimeout(() => setShowCNProductDropdown(false), 250)}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setShowCNProductDropdown(true);
                                setActiveCNProductSuggestionIdx((prev: number) => 
                                  filteredCNProductsSuggestions.length > 0 ? (prev + 1) % filteredCNProductsSuggestions.length : 0
                                );
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setShowCNProductDropdown(true);
                                setActiveCNProductSuggestionIdx((prev: number) => 
                                  filteredCNProductsSuggestions.length > 0 ? (prev - 1 + filteredCNProductsSuggestions.length) % filteredCNProductsSuggestions.length : 0
                                );
                              } else if (e.key === 'Enter') {
                                if (showCNProductDropdown && filteredCNProductsSuggestions.length > 0) {
                                  e.preventDefault();
                                  const p = filteredCNProductsSuggestions[activeCNProductSuggestionIdx];
                                  setSelectedCNProduct(String(p.id));
                                  setCnProductSearchQuery(p.name);
                                  setCnProductPrice(String(p.listPrice));
                                  setShowCNProductDropdown(false);
                                }
                              }
                            }}
                            style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                          />
                          {showCNProductDropdown && filteredCNProductsSuggestions.length > 0 && (
                            <div className="suggestions-list" style={{ width: '100%', zIndex: 10 }}>
                              {filteredCNProductsSuggestions.map((p, idx) => {
                                const isActive = idx === activeCNProductSuggestionIdx;
                                return (
                                  <div
                                    key={p.id}
                                    className={`suggestion-item ${isActive ? 'active' : ''}`}
                                    onMouseDown={() => {
                                      setSelectedCNProduct(String(p.id));
                                      setCnProductSearchQuery(p.name);
                                      setCnProductPrice(String(p.listPrice));
                                    }}
                                    onMouseEnter={() => setActiveCNProductSuggestionIdx(idx)}
                                    style={{ backgroundColor: isActive ? '#e8f0fe' : 'inherit' }}
                                  >
                                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                      SKU: {p.sku} | Stock: {p.stock} | Precio: ${Number(p.listPrice).toLocaleString()}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Cantidad</label>
                          <input 
                            type="number" 
                            className="input" 
                            min="1" 
                            value={cnProductQty} 
                            onChange={(e) => setCnProductQty(e.target.value)}
                            style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Precio Unit.</label>
                          <input 
                            type="number" 
                            className="input" 
                            step="0.01" 
                            value={cnProductPrice} 
                            onChange={(e) => setCnProductPrice(e.target.value)}
                            placeholder="Precio"
                            style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                          />
                        </div>

                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          onClick={handleAddCNItemManual}
                          style={{ padding: '8px 12px' }}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}

                    {/* Tabla de Artículos del Carrito */}
                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead style={{ backgroundColor: '#fafafa', position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr>
                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Producto</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', width: '130px' }}>Precio</th>
                            {creditNoteForm.orderId && <th style={{ padding: '8px 12px', textAlign: 'center' }}>Cant. Pedido</th>}
                            <th style={{ padding: '8px 12px', width: '140px', textAlign: 'center' }}>Cant. Devuelta</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Subtotal</th>
                            <th style={{ padding: '8px 12px', width: '50px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {creditNoteCart.length === 0 ? (
                            <tr>
                              <td colSpan={creditNoteForm.orderId ? 6 : 5} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                {creditNoteForm.orderId 
                                  ? 'No se cargaron ítems. Seleccione un pedido para listar sus artículos.' 
                                  : 'No hay artículos en la Nota de Crédito.'
                                }
                              </td>
                            </tr>
                          ) : (
                            creditNoteCart.map((item, idx) => (
                              <tr key={item.productId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '10px 12px' }}>
                                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>SKU: {item.sku}</div>
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>$</span>
                                    <input 
                                      type="number"
                                      className="input"
                                      min="0"
                                      step="0.01"
                                      value={item.unitPrice}
                                      onChange={(e) => {
                                        const val = Math.max(0, Number(e.target.value));
                                        const updated = [...creditNoteCart];
                                        updated[idx].unitPrice = val;
                                        updated[idx].subtotal = item.quantity * val;
                                        setCreditNoteCart(updated);
                                      }}
                                      style={{ width: '90px', padding: '4px 8px', fontSize: '0.85rem' }}
                                    />
                                  </div>
                                </td>
                                {creditNoteForm.orderId && (
                                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                                    {item.orderQuantity}
                                  </td>
                                )}
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <input 
                                    type="number"
                                    className="input"
                                    min="0"
                                    max={creditNoteForm.orderId ? item.orderQuantity : undefined}
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const val = creditNoteForm.orderId 
                                        ? Math.min(item.orderQuantity, Math.max(0, Number(e.target.value)))
                                        : Math.max(0, Number(e.target.value));
                                      const updated = [...creditNoteCart];
                                      updated[idx].quantity = val;
                                      updated[idx].subtotal = val * item.unitPrice;
                                      setCreditNoteCart(updated);
                                    }}
                                    style={{ width: '80px', padding: '4px 8px', textAlign: 'center', fontSize: '0.85rem' }}
                                  />
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                                  ${Number(item.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <button 
                                    type="button" 
                                    className="btn btn-ghost" 
                                    style={{ padding: '2px', color: 'var(--color-danger)' }}
                                    onClick={() => {
                                      setCreditNoteCart(prev => prev.filter(p => p.productId !== item.productId));
                                    }}
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* COLUMNA DERECHA: PARAMETROS Y TOTALES */}
                <div style={{ 
                  backgroundColor: '#f8f8fa', 
                  borderRadius: '8px', 
                  padding: '20px', 
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                    Resumen y Parámetros
                  </h3>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontWeight: 600, fontSize: '0.8rem' }}>Motivo de la Emisión</label>
                    <select 
                      className="input" 
                      value={creditNoteForm.reason} 
                      onChange={(e) => setCreditNoteForm(prev => ({ ...prev, reason: e.target.value }))}
                    >
                      <option value="DEVOLUCION">Devolución física de mercadería</option>
                      <option value="DESCUENTO">Diferencia de precio / Bonificación</option>
                      <option value="ERROR_FACTURACION">Error impositivo / Facturación</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontWeight: 600, fontSize: '0.8rem' }}>Tipo de Comprobante</label>
                    <select 
                      className="input" 
                      value={creditNoteForm.billingType} 
                      onChange={(e) => setCreditNoteForm(prev => ({ ...prev, billingType: e.target.value }))}
                      disabled={selectedCNClient && !selectedCNClient.cuit} 
                    >
                      <option value="INTERNAL">Interno (Presupuesto / Sin AFIP)</option>
                      {selectedCNClient?.cuit && (
                        <option value="OFFICIAL">Oficial (AFIP - Nota de Crédito A o B)</option>
                      )}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontWeight: 600, fontSize: '0.8rem' }}>Comentarios / Notas</label>
                    <textarea 
                      className="input" 
                      rows={3} 
                      value={creditNoteForm.comments}
                      onChange={(e) => setCreditNoteForm(prev => ({ ...prev, comments: e.target.value }))}
                      placeholder="Ingresar comentarios internos o motivos detallados..."
                      style={{ resize: 'none', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Totales */}
                  {(() => {
                    const subtotal = creditNoteCart.reduce((sum, item) => sum + item.subtotal, 0);
                    const net = subtotal / 1.21;
                    const tax = subtotal - net;

                    return (
                      <div style={{ 
                        marginTop: 'auto', 
                        backgroundColor: '#ffffff', 
                        padding: '16px', 
                        borderRadius: '6px', 
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Subtotal Neto:</span>
                          <span style={{ fontWeight: 600 }}>${net.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                        </div>
                        {creditNoteForm.billingType === 'OFFICIAL' && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>IVA Débito Revertido (21%):</span>
                            <span style={{ fontWeight: 600 }}>${tax.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                          <span style={{ fontWeight: 700 }}>Total a Acreditar:</span>
                          <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                            -${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>

                        {selectedCNClient && (
                          <div style={{ 
                            fontSize: '0.78rem', 
                            padding: '8px 12px', 
                            borderRadius: '4px', 
                            backgroundColor: '#e6f4ea', 
                            color: '#137333', 
                            marginTop: '10px',
                            fontWeight: 500,
                            textAlign: 'center'
                          }}>
                            El saldo de C/C bajará a: ${(Number(selectedCNClient.outstandingBalance || 0) - subtotal).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        )}

                        <button 
                          type="submit" 
                          className="btn btn-primary" 
                          disabled={loading || subtotal === 0}
                          style={{ width: '100%', padding: '12px', marginTop: '10px', fontSize: '0.9rem', fontWeight: 600 }}
                        >
                          {loading ? 'Procesando emisión...' : 'Confirmar y Emitir Nota de Crédito'}
                        </button>
                      </div>
                    );
                  })()}

                </div>

              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: DETALLE E IMPRESIÓN DE NOTA DE CRÉDITO
          ==================================================================== */}
      {viewCreditNoteModal && (() => {
        const isOfficial = viewCreditNoteModal.billingType === 'OFFICIAL';
        const formattedDate = viewCreditNoteModal.createdAt 
          ? new Date(viewCreditNoteModal.createdAt).toLocaleDateString('es-AR') 
          : new Date().toLocaleDateString('es-AR');

        return (
          <div className="modal-overlay" style={{ zIndex: 1000 }}>
            <div className="modal-content" style={{ 
              maxWidth: '850px', 
              width: '90vw', 
              maxHeight: '90vh', 
              padding: '24px', 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden' 
            }}>
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Visualización de Comprobante</h2>
                <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setViewCreditNoteModal(null)}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                
                {/* Plantilla de Impresión de Nota de Crédito */}
                <div id="invoice-print-section" style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #1D1D1F',
                  padding: '24px',
                  borderRadius: '6px',
                  color: '#000000',
                  fontSize: '0.8rem',
                  lineHeight: '1.4'
                }}>
                  
                  {/* Cabecera del Ticket */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.4fr 1.2fr', borderBottom: '2px solid #000', paddingBottom: '14px', marginBottom: '14px' }}>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>DISTRIBUIDORA DV</div>
                      <div style={{ fontSize: '0.72rem', color: '#555', marginTop: '4px' }}>
                        <div>Calle Falsa 1234, Quilmes</div>
                        <div>Teléfono: 0800-333-1212</div>
                        <div>Email: administracion@distribuidoradv.com.ar</div>
                        <div>IVA Responsable Inscripto</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{
                        border: '2px solid #000',
                        width: '45px',
                        height: '45px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.6rem',
                        fontWeight: 900,
                        backgroundColor: '#fff'
                      }}>
                        {viewCreditNoteModal.creditNoteType?.includes('_A') ? 'A' :
                         viewCreditNoteModal.creditNoteType?.includes('_B') ? 'B' :
                         viewCreditNoteModal.creditNoteType?.includes('_C') ? 'C' : 'X'}
                      </div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 600, marginTop: '2px', textAlign: 'center' }}>
                        {isOfficial ? 'COMP. OFICIAL' : 'INTERNO'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 900 }}>NOTA DE CRÉDITO</div>
                      <div style={{ fontSize: '0.72rem', color: '#555', marginTop: '4px' }}>
                        <div><strong>Nro:</strong> {viewCreditNoteModal.creditNoteNumber || `00001-${viewCreditNoteModal.id.toString().padStart(8, '0')}`}</div>
                        <div><strong>Fecha:</strong> {formattedDate}</div>
                        <div><strong>CUIT:</strong> 30-71123456-9</div>
                        <div><strong>Ingr. Brutos:</strong> 30-71123456-9</div>
                      </div>
                    </div>
                  </div>

                  {/* Datos del Cliente */}
                  <div style={{ border: '1px solid #000', padding: '10px', borderRadius: '4px', marginBottom: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div><strong>Nombre / Razón Social:</strong> {viewCreditNoteModal.persona?.name || 'Cliente Genérico'}</div>
                      <div><strong>CUIT / DNI:</strong> {viewCreditNoteModal.persona?.cuit || 'S/D'}</div>
                      <div><strong>Domicilio:</strong> {viewCreditNoteModal.persona?.address || 'S/D'}</div>
                      <div><strong>Condición IVA:</strong> {viewCreditNoteModal.creditNoteType?.includes('_A') ? 'Responsable Inscripto' : 'Consumidor Final'}</div>
                    </div>
                  </div>

                  {/* Datos de Vinculación y Motivo */}
                  <div style={{ marginBottom: '14px', fontSize: '0.78rem' }}>
                    <div><strong>Motivo del Crédito:</strong> {
                      viewCreditNoteModal.reason === 'DEVOLUCION' ? 'Devolución física de mercadería' : 
                      viewCreditNoteModal.reason === 'DESCUENTO' ? 'Diferencia de precio / Descuento aplicado' : 
                      'Corrección de error de facturación'
                    }</div>
                    {viewCreditNoteModal.order && (
                      <div style={{ marginTop: '2px' }}>
                        <strong>Vinculado a Factura:</strong> {viewCreditNoteModal.order.invoiceNumber || `Pedido #${viewCreditNoteModal.order.id}`}
                      </div>
                    )}
                    {viewCreditNoteModal.comments && (
                      <div style={{ marginTop: '2px', fontStyle: 'italic' }}>
                        <strong>Observaciones:</strong> {viewCreditNoteModal.comments}
                      </div>
                    )}
                  </div>

                  {/* Tabla de Artículos */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginBottom: '16px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #000', borderTop: '1px solid #000', backgroundColor: '#f0f0f2' }}>
                        <th style={{ padding: '6px', textAlign: 'left', width: '80px' }}>Código</th>
                        <th style={{ padding: '6px', textAlign: 'left' }}>Detalle / Producto</th>
                        <th style={{ padding: '6px', textAlign: 'center', width: '80px' }}>Cant.</th>
                        <th style={{ padding: '6px', textAlign: 'right', width: '100px' }}>Precio Unit.</th>
                        <th style={{ padding: '6px', textAlign: 'right', width: '120px' }}>Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewCreditNoteModal.items && viewCreditNoteModal.items.map((item: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                          <td style={{ padding: '6px' }}>{item.product?.sku || `PROD-${item.productId}`}</td>
                          <td style={{ padding: '6px' }}>{item.product?.name || item.name || `Artículo #${item.productId}`}</td>
                          <td style={{ padding: '6px', textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ padding: '6px', textAlign: 'right' }}>
                            ${Number(item.unitPrice).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600 }}>
                            ${Number(item.subtotal || item.quantity * item.unitPrice).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Desglose de Totales y CAE */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', alignItems: 'end' }}>
                    
                    {/* Información de AFIP */}
                    <div>
                      {isOfficial ? (
                        <div style={{ border: '1px dashed #000', padding: '8px', borderRadius: '4px', fontSize: '0.7rem' }}>
                          <div><strong>CAE Nº:</strong> {viewCreditNoteModal.cae || '99991234567890'}</div>
                          <div style={{ marginTop: '2px' }}><strong>Fecha de Vto. de CAE:</strong> {
                            viewCreditNoteModal.caeDueDate 
                              ? new Date(viewCreditNoteModal.caeDueDate).toLocaleDateString('es-AR') 
                              : new Date(Date.now() + 10 * 24 * 3600 * 1000).toLocaleDateString('es-AR')
                          }</div>
                          <div style={{ marginTop: '4px', fontSize: '0.62rem', color: '#555' }}>
                            Comprobante autorizado por la Administración Federal de Ingresos Públicos (AFIP).
                          </div>
                        </div>
                      ) : (
                        <div style={{ border: '1px solid #ccc', padding: '8px', borderRadius: '4px', fontSize: '0.7rem', color: '#555', backgroundColor: '#fafafa' }}>
                          <div><strong>DOCUMENTO DE USO INTERNO</strong></div>
                          <div style={{ marginTop: '2px' }}>Ajuste de saldo en Cuenta Corriente.</div>
                          <div style={{ marginTop: '2px' }}>Emitido por: {viewCreditNoteModal.user?.username || 'admin'}</div>
                        </div>
                      )}
                    </div>

                    {/* Importes final */}
                    <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Subtotal Neto:</span>
                        <span style={{ fontWeight: 600 }}>
                          ${Number(viewCreditNoteModal.netAmount || viewCreditNoteModal.totalAmount / 1.21).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      {isOfficial && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>IVA (21%):</span>
                          <span style={{ fontWeight: 600 }}>
                            ${Number(viewCreditNoteModal.taxAmount || viewCreditNoteModal.totalAmount - (viewCreditNoteModal.totalAmount / 1.21)).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #000', paddingTop: '6px', fontSize: '1rem', fontWeight: 900 }}>
                        <span>TOTAL CREDITO:</span>
                        <span>
                          -${Number(viewCreditNoteModal.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>

                  </div>

                </div>

              </div>

              {/* Botones de Acción */}
              <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setViewCreditNoteModal(null)}>Cerrar</button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={16} />
                  Imprimir Comprobante
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {viewInvoiceModal && (() => {
        const isOfficial = viewInvoiceModal.billingType === 'OFFICIAL' || viewInvoiceModal.invoiceType === 'FACTURA_A' || viewInvoiceModal.invoiceType === 'FACTURA_B' || viewInvoiceModal.invoiceType === 'FACTURA_C';
        const issueDateStr = viewInvoiceModal.issueDate || viewInvoiceModal.createdAt;
        const formattedDate = issueDateStr ? new Date(issueDateStr).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR');

        return (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '850px', width: '95vw', padding: '24px', maxHeight: '95vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Vista Previa de Comprobante</h3>
                <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setViewInvoiceModal(null)}><X size={18} /></button>
              </div>

              {/* FACTURA IMPRIMIBLE CON EL FORMATO DON VENANCIO */}
              <div id="invoice-print-section" style={{
                fontFamily: 'Arial, sans-serif',
                color: '#000000',
                backgroundColor: '#ffffff',
                padding: '20px',
                border: '1px solid #7F8C8D',
                borderRadius: '4px',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                {/* BARRA SUPERIOR ORIGINAL */}
                <div style={{
                  backgroundColor: '#D6E4F0',
                  border: '1px solid #7F8C8D',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  padding: '4px 0',
                  fontSize: '0.85rem',
                  letterSpacing: '0.1em',
                  borderBottom: 'none'
                }}>
                  ORIGINAL
                </div>

                {/* SECCION CABECERA (Logo, Tipo Factura, Datos Emisor) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.6fr 1.2fr', border: '1px solid #7F8C8D', minHeight: '140px' }}>
                  
                  {/* Lado Izquierdo: Emisor */}
                  <div style={{ padding: '12px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', borderRight: '1px solid #7F8C8D', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <img src="/logo.png" alt="Logo" style={{ height: '42px', objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-color)', letterSpacing: '-0.02em' }}>DON VENANCIO</span>
                    </div>
                    <div><strong>MARTIN PABLO DAVID</strong></div>
                    <div>Domicilio: PRINGLES 116 - GENERAL VILLEGAS - BUENOS AIRES</div>
                    <div>Teléfono: 5493388526852</div>
                    <div>E-mail: contacto@donvenancio.com.ar</div>
                    <div>Condicion frente al IVA: RESPONSABLE INSCRIPTO</div>
                  </div>

                  {/* Centro: Letra A/B/C/X */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #7F8C8D', backgroundColor: '#ffffff', zIndex: 2, position: 'relative', minHeight: '100%' }}>
                    <div style={{ fontSize: '2.4rem', fontWeight: 900, lineHeight: 1, border: '1px solid #7F8C8D', padding: '4px 14px', backgroundColor: '#ffffff', marginTop: '12px' }}>
                      {viewInvoiceModal.invoiceType === 'FACTURA_A' ? 'A' :
                       viewInvoiceModal.invoiceType === 'FACTURA_B' ? 'B' :
                       viewInvoiceModal.invoiceType === 'FACTURA_C' ? 'C' : 'X'}
                    </div>
                    <div style={{ fontSize: '0.625rem', fontWeight: 'bold', marginTop: '6px', textTransform: 'uppercase' }}>
                      {viewInvoiceModal.invoiceType === 'FACTURA_A' ? 'COD. 001' :
                       viewInvoiceModal.invoiceType === 'FACTURA_B' ? 'COD. 006' :
                       viewInvoiceModal.invoiceType === 'FACTURA_C' ? 'COD. 011' : 'COD. 000'}
                    </div>
                  </div>

                  {/* Lado Derecho: Datos Factura */}
                  <div style={{ padding: '12px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', paddingLeft: '16px', textAlign: 'left' }}>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 4px 0', letterSpacing: '0.02em', textTransform: 'uppercase', color: '#000000' }}>
                      {!isOfficial ? 'REMITO' : 'FACTURA'}
                    </h1>
                    <div style={{ marginBottom: '4px' }}>
                      <strong>Punto de Venta: 0005</strong> &nbsp;&nbsp; 
                      <strong>Comp. Nro: {viewInvoiceModal.invoiceNumber?.split('-')[1] || viewInvoiceModal.invoiceNumber || '00000000'}</strong>
                    </div>
                    <div><strong>CUIT:</strong> 20163165059</div>
                    <div><strong>Ingresos Brutos:</strong> 911-440570-8</div>
                    <div><strong>Fecha de Inicio de Actividades:</strong> 01/10/1996</div>
                  </div>

                </div>

                {/* SECCION DATOS RECEPTOR */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginTop: '12px' }}>
                  
                  {/* Datos Cliente */}
                  <div style={{ border: '1px solid #7F8C8D', padding: '12px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px', borderRadius: '4px', backgroundColor: '#ffffff', textAlign: 'left' }}>
                    <div style={{ backgroundColor: '#D6E4F0', fontWeight: 'bold', padding: '2px 8px', margin: '-12px -12px 8px -12px', borderBottom: '1px solid #7F8C8D', borderTopLeftRadius: '3px', borderTopRightRadius: '3px' }}>
                      Señor/es
                    </div>
                    <div><strong>Nombre / Razón Social:</strong> {viewInvoiceModal.persona?.name || 'Consumidor Final'}</div>
                    <div><strong>Domicilio:</strong> {viewInvoiceModal.persona?.address || 'Retiro en Local'}</div>
                    <div><strong>CUIT / DNI:</strong> {viewInvoiceModal.persona?.cuit || 'S/D'}</div>
                    <div><strong>Categoría de IVA:</strong> {viewInvoiceModal.invoiceType === 'FACTURA_A' ? 'Responsable Inscripto' : 'Consumidor Final'}</div>
                  </div>

                  {/* Fecha y Moneda */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* F. Emision */}
                    <div style={{ border: '1px solid #7F8C8D', borderRadius: '4px', overflow: 'hidden', fontSize: '0.75rem', textAlign: 'center' }}>
                      <div style={{ backgroundColor: '#D6E4F0', fontWeight: 'bold', padding: '2px 4px', borderBottom: '1px solid #7F8C8D' }}>F. EMISION</div>
                      <div style={{ padding: '6px', backgroundColor: '#ffffff', fontWeight: 'bold' }}>
                        {formattedDate}
                      </div>
                    </div>
                    {/* Moneda */}
                    <div style={{ border: '1px solid #7F8C8D', borderRadius: '4px', overflow: 'hidden', fontSize: '0.75rem', textAlign: 'center' }}>
                      <div style={{ backgroundColor: '#D6E4F0', fontWeight: 'bold', padding: '2px 4px', borderBottom: '1px solid #7F8C8D' }}>MONEDA</div>
                      <div style={{ padding: '6px', backgroundColor: '#ffffff', fontWeight: 'bold' }}>PESOS</div>
                    </div>
                  </div>

                </div>

                {/* CONDICION DE VENTA Y SALDO ANTERIOR */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px', marginBottom: '12px' }}>
                  <div style={{ border: '1px solid #7F8C8D', borderRadius: '4px', display: 'flex', fontSize: '0.75rem', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#D6E4F0', fontWeight: 'bold', padding: '6px 12px', borderRight: '1px solid #7F8C8D', width: '130px', textAlign: 'center' }}>Condición de Venta</div>
                    <div style={{ padding: '6px 12px', fontWeight: 'bold', backgroundColor: '#ffffff', flex: 1, textAlign: 'center' }}>
                      {viewInvoiceModal.paymentMethod === 'BANK_TRANSFER' ? 'TRANSFERENCIA' :
                       viewInvoiceModal.paymentMethod === 'CHECK' ? 'CHEQUE' :
                       viewInvoiceModal.paymentMethod === 'CASH' ? 'EFECTIVO' : 'CUENTA CORRIENTE'}
                    </div>
                  </div>

                  <div style={{ border: '1px solid #7F8C8D', borderRadius: '4px', display: 'flex', fontSize: '0.75rem', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#D6E4F0', fontWeight: 'bold', padding: '6px 12px', borderRight: '1px solid #7F8C8D', width: '110px', textAlign: 'center' }}>Saldo Anterior</div>
                    <div style={{ padding: '6px 12px', fontWeight: 'bold', backgroundColor: '#ffffff', flex: 1, textAlign: 'center', color: '#c0392b' }}>
                      ${Number(viewInvoiceModal.persona?.outstandingBalance || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>

                {/* GRILLA DE PRODUCTOS */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #7F8C8D', fontSize: '0.75rem', marginTop: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#D6E4F0', borderBottom: '1px solid #7F8C8D' }}>
                      <th style={{ padding: '6px', borderRight: '1px solid #7F8C8D', textAlign: 'center', width: '80px' }}>Cantidad</th>
                      <th style={{ padding: '6px', borderRight: '1px solid #7F8C8D', textAlign: 'left' }}>Producto/Servicio/Detalle</th>
                      <th style={{ padding: '6px', borderRight: '1px solid #7F8C8D', textAlign: 'center', width: '60px' }}>% IVA</th>
                      <th style={{ padding: '6px', borderRight: '1px solid #7F8C8D', textAlign: 'right', width: '100px' }}>Precio (c/ IVA)</th>
                      <th style={{ padding: '6px', textAlign: 'right', width: '110px' }}>Total (s/ IVA)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewInvoiceModal.items && viewInvoiceModal.items.map((item: any, idx: number) => {
                      const unitPriceWithIva = Number(item.price || item.listPrice || 0);
                      const totalWithIva = item.quantity * unitPriceWithIva;
                      const totalWithoutIva = isOfficial ? totalWithIva / 1.21 : totalWithIva;
                      const taxRate = isOfficial ? 21.00 : 0.00;

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #E5E5EA' }}>
                          <td style={{ padding: '6px', borderRight: '1px solid #7F8C8D', textAlign: 'center' }}>
                            {item.quantity.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                          <td style={{ padding: '6px', borderRight: '1px solid #7F8C8D', fontWeight: 500, textAlign: 'left' }}>
                            {item.productName || item.name || `Producto ID #${item.productId}`}
                          </td>
                          <td style={{ padding: '6px', borderRight: '1px solid #7F8C8D', textAlign: 'center' }}>
                            {taxRate.toFixed(2)}
                          </td>
                          <td style={{ padding: '6px', borderRight: '1px solid #7F8C8D', textAlign: 'right' }}>
                            ${unitPriceWithIva.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600 }}>
                            ${totalWithoutIva.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* TOTALES Y AFIP/ARCA FOOTER */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginTop: '16px', alignItems: 'flex-end' }}>
                  
                  {/* ARCA / CAE (Lado Izquierdo) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.72rem', textAlign: 'left' }}>
                    {isOfficial ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #7F8C8D', padding: '6px', borderRadius: '4px', backgroundColor: '#ffffff' }}>
                          {/* ARCA QR mock */}
                          <div style={{ width: '42px', height: '42px', backgroundColor: '#000000', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.45rem', fontFamily: 'monospace', textAlign: 'center', padding: '2px' }}>
                            [QR ARCA]
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 900, color: '#000000', letterSpacing: '0.05em', lineHeight: 1 }}>ARCA</span>
                            <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Comprobante Autorizado</div>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#000000', lineHeight: '1.4' }}>
                          <div><strong>CAE Nº:</strong> {viewInvoiceModal.cae || '86251033241354'}</div>
                          <div><strong>Fecha de Vto. de CAE:</strong> {viewInvoiceModal.caeDueDate ? new Date(viewInvoiceModal.caeDueDate).toLocaleDateString('es-AR') : '04/07/2026'}</div>
                        </div>
                      </>
                    ) : (
                      <div style={{ border: '1px dashed #7F8C8D', padding: '12px', borderRadius: '4px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        Documento Interno - No válido como factura comercial.
                      </div>
                    )}
                  </div>

                  {/* Desglose de importes (Lado Derecho) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E5EA', padding: '3px 0' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Neto Gravado:</span>
                      <span style={{ fontWeight: 600 }}>${Number(viewInvoiceModal.netAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E5EA', padding: '3px 0' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Exento:</span>
                      <span style={{ fontWeight: 600 }}>$0,00</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E5EA', padding: '3px 0' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>IVA (21%):</span>
                      <span style={{ fontWeight: 600 }}>${Number(viewInvoiceModal.taxAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>

                    {Number(viewInvoiceModal.percepcionAmount || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E5EA', padding: '3px 0' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Percep. de IVA RG 5329:</span>
                        <span style={{ fontWeight: 600 }}>${Number(viewInvoiceModal.percepcionAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                    )}

                    <div style={{ backgroundColor: '#D6E4F0', border: '1px solid #7F8C8D', display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: '1.05rem', fontWeight: 'bold', marginTop: '6px', borderRadius: '4px' }}>
                      <span>TOTAL:</span>
                      <span>${Number(viewInvoiceModal.totalAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>

                  </div>

                </div>

                {/* Footer del software */}
                <div style={{ textAlign: 'center', fontSize: '0.625rem', color: 'var(--text-secondary)', borderTop: '1px solid #E5E5EA', paddingTop: '8px', marginTop: '20px' }}>
                  Software de Gestión provisto por Distribuidora DV S.A. - CUIT 30-71112223-9
                </div>

              </div>

              {/* Botonera de acciones */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setViewInvoiceModal(null)}>Cerrar</button>
                <button 
                  type="button"
                  className="btn btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    window.print();
                  }}
                >
                  <Printer size={16} />
                  Imprimir Factura
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Animaciones CSS Locales */}
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-print-section, #invoice-print-section * {
            visibility: visible;
          }
          #invoice-print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

    </div>
  );
}
