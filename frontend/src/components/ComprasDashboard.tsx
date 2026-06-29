import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { 
  Plus, 
  X, 
  Truck,
  Eye
} from 'lucide-react';
import { PurchaseScannerModal } from './PurchaseScannerModal';

export default function ComprasDashboard() {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Modales
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
      setProviders(personas);

      const allProducts = await api.getProducts('');
      setProducts(allProducts);
    } catch (err: any) {
      setErrorMsg('Error al cargar datos de compras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  // Filtrado de productos para el buscador del carrito
  const filteredProductsForAdd = useMemo(() => {
    if (!searchProductQuery) return [];
    const q = searchProductQuery.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [searchProductQuery, products]);

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

  // --- ABRIR MODAL DE RECEPCION ---
  const handleOpenReceiveModal = (order: any) => {
    setInvoiceNumber('');
    // Inicializar asignaciones de lotes para los ítems
    const initialAssignments: typeof lotAssignments = {};
    order.items.forEach((item: any) => {
      initialAssignments[item.productId] = {
        lotNumber: `LOTE-PO-${order.id}`,
        expirationDate: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0] // 6 meses por defecto
      };
    });
    setLotAssignments(initialAssignments);
    setShowReceiveModal(order);
  };

  // Cambiar valores de asignaciones de lotes
  const handleLotAssignmentChange = (productId: number, field: 'lotNumber' | 'expirationDate', value: string) => {
    setLotAssignments(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  // --- CONFIRMAR RECEPCION ---
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

      setSuccessMsg(`✨ Orden de compra #${showReceiveModal.id} recibida con éxito. Stock ingresado al depósito y costo actualizado.`);
      setShowReceiveModal(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar la recepción de mercadería.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Feedback alerts */}
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

      {/* Cabecera de Compras */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 className="card-title" style={{ margin: '0' }}>🧾 Órdenes de Compra a Proveedores</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Control de abastecimiento, ingresos de lotes y actualización automática del precio costo en el catálogo.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <label className="btn" style={{ backgroundColor: '#E30613', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', borderRadius: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>📸 Escanear Documento (IA)</span>
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
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              Nueva Orden de Compra
            </button>
          </div>
        </div>

        {/* Grilla de OC */}
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
                    {viewDetailsModal.items.map((item: any) => (
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

      <PurchaseScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        file={scannerFile}
        onSuccess={() => {
          setSuccessMsg('Documento procesado con éxito y stock inyectado.');
          loadData();
        }}
      />
    </div>
  );
}
