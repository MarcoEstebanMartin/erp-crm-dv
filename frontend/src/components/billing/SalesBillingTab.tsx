import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../utils/api';
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  Printer, 
  X,
  CheckCircle
} from 'lucide-react';

interface SalesBillingTabProps {
  salesInvoices: any[];
  personas: any[];
  products: any[];
  bankAccounts: any[];
  activeDrawers: any[];
  loading: boolean;
  loadData: () => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
  handleCreateCreditNoteFromInvoice: (invoice: any) => void;
}

export default function SalesBillingTab({
  salesInvoices,
  personas,
  products,
  bankAccounts,
  activeDrawers,
  loading,
  loadData,
  setErrorMsg,
  setSuccessMsg,
  handleCreateCreditNoteFromInvoice
}: SalesBillingTabProps) {
  // Modal view states
  const [showDirectInvoiceModal, setShowDirectInvoiceModal] = useState(false);
  const [viewInvoiceModal, setViewInvoiceModal] = useState<any | null>(null);

  // Direct Invoice state
  const [directInvoiceForm, setDirectInvoiceForm] = useState({
    personaId: '',
    billingType: 'INTERNAL',
    immediatePayment: true,
    paymentMethod: 'CASH',
    cashDrawerId: '',
    bankAccountId: '',
    checkNumber: '',
    checkIssuer: '',
    isEcheq: false
  });
  const [directCart, setDirectCart] = useState<any[]>([]);
  const [selectedDirectProduct, setSelectedDirectProduct] = useState('');
  const [directProductQty, setDirectProductQty] = useState('1');
  const [ivaPerceptionAliquot] = useState(3.00);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Search queries
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [activeClientSuggestionIdx, setActiveClientSuggestionIdx] = useState<number>(0);
  const clientSearchInputRef = useRef<HTMLInputElement>(null);

  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [activeProductSuggestionIdx, setActiveProductSuggestionIdx] = useState<number>(0);
  const productSearchInputRef = useRef<HTMLInputElement>(null);
  const productQtyInputRef = useRef<HTMLInputElement>(null);

  // Tab filter
  const [salesInvoiceTypeFilter, setSalesInvoiceTypeFilter] = useState<'ALL' | 'OFFICIAL' | 'INTERNAL'>('ALL');

  // Filter clients
  const clientsOnly = useMemo(() => {
    return personas.filter(p => p.isClient);
  }, [personas]);

  // Autocomplete filtered lists
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery) return clientsOnly.slice(0, 10);
    const q = clientSearchQuery.toUpperCase();
    return clientsOnly.filter((c: any) => 
      c.name.toUpperCase().includes(q) || (c.cuit && c.cuit.includes(q))
    ).slice(0, 10);
  }, [clientSearchQuery, clientsOnly]);

  const filteredProducts = useMemo(() => {
    if (!productSearchQuery) return products.slice(0, 10);
    const q = productSearchQuery.toUpperCase();
    return products.filter((p: any) => 
      p.name.toUpperCase().includes(q) || 
      (p.sku && p.sku.toUpperCase().includes(q)) || 
      (p.barcode && p.barcode.includes(q))
    ).slice(0, 10);
  }, [productSearchQuery, products]);

  const selectedDirectClient = useMemo(() => {
    if (!directInvoiceForm.personaId) return null;
    return personas.find((p: any) => p.id === Number(directInvoiceForm.personaId));
  }, [directInvoiceForm.personaId, personas]);

  // Set default bank and drawer when modal opens
  useEffect(() => {
    if (showDirectInvoiceModal) {
      if (bankAccounts.length > 0) {
        setDirectInvoiceForm(prev => ({
          ...prev,
          bankAccountId: bankAccounts[0].id.toString()
        }));
      }
      if (activeDrawers.length > 0) {
        setDirectInvoiceForm(prev => ({
          ...prev,
          cashDrawerId: activeDrawers[0].id.toString()
        }));
      }
    }
  }, [showDirectInvoiceModal, bankAccounts, activeDrawers]);

  // Select client handler
  const handleSelectClient = (c: any) => {
    setDirectInvoiceForm(prev => ({ ...prev, personaId: String(c.id) }));
    setClientSearchQuery(c.name);
    setShowClientDropdown(false);
    setDirectCart([]); // Reset cart
    setTimeout(() => {
      productSearchInputRef.current?.focus();
    }, 50);
  };

  const handleSelectProduct = (p: any) => {
    setSelectedDirectProduct(String(p.id));
    setProductSearchQuery(p.name);
    setShowProductDropdown(false);
    const minQty = p.minOrderQuantity || 1;
    setDirectProductQty(String(minQty));
  };

  // Direct Invoicing totals calculation
  const directBillingTotals = useMemo(() => {
    let subtotalSum = directCart.reduce((sum, item) => sum + item.subtotal, 0);
    let net = subtotalSum;
    let tax = 0;
    let percepIIBB = 0;
    let percepIVA = 0;
    let total = subtotalSum;

    if (directInvoiceForm.billingType === 'OFFICIAL') {
      const isFacturaA = selectedDirectClient && selectedDirectClient.cuit && selectedDirectClient.cuit.replace(/-/g, '').length === 11;
      if (isFacturaA) {
        const iibbAliquot = Number(selectedDirectClient.iibbAliquot || 0);
        const applyIvaPerc = subtotalSum > 100000;
        const currentIvaPerc = applyIvaPerc ? ivaPerceptionAliquot : 0;

        net = subtotalSum / (1.21 + (iibbAliquot / 100) + (currentIvaPerc / 100));
        tax = net * 0.21;
        percepIIBB = net * (iibbAliquot / 100);
        percepIVA = net * (currentIvaPerc / 100);
      } else {
        net = subtotalSum / 1.21;
        tax = subtotalSum - net;
      }
    } else {
      net = subtotalSum;
      tax = 0;
      percepIIBB = 0;
      percepIVA = 0;
    }

    const isFacturaA = directInvoiceForm.billingType === 'OFFICIAL' && selectedDirectClient && selectedDirectClient.cuit && selectedDirectClient.cuit.replace(/-/g, '').length === 11;
    return {
      net: isFacturaA ? Number(net.toFixed(2)) : Math.round(net),
      tax: isFacturaA ? Number(tax.toFixed(2)) : Math.round(tax),
      percepcion: isFacturaA ? Number(percepIIBB.toFixed(2)) : Math.round(percepIIBB),
      percepcionIva: isFacturaA ? Number(percepIVA.toFixed(2)) : Math.round(percepIVA),
      total: Math.round(total)
    };
  }, [directCart, directInvoiceForm.billingType, selectedDirectClient, ivaPerceptionAliquot]);

  // Add item to cart
  const handleAddDirectProduct = () => {
    if (!selectedDirectProduct) return;
    const prod = products.find(p => p.id === Number(selectedDirectProduct));
    if (!prod) return;

    let qty = Number(directProductQty);
    if (isNaN(qty) || qty <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    const minQty = prod.minOrderQuantity || 1;
    if (qty < minQty) {
      qty = minQty;
      setDirectProductQty(String(minQty));
      setModalError(`⚠️ El producto "${prod.name}" exige un mínimo de ${minQty} unidades. Se ajustó automáticamente la cantidad.`);
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

  const handleRemoveDirectProduct = (prodId: number) => {
    setDirectCart(prev => prev.filter(item => item.product.id !== prodId));
  };

  // Submit direct invoice
  const handleCreateDirectInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setModalError(null);

    const { personaId, billingType, immediatePayment, paymentMethod, cashDrawerId, bankAccountId } = directInvoiceForm;

    if (!personaId || !billingType || directCart.length === 0) {
      const msg = 'Por favor selecciona un cliente y añade al menos un producto.';
      setErrorMsg(msg);
      setModalError(msg);
      return;
    }

    // Auto-fallback para caja operativa y banco si no estaban asignados en el state
    let effectiveCashDrawerId = cashDrawerId;
    if (immediatePayment && paymentMethod === 'CASH' && !effectiveCashDrawerId && activeDrawers.length > 0) {
      effectiveCashDrawerId = activeDrawers[0].id.toString();
    }

    let effectiveBankAccountId = bankAccountId;
    if (immediatePayment && paymentMethod === 'BANK_TRANSFER' && !effectiveBankAccountId && bankAccounts.length > 0) {
      effectiveBankAccountId = bankAccounts[0].id.toString();
    }

    const isDrawerInvalid = immediatePayment && paymentMethod === 'CASH' && (!effectiveCashDrawerId || activeDrawers.length === 0);

    if (isDrawerInvalid) {
      let msg = '';
      if (activeDrawers.length === 0) {
        msg = 'No se puede cobrar en efectivo. Verifique que posee una caja operativa abierta.';
      } else {
        msg = 'No se puede cobrar en efectivo. Por favor, seleccione una caja operativa.';
      }
      setErrorMsg(msg);
      setModalError(msg);
      return;
    }

    setIsSubmitting(true);

    try {
      const reqData: any = {
        personaId: Number(personaId),
        billingType,
        paymentMethod: immediatePayment ? paymentMethod : undefined,
        cashDrawerId: immediatePayment && paymentMethod === 'CASH' ? Number(effectiveCashDrawerId) : undefined,
        bankAccountId: immediatePayment && paymentMethod === 'BANK_TRANSFER' ? Number(effectiveBankAccountId) : undefined,
        items: directCart.map(item => ({ 
          productId: item.product.id, 
          quantity: item.quantity,
          weight: item.weight || null,
          isEmergencyOverride: Boolean(item.isEmergencyOverride || (item.quantity < (item.product.minOrderQuantity || 1)))
        }))
      };

      if (immediatePayment && paymentMethod === 'CHECK') {
        reqData.checkNumber = directInvoiceForm.checkNumber;
        reqData.checkIssuer = directInvoiceForm.isEcheq 
          ? `${directInvoiceForm.checkIssuer} (Echeq)` 
          : directInvoiceForm.checkIssuer;
      }

      const res = await api.createDirectInvoice(reqData);

      setSuccessMsg(`✅ Factura directa emitida con éxito. Comprobante: ${res?.invoiceNumber || 'Emitido'}`);
      setShowDirectInvoiceModal(false);
      setModalError(null);
      
      // Clear form
      setDirectCart([]);
      setDirectInvoiceForm({
        personaId: '',
        billingType: 'INTERNAL',
        immediatePayment: true,
        paymentMethod: 'CASH',
        cashDrawerId: '',
        bankAccountId: '',
        checkNumber: '',
        checkIssuer: '',
        isEcheq: false
      });
      setClientSearchQuery('');
      setProductSearchQuery('');
      loadData();
    } catch (err: any) {
      console.error('Error al emitir factura directa:', err);
      const msg = err.message || 'Error al emitir factura directa.';
      setErrorMsg(msg);
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 className="card-title" style={{ margin: '0' }}>🧾 Facturas y Comprobantes de Venta Emitidos</h3>
            <p style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--text-secondary)' }}>Solo se muestran pedidos con facturación fiscal o presupuestos en estado entregado.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select 
              className="select" 
              value={salesInvoiceTypeFilter}
              onChange={(e) => setSalesInvoiceTypeFilter(e.target.value as any)}
              style={{ width: '150px' }}
            >
              <option value="ALL">Todos</option>
              <option value="OFFICIAL">Oficiales (A/B)</option>
              <option value="INTERNAL">Internos (Presup.)</option>
            </select>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowDirectInvoiceModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              Emitir Factura Directa
            </button>
          </div>
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
                         inv.invoiceType === 'FACTURA_C' ? 'Factura C' : 'Factura'}
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
                    <td>${Number(inv.netAmount || 0).toLocaleString('es-AR', (inv.billingType === 'OFFICIAL' && inv.invoiceType === 'FACTURA_A') ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td>${Number(inv.taxAmount || 0).toLocaleString('es-AR', (inv.billingType === 'OFFICIAL' && inv.invoiceType === 'FACTURA_A') ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td>
                      {Number(inv.percepcionAmount || 0) > 0 ? (
                        <span style={{ color: 'var(--color-warning)', fontWeight: 500 }}>
                          ${Number(inv.percepcionAmount).toLocaleString('es-AR', (inv.billingType === 'OFFICIAL' && inv.invoiceType === 'FACTURA_A') ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      ) : '$0'}
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
                          Ver Factura
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

      {/* ====================================================================
          MODAL: EMITIR FACTURA DE VENTA DIRECTA (CARRITO)
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
                  immediatePayment: true,
                  paymentMethod: 'CASH',
                  cashDrawerId: '',
                  bankAccountId: '',
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
                        <div className="suggestions-list" style={{ position: 'absolute', zIndex: 100, width: '100%', maxHeight: '200px', overflowY: 'auto', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', boxShadow: 'var(--shadow-md)' }}>
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
                                  cursor: 'pointer',
                                  padding: '8px 12px',
                                  fontSize: '0.85rem',
                                  borderBottom: '1px solid #f0f0f0'
                                }}
                              >
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  CUIT: {c.cuit || 'S/D'} | Saldo CC: {Number(c.outstandingBalance || 0) < 0 ? `$${Math.abs(Number(c.outstandingBalance)).toLocaleString()} (A Favor)` : `$${Number(c.outstandingBalance || 0).toLocaleString()}`} | Lista: {c.priceList || 'A'}
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
                          {(!selectedDirectClient.priceList || selectedDirectClient.priceList === 'A' || selectedDirectClient.priceList === '4' || selectedDirectClient.priceList === 'SUCURSAL A') 
                            ? 'Lista 4' 
                            : (selectedDirectClient.priceList === 'B' || selectedDirectClient.priceList === 'Especial')
                              ? 'Lista Especial' 
                              : (selectedDirectClient.priceList === 'C' || selectedDirectClient.priceList === 'Especial 2')
                                ? 'Lista Especial 2' 
                                : selectedDirectClient.priceList}
                        </span>
                      </div>
                      <div>
                        <strong>Tiene Cta. Corriente:</strong>{' '}
                        <span style={{ 
                          fontWeight: 700, 
                          color: (Number(selectedDirectClient.creditLimit || 0) > 0 || Number(selectedDirectClient.paymentTermDays || 0) > 0) ? '#059669' : '#64748b' 
                        }}>
                          {(Number(selectedDirectClient.creditLimit || 0) > 0 || Number(selectedDirectClient.paymentTermDays || 0) > 0) 
                            ? `SÍ ${Number(selectedDirectClient.creditLimit || 0) > 0 ? `(Límite: $${Number(selectedDirectClient.creditLimit).toLocaleString()})` : ''}` 
                            : 'NO (Solo Contado)'}
                        </span>
                      </div>
                      <div>
                        <strong>Saldo Cuenta Corriente:</strong>{' '}
                        <span style={{ 
                          color: Number(selectedDirectClient.outstandingBalance || 0) > 0 
                            ? 'var(--color-danger)' 
                            : Number(selectedDirectClient.outstandingBalance || 0) < 0 
                              ? 'var(--color-success)' 
                              : 'inherit', 
                          fontWeight: 700 
                        }}>
                          {Number(selectedDirectClient.outstandingBalance || 0) < 0 
                            ? `$${Math.abs(Number(selectedDirectClient.outstandingBalance)).toLocaleString()} (A Favor)` 
                            : `$${Number(selectedDirectClient.outstandingBalance || 0).toLocaleString()}`}
                        </span>
                      </div>

                      <div>
                        <strong>Boletas Pendientes:</strong>{' '}
                        <span style={{ 
                          fontWeight: 700,
                          color: (selectedDirectClient.pendingInvoicesCount || 0) > 0 
                            ? ((Number(selectedDirectClient.maxUnpaidInvoices || 0) > 0 && (selectedDirectClient.pendingInvoicesCount || 0) >= Number(selectedDirectClient.maxUnpaidInvoices)) ? 'var(--color-danger)' : '#d97706') 
                            : '#059669'
                        }}>
                          {selectedDirectClient.pendingInvoicesCount || 0}
                          {Number(selectedDirectClient.maxUnpaidInvoices || 0) > 0 
                            ? ` de ${Number(selectedDirectClient.maxUnpaidInvoices)} máx. permitida${Number(selectedDirectClient.maxUnpaidInvoices) > 1 ? 's' : ''}` 
                            : ' (Sin límite)'}
                        </span>
                      </div>
                      
                      {Number(selectedDirectClient.maxUnpaidInvoices || 0) > 0 && (selectedDirectClient.pendingInvoicesCount || 0) >= Number(selectedDirectClient.maxUnpaidInvoices) && (
                        <div style={{ gridColumn: 'span 2', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '6px 10px', color: '#991b1b', fontWeight: 600, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          ⚠️ Límite de boletas alcanzado: El cliente debe {selectedDirectClient.pendingInvoicesCount || 0} de {Number(selectedDirectClient.maxUnpaidInvoices)} boletas permitidas.
                        </div>
                      )}

                      {Number(selectedDirectClient.outstandingBalance || 0) > 0 && !(Number(selectedDirectClient.maxUnpaidInvoices || 0) > 0 && (selectedDirectClient.pendingInvoicesCount || 0) >= Number(selectedDirectClient.maxUnpaidInvoices)) && (
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
                            placeholder="Escribí para buscar producto o escaneá código..."
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
                                  filteredProducts.length > 0 ? (prev + 1) % filteredProducts.length : 0
                                );
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setShowProductDropdown(true);
                                setActiveProductSuggestionIdx((prev: number) => 
                                  filteredProducts.length > 0 ? (prev - 1 + filteredProducts.length) % filteredProducts.length : 0
                                );
                              } else if (e.key === 'Enter') {
                                if (showProductDropdown && filteredProducts.length > 0) {
                                  e.preventDefault();
                                  handleSelectProduct(filteredProducts[activeProductSuggestionIdx]);
                                  setTimeout(() => productQtyInputRef.current?.focus(), 50);
                                }
                              }
                            }}
                            style={{ fontSize: '0.9rem' }}
                          />
                          {showProductDropdown && filteredProducts.length > 0 && (
                            <div className="suggestions-list" style={{ position: 'absolute', zIndex: 100, width: '100%', maxHeight: '200px', overflowY: 'auto', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', boxShadow: 'var(--shadow-md)' }}>
                              {filteredProducts.map((p, idx) => {
                                const isActive = idx === activeProductSuggestionIdx;
                                return (
                                  <div
                                    key={p.id}
                                    className={`suggestion-item ${isActive ? 'active' : ''}`}
                                    onMouseDown={() => {
                                      handleSelectProduct(p);
                                      setTimeout(() => productQtyInputRef.current?.focus(), 50);
                                    }}
                                    onMouseEnter={() => setActiveProductSuggestionIdx(idx)}
                                    style={{
                                      backgroundColor: isActive ? '#e8f0fe' : 'inherit',
                                      cursor: 'pointer',
                                      padding: '8px 12px',
                                      fontSize: '0.85rem',
                                      borderBottom: '1px solid #f0f0f0'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <strong>{p.name}</strong>
                                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        {p.minOrderQuantity && p.minOrderQuantity > 1 && (
                                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d97706', backgroundColor: '#fef3c7', padding: '1px 5px', borderRadius: '4px' }}>
                                            Mín: {p.minOrderQuantity} u.
                                          </span>
                                        )}
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: p.stock > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>Stock: {p.stock}</span>
                                      </div>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                      SKU: {p.sku || 'S/D'} | Precio Lista: ${p.listPrice} {p.isPesable ? '(Pesable)' : ''}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div style={{ width: '100px' }}>
                          <input
                            ref={productQtyInputRef}
                            type="number"
                            className="input"
                            min="1"
                            placeholder="Cant"
                            value={directProductQty}
                            onChange={(e) => setDirectProductQty(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddDirectProduct();
                                setTimeout(() => productSearchInputRef.current?.focus(), 50);
                              }
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            handleAddDirectProduct();
                            setTimeout(() => productSearchInputRef.current?.focus(), 50);
                          }}
                        >
                          Añadir
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Detalle de Productos Añadidos (Tabla del Carrito) */}
                  <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff', minHeight: '180px' }}>
                    <table style={{ margin: 0 }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-app)' }}>
                        <tr>
                          <th>Producto</th>
                          <th>Precio Unit.</th>
                          <th style={{ width: '100px' }}>Cant.</th>
                          <th style={{ width: '110px' }}>Kilos</th>
                          <th>Subtotal</th>
                          <th style={{ width: '40px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {directCart.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                              El carrito de compras está vacío.
                            </td>
                          </tr>
                        ) : (
                          directCart.map((item, index) => (
                            <tr key={item.product.id}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{item.product.name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span>SKU: {item.product.sku}</span>
                                  {item.product.minOrderQuantity && item.product.minOrderQuantity > 1 && (
                                    <span style={{ 
                                      color: item.quantity < item.product.minOrderQuantity ? '#d97706' : '#059669', 
                                      fontWeight: 600,
                                      fontSize: '0.68rem',
                                      backgroundColor: item.quantity < item.product.minOrderQuantity ? '#fef3c7' : '#ecfdf5',
                                      padding: '1px 5px',
                                      borderRadius: '4px'
                                    }}>
                                      {item.quantity < item.product.minOrderQuantity ? `⚠️ Mínimo exigido: ${item.product.minOrderQuantity} u.` : `Mín. ${item.product.minOrderQuantity} u. OK`}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>${Number(item.unitPrice).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td>
                                <input
                                  type="number"
                                  className="input"
                                  style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (val > 0) {
                                      const newCart = [...directCart];
                                      newCart[index].quantity = val;
                                      newCart[index].weight = item.product.isPesable ? (val * (item.product.approximateWeight || 1)) : null;
                                      newCart[index].subtotal = Number((item.unitPrice * (item.product.isPesable ? newCart[index].weight : val)).toFixed(2));
                                      setDirectCart(newCart);
                                    }
                                  }}
                                />
                              </td>
                              <td>
                                {item.product.isPesable ? (
                                  <input
                                    type="number"
                                    step="0.001"
                                    className="input"
                                    style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                    value={item.weight || ''}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      if (val >= 0) {
                                        const newCart = [...directCart];
                                        newCart[index].weight = val;
                                        newCart[index].subtotal = Number((item.unitPrice * val).toFixed(2));
                                        setDirectCart(newCart);
                                      }
                                    }}
                                  />
                                ) : (
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No Aplica</span>
                                )}
                              </td>
                              <td style={{ fontWeight: 600 }}>
                                ${Number(item.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td>
                                <button type="button" className="btn btn-ghost" style={{ color: 'var(--color-danger)', padding: '4px' }} onClick={() => handleRemoveDirectProduct(item.product.id)}>
                                  <TrashIcon size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* COLUMNA DERECHA: PARAMETROS DE FACTURACION Y PAGO */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '1px solid var(--border-color)', paddingLeft: '24px', overflowY: 'auto' }}>
                  
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    ⚙️ Configuración del Comprobante
                  </h3>

                  <div className="form-group">
                    <label>Tipo de Facturación</label>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                        <input
                          type="radio"
                          name="directBillingType"
                          value="INTERNAL"
                          checked={directInvoiceForm.billingType === 'INTERNAL'}
                          onChange={() => setDirectInvoiceForm(prev => ({ ...prev, billingType: 'INTERNAL' }))}
                        />
                        Interno (Presupuesto X)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                        <input
                          type="radio"
                          name="directBillingType"
                          value="OFFICIAL"
                          disabled={selectedDirectClient && (!selectedDirectClient.cuit || selectedDirectClient.cuit.length < 5)}
                          checked={directInvoiceForm.billingType === 'OFFICIAL'}
                          onChange={() => setDirectInvoiceForm(prev => ({ ...prev, billingType: 'OFFICIAL' }))}
                        />
                        Oficial AFIP (A / B)
                      </label>
                    </div>
                    {selectedDirectClient && (!selectedDirectClient.cuit || selectedDirectClient.cuit.length < 5) && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-warning)', marginTop: '4px' }}>
                        * El cliente no posee CUIT válido registrado para facturación oficial.
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>💳 Condición de Cobro</label>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '8px 12px', 
                        border: directInvoiceForm.immediatePayment ? '2px solid var(--color-success, #10b981)' : '1px solid var(--border-color)', 
                        borderRadius: '6px', 
                        backgroundColor: directInvoiceForm.immediatePayment ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-app)', 
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}>
                        <input
                          type="radio"
                          name="directPaymentCondition"
                          checked={directInvoiceForm.immediatePayment}
                          onChange={() => setDirectInvoiceForm(prev => ({ ...prev, immediatePayment: true }))}
                          style={{ width: '15px', height: '15px' }}
                        />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          💵 Cobro en el Acto
                        </span>
                      </label>

                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '8px 12px', 
                        border: !directInvoiceForm.immediatePayment ? '2px solid #f59e0b' : '1px solid var(--border-color)', 
                        borderRadius: '6px', 
                        backgroundColor: !directInvoiceForm.immediatePayment ? 'rgba(245, 158, 11, 0.06)' : 'var(--bg-app)', 
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}>
                        <input
                          type="radio"
                          name="directPaymentCondition"
                          checked={!directInvoiceForm.immediatePayment}
                          onChange={() => setDirectInvoiceForm(prev => ({ ...prev, immediatePayment: false }))}
                          style={{ width: '15px', height: '15px' }}
                        />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          📝 Queda en Cuenta Corriente
                        </span>
                      </label>
                    </div>
                  </div>

                  {directInvoiceForm.immediatePayment && (
                    <div style={{
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Método de Pago</label>
                        <select
                          className="select"
                          value={directInvoiceForm.paymentMethod}
                          onChange={(e) => setDirectInvoiceForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                        >
                          <option value="CASH">Efectivo (Caja Chica)</option>
                          <option value="BANK_TRANSFER">Transferencia / MercadoPago</option>
                          <option value="CHECK">Cheque de Terceros</option>
                        </select>
                      </div>

                      {directInvoiceForm.paymentMethod === 'CASH' && (
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Caja Operativa</label>
                          {activeDrawers.length === 0 ? (
                            <div style={{ color: 'var(--color-danger)', fontSize: '0.78rem', marginTop: '4px', fontWeight: 600 }}>
                              ⚠️ No hay cajas abiertas. Abra la Caja Grande en Configuración.
                            </div>
                          ) : (
                            <select
                              className="select"
                              value={directInvoiceForm.cashDrawerId}
                              onChange={(e) => setDirectInvoiceForm(prev => ({ ...prev, cashDrawerId: e.target.value }))}
                              required
                            >
                              {activeDrawers.map(d => (
                                <option key={d.id} value={d.id}>
                                  Caja #{d.id} - {d.branch} ({d.user?.name || 'Administración'})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}

                      {directInvoiceForm.paymentMethod === 'BANK_TRANSFER' && (
                        <div className="form-group" style={{ margin: 0 }}>
                          <label>Cuenta de Destino</label>
                          <select
                            className="select"
                            value={directInvoiceForm.bankAccountId}
                            onChange={(e) => setDirectInvoiceForm(prev => ({ ...prev, bankAccountId: e.target.value }))}
                            required
                          >
                            {bankAccounts.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.bankName} - CBU: {b.cbu || 'N/A'} (Saldo: ${Number(b.balance).toLocaleString()})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {directInvoiceForm.paymentMethod === 'CHECK' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>Nro de Cheque</label>
                              <input
                                type="text"
                                className="input"
                                value={directInvoiceForm.checkNumber}
                                onChange={(e) => setDirectInvoiceForm(prev => ({ ...prev, checkNumber: e.target.value }))}
                                placeholder="Nro Cheque"
                                required
                              />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>Emisor / Librador</label>
                              <input
                                type="text"
                                className="input"
                                value={directInvoiceForm.checkIssuer}
                                onChange={(e) => setDirectInvoiceForm(prev => ({ ...prev, checkIssuer: e.target.value }))}
                                placeholder="Nombre Emisor"
                                required
                              />
                            </div>
                          </div>
                          <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              id="isEcheq"
                              checked={directInvoiceForm.isEcheq}
                              onChange={(e) => setDirectInvoiceForm(prev => ({ ...prev, isEcheq: e.target.checked }))}
                              style={{ width: '16px', height: '16px' }}
                            />
                            <label htmlFor="isEcheq" style={{ cursor: 'pointer', margin: 0, fontSize: '0.8rem' }}>¿Es un Cheque Electrónico (Echeq)?</label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Resumen de Facturación */}
                  <div style={{
                    marginTop: 'auto',
                    backgroundColor: '#F8F9FA',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                      <span>Subtotal / Bruto:</span>
                      <span style={{ fontWeight: 600 }}>${(directBillingTotals.net + directBillingTotals.tax).toLocaleString('es-AR')}</span>
                    </div>

                    {directInvoiceForm.billingType === 'OFFICIAL' && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                          <span>Neto Gravado (Exento de IVA):</span>
                          <span>${directBillingTotals.net.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                          <span>IVA (21%):</span>
                          <span>${directBillingTotals.tax.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        {directBillingTotals.percepcion > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--color-warning)' }}>
                            <span>Percep. IIBB ({selectedDirectClient?.province || 'Bs.As.'}):</span>
                            <span>+${directBillingTotals.percepcion.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {directBillingTotals.percepcionIva > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--color-warning)' }}>
                            <span>Percep. IVA RG 5329:</span>
                            <span>+${directBillingTotals.percepcionIva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '10px', color: 'var(--accent-color)' }}>
                      <span>TOTAL GENERAL:</span>
                      <span>${directBillingTotals.total.toLocaleString('es-AR')}</span>
                    </div>
                  </div>

                    {modalError && (
                      <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', fontSize: '0.83rem', fontWeight: 600, marginTop: '12px' }}>
                        ⚠️ {modalError}
                      </div>
                    )}

                    <div className="modal-footer" style={{ border: 0, padding: 0, marginTop: '16px' }}>
                      <button type="button" className="btn btn-secondary" style={{ flex: 1 }} disabled={isSubmitting} onClick={() => {
                        setShowDirectInvoiceModal(false);
                        setDirectCart([]);
                        setClientSearchQuery('');
                        setProductSearchQuery('');
                        setModalError(null);
                      }}>
                        Cancelar
                      </button>
                      <button 
                        type="submit" 
                        className="btn btn-primary" 
                        style={{ flex: 1.5, backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', fontWeight: 700 }}
                        disabled={isSubmitting || directCart.length === 0}
                      >
                        {isSubmitting ? 'Procesando Factura...' : 'Facturar y Confirmar'}
                      </button>
                    </div>

                </div>

              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: VER COMPROBANTE DE FACTURA (VISTA IMPRESIÓN OFICIAL)
          ==================================================================== */}
      {viewInvoiceModal && (() => {
        const isOfficial = viewInvoiceModal.billingType === 'OFFICIAL' || viewInvoiceModal.invoiceType === 'FACTURA_A' || viewInvoiceModal.invoiceType === 'FACTURA_B' || viewInvoiceModal.invoiceType === 'FACTURA_C';
        const issueDateStr = viewInvoiceModal.issueDate || viewInvoiceModal.createdAt;
        const decimalOptions = (viewInvoiceModal.billingType === 'OFFICIAL' && viewInvoiceModal.invoiceType === 'FACTURA_A') ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { minimumFractionDigits: 0, maximumFractionDigits: 0 };

        return (
          <div className="modal-overlay print-modal">
            <div className="modal-content print-content-box" style={{ maxWidth: '850px', width: '90vw' }}>
              <div className="modal-header no-print">
                <h3>Vista Previa del Comprobante</h3>
                <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setViewInvoiceModal(null)}><X size={18} /></button>
              </div>

              <div id="print-area" className="invoice-container-box" style={{ backgroundColor: '#fff', padding: '30px', border: '1px solid #ddd', fontFamily: 'Arial, sans-serif', color: '#000', fontSize: '0.85rem' }}>
                
                {/* Cabecera del comprobante */}
                <div style={{ display: 'flex', border: '2px solid #000', marginBottom: '20px', position: 'relative' }}>
                  
                  {/* Letra A / B / X en el medio */}
                  <div style={{
                    position: 'absolute',
                    top: '-2px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '44px',
                    height: '44px',
                    backgroundColor: '#fff',
                    border: '2px solid #000',
                    borderTop: '0',
                    textAlign: 'center',
                    fontSize: '1.6rem',
                    fontWeight: 800,
                    zIndex: 2
                  }}>
                    {viewInvoiceModal.invoiceType === 'FACTURA_A' ? 'A' :
                     viewInvoiceModal.invoiceType === 'FACTURA_B' ? 'B' :
                     viewInvoiceModal.invoiceType === 'FACTURA_C' ? 'C' : 'X'}
                    <div style={{ fontSize: '0.5rem', fontWeight: 600, marginTop: '-4px' }}>
                      {viewInvoiceModal.invoiceType === 'FACTURA_A' ? 'COD. 001' :
                       viewInvoiceModal.invoiceType === 'FACTURA_B' ? 'COD. 006' :
                       viewInvoiceModal.invoiceType === 'FACTURA_C' ? 'COD. 011' : 'COD. 000'}
                    </div>
                  </div>

                  {/* Mitad izquierda: Emisor */}
                  <div style={{ width: '50%', padding: '16px', borderRight: '1px solid #000' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>DISTRIBUIDORA DV</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '4px', fontWeight: 600 }}>Ruta 5 - Km 320, General Villegas, Buenos Aires</div>
                    <div style={{ fontSize: '0.75rem', color: '#444', marginTop: '2px' }}>Tel: (03388) 15-429304 | E-mail: contacto@distribuidoradv.com</div>
                    <div style={{ fontSize: '0.75rem', color: '#444' }}>IVA: Responsable Inscripto</div>
                  </div>

                  {/* Mitad derecha: Datos del comprobante */}
                  <div style={{ width: '50%', padding: '16px', paddingLeft: '32px' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase' }}>
                      {isOfficial ? 'Factura Oficial' : 'Presupuesto de Venta Interna'}
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <strong>Comp. Nro: {viewInvoiceModal.invoiceNumber?.split('-')[1] || viewInvoiceModal.invoiceNumber || '00000000'}</strong>
                    </div>
                    <div>Fecha de Emisión: {new Date(issueDateStr).toLocaleDateString('es-AR')}</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '8px' }}>
                      <div>CUIT: 30-71490283-9</div>
                      <div>Ingresos Brutos: 30-71490283-9 (Convenio Multilateral)</div>
                      <div>Inicio de Actividades: 01/03/2018</div>
                    </div>
                  </div>

                </div>

                {/* Datos del Receptor / Cliente */}
                <div style={{ border: '2px solid #000', padding: '16px', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                  <div>
                    <div><strong>Nombre / Razón Social:</strong> {viewInvoiceModal.persona?.name || 'Consumidor Final'}</div>
                    <div><strong>Domicilio:</strong> {viewInvoiceModal.persona?.address || 'Retiro en Local'}</div>
                    <div><strong>CUIT / DNI:</strong> {viewInvoiceModal.persona?.cuit || 'S/D'}</div>
                    <div><strong>Categoría de IVA:</strong> {viewInvoiceModal.invoiceType === 'FACTURA_A' ? 'Responsable Inscripto' : 'Consumidor Final'}</div>
                  </div>
                  <div style={{ borderLeft: '1px solid #ddd', paddingLeft: '16px' }}>
                    <div><strong>Condición de Venta:</strong></div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '4px', textTransform: 'uppercase' }}>
                      {viewInvoiceModal.paymentMethod === 'BANK_TRANSFER' ? 'TRANSFERENCIA' :
                       viewInvoiceModal.paymentMethod === 'CHECK' ? 'CHEQUE' :
                       viewInvoiceModal.paymentMethod === 'CASH' ? 'EFECTIVO' : 'CUENTA CORRIENTE'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '6px' }}>
                      Saldo CC Histórico del Cliente: ${Number(viewInvoiceModal.persona?.outstandingBalance || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>

                {/* Detalle de Artículos */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '20px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#eee', borderBottom: '2px solid #000' }}>
                      <th style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'left' }}>Código / SKU</th>
                      <th style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'left' }}>Descripción del Artículo</th>
                      <th style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'right', width: '70px' }}>Cant</th>
                      <th style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'right', width: '80px' }}>Kilos</th>
                      <th style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'right', width: '100px' }}>P. Unit</th>
                      <th style={{ padding: '8px', textAlign: 'right', width: '110px' }}>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewInvoiceModal.items && viewInvoiceModal.items.map((item: any, idx: number) => {
                      const isFacturaA_Official = viewInvoiceModal.billingType === 'OFFICIAL' && viewInvoiceModal.invoiceType === 'FACTURA_A';
                      const displayPrice = isFacturaA_Official ? (item.unitPrice / 1.21) : item.unitPrice;
                      const displaySubtotal = isFacturaA_Official ? (item.subtotal / 1.21) : item.subtotal;
                      
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #000' }}>
                          <td style={{ padding: '8px', borderRight: '1px solid #000', fontFamily: 'monospace' }}>{item.product?.sku || 'S/D'}</td>
                          <td style={{ padding: '8px', borderRight: '1px solid #000', fontWeight: 600 }}>{item.product?.name || item.productName || 'Artículo general'}</td>
                          <td style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'right' }}>{item.quantity}</td>
                          <td style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'right' }}>{item.weight || '-'}</td>
                          <td style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'right' }}>
                            ${Number(displayPrice).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                            ${Number(displaySubtotal).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pie de factura y Totales */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
                  
                  {/* Datos AFIP y CAE */}
                  <div style={{ border: '1px solid #000', padding: '12px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                    {isOfficial ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <div style={{ width: '40px', height: '40px', backgroundColor: '#000', color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>AFIP</div>
                          <div>
                            <strong>Comprobante Autorizado por AFIP Web Services</strong>
                            <div style={{ fontSize: '0.65rem', color: '#555' }}>La autenticidad de este comprobante puede ser verificada en el sitio oficial.</div>
                          </div>
                        </div>
                        <div><strong>CAE Nº:</strong> {viewInvoiceModal.cae || '86251033241354'}</div>
                        <div><strong>Fecha de Vto. de CAE:</strong> {viewInvoiceModal.caeDueDate ? new Date(viewInvoiceModal.caeDueDate).toLocaleDateString('es-AR') : '04/07/2026'}</div>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', color: '#777', fontWeight: 600 }}>
                        DOCUMENTO NO VÁLIDO COMO FACTURA
                        <div style={{ fontSize: '0.65rem', fontWeight: 400, marginTop: '4px' }}>Este presupuesto de venta interna se emite únicamente a fines administrativos e informativos de stock.</div>
                      </div>
                    )}
                  </div>

                  {/* Totales */}
                  <div style={{ border: '2px solid #000', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    
                    {/* Desglose oficial de IVA */}
                    {isOfficial ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Importe Neto Gravado:</span>
                          <span style={{ fontWeight: 600 }}>${Number(viewInvoiceModal.netAmount || 0).toLocaleString('es-AR', decimalOptions)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>IVA Inscripto (21%):</span>
                          <span style={{ fontWeight: 600 }}>${Number(viewInvoiceModal.taxAmount || 0).toLocaleString('es-AR', decimalOptions)}</span>
                        </div>
                        {Number(viewInvoiceModal.percepcionAmount || 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#C0392B' }}>
                            <span>Percep. IIBB ({viewInvoiceModal.persona?.province || (viewInvoiceModal.persona?.address?.includes('CABA') ? 'CABA' : 'Bs.As.')}):</span>
                            <span style={{ fontWeight: 600 }}>${Number(viewInvoiceModal.percepcionAmount).toLocaleString('es-AR', decimalOptions)}</span>
                          </div>
                        )}
                        {Number(viewInvoiceModal.percepcionIvaAmount || 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#C0392B' }}>
                            <span>Percep. IVA RG 5329 (3%):</span>
                            <span style={{ fontWeight: 600 }}>${Number(viewInvoiceModal.percepcionIvaAmount).toLocaleString('es-AR', decimalOptions)}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Subtotal Neto:</span>
                        <span>${Number(viewInvoiceModal.totalAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 800, borderTop: '2px solid #000', paddingTop: '8px', marginTop: '4px' }}>
                      <span>TOTAL COMPROBANTE:</span>
                      <span>${Number(viewInvoiceModal.totalAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>

                  </div>

                </div>

              </div>

              <div className="modal-footer no-print" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn btn-secondary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }}>
                  <Printer size={16} /> Imprimir Comprobante
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setViewInvoiceModal(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

// Helper icons
function TrashIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2">
      <path d="M3 6h18"/>
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
      <line x1="10" x2="10" y1="11" y2="17"/>
      <line x1="14" x2="14" y1="11" y2="17"/>
    </svg>
  );
}
