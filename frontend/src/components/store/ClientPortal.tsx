import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../../utils/api';

interface ClientPortalProps {
  onBackToStaffLogin?: () => void;
}

interface ClientProfile {
  id: number;
  name: string;
  cuit: string | null;
  address: string | null;
  city: string | null;
  priceList: string;
  discount: number;
  outstandingBalance: number;
  creditLimit: number;
  paymentTermDays?: number;
}

interface StoreProduct {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  barcode: string | null;
  price: number;
  listPriceA: number;
  listPriceB: number;
  listPriceC: number;
  stock: number;
  isPesable: boolean;
  unitsPerBox: number;
  imageUrl: string | null;
  rubroId: number | null;
  rubroName: string;
  commercialGroupId?: string;
  commercialGroupName?: string;
  commercialGroupIcon?: string;
  isOffer: boolean;
  offerDiscount: number;
  offerName: string | null;
}

interface CartItem {
  product: StoreProduct;
  quantity: number;
  unitPrice: number;
}

export const ClientPortal: React.FC<ClientPortalProps> = ({ onBackToStaffLogin }) => {
  // Estado del cliente autenticado
  const [client, setClient] = useState<ClientProfile | null>(() => {
    const saved = localStorage.getItem('store_client_session');
    return saved ? JSON.parse(saved) : null;
  });

  // Modal de inicio de sesión / selección de cliente
  const [loginSearch, setLoginSearch] = useState('');
  const [availableClients, setAvailableClients] = useState<ClientProfile[]>([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);

  // Pestañas activas: 'catalog' | 'account' | 'orders'
  const [activeTab, setActiveTab] = useState<'catalog' | 'account' | 'orders'>('catalog');

  // Catálogo y filtros comerciales
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [rubros, setRubros] = useState<any[]>([]);
  const [commercialGroups, setCommercialGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedRubroId, setSelectedRubroId] = useState<number | null>(null);
  const [onlyOffers, setOnlyOffers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  // Carrito de compras
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(null);

  // Historial de pedidos y cuenta corriente
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [accountData, setAccountData] = useState<any>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);

  // Cargar catálogo cuando cambia el cliente o su lista de precios
  useEffect(() => {
    if (client) {
      fetchCatalog(client.priceList || 'A');
      fetchAccountData(client.id);
    }
  }, [client]);

  const fetchAvailableClients = async (term: string) => {
    if (!term.trim()) {
      setLoginError('Por favor ingresá tu CUIT o el Nombre de tu comercio.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);
    setAvailableClients([]);

    try {
      const res = await fetch(`${API_BASE_URL}/store/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search: term.trim() })
      });
      const json = await res.json();
      if (json.status === 'success') {
        if (json.data.client) {
          handleSelectClient(json.data.client, json.data.token);
        } else if (json.data.clients && json.data.clients.length > 0) {
          setAvailableClients(json.data.clients);
        } else {
          setLoginError('No se encontró ningún comercio activo con los datos ingresados.');
        }
      } else {
        setLoginError(json.message || 'No se encontró el cliente.');
      }
    } catch (e: any) {
      setLoginError('Error al conectar con el servidor.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSelectClient = (selected: ClientProfile, token?: string) => {
    setClient(selected);
    localStorage.setItem('store_client_session', JSON.stringify(selected));
    if (token) {
      localStorage.setItem('store_token', token);
    }
  };

  const handleLogoutClient = () => {
    setClient(null);
    localStorage.removeItem('store_client_session');
    localStorage.removeItem('store_token');
    setCart([]);
    setLoginSearch('');
    setAvailableClients([]);
    setLoginError(null);
  };

  const fetchCatalog = async (priceList: string) => {
    setIsLoadingCatalog(true);
    try {
      const res = await fetch(`${API_BASE_URL}/store/catalog?priceList=${encodeURIComponent(priceList)}`);
      const json = await res.json();
      if (json.status === 'success') {
        setProducts(json.data.products || []);
        setRubros(json.data.rubros || []);
        setCommercialGroups(json.data.commercialGroups || []);
      } else {
        console.error('Error del catálogo:', json.message);
      }
    } catch (e) {
      console.error('Error al cargar catálogo:', e);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const fetchAccountData = async (personaId: number) => {
    setIsLoadingAccount(true);
    try {
      const [accRes, ordRes] = await Promise.all([
        fetch(`${API_BASE_URL}/store/account/${personaId}`),
        fetch(`${API_BASE_URL}/store/orders/${personaId}`)
      ]);
      const accJson = await accRes.json();
      const ordJson = await ordRes.json();

      if (accJson.status === 'success') {
        setAccountData(accJson.data);
      }
      if (ordJson.status === 'success') {
        setRecentOrders(ordJson.data.orders || []);
      }
    } catch (e) {
      console.error('Error al cargar datos de cuenta:', e);
    } finally {
      setIsLoadingAccount(false);
    }
  };

  // Filtrado por Grupos Comerciales de Oferta
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Filtro por Grupo Comercial
      if (selectedGroupId && selectedGroupId !== 'all') {
        if (selectedGroupId === 'bultos') {
          if ((p.unitsPerBox || 1) <= 1) return false;
        } else if (p.commercialGroupId !== selectedGroupId) {
          return false;
        }
      }
      if (selectedRubroId && p.rubroId !== selectedRubroId) return false;
      if (onlyOffers && !p.isOffer) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku.toLowerCase().includes(q);
        const matchRubro = p.rubroName.toLowerCase().includes(q);
        const matchGroup = (p.commercialGroupName || '').toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchRubro && !matchGroup) return false;
      }
      return true;
    });
  }, [products, selectedGroupId, selectedRubroId, onlyOffers, searchQuery]);

  // Manejo de Carrito
  const addToCart = (product: StoreProduct, qty: number = 1) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += qty;
        return updated;
      }
      return [...prev, { product, quantity: qty, unitPrice: product.price }];
    });
  };

  const updateCartQuantity = (productId: number, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
    } else {
      setCart((prev) =>
        prev.map((item) => (item.product.id === productId ? { ...item, quantity: qty } : item))
      );
    }
  };

  const cartTotalNeto = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const cartTotalIva = cartTotalNeto * 0.21;
  const cartTotalFinal = cartTotalNeto + cartTotalIva;
  const cartTotalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmitOrder = async () => {
    if (!client || cart.length === 0) return;
    setIsSubmittingOrder(true);
    try {
      const res = await fetch(`${API_BASE_URL}/store/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: client.id,
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          })),
          notes: orderNotes
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setOrderSuccessMessage('¡Tu pedido fue recibido con éxito! Un vendedor procesará tu orden.');
        setCart([]);
        setOrderNotes('');
        setIsCartOpen(false);
        fetchAccountData(client.id);
        setActiveTab('orders');
      } else {
        alert(json.message || 'Ocurrió un error al enviar el pedido.');
      }
    } catch (e: any) {
      alert('Error de conexión al enviar el pedido.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleRepeatOrder = (pastOrder: any) => {
    if (!pastOrder.items || pastOrder.items.length === 0) return;
    pastOrder.items.forEach((item: any) => {
      const matchedProd = products.find((p) => p.id === item.productId);
      if (matchedProd) {
        addToCart(matchedProd, item.quantity);
      }
    });
    setIsCartOpen(true);
  };

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

  // HELPER PARA INSIGNIA DE STOCK ESTIMADO (Sin mostrar números reales)
  const renderStockBadge = (stock: number) => {
    if (stock <= 0) {
      return (
        <span style={styles.stockTagRed}>
          🔴 Sin Stock Inmediato
        </span>
      );
    }
    if (stock <= 30) {
      return (
        <span style={styles.stockTagAmber}>
          ⚠️ Pocas Unidades
        </span>
      );
    }
    return (
      <span style={styles.stockTagGreen}>
        🟢 Disponible
      </span>
    );
  };

  // REGLA: Cuenta corriente sólo visible para Lista A / Sucursal A (Oficial)
  const showAccountBalance = useMemo(() => {
    if (!client || !client.priceList) return false;
    const listName = client.priceList.toUpperCase().trim();
    return listName === 'A' || listName === 'LISTA A' || listName === 'SUCURSAL A' || listName.includes('OFICIAL');
  }, [client]);

  // SI NO HAY CLIENTE AUTENTICADO: MOSTRAR INGRESO PRIVADO B2B DE CLIENTE
  if (!client) {
    return (
      <div style={styles.loginOverlay}>
        <div style={styles.loginCard}>
          <div style={styles.loginHeader}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              {!logoFailed ? (
                <img
                  src="/logo.png"
                  alt="Logo DV"
                  style={{ height: '75px', objectFit: 'contain' }}
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <div style={styles.logoTextFallback}>ERP-CRM DV</div>
              )}
            </div>
            <div style={styles.badgeCorpRed}>PORTAL MAYORISTA B2B</div>
            <h1 style={styles.loginTitle}>Ingreso a la Tienda Online</h1>
            <p style={styles.loginSubtitle}>
              Ingresá el CUIT o Nombre Comercial de tu comercio para ver tu catálogo exclusivo de productos y promociones.
            </p>
          </div>

          <div style={styles.loginSearchBox}>
            <input
              type="text"
              placeholder="Ej: 30-71234567-8 o Nombre del Comercio..."
              value={loginSearch}
              onChange={(e) => setLoginSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchAvailableClients(loginSearch)}
              style={styles.searchInput}
              autoFocus
            />
            <button
              onClick={() => fetchAvailableClients(loginSearch)}
              disabled={isLoggingIn || !loginSearch.trim()}
              style={{
                ...styles.btnPrimary,
                opacity: !loginSearch.trim() || isLoggingIn ? 0.6 : 1
              }}
            >
              {isLoggingIn ? 'Buscando...' : 'Ingresar'}
            </button>
          </div>

          {loginError && <div style={styles.errorBanner}>{loginError}</div>}

          {/* LISTA DE COINCIDENCIAS (Solo se muestra cuando busca) */}
          {availableClients.length > 0 && (
            <div style={styles.clientListContainer}>
              <h4 style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                Seleccioná tu Comercio ({availableClients.length}):
              </h4>
              <div style={styles.clientGrid}>
                {availableClients.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectClient(c)}
                    style={styles.clientCard}
                  >
                    <div style={{ fontWeight: 600, fontSize: '15px', color: '#0f172a' }}>{c.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      CUIT: {c.cuit || 'Sin CUIT'} • Lista: <span style={{ color: '#E30613', fontWeight: 600 }}>{c.priceList || 'A'}</span>
                    </div>
                    {c.city && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>📍 {c.city}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {onBackToStaffLogin && (
            <div style={{ marginTop: '28px', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button onClick={onBackToStaffLogin} style={styles.btnLink}>
                ← Volver al Panel de Empleados / Vendedores
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.portalContainer}>
      {/* BARRA SUPERIOR DE TIENDA */}
      <header style={styles.topNavbar}>
        <div style={styles.navBrand}>
          {!logoFailed ? (
            <img
              src="/logo.png"
              alt="Logo DV"
              style={{ height: '40px', objectFit: 'contain' }}
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div style={styles.logoBadge}>TIENDA B2B</div>
          )}
          <div>
            <div style={styles.clientNameTitle}>{client.name}</div>
            <div style={styles.clientMetaInfo}>
              CUIT: {client.cuit || 'S/D'} • Lista {client.priceList || 'A'} • Dto: {client.discount}%
            </div>
          </div>
        </div>

        <div style={styles.navActions}>
          {showAccountBalance && (
            <div style={styles.balanceBadge}>
              <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Cuenta Corriente:</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: client.outstandingBalance > 0 ? '#ef4444' : '#10b981' }}>
                {formatMoney(client.outstandingBalance)}
              </span>
            </div>
          )}

          <button onClick={() => setIsCartOpen(true)} style={styles.cartButton}>
            🛒 Mi Carrito
            {cartTotalItemsCount > 0 && <span style={styles.cartCountBadge}>{cartTotalItemsCount}</span>}
          </button>

          <button onClick={handleLogoutClient} style={styles.btnSecondarySmall}>
            Salir
          </button>
        </div>
      </header>

      {/* MENSAJE DE ÉXITO DE PEDIDO */}
      {orderSuccessMessage && (
        <div style={styles.successBanner}>
          <span>{orderSuccessMessage}</span>
          <button onClick={() => setOrderSuccessMessage(null)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontWeight: 'bold' }}>
            ✕
          </button>
        </div>
      )}

      {/* PESTAÑAS DE NAVEGACIÓN */}
      <nav style={styles.tabNav}>
        <button
          onClick={() => setActiveTab('catalog')}
          style={{ ...styles.tabItem, ...(activeTab === 'catalog' ? styles.tabItemActive : {}) }}
        >
          🛒 Catálogo Interactivo & Ofertas
        </button>
        {showAccountBalance && (
          <button
            onClick={() => setActiveTab('account')}
            style={{ ...styles.tabItem, ...(activeTab === 'account' ? styles.tabItemActive : {}) }}
          >
            📄 Mi Cuenta Corriente
          </button>
        )}
        <button
          onClick={() => setActiveTab('orders')}
          style={{ ...styles.tabItem, ...(activeTab === 'orders' ? styles.tabItemActive : {}) }}
        >
          📦 Mis Pedidos ({recentOrders.length})
        </button>
      </nav>

      {/* VISTA 1: CATÁLOGO INTERACTIVO POR GRUPOS COMERCIALES DE OFERTA */}
      {activeTab === 'catalog' && (
        <div style={styles.tabContent}>
          {/* BARRA DE BÚSQUEDA Y FILTROS */}
          <div style={styles.filterSection}>
            <input
              type="text"
              placeholder="Buscar producto por nombre, SKU o marca..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.catalogSearchInput}
            />

            <button
              onClick={() => setOnlyOffers(!onlyOffers)}
              style={{
                ...styles.btnFilterOffer,
                ...(onlyOffers ? styles.btnFilterOfferActive : {})
              }}
            >
              🔥 Solo Ofertas Destacadas
            </button>
          </div>

          {/* BARRA DE PESTAÑAS DE GRUPOS COMERCIALES DE OFERTA */}
          <div style={styles.commercialGroupTabsContainer}>
            {commercialGroups.map((g) => {
              const count = g.id === 'all'
                ? products.length
                : g.id === 'bultos'
                ? products.filter((p) => (p.unitsPerBox || 1) > 1).length
                : products.filter((p) => p.commercialGroupId === g.id).length;

              return (
                <button
                  key={g.id}
                  onClick={() => {
                    setSelectedGroupId(g.id);
                    setSelectedRubroId(null);
                  }}
                  style={{
                    ...styles.commercialGroupTab,
                    ...(selectedGroupId === g.id ? styles.commercialGroupTabActive : {})
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{g.icon}</span>
                  <span style={{ fontWeight: 600 }}>{g.name}</span>
                  <span style={styles.groupCountBadge}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* GRILLA DE PRODUCTOS */}
          {isLoadingCatalog ? (
            <div style={styles.loadingBox}>Cargando catálogo de productos...</div>
          ) : filteredProducts.length === 0 ? (
            <div style={styles.emptyBox}>No se encontraron productos en este grupo comercial con los filtros aplicados.</div>
          ) : (
            <div style={styles.productGrid}>
              {filteredProducts.map((p) => {
                const itemInCart = cart.find((c) => c.product.id === p.id);
                const currentQty = itemInCart ? itemInCart.quantity : 0;

                return (
                  <div key={p.id} style={styles.productCard}>
                    {/* IMAGEN DE PRODUCTO */}
                    <div style={styles.productImageArea}>
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl.startsWith('http') || p.imageUrl.startsWith('/uploads') ? p.imageUrl : `/uploads/products/${p.imageUrl}`}
                          alt={p.name}
                          style={styles.productImg}
                          onError={(e: any) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div style={styles.productPlaceholder}>
                          <span style={{ fontSize: '36px' }}>{p.commercialGroupIcon || '📦'}</span>
                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>SKU {p.sku}</span>
                        </div>
                      )}

                      {p.isOffer && (
                        <div style={styles.offerBadge}>
                          🔥 {p.offerName || 'OFERTA ESPECIAL'}
                        </div>
                      )}
                    </div>

                    <div style={styles.productCardBody}>
                      <div style={styles.productHeaderRow}>
                        <span style={styles.productSku}>SKU: {p.sku}</span>
                        <span style={styles.productCommercialTag}>
                          {p.commercialGroupIcon || '📦'} {p.commercialGroupName || 'Almacén'}
                        </span>
                      </div>

                      <h3 style={styles.productTitle}>{p.name}</h3>
                      {p.description && <p style={styles.productDesc}>{p.description}</p>}

                      <div style={styles.productPriceRow}>
                        <div>
                          <div style={styles.productPriceLabel}>Precio Neto Lista {client.priceList}:</div>
                          <div style={styles.productPriceValue}>{formatMoney(p.price)}</div>
                        </div>
                        {p.unitsPerBox > 1 && (
                          <div style={styles.unitsBoxTag}>
                            📦 Caja x {p.unitsPerBox} un.
                          </div>
                        )}
                      </div>

                      {/* DISPONIBILIDAD (Sin mostrar número exacto de stock) */}
                      <div style={styles.stockStatusRow}>
                        {renderStockBadge(p.stock)}
                      </div>

                      {/* CONTROLES DE CANTIDAD */}
                      <div style={styles.cardActions}>
                        {currentQty === 0 ? (
                          <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                            <button
                              onClick={() => addToCart(p, 1)}
                              style={styles.btnAddCart}
                            >
                              + Agregar 1 Un.
                            </button>
                            {p.unitsPerBox > 1 && (
                              <button
                                onClick={() => addToCart(p, p.unitsPerBox)}
                                style={styles.btnAddBox}
                              >
                                + 1 Caja ({p.unitsPerBox})
                              </button>
                            )}
                          </div>
                        ) : (
                          <div style={styles.qtyControllerRow}>
                            <button
                              onClick={() => updateCartQuantity(p.id, currentQty - 1)}
                              style={styles.btnQty}
                            >
                              -
                            </button>
                            <span style={styles.qtyDisplay}>{currentQty} un.</span>
                            <button
                              onClick={() => updateCartQuantity(p.id, currentQty + 1)}
                              style={styles.btnQty}
                            >
                              +
                            </button>
                            {p.unitsPerBox > 1 && (
                              <button
                                onClick={() => updateCartQuantity(p.id, currentQty + p.unitsPerBox)}
                                style={styles.btnQtyBox}
                              >
                                +Caja
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VISTA 2: CUENTA CORRIENTE (Solo si es Lista A / Oficial) */}
      {activeTab === 'account' && showAccountBalance && (
        <div style={styles.tabContent}>
          <div style={styles.accountCardHeader}>
            <div style={styles.accountMetricBox}>
              <span style={styles.accountMetricLabel}>Saldo Total Acumulado</span>
              <span style={{ ...styles.accountMetricValue, color: client.outstandingBalance > 0 ? '#dc2626' : '#059669' }}>
                {formatMoney(client.outstandingBalance)}
              </span>
              <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                {client.outstandingBalance > 0 ? 'Saldo a regularizar según plazo acordado' : 'Sin saldos pendientes de pago'}
              </span>
            </div>

            <div style={styles.accountMetricBox}>
              <span style={styles.accountMetricLabel}>Límite de Crédito Otorgado</span>
              <span style={{ ...styles.accountMetricValue, color: '#2563eb' }}>
                {formatMoney(client.creditLimit)}
              </span>
              <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Plazo acordado: {client.paymentTermDays || 30} días
              </span>
            </div>
          </div>

          <div style={{ marginTop: '24px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', marginBottom: '16px' }}>
              📄 Resumen de Comprobantes y Movimientos Recientes
            </h3>
            {isLoadingAccount ? (
              <div style={styles.loadingBox}>Cargando estado de cuenta...</div>
            ) : recentOrders.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px' }}>No hay movimientos registrados.</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>N° Movimiento</th>
                    <th style={styles.th}>Fecha</th>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Monto Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td style={styles.td}>#{o.movementId || o.id}</td>
                      <td style={styles.td}>{new Date(o.createdAt).toLocaleDateString('es-AR')}</td>
                      <td style={styles.td}>{o.invoiceType || 'Presupuesto'}</td>
                      <td style={styles.td}>
                        <span style={styles.statusPill(o.status)}>{o.status}</span>
                      </td>
                      <td style={{ ...styles.td, fontWeight: 700, color: '#0f172a' }}>{formatMoney(Number(o.totalAmount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* VISTA 3: MIS PEDIDOS */}
      {activeTab === 'orders' && (
        <div style={styles.tabContent}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', marginBottom: '16px' }}>
            📦 Historial y Seguimiento de Pedidos
          </h3>

          {recentOrders.length === 0 ? (
            <div style={styles.emptyBox}>No has realizado pedidos recientemente.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {recentOrders.map((ord) => (
                <div key={ord.id} style={styles.orderHistoryCard}>
                  <div style={styles.orderHistoryHeader}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '16px', color: '#0f172a' }}>
                        Pedido #{ord.movementId || ord.id}
                      </span>
                      <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '12px' }}>
                        📅 {new Date(ord.createdAt).toLocaleString('es-AR')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={styles.statusPill(ord.status)}>
                        {ord.status === 'PENDING' ? '⏳ En Revisión' : ord.status === 'PREPARED' ? '✅ Preparado' : ord.status === 'DELIVERED' ? '🚚 Entregado' : ord.status}
                      </span>
                      <button onClick={() => handleRepeatOrder(ord)} style={styles.btnSecondarySmall}>
                        🔄 Repetir Pedido
                      </button>
                    </div>
                  </div>

                  <div style={styles.orderHistoryItems}>
                    {ord.items && ord.items.map((it: any) => (
                      <div key={it.id} style={styles.orderItemRow}>
                        <span style={{ color: '#0f172a', fontWeight: 500 }}>
                          {it.product?.name || `Producto #${it.productId}`}
                        </span>
                        <span style={{ color: '#475569', fontSize: '13px' }}>
                          {it.quantity} un. x {formatMoney(Number(it.unitPrice))} = <strong style={{ color: '#0f172a' }}>{formatMoney(Number(it.subtotal))}</strong>
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={styles.orderHistoryFooter}>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>Total Estimado con IVA:</span>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: '#059669' }}>
                      {formatMoney(Number(ord.totalAmount))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DRAWER / SLIDE-OVER DEL CARRITO DE COMPRAS */}
      {isCartOpen && (
        <div style={styles.drawerOverlay} onClick={() => setIsCartOpen(false)}>
          <div style={styles.drawerCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.drawerHeader}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>🛒 Resumen del Pedido</h2>
              <button onClick={() => setIsCartOpen(false)} style={styles.btnCloseDrawer}>
                ✕
              </button>
            </div>

            <div style={styles.drawerBody}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                  El carrito está vacío. Explorá el catálogo y agregá productos.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {cart.map((item) => (
                    <div key={item.product.id} style={styles.cartItemRow}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{item.product.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {formatMoney(item.unitPrice)} c/u
                        </div>
                      </div>

                      <div style={styles.qtyControllerSmall}>
                        <button onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)} style={styles.btnQtySmall}>-</button>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', width: '28px', textAlign: 'center' }}>{item.quantity}</span>
                        <button onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)} style={styles.btnQtySmall}>+</button>
                      </div>

                      <div style={{ minWidth: '80px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {formatMoney(item.unitPrice * item.quantity)}
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 500 }}>
                      📝 Observaciones para la entrega (Opcional):
                    </label>
                    <textarea
                      placeholder="Ej: Entregar por la mañana, o comentarios del pedido..."
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      rows={3}
                      style={styles.notesTextarea}
                    />
                  </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div style={styles.drawerFooter}>
                <div style={styles.summaryRow}>
                  <span>Subtotal Neto:</span>
                  <span>{formatMoney(cartTotalNeto)}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span>IVA Estimado (21%):</span>
                  <span>{formatMoney(cartTotalIva)}</span>
                </div>
                <div style={{ ...styles.summaryRow, fontSize: '18px', fontWeight: 700, color: '#0f172a', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                  <span>Total Estimado:</span>
                  <span style={{ color: '#059669' }}>{formatMoney(cartTotalFinal)}</span>
                </div>

                <button
                  onClick={handleSubmitOrder}
                  disabled={isSubmittingOrder}
                  style={styles.btnSubmitOrder}
                >
                  {isSubmittingOrder ? 'Procesando Pedido...' : '🚀 CONFIRMAR Y ENVIAR PEDIDO'}
                </button>

                <a
                  href={`https://wa.me/?text=Hola%20tengo%20una%20consulta%20sobre%20mi%20pedido%20de%20tienda%20B2B%20(Cliente:%20${encodeURIComponent(client.name)})`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.whatsappLink}
                >
                  💬 Consulta Urgente por WhatsApp
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ESTILOS NATIVOS SUPER PREMIUM ALINEADOS AL ERP (PALETA CÁLIDA, BLANCOS, GRISES Y NEGROS CON ROJO CORPORATIVO)
const styles: { [key: string]: any } = {
  portalContainer: {
    minHeight: '100vh',
    background: '#f8fafc',
    color: '#0f172a',
    fontFamily: "'Outfit', Inter, system-ui, -apple-system, sans-serif",
    paddingBottom: '60px'
  },
  loginOverlay: {
    minHeight: '100vh',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
  },
  loginCard: {
    width: '100%',
    maxWidth: '520px',
    background: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    padding: '40px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)'
  },
  loginHeader: {
    textAlign: 'center',
    marginBottom: '28px'
  },
  logoTextFallback: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '1px'
  },
  badgeCorpRed: {
    display: 'inline-block',
    background: 'rgba(227, 6, 19, 0.08)',
    color: '#E30613',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    padding: '4px 12px',
    borderRadius: '20px',
    marginBottom: '14px',
    border: '1px solid rgba(227, 6, 19, 0.2)'
  },
  loginTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 8px 0'
  },
  loginSubtitle: {
    fontSize: '14px',
    color: '#475569',
    margin: 0,
    lineHeight: '1.5'
  },
  loginSearchBox: {
    display: 'flex',
    gap: '10px',
    marginBottom: '16px'
  },
  searchInput: {
    flex: 1,
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '13px 18px',
    color: '#0f172a',
    fontSize: '14px',
    outline: 'none'
  },
  btnPrimary: {
    background: '#E30613',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 22px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer'
  },
  clientListContainer: {
    maxHeight: '280px',
    overflowY: 'auto',
    marginTop: '16px'
  },
  clientGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '8px'
  },
  clientCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '14px 18px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  btnLink: {
    background: 'none',
    border: 'none',
    color: '#475569',
    fontSize: '13px',
    cursor: 'pointer',
    textDecoration: 'underline'
  },
  errorBanner: {
    background: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '13px',
    marginBottom: '16px'
  },
  topNavbar: {
    background: '#1e293b',
    borderBottom: '1px solid #0f172a',
    padding: '16px 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px'
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  logoBadge: {
    background: '#E30613',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 800,
    padding: '6px 12px',
    borderRadius: '6px',
    letterSpacing: '0.5px'
  },
  clientNameTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#ffffff'
  },
  clientMetaInfo: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  navActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  balanceBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    background: '#0f172a',
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid #334155'
  },
  cartButton: {
    background: '#E30613',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 4px 12px rgba(227, 6, 19, 0.3)'
  },
  cartCountBadge: {
    background: '#fff',
    color: '#E30613',
    borderRadius: '10px',
    padding: '2px 7px',
    fontSize: '12px',
    fontWeight: 800
  },
  btnSecondarySmall: {
    background: '#334155',
    color: '#f8fafc',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '12px',
    cursor: 'pointer'
  },
  tabNav: {
    display: 'flex',
    gap: '8px',
    background: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    padding: '0 28px'
  },
  tabItem: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#64748b',
    padding: '16px 20px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  tabItemActive: {
    color: '#0f172a',
    borderBottomColor: '#E30613',
    fontWeight: 700
  },
  tabContent: {
    maxWidth: '1320px',
    margin: '0 auto',
    padding: '28px'
  },
  filterSection: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px'
  },
  catalogSearchInput: {
    flex: 1,
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '13px 18px',
    color: '#0f172a',
    fontSize: '14px',
    outline: 'none'
  },
  btnFilterOffer: {
    background: '#ffffff',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '0 18px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnFilterOfferActive: {
    background: 'rgba(227, 6, 19, 0.08)',
    color: '#E30613',
    borderColor: '#E30613'
  },
  commercialGroupTabsContainer: {
    display: 'flex',
    gap: '10px',
    overflowX: 'auto',
    paddingBottom: '12px',
    marginBottom: '24px'
  },
  commercialGroupTab: {
    background: '#ffffff',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '10px 18px',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
  },
  commercialGroupTabActive: {
    background: '#0f172a',
    color: '#ffffff',
    borderColor: '#0f172a',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
  },
  groupCountBadge: {
    background: 'rgba(148, 163, 184, 0.2)',
    borderRadius: '10px',
    padding: '2px 7px',
    fontSize: '11px',
    fontWeight: 700
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px'
  },
  productCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
  },
  productImageArea: {
    height: '150px',
    background: '#f8fafc',
    borderBottom: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden'
  },
  productImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    padding: '12px'
  },
  productPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%'
  },
  offerBadge: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    background: '#E30613',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 800,
    padding: '4px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  productCardBody: {
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1
  },
  productHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px'
  },
  productSku: {
    fontSize: '11px',
    color: '#94a3b8'
  },
  productCommercialTag: {
    fontSize: '11px',
    color: '#2563eb',
    fontWeight: 600
  },
  productTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 6px 0',
    lineHeight: '1.3'
  },
  productDesc: {
    fontSize: '12px',
    color: '#64748b',
    margin: '0 0 12px 0'
  },
  productPriceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: '12px 0 8px 0'
  },
  productPriceLabel: {
    fontSize: '11px',
    color: '#64748b'
  },
  productPriceValue: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#0f172a'
  },
  unitsBoxTag: {
    fontSize: '11px',
    background: '#f1f5f9',
    color: '#334155',
    padding: '4px 8px',
    borderRadius: '6px',
    fontWeight: 600
  },
  stockStatusRow: {
    margin: '6px 0 14px 0'
  },
  stockTagGreen: {
    fontSize: '11px',
    color: '#059669',
    fontWeight: 600,
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    padding: '4px 10px',
    borderRadius: '6px',
    display: 'inline-block'
  },
  stockTagAmber: {
    fontSize: '11px',
    color: '#d97706',
    fontWeight: 600,
    background: '#fffbeb',
    border: '1px solid #fde68a',
    padding: '4px 10px',
    borderRadius: '6px',
    display: 'inline-block'
  },
  stockTagRed: {
    fontSize: '11px',
    color: '#dc2626',
    fontWeight: 600,
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    padding: '4px 10px',
    borderRadius: '6px',
    display: 'inline-block'
  },
  cardActions: {
    marginTop: 'auto'
  },
  btnAddCart: {
    flex: 1,
    background: '#E30613',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnAddBox: {
    background: '#1e293b',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '12px',
    cursor: 'pointer'
  },
  qtyControllerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '4px'
  },
  btnQty: {
    background: '#ffffff',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  btnQtyBox: {
    background: '#1e293b',
    color: '#fff',
    border: 'none',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    cursor: 'pointer',
    marginLeft: 'auto'
  },
  qtyDisplay: {
    flex: 1,
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a'
  },
  loadingBox: {
    textAlign: 'center',
    padding: '60px',
    color: '#64748b'
  },
  emptyBox: {
    textAlign: 'center',
    padding: '60px',
    color: '#64748b',
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0'
  },

  // ESTILOS DRAWER / CARRITO
  drawerOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    justifyContent: 'flex-end',
    zIndex: 9999
  },
  drawerCard: {
    width: '100%',
    maxWidth: '460px',
    background: '#ffffff',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-10px 0 35px rgba(0,0,0,0.15)'
  },
  drawerHeader: {
    padding: '24px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  btnCloseDrawer: {
    background: 'none',
    border: 'none',
    color: '#0f172a',
    fontSize: '20px',
    cursor: 'pointer'
  },
  drawerBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px'
  },
  cartItemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#f8fafc',
    padding: '14px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0'
  },
  qtyControllerSmall: {
    display: 'flex',
    alignItems: 'center',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '2px'
  },
  btnQtySmall: {
    background: '#f1f5f9',
    color: '#0f172a',
    border: 'none',
    width: '26px',
    height: '26px',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  notesTextarea: {
    width: '100%',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '12px',
    color: '#0f172a',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  drawerFooter: {
    padding: '24px',
    borderTop: '1px solid #e2e8f0',
    background: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    color: '#64748b'
  },
  btnSubmitOrder: {
    background: '#E30613',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '16px',
    fontWeight: 700,
    fontSize: '15px',
    cursor: 'pointer',
    marginTop: '6px'
  },
  whatsappLink: {
    display: 'block',
    textAlign: 'center',
    color: '#059669',
    fontSize: '13px',
    textDecoration: 'none',
    marginTop: '4px',
    fontWeight: 600
  },
  successBanner: {
    background: '#ecfdf5',
    color: '#059669',
    borderBottom: '1px solid #a7f3d0',
    padding: '14px 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px'
  },

  // CUENTA CORRIENTE
  accountCardHeader: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px'
  },
  accountMetricBox: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  accountMetricLabel: {
    fontSize: '12px',
    color: '#64748b',
    textTransform: 'uppercase'
  },
  accountMetricValue: {
    fontSize: '28px',
    fontWeight: 800,
    marginTop: '6px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    padding: '12px 14px',
    fontSize: '12px',
    color: '#64748b',
    borderBottom: '1px solid #e2e8f0'
  },
  td: {
    padding: '14px',
    fontSize: '13px',
    color: '#334155',
    borderBottom: '1px solid #e2e8f0'
  },
  statusPill: (status: string) => {
    let bg = '#f1f5f9';
    let color = '#64748b';
    if (status === 'PENDING') {
      bg = '#fffbeb';
      color = '#d97706';
    } else if (status === 'PREPARED' || status === 'DELIVERED') {
      bg = '#ecfdf5';
      color = '#059669';
    }
    return {
      background: bg,
      color: color,
      padding: '4px 10px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: 600
    };
  },

  // HISTORIAL DE PEDIDOS
  orderHistoryCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  orderHistoryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '14px',
    marginBottom: '14px'
  },
  orderHistoryItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  orderItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px'
  },
  orderHistoryFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '14px',
    paddingTop: '14px',
    borderTop: '1px dashed #e2e8f0'
  }
};

export default ClientPortal;
