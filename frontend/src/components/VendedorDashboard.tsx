import { useState, useEffect } from 'react';
import React from 'react';
import { api } from '../utils/api';
import { Trash2, ShoppingCart, UserPlus, CheckCircle2, Eye, Edit, Printer } from 'lucide-react';

interface VendedorDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function VendedorDashboard({ activeTab }: VendedorDashboardProps) {
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  
  // Nuevo Pedido State
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  const [subTab, setSubTab] = useState<'create' | 'list'>('create');
  
  // Modales
  const [clientModal, setClientModal] = useState({ open: false, name: '', cuit: '', address: '', city: '', phone: '', email: '' });
  const [orderDetailsModal, setOrderDetailsModal] = useState<any | null>(null);
  const [editOrderModal, setEditOrderModal] = useState<{ open: boolean; orderId: number; clientId: number; clientName: string; items: { id: number; productId: number; name: string; sku: string; quantity: number; listPrice: number }[] } | null>(null);
  
  // Filtros y búsquedas
  const [searchQuery, setSearchQuery] = useState('');
  const [prodSearchQuery, setProdSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) return '';
    const formatted = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`;
    return `https://wa.me/${formatted}`;
  };

  const getItemPrice = (product: any, client: any) => {
    if (!client) return Number(product.listPrice);
    let price = Number(product.listPrice);
    if (client.priceList === 'B') {
      const priceB = Number(product.listPriceB);
      if (priceB > 0) price = priceB;
    } else if (client.priceList === 'C') {
      const priceC = Number(product.listPriceC);
      if (priceC > 0) price = priceC;
    }
    const discount = Number(client.discount || 0);
    return price * (1 - discount / 100);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, searchQuery, prodSearchQuery, subTab]);

  const fetchData = async () => {
    setErrorMsg(null);
    try {
      if (activeTab === 'orders') {
        const clientData = await api.getClients();
        setClients(clientData);
        const prodData = await api.getProducts(prodSearchQuery);
        setProducts(prodData);
        const orderData = await api.getOrders();
        setOrders(orderData);
      } else if (activeTab === 'clients') {
        const clientData = await api.getClients(searchQuery);
        setClients(clientData);
      } else if (activeTab === 'products') {
        const prodData = await api.getProducts(searchQuery);
        setProducts(prodData);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener datos.');
    }
  };

  // --- CARRITO DE COMPRAS ---
  const addToCart = (product: any) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        setErrorMsg(`Stock máximo disponible para ${product.name} alcanzado.`);
        return;
      }
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      if (product.stock <= 0) {
        setErrorMsg(`No hay stock disponible de ${product.name}.`);
        return;
      }
      setCart([...cart, { product, quantity: 1 }]);
    }
    setErrorMsg(null);
  };

  const handleBarcodeScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = barcodeInput.trim();
      if (!code) return;

      setErrorMsg(null);
      setBarcodeError(false);

      try {
        const found = products.find(p => p.barcode === code);
        if (found) {
          addToCart(found);
          setBarcodeInput('');
        } else {
          const prod = await api.getProductByBarcode(code);
          if (prod) {
            setProducts(prev => prev.some(p => p.id === prod.id) ? prev : [...prev, prod]);
            addToCart(prod);
            setBarcodeInput('');
          } else {
            throw new Error('Producto no encontrado.');
          }
        }
      } catch (err: any) {
        setBarcodeError(true);
        setErrorMsg(`Código de barras "${code}" no reconocido.`);
        setTimeout(() => setBarcodeError(false), 1500);
      }
    }
  };

  const updateCartQty = (productId: number, change: number) => {
    const existing = cart.find(item => item.product.id === productId);
    if (!existing) return;

    const newQty = existing.quantity + change;
    if (newQty <= 0) {
      setCart(cart.filter(item => item.product.id !== productId));
    } else {
      if (newQty > existing.product.stock) {
        setErrorMsg(`Solo hay ${existing.product.stock} unidades en stock.`);
        return;
      }
      setCart(cart.map(item => 
        item.product.id === productId 
          ? { ...item, quantity: newQty }
          : item
      ));
    }
    setErrorMsg(null);
  };

  const getCartTotal = () => {
    return cart.reduce((acc, curr) => acc + (getItemPrice(curr.product, selectedClient) * curr.quantity), 0);
  };

  // --- CONFIRMAR PEDIDO (3-CLICS) ---
  const handleConfirmOrder = async () => {
    if (!selectedClient) {
      setErrorMsg('Debe seleccionar un cliente antes de confirmar.');
      return;
    }
    if (cart.length === 0) {
      setErrorMsg('El carrito está vacío.');
      return;
    }

    // Validar regla boleta contra boleta
    if (Number(selectedClient.outstandingBalance || 0) > 0) {
      setErrorMsg(`Regla Boleta contra Boleta: El cliente posee una boleta pendiente ($${Number(selectedClient.outstandingBalance).toLocaleString()}). Debe registrar el pago de la boleta anterior antes de iniciar un nuevo pedido a crédito.`);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const items = cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity
      }));

      await api.createOrder({
        clientId: selectedClient.id,
        items
      });

      setSuccessMsg(`🎉 ¡Pedido cargado con éxito! Se envió a depósito para su armado.`);
      setCart([]);
      setSelectedClient(null);
      setSubTab('list'); // Ir al historial
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el pedido.');
    } finally {
      setLoading(false);
    }
  };

  // --- REGISTRAR NUEVO CLIENTE EN CALLE ---
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientModal.name) {
      setErrorMsg('El nombre es obligatorio.');
      return;
    }

    try {
      const client = await api.createClient(clientModal);
      setClientModal({ open: false, name: '', cuit: '', address: '', city: '', phone: '', email: '' });
      setSelectedClient(client); // Auto-seleccionar cliente creado
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar cliente.');
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
          <CheckCircle2 size={18} />
          {successMsg}
        </div>
      )}

      {/* ====================================================================
          1. TOMA DE PEDIDOS
          ==================================================================== */}
      {activeTab === 'orders' && (
        <div>
          {/* Sub Tab Selector */}
          <div className="tabs-container" style={{ marginBottom: '20px' }}>
            <button className={`tab-btn ${subTab === 'create' ? 'tab-btn-active' : ''}`} onClick={() => setSubTab('create')}>Nueva Toma de Pedido</button>
            <button className={`tab-btn ${subTab === 'list' ? 'tab-btn-active' : ''}`} onClick={() => setSubTab('list')}>Historial de Pedidos</button>
          </div>

          {subTab === 'create' ? (
            <div>
              {/* Clic 1: Seleccionar Cliente */}
              <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ background: 'var(--text-primary)', color: '#fff', width: '20px', height: '20px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>1</span>
                  <span>Seleccionar Cliente</span>
                </h3>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <select
                      className="select"
                      value={selectedClient ? selectedClient.id : ''}
                      onChange={(e) => {
                        const client = clients.find(c => c.id === Number(e.target.value));
                        setSelectedClient(client || null);
                      }}
                      style={{ paddingRight: '40px' }}
                    >
                      <option value="">-- Selecciona un cliente registrado --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.cuit ? `(CUIT: ${c.cuit})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="btn btn-secondary" onClick={() => setClientModal({ open: true, name: '', cuit: '', address: '', city: '', phone: '', email: '' })}>
                    <UserPlus size={16} />
                    <span>Nuevo Cliente</span>
                  </button>
                </div>
                {selectedClient && (
                  <div style={{ marginTop: '10px', fontSize: '0.825rem', display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px', backgroundColor: 'var(--bg-light)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div>
                      <strong>Dirección:</strong> {selectedClient.address || 'Sin registrar'} | <strong>Teléfono:</strong> {selectedClient.phone || 'Sin registrar'}
                      {selectedClient.phone && (
                        <a 
                          href={getWhatsAppLink(selectedClient.phone)} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          title="Escribir por WhatsApp" 
                          style={{ marginLeft: '6px', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                          </svg>
                        </a>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                      <span><strong>Saldo C/C:</strong> <span style={{ color: (selectedClient.outstandingBalance || 0) > 0 ? 'var(--color-danger)' : 'var(--text-primary)', fontWeight: 600 }}>${(selectedClient.outstandingBalance || 0).toLocaleString()}</span></span>
                      <span><strong>Límite Crédito:</strong> <span style={{ fontWeight: 600 }}>${(selectedClient.creditLimit || 0).toLocaleString()}</span></span>
                      <span><strong>Lista:</strong> <span style={{ fontWeight: 600 }}>{selectedClient.priceList === 'C' ? 'Distribuidor C' : selectedClient.priceList === 'B' ? 'Especial B' : 'Estándar A'}</span></span>
                      {Number(selectedClient.discount || 0) > 0 && (
                        <span style={{ color: 'var(--color-success)' }}><strong>Desc. Fijo:</strong> {selectedClient.discount}%</span>
                      )}
                    </div>
                    {Number(selectedClient.outstandingBalance || 0) > 0 && (
                      <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#FDF2F2', border: '1px solid #F8B4B4', borderRadius: '4px', color: '#9B1C1C', fontSize: '0.775rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <strong>⚠️ Bloqueo de Cuenta Corriente (Boleta contra Boleta):</strong>
                        <span>Este cliente posee una deuda activa de <strong>${Number(selectedClient.outstandingBalance).toLocaleString()}</strong>. No se permite registrar nuevos pedidos a crédito (C/C).</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Clic 2: Armar Carrito de Compras */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
                {/* Columna Izquierda: Catálogo */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ background: 'var(--text-primary)', color: '#fff', width: '20px', height: '20px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>2</span>
                    <span>Agregar Productos al Carrito</span>
                  </h3>
                  
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <div className="search-input-wrapper" style={{ flex: 1 }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Filtrar catálogo..."
                        value={prodSearchQuery}
                        onChange={(e) => setProdSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="search-input-wrapper" style={{ flex: 1 }}>
                      <input
                        type="text"
                        className={`input ${barcodeError ? 'border-danger' : ''}`}
                        placeholder="Escanear Código Barras..."
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={handleBarcodeScan}
                        style={{
                          borderColor: barcodeError ? '#C5221F' : undefined,
                          backgroundColor: barcodeError ? '#FDF6F6' : undefined,
                          transition: 'all 0.2s ease'
                        }}
                      />
                    </div>
                  </div>

                  <div className="catalog-list" style={{ flex: 1, maxHeight: '350px', overflowY: 'auto' }}>
                    {products.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No hay productos.</div>
                    ) : (
                      products.map(p => {
                        const price = getItemPrice(p, selectedClient);
                        const hasCustomPrice = selectedClient && (
                          (selectedClient.priceList === 'B' && p.listPriceB > 0) || 
                          (selectedClient.priceList === 'C' && p.listPriceC > 0) ||
                          Number(selectedClient.discount || 0) > 0
                        );
                        return (
                          <div key={p.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Stock: {p.stock} u.</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: hasCustomPrice ? 'var(--color-success)' : 'var(--text-primary)' }}>
                                ${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}
                                onClick={() => addToCart(p)}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Columna Derecha: Carrito */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShoppingCart size={18} />
                      <span>Detalle del Pedido</span>
                    </h3>
                  </div>

                  <div className="cart-list" style={{ flex: 1, backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                    {cart.length === 0 ? (
                      <div style={{ display: 'flex', height: '150px', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-secondary)', gap: '8px' }}>
                        <ShoppingCart size={24} />
                        <p style={{ fontSize: '0.8rem' }}>El carrito de compras está vacío.</p>
                      </div>
                    ) : (
                      cart.map(item => {
                        const itemPrice = getItemPrice(item.product, selectedClient);
                        return (
                          <div key={item.product.id} className="list-item" style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{item.product.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Subtotal: ${(itemPrice * item.quantity).toLocaleString()} (${itemPrice.toLocaleString()} c/u)</div>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button className="btn btn-secondary" style={{ padding: '2px 6px' }} onClick={() => updateCartQty(item.product.id, -1)}>-</button>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.quantity}</span>
                              <button className="btn btn-secondary" style={{ padding: '2px 6px' }} onClick={() => updateCartQty(item.product.id, 1)}>+</button>
                              <button className="btn btn-ghost text-danger" style={{ padding: '4px' }} onClick={() => updateCartQty(item.product.id, -item.quantity)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Importe Total:</span>
                      <span style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                        ${getCartTotal().toLocaleString()}
                      </span>
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '12px', fontWeight: 600 }}
                      onClick={handleConfirmOrder}
                      disabled={loading}
                    >
                      {loading ? 'Procesando...' : 'Confirmar Pedido'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Historial de Pedidos */
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Nro Comprobante</th>
                    <th>Canal</th>
                    <th>Total</th>
                    <th>Estado Envío</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0' }}>No registraste pedidos aún.</td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id}>
                        <td style={{ fontSize: '0.8rem' }}>{new Date(o.createdAt).toLocaleDateString('es-AR')}</td>
                        <td style={{ fontWeight: 500 }}>{o.client.name}</td>
                        <td style={{ fontFamily: 'monospace' }}>{o.invoiceNumber || 'Pendiente'}</td>
                        <td>
                          <span className={o.billingType === 'OFFICIAL' ? 'badge badge-official' : 'badge badge-internal'}>
                            {o.billingType === 'OFFICIAL' ? 'Sucursal A' : 'Sucursal X'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>${o.totalAmount.toLocaleString()}</td>
                        <td>
                          <span className={`badge badge-${o.status.toLowerCase()}`}>
                            {o.status === 'PENDING' ? 'Pendiente' : o.status === 'PREPARING' ? 'En picking' : o.status === 'PREPARED' ? 'Armado listo' : o.status === 'DELIVERED' ? 'Facturado' : 'Cancelado'}
                          </span>
                        </td>
                        <td style={{ display: 'flex', gap: '6px' }}>
                          <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} title="Ver Detalle" onClick={() => setOrderDetailsModal(o)}>
                            <Eye size={12} />
                          </button>
                          <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} title="Imprimir Ticket" onClick={() => printTicket(o)}>
                            <Printer size={12} />
                          </button>
                          {o.status === 'PENDING' && (
                            <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} title="Editar Pedido" onClick={() => handleOpenEditOrder(o)}>
                              <Edit size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          2. MIS CLIENTES
          ==================================================================== */}
      {activeTab === 'clients' && (
        <div>
          <div className="actions-bar">
            <div className="search-input-wrapper">
              <input
                type="text"
                className="input"
                placeholder="Buscar mis clientes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={() => setClientModal({ open: true, name: '', cuit: '', address: '', city: '', phone: '', email: '' })}>
              <UserPlus size={16} />
              <span>Nuevo Cliente</span>
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre/Razón Social</th>
                  <th>CUIT / ID Fiscal</th>
                  <th>Lista</th>
                  <th>Saldo C/C</th>
                  <th>Dirección de Entrega</th>
                  <th>Teléfono</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0' }}>No se encontraron clientes asociados a tu cuenta.</td>
                  </tr>
                ) : (
                  clients.map((c) => {
                    const balance = Number(c.outstandingBalance || 0);
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td style={{ fontFamily: 'monospace' }}>{c.cuit || 'Sin CUIT'}</td>
                        <td>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: c.priceList === 'C' ? '#E5F6FD' : c.priceList === 'B' ? '#FDF6E2' : '#F2F2F7',
                            color: c.priceList === 'C' ? '#0288D1' : c.priceList === 'B' ? '#B78103' : '#3A3A3C',
                            padding: '3px 6px',
                            borderRadius: '4px'
                          }}>
                            {c.priceList === 'C' ? 'Dist C' : c.priceList === 'B' ? 'Esp B' : 'Est A'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: balance > 0 ? 'var(--color-danger)' : balance < 0 ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                          ${balance.toLocaleString()}
                        </td>
                        <td>{c.address || 'Sin dirección'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{c.phone || 'Sin teléfono'}</span>
                            {c.phone && (
                              <a href={getWhatsAppLink(c.phone)} target="_blank" rel="noopener noreferrer" title="Escribir por WhatsApp">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366">
                                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                                </svg>
                              </a>
                            )}
                          </div>
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
          3. CATALOGO DE PRODUCTOS (READ-ONLY)
          ==================================================================== */}
      {activeTab === 'products' && (
        <div>
          <div className="actions-bar">
            <div className="search-input-wrapper">
              <input
                type="text"
                className="input"
                placeholder="Buscar en el catálogo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Precio Venta (Lista)</th>
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
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
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
                <label>Nombre Comercial / Razón Social</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Almacén Don Carlos"
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
                  placeholder="ej: 20222334449"
                  value={clientModal.cuit}
                  onChange={(e) => setClientModal({ ...clientModal, cuit: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Dirección de Entrega</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Belgrano 150, CABA"
                  value={clientModal.address}
                  onChange={(e) => setClientModal({ ...clientModal, address: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Localidad</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: General Villegas"
                  value={clientModal.city || ''}
                  onChange={(e) => setClientModal({ ...clientModal, city: e.target.value })}
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
                <button type="submit" className="btn btn-primary">Registrar Cliente</button>
              </div>
            </form>
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
            
            {/* Barra de progreso de preparación (Fase 2) */}
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

            <div style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
              <p><strong>Cliente:</strong> {orderDetailsModal.client?.name}</p>
              <p><strong>Dirección:</strong> {orderDetailsModal.client?.address || 'S/D'}</p>
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

      {/* 2. Modal Editar Pedido */}
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
    </div>
  );
}
