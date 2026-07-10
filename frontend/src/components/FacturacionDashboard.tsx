import { useState, useEffect } from 'react';
import { api } from '../utils/api';

import { BillingType, OrderStatus, PaymentMethod } from '../utils/types';
import { RefreshCw, Eye, Sparkles, UserPlus, Printer, Search } from 'lucide-react';
import BillingDashboard from './BillingDashboard';
import PriceListModal from './PriceListModal';
import QuickPriceSearchModal from './modals/QuickPriceSearchModal';

interface FacturacionDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function FacturacionDashboard({ activeTab, setActiveTab }: FacturacionDashboardProps) {
  const normalizedTab = activeTab === 'orders' ? 'invoice-orders' : activeTab;

  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [pesableWeights, setPesableWeights] = useState<{ [orderItemId: number]: number }>({});
  const [activeDrawer, setActiveDrawer] = useState<any | null>(null);
  
  // Modales y formularios de facturación
  const [billingType, setBillingType] = useState<BillingType>(BillingType.INTERNAL);
  const [immediatePayment, setImmediatePayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [checkDetails, setCheckDetails] = useState({
    number: '',
    issuer: '',
    isEcheq: false
  });
  
  // Crear cliente modal
  const [clientModal, setClientModal] = useState({ open: false, name: '', cuit: '', address: '', phone: '', email: '' });

  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionInvoices, setSessionInvoices] = useState<any[]>([]);

  const [isPriceListModalOpen, setIsPriceListModalOpen] = useState(false);
  const [isQuickSearchModalOpen, setIsQuickSearchModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [normalizedTab, searchQuery]);

  // Limpiar mensajes al cambiar de pestaña
  useEffect(() => {
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [normalizedTab, activeTab]);

  useEffect(() => {
    if (selectedOrder) {
      const initialWeights: any = {};
      selectedOrder.items.forEach((item: any) => {
        if (item.weight) {
          initialWeights[item.id] = Number(item.weight);
        }
      });
      setPesableWeights(initialWeights);
    } else {
      setPesableWeights({});
    }
  }, [selectedOrder]);

  const fetchData = async () => {
    setErrorMsg(null);
    try {
      if (normalizedTab === 'invoice-orders') {
        const data = await api.getOrders();
        // Filtrar solo los armados listos para facturar
        const filtered = data.filter((o: any) => o.status === OrderStatus.PREPARED);
        setOrders(filtered);
        
        // Cargar caja operativa activa
        const active = await api.getActiveDrawer();
        setActiveDrawer(active);
      } else if (normalizedTab === 'products') {
        const data = await api.getProducts(searchQuery);
        setProducts(data);
      } else if (normalizedTab === 'clients') {
        const data = await api.getClients(searchQuery);
        setClients(data);
      } else if (normalizedTab === 'finanzas') {
        // Cargar todos los pedidos facturados de hoy
        const data = await api.getOrders();
        const deliveredToday = data.filter((o: any) => o.status === OrderStatus.DELIVERED);
        setSessionInvoices(deliveredToday);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener datos.');
    }
  };

  // --- CONFIRMAR FACTURACIÓN ---
  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      // Si hay pesos que se hayan modificado en facturacion, actualizarlos primero
      const weightItems = Object.entries(pesableWeights).map(([orderItemId, weight]) => ({
        orderItemId: Number(orderItemId),
        weight: Number(weight)
      })).filter(i => i.weight > 0);
      
      if (weightItems.length > 0) {
        await api.updateOrderWeights(selectedOrder.id, weightItems);
      }

      let paymentDescription: string | undefined = undefined;
      if (immediatePayment && paymentMethod === 'CHECK') {
        paymentDescription = checkDetails.isEcheq 
          ? `${checkDetails.issuer} (Echeq) - Nro: ${checkDetails.number}` 
          : `${checkDetails.issuer} - Nro: ${checkDetails.number}`;
      }

      const updated = await api.invoiceOrder(
        selectedOrder.id,
        billingType,
        immediatePayment ? paymentMethod : undefined,
        paymentDescription
      );

      setSuccessMsg(`✨ Pedido #${selectedOrder.id} facturado con éxito. Comprobante: ${updated.invoiceNumber}`);
      setSelectedOrder(null);
      setImmediatePayment(false);
      setCheckDetails({ number: '', issuer: '', isEcheq: false });
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al facturar el pedido.');
    } finally {
      setLoading(false);
    }
  };

  // --- ALTA CLIENTE ---
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientModal.name) {
      setErrorMsg('El nombre es obligatorio.');
      return;
    }

    try {
      await api.createClient(clientModal);
      setClientModal({ open: false, name: '', cuit: '', address: '', phone: '', email: '' });
      setSuccessMsg('Cliente creado con éxito.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar cliente.');
    }
  };

  // Caja de cobro para facturación
  const getSessionIncomeTotal = () => {
    return sessionInvoices.reduce((acc, curr) => acc + curr.totalAmount, 0);
  };

  return (
    <div style={{ width: '100%' }}>
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
          padding: '16px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.9rem',
          fontWeight: 500,
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid rgba(52, 199, 89, 0.15)'
        }}>
          <Sparkles size={18} style={{ color: 'var(--color-success)' }} />
          {successMsg}
        </div>
      )}

      {/* ====================================================================
          1. FACTURAR PEDIDOS (LISTA PREPARED)
          ==================================================================== */}
      {normalizedTab === 'invoice-orders' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedOrder ? '1.2fr 1fr' : '1fr', gap: '30px' }}>
          {/* Listado de Pedidos Armados por Depósito */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="card-title" style={{ marginBottom: 0 }}>Pedidos Listos para Facturar</h3>
              <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={fetchData}>
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="table-container" style={{ border: 'none', marginTop: 0 }}>
              <table style={{ border: 'none' }}>
                <thead>
                  <tr>
                    <th>ID Pedido</th>
                    <th>Cliente</th>
                    <th>Vendedor</th>
                    <th>Monto</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
                        No hay pedidos armados pendientes de facturación.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id} style={{ cursor: 'pointer', backgroundColor: selectedOrder?.id === o.id ? '#F8F8FA' : 'inherit' }} onClick={() => setSelectedOrder(o)}>
                        <td style={{ fontWeight: 600 }}>#{o.id}</td>
                        <td>{o.client?.name}</td>
                        <td>{o.seller?.username}</td>
                        <td style={{ fontWeight: 600 }}>${o.totalAmount.toLocaleString()}</td>
                        <td>
                          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', gap: '4px' }}>
                            <Eye size={12} />
                            <span>Facturar</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel Lateral de Procesamiento de Factura */}
          {selectedOrder && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Procesar Factura #{selectedOrder.id}</h3>
                <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setSelectedOrder(null)}>✕</button>
              </div>

              <div style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
                <div><strong>Razón Social:</strong> {selectedOrder.client?.name}</div>
                <div><strong>CUIT:</strong> {selectedOrder.client?.cuit || 'No registrado'}</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Dirección de despacho: {selectedOrder.client?.address || 'Retiro local'}</div>
              </div>

              {/* Items picking list review */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '20px', maxHeight: '180px', overflowY: 'auto' }}>
                <table style={{ fontSize: '0.8rem' }}>
                  <thead style={{ backgroundColor: '#F8F8FA' }}>
                    <tr>
                      <th>Producto</th>
                      <th style={{ textAlign: 'right' }}>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item: any) => (
                      <tr key={item.id}>
                        <td>
                          {item.product?.name}
                          {item.product?.isPesable && (
                            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Peso final (Kg):</span>
                              <input 
                                type="number" 
                                step="0.001"
                                className="input" 
                                style={{ width: '80px', padding: '2px 6px', fontSize: '0.8rem', height: '26px' }}
                                placeholder={item.product?.approximateWeight ? `Aprox: ${Number(item.quantity) * Number(item.product.approximateWeight)}` : ""}
                                value={pesableWeights[item.id] || ''}
                                onChange={(e) => setPesableWeights(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                              />
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.quantity} u.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <form onSubmit={handleInvoiceSubmit}>
                {/* Canal de Facturación */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px' }}>Canal de Facturación</label>
                  <div className="billing-toggle-container" style={{ width: '100%' }}>
                    <button
                      type="button"
                      className={`billing-toggle-btn ${billingType === BillingType.OFFICIAL ? 'billing-toggle-btn-official-active' : ''}`}
                      onClick={() => setBillingType(BillingType.OFFICIAL)}
                      style={{ flex: 1 }}
                    >
                      Sucursal A
                    </button>
                    <button
                      type="button"
                      className={`billing-toggle-btn ${billingType === BillingType.INTERNAL ? 'billing-toggle-btn-internal-active' : ''}`}
                      onClick={() => setBillingType(BillingType.INTERNAL)}
                      style={{ flex: 1 }}
                    >
                      Sucursal X
                    </button>
                  </div>
                </div>

                {/* Cobro */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="checkbox-container">
                      <input
                        type="checkbox"
                        checked={immediatePayment}
                        onChange={(e) => setImmediatePayment(e.target.checked)}
                      />
                      <span>Cobrar en el acto (Caja)</span>
                    </label>

                    {immediatePayment && (
                      <select
                        className="select"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }}
                      >
                        <option value="CASH">Efectivo</option>
                        <option value="BANK_TRANSFER">Transferencia</option>
                        <option value="CHECK">Cheque</option>
                      </select>
                    )}
                  </div>
                  
                  {immediatePayment && paymentMethod === 'CHECK' && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input 
                        type="text" 
                        className="input" 
                        placeholder="Número de Cheque" 
                        value={checkDetails.number}
                        onChange={(e) => setCheckDetails(prev => ({...prev, number: e.target.value}))}
                        style={{ fontSize: '0.85rem' }}
                      />
                      <input 
                        type="text" 
                        className="input" 
                        placeholder="Banco Emisor / Detalles" 
                        value={checkDetails.issuer}
                        onChange={(e) => setCheckDetails(prev => ({...prev, issuer: e.target.value}))}
                        style={{ fontSize: '0.85rem' }}
                      />
                      <label className="checkbox-container" style={{ marginTop: '4px' }}>
                        <input
                          type="checkbox"
                          checked={checkDetails.isEcheq}
                          onChange={(e) => setCheckDetails(prev => ({ ...prev, isEcheq: e.target.checked }))}
                        />
                        <span style={{ fontSize: '0.8rem' }}>Es E-Cheq</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Validación de caja activa si es efectivo */}
                {(() => {
                  const isDrawerInvalid = immediatePayment && paymentMethod === 'CASH' && !activeDrawer;

                  return (
                    <>
                      {isDrawerInvalid && (
                        <div style={{
                          backgroundColor: '#FDF6F6',
                          color: '#C5221F',
                          border: '1px solid #FAD2D2',
                          borderRadius: '6px',
                          padding: '10px 12px',
                          fontSize: '0.8rem',
                          marginBottom: '16px',
                          lineHeight: '1.4'
                        }}>
                          <div>
                            <strong>⚠️ Caja Cerrada:</strong> No tenés una caja operativa abierta. 
                            Debés abrir una caja operativa en la solapa <strong>Cajas Diarias</strong> del menú Finanzas para cobrar en efectivo.
                          </div>
                        </div>
                      )}

                      {/* Importe */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
                        <span>Importe a Facturar:</span>
                        <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ${Number(selectedOrder.totalAmount).toLocaleString()}
                        </span>
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ 
                          width: '100%', 
                          padding: '12px', 
                          fontWeight: 600,
                          backgroundColor: isDrawerInvalid ? '#ccc' : undefined,
                          borderColor: isDrawerInvalid ? '#ccc' : undefined,
                          cursor: isDrawerInvalid ? 'not-allowed' : 'pointer'
                        }}
                        disabled={loading || isDrawerInvalid}
                      >
                        {loading ? 'Emitiendo comprobante...' : 'Facturar y Despachar'}
                      </button>
                    </>
                  );
                })()}
              </form>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          2. CATÁLOGO DE PRODUCTOS (SOLO PRECIOS DE VENTA)
          ==================================================================== */}
      {normalizedTab === 'products' && (
        <div>
          <div className="actions-bar">
            <div className="search-input-wrapper">
              <input
                type="text"
                className="input"
                placeholder="Buscar productos por SKU o nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                onClick={() => setIsQuickSearchModalOpen(true)}
              >
                <Search size={16} />
                <span>Buscar Precio</span>
              </button>
              <button 
                type="button"
                className="btn btn-secondary" 
                style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                onClick={() => setIsPriceListModalOpen(true)}
              >
                <Printer size={16} />
                <span>Lista de Precios General</span>
              </button>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Precio de Venta (Lista)</th>
                  <th>Stock Físico</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px 0' }}>No se encontraron productos.</td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.sku}</td>
                      <td>{p.name}</td>
                      <td style={{ fontWeight: 600 }}>${p.listPrice}</td>
                      <td>{p.stock} u.</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================================
          3. FICHERO DE CLIENTES
          ==================================================================== */}
      {normalizedTab === 'clients' && (
        <div>
          <div className="actions-bar">
            <div className="search-input-wrapper">
              <input
                type="text"
                className="input"
                placeholder="Buscar clientes por nombre o CUIT..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={() => setClientModal({ open: true, name: '', cuit: '', address: '', phone: '', email: '' })}>
              <UserPlus size={16} />
              <span>Nuevo Cliente</span>
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre / Razón Social</th>
                  <th>CUIT</th>
                  <th>Saldo C/C</th>
                  <th>Contacto</th>
                  <th>Dirección</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0' }}>No se encontraron clientes.</td>
                  </tr>
                ) : (
                  clients.map((c) => {
                    const balance = Number(c.outstandingBalance || 0);
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{c.cuit || ''}</td>
                        <td style={{ fontWeight: 600, color: balance > 0 ? 'var(--color-danger)' : balance < 0 ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                          ${balance.toLocaleString()}
                        </td>
                        <td>
                          {c.phone && <div>{c.phone}</div>}
                          {c.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.email}</div>}
                        </td>
                        <td>{c.address}</td>
                        <td>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'var(--text-primary)', color: '#fff', borderColor: 'var(--text-primary)' }}
                            onClick={() => {
                              localStorage.setItem('preselected_billing_client', String(c.id));
                              setActiveTab('billing');
                            }}
                          >
                            Facturar
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
      )}

      {/* ====================================================================
          4. CAJA OPERATIVA (FINANZAS RESTRICTED VIEW)
          ==================================================================== */}
      {normalizedTab === 'finanzas' && (
        <div>
          <div className="dashboard-grid">
            <div className="card stat-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
              <div className="stat-label">Cobros Emitidos Hoy</div>
              <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                ${getSessionIncomeTotal().toLocaleString()}
              </div>
              <div className="stat-desc">{sessionInvoices.length} facturas emitidas por esta terminal</div>
            </div>
          </div>

          <div className="card" style={{ marginTop: '24px' }}>
            <h3 className="card-title">Historial de Cobranza del Día</h3>
            <div className="table-container" style={{ border: 'none', marginTop: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Factura Nro</th>
                    <th>Cliente</th>
                    <th>Importe</th>
                    <th>Canal</th>
                    <th>Cobro Caja</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '20px 0' }}>Ningún cobro registrado en esta sesión de caja hoy.</td>
                    </tr>
                  ) : (
                    sessionInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td style={{ fontWeight: 600 }}>{inv.invoiceNumber}</td>
                        <td>{inv.client?.name}</td>
                        <td style={{ fontWeight: 700 }}>${inv.totalAmount.toLocaleString()}</td>
                        <td>
                          <span className={inv.billingType === 'OFFICIAL' ? 'badge badge-official' : 'badge badge-internal'}>
                            {inv.billingType === 'OFFICIAL' ? 'Sucursal A' : 'Sucursal X'}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-official">Registrado</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          FACTURACION & IMPUESTOS (BILLING)
          ==================================================================== */}
      {normalizedTab === 'billing' && (
        <BillingDashboard activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

      {/* ALTA CLIENTE MODAL */}
      {clientModal.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Registrar Nuevo Cliente</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setClientModal({ ...clientModal, open: false })}>✕</button>
            </div>
            <form onSubmit={handleCreateClient}>
              <div className="form-group">
                <label>Nombre o Razón Social</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Almacén El Porvenir"
                  value={clientModal.name}
                  onChange={(e) => setClientModal({ ...clientModal, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>CUIT (Sin guiones)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: 30123456789"
                  value={clientModal.cuit}
                  onChange={(e) => setClientModal({ ...clientModal, cuit: e.target.value })}
                  onBlur={async (e) => {
                    const c = e.target.value;
                    if(c && c.length >= 8) {
                      try {
                        const json = await api.getAfipData(c);
                        if(json && json.status === 'success' && json.data) {
                          setClientModal(prev => ({...prev, name: json.data.name || prev.name, address: json.data.address || prev.address}));
                        } else if (json && json.name) {
                          setClientModal(prev => ({...prev, name: json.name || prev.name, address: json.address || prev.address}));
                        }
                      } catch(err) { console.error('Error AFIP', err); }
                    }
                  }}
                />
              </div>

              <div className="form-group">
                <label>Dirección</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Av. San Martín 4200"
                  value={clientModal.address}
                  onChange={(e) => setClientModal({ ...clientModal, address: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    className="input"
                    value={clientModal.phone}
                    onChange={(e) => setClientModal({ ...clientModal, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    className="input"
                    value={clientModal.email}
                    onChange={(e) => setClientModal({ ...clientModal, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setClientModal({ ...clientModal, open: false })}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renderizar Modales de Precios */}
      <PriceListModal isOpen={isPriceListModalOpen} onClose={() => setIsPriceListModalOpen(false)} />
      <QuickPriceSearchModal isOpen={isQuickSearchModalOpen} onClose={() => setIsQuickSearchModalOpen(false)} />
    </div>
  );
}
