import React from 'react';
import { Trash2, ShoppingCart, UserPlus, Package } from 'lucide-react';
import { cleanCityName, getWhatsAppLink, getVendedorItemPrice, sortVendedorCatalog } from './vendedorHelpers';
import type { Persona, Product, Rubro } from '../../types';

interface VendedorOrderTakeTabProps {
  clients: Persona[];
  products: Product[];
  rubros: Rubro[];
  selectedClient: Persona | null;
  setSelectedClient: (c: Persona | null) => void;
  clientFilter: string;
  setClientFilter: (q: string) => void;
  selectedCityFilters: string[];
  setSelectedCityFilters: (cities: string[]) => void;
  uniqueCities: string[];
  prodSearchQuery: string;
  setProdSearchQuery: (q: string) => void;
  filterRubroId: string;
  setFilterRubroId: (id: string) => void;
  cart: { product: any; quantity: number; isEmergencyOverride?: boolean }[];
  setCart: React.Dispatch<React.SetStateAction<{ product: any; quantity: number; isEmergencyOverride?: boolean }[]>>;
  orderNotes: string;
  setOrderNotes: (notes: string) => void;
  loading: boolean;
  onAddToCart: (product: any) => void;
  onUpdateCartQty: (productId: number, change: number) => void;
  onConfirmOrder: () => void;
  onOpenNewClientModal: () => void;
}

export const VendedorOrderTakeTab: React.FC<VendedorOrderTakeTabProps> = ({
  clients, products, rubros, selectedClient, setSelectedClient, clientFilter, setClientFilter,
  selectedCityFilters, setSelectedCityFilters, uniqueCities, prodSearchQuery, setProdSearchQuery,
  filterRubroId, setFilterRubroId, cart, setCart, orderNotes, setOrderNotes, loading,
  onAddToCart, onUpdateCartQty, onConfirmOrder, onOpenNewClientModal,
}) => {
  const filteredClientsForSelect = clients.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(clientFilter.toLowerCase()) || (c.cuit && c.cuit.includes(clientFilter));
    const matchesCity = selectedCityFilters.length === 0 || selectedCityFilters.includes(cleanCityName(c.city));
    return matchesSearch && matchesCity;
  });

  const filteredProducts = sortVendedorCatalog(
    products.filter((p) => {
      if (filterRubroId && Number(p.rubroId) !== Number(filterRubroId)) return false;
      if (prodSearchQuery) {
        const q = prodSearchQuery.toLowerCase().trim();
        return (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
      }
      return true;
    }),
    rubros,
    filterRubroId,
  );

  const cartTotal = cart.reduce((acc, curr) => {
    const price = getVendedorItemPrice(curr.product, selectedClient);
    const qtyOrWeight = curr.product.isPesable ? curr.quantity * (curr.product.approximateWeight || 1) : curr.quantity;
    return acc + Math.round(price * qtyOrWeight);
  }, 0);

  return (
    <div>
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input type="text" className="input" placeholder="🔍 Buscar cliente por nombre, razón social..." value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} style={{ fontSize: '0.88rem', padding: '10px 12px' }} />

          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '4px 2px', scrollbarWidth: 'none' }}>
            <button
              type="button" onClick={() => setSelectedCityFilters([])}
              style={{
                padding: '4px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 600,
                border: '1px solid', borderColor: selectedCityFilters.length === 0 ? 'var(--text-primary)' : 'var(--border-color)',
                backgroundColor: selectedCityFilters.length === 0 ? 'var(--text-primary)' : '#fff',
                color: selectedCityFilters.length === 0 ? '#fff' : 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'pointer',
              }}
            >
              Todas
            </button>
            {uniqueCities.map((city) => {
              const isActive = selectedCityFilters.includes(city);
              return (
                <button
                  key={city} type="button"
                  onClick={() => setSelectedCityFilters(isActive ? selectedCityFilters.filter((c) => c !== city) : [...selectedCityFilters, city])}
                  style={{
                    padding: '4px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 600,
                    border: '1px solid', borderColor: isActive ? 'var(--accent-color)' : 'var(--border-color)',
                    backgroundColor: isActive ? 'rgba(var(--color-corp-red-rgb), 0.06)' : '#fff',
                    color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'pointer',
                  }}
                >
                  {city}
                </button>
              );
            })}
          </div>

          <div className="client-select-row">
            <div style={{ flex: 1 }}>
              <select
                className="select"
                value={selectedClient ? selectedClient.id : ''}
                onChange={(e) => setSelectedClient(clients.find((c) => c.id === Number(e.target.value)) || null)}
                style={{ paddingRight: '40px' }}
              >
                <option value="">{clientFilter.trim() ? `-- Seleccionar de los ${filteredClientsForSelect.length} filtrados --` : '-- Selecciona un cliente registrado --'}</option>
                {filteredClientsForSelect.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
            <button className="btn btn-secondary" style={{ padding: '8px 12px' }} title="Nuevo Cliente" onClick={onOpenNewClientModal}>
              <UserPlus size={16} />
            </button>
          </div>
        </div>

        {selectedClient && (
          <div style={{ marginTop: '10px', fontSize: '0.825rem', display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px', backgroundColor: 'var(--bg-light)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <div>
              <strong>Dirección:</strong> {selectedClient.address || 'Sin registrar'} | <strong>Teléfono:</strong> {selectedClient.phone || 'Sin registrar'}
              {selectedClient.phone && (
                <a href={getWhatsAppLink(selectedClient.phone)} target="_blank" rel="noopener noreferrer" title="Escribir por WhatsApp" style={{ marginLeft: '6px', textDecoration: 'none' }}>💬</a>
              )}
            </div>
            <div className="client-info-stats">
              <span>
                <strong>Saldo C/C:</strong>{' '}
                <span style={{ color: Number(selectedClient.outstandingBalance || 0) > 0 ? 'var(--color-danger)' : Number(selectedClient.outstandingBalance || 0) < 0 ? 'var(--color-success)' : 'var(--text-primary)', fontWeight: 600 }}>
                  {Number(selectedClient.outstandingBalance || 0) < 0 ? `$${Math.abs(Math.round(Number(selectedClient.outstandingBalance))).toLocaleString()} (A Favor)` : `$${Math.round(Number(selectedClient.outstandingBalance || 0)).toLocaleString()}`}
                </span>
              </span>
              <span><strong>Lista:</strong> <span style={{ fontWeight: 600 }}>{selectedClient.priceList === 'C' ? 'Lista Especial 2' : selectedClient.priceList === 'B' ? 'Lista Especial' : 'Lista 4 Oficial'}</span></span>
              {Number(selectedClient.discount || 0) > 0 && <span style={{ color: 'var(--color-success)' }}><strong>Desc. Fijo:</strong> {selectedClient.discount}%</span>}
            </div>
            {Number(selectedClient.outstandingBalance || 0) > 0 && (
              <div style={{ marginTop: '6px', padding: '8px', backgroundColor: '#FFF9E6', border: '1px solid #FFE0B2', borderRadius: '4px', color: '#B78103', fontSize: '0.775rem' }}>
                <strong>⚠️ Deuda Pendiente (${Math.round(Number(selectedClient.outstandingBalance)).toLocaleString()}):</strong> El pedido quedará sujeto a revisión administrativa.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="order-creation-grid">
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="catalog-filters-row">
            <div className="search-input-wrapper" style={{ flex: 1.2 }}>
              <input type="text" className="input" placeholder="🔍 Filtrar catálogo..." value={prodSearchQuery} onChange={(e) => setProdSearchQuery(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <select className="input" value={filterRubroId} onChange={(e) => setFilterRubroId(e.target.value)} style={{ height: '40px', fontSize: '0.85rem', padding: '8px 12px' }}>
                <option value="">-- Todos los Rubros --</option>
                {rubros.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
              </select>
            </div>
          </div>

          <div className="catalog-grid" style={{ flex: 1, maxHeight: '600px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px', padding: '10px 4px' }}>
            {filteredProducts.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>No se encontraron productos.</div>
            ) : (
              filteredProducts.map((p) => {
                const price = getVendedorItemPrice(p, selectedClient);
                const isMelincue = p.description?.toUpperCase() === 'MELINCUE' || p.name?.toUpperCase().includes('MELINCUE');
                const hasCustomPrice = selectedClient && ((selectedClient.priceList === 'B' && (isMelincue || Number(p.listPriceB || 0) > 0)) || (selectedClient.priceList === 'C' && Number(p.listPriceC || 0) > 0) || Number(selectedClient.discount || 0) > 0);
                const imgSrc = p.imageUrl ? (p.imageUrl.startsWith('http') ? p.imageUrl : p.imageUrl.startsWith('/') ? `${p.imageUrl}?v=2.0` : `/uploads/products/${p.imageUrl}?v=2.0`) : null;
                const cartItem = cart.find((item) => item.product.id === p.id);

                return (
                  <div
                    key={p.id} className="product-card"
                    style={{ backgroundColor: '#fff', borderRadius: '8px', border: cartItem ? '1.5px solid #10B981' : '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px', cursor: 'pointer', position: 'relative' }}
                    onClick={() => { if (p.stock > 0) onAddToCart(p); }}
                  >
                    <div style={{ position: 'relative', height: '135px', width: '100%', backgroundColor: '#f8fafc', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ position: 'absolute', top: '4px', left: '4px', backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', zIndex: 3 }}>#{p.sku || p.id}</span>
                      {imgSrc ? (
                        <img src={imgSrc} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8' }}>
                          <Package size={30} color="#cbd5e1" />
                          <span style={{ fontSize: '0.66rem', marginTop: '4px', fontWeight: 600 }}>Sin foto</span>
                        </div>
                      )}
                      {cartItem && (
                        <div style={{ position: 'absolute', bottom: '4px', left: '4px', backgroundColor: '#10B981', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', zIndex: 3, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ShoppingCart size={10} /><span>{cartItem.quantity} en carrito</span>
                        </div>
                      )}
                      {p.stock <= 0 && <span style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--color-danger)', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, zIndex: 3 }}>Agotado</span>}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', textAlign: 'center', flex: 1 }}>
                      <span style={{ fontWeight: 800, fontSize: '1.2rem', color: hasCustomPrice ? 'var(--color-success)' : 'var(--text-primary)' }}>
                        ${price.toLocaleString('es-AR')}
                        {p.isPesable && <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}> / Kg</span>}
                      </span>
                      <div style={{ fontWeight: 600, fontSize: '0.78rem', marginTop: '6px', lineHeight: '1.25', minHeight: '2.5em' }}>{p.name}</div>
                      <button
                        type="button"
                        style={{ marginTop: '10px', width: '100%', padding: '7px 4px', borderRadius: '20px', backgroundColor: p.stock <= 0 ? 'var(--border-color)' : cartItem ? '#10B981' : 'var(--text-primary)', color: p.stock <= 0 ? 'var(--text-secondary)' : '#fff', border: 'none', fontWeight: 700, fontSize: '0.73rem', cursor: p.stock <= 0 ? 'not-allowed' : 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); onAddToCart(p); }}
                        disabled={p.stock <= 0}
                      >
                        {p.stock <= 0 ? 'AGOTADO' : cartItem ? `AGREGAR OTRO (+${cartItem.quantity})` : '+ AGREGAR'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <ShoppingCart size={18} /><span>Detalle del Pedido</span>
          </h3>

          <div className="cart-list" style={{ flex: 1, backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
            {cart.length === 0 ? (
              <div style={{ display: 'flex', height: '150px', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-secondary)', gap: '8px' }}>
                <ShoppingCart size={24} /><p style={{ fontSize: '0.8rem' }}>El carrito está vacío.</p>
              </div>
            ) : (
              cart.map((item) => {
                const itemPrice = getVendedorItemPrice(item.product, selectedClient);
                return (
                  <div key={item.product.id} className="list-item" style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                        {item.product.name}
                        {item.product.isPesable && <span style={{ fontSize: '0.72rem', color: 'var(--color-danger)', marginLeft: '6px', fontWeight: 600 }}>({(item.quantity * (item.product.approximateWeight || 1)).toLocaleString()} Kg aprox.)</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {item.product.isPesable
                          ? `Subtotal: $${Math.round(itemPrice * item.quantity * (item.product.approximateWeight || 1)).toLocaleString()} ($${itemPrice.toLocaleString()} / Kg)`
                          : `Subtotal: $${(itemPrice * item.quantity).toLocaleString()} ($${itemPrice.toLocaleString()} c/u)`}
                      </div>
                      {item.quantity < (item.product.minOrderQuantity || 1) && (
                        <div style={{ marginTop: '3px', fontSize: '0.7rem', color: '#e30613', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700 }}>⚠️ Mín: {item.product.minOrderQuantity} u.</span>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer', fontWeight: 600 }}>
                            <input type="checkbox" checked={Boolean(item.isEmergencyOverride)} onChange={(e) => setCart(cart.map((c) => (c.product.id === item.product.id ? { ...c, isEmergencyOverride: e.target.checked } : c)))} />
                            Excepción Emergencia
                          </label>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button className="btn btn-secondary" style={{ padding: '2px 6px' }} onClick={() => onUpdateCartQty(item.product.id, -1)}>-</button>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.quantity}</span>
                      <button className="btn btn-secondary" style={{ padding: '2px 6px' }} onClick={() => onUpdateCartQty(item.product.id, 1)}>+</button>
                      <button className="btn btn-ghost text-danger" style={{ padding: '4px' }} onClick={() => onUpdateCartQty(item.product.id, -item.quantity)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>📝 Notas / Observaciones del Envío:</label>
              <textarea className="input" placeholder="Ej: Entregar después de las 17 hs..." style={{ width: '100%', fontSize: '0.8rem', padding: '8px', minHeight: '50px', resize: 'vertical' }} value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Importe Total:</span>
              <span style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--accent-color)' }}>${cartTotal.toLocaleString()}</span>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 600 }} onClick={onConfirmOrder} disabled={loading}>
              {loading ? 'Procesando...' : 'Confirmar Pedido (Check-in GPS Automático)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
