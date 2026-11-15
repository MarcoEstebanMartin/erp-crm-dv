import React, { useMemo } from 'react';
import { Trash2, ShoppingCart, UserPlus, Package } from 'lucide-react';
import { cleanCityName, getWhatsAppLink, getVendedorItemPrice, sortVendedorCatalog } from './vendedorHelpers';
import { evaluateFrontendCartPromos, getProductPromoBadge } from '../../utils/weeklyPromoCartEvaluator';
import type { Persona, Product, Rubro } from '../../types';
import type { WeeklyPromo } from '../admin/config/weeklyPromo.helpers';

interface VendedorOrderTakeTabProps {
  clients: Persona[];
  products: Product[];
  rubros: Rubro[];
  weeklyPromos?: WeeklyPromo[];
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
  clients, products, rubros, weeklyPromos = [], selectedClient, setSelectedClient, clientFilter, setClientFilter,
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

  const promoEval = useMemo(() => evaluateFrontendCartPromos({
    items: cart.map((curr) => ({
      productId: curr.product.id, productName: curr.product.name, quantity: curr.quantity,
      isPesable: Boolean(curr.product.isPesable), approximateWeight: curr.product.approximateWeight,
      baseUnitPrice: getVendedorItemPrice(curr.product, selectedClient),
    })),
    promos: weeklyPromos,
  }), [cart, selectedClient, weeklyPromos]);
  const cartTotal = promoEval.totalAmount;

  return (
    <div>
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <search>
            <label htmlFor="vendedor-order-client-search" className="sr-only">Buscar cliente</label>
            <input id="vendedor-order-client-search" type="text" className="input" placeholder="Buscar cliente" autoCorrect="off" autoCapitalize="none" spellCheck={false} value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} style={{ fontSize: '0.88rem', padding: '10px 12px', width: '100%' }} />
          </search>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '4px 2px', scrollbarWidth: 'none' }}>
            <button type="button" onClick={() => setSelectedCityFilters([])} style={{ padding: '4px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid', borderColor: selectedCityFilters.length === 0 ? 'var(--text-primary)' : 'var(--border-color)', backgroundColor: selectedCityFilters.length === 0 ? 'var(--text-primary)' : '#fff', color: selectedCityFilters.length === 0 ? '#fff' : 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'pointer' }}>Todas</button>
            {uniqueCities.map((city) => {
              const isActive = selectedCityFilters.includes(city);
              return (
                <button key={city} type="button" onClick={() => setSelectedCityFilters(isActive ? selectedCityFilters.filter((c) => c !== city) : [...selectedCityFilters, city])} style={{ padding: '4px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid', borderColor: isActive ? 'var(--accent-color)' : 'var(--border-color)', backgroundColor: isActive ? 'rgba(var(--color-corp-red-rgb), 0.06)' : '#fff', color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  {city}
                </button>
              );
            })}
          </div>
          <div className="client-select-row">
            <div style={{ flex: 1 }}>
              <label htmlFor="vendedor-order-client-select" className="sr-only">Cliente</label>
              <select id="vendedor-order-client-select" className="select" value={selectedClient ? selectedClient.id : ''} onChange={(e) => setSelectedClient(clients.find((c) => c.id === Number(e.target.value)) || null)} style={{ paddingRight: '40px' }}>
                <option value="">{clientFilter.trim() ? `Seleccionar cliente (${filteredClientsForSelect.length})` : 'Seleccionar cliente'}</option>
                {filteredClientsForSelect.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
            <button type="button" className="btn btn-secondary" style={{ padding: '8px 12px' }} title="Nuevo cliente" aria-label="Nuevo cliente" onClick={onOpenNewClientModal}>
              <UserPlus size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {selectedClient && (
          <div style={{ marginTop: '10px', fontSize: '0.825rem', display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px', backgroundColor: 'var(--bg-light)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <div>
              <strong>Dirección:</strong> {selectedClient.address || '-'} | <strong>Teléfono:</strong> <span className="tabular-nums">{selectedClient.phone || '-'}</span>
              {selectedClient.phone && (<a href={getWhatsAppLink(selectedClient.phone)} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '6px', color: '#166534', fontSize: '0.78rem', fontWeight: 600 }}>WhatsApp</a>)}
            </div>
            <div className="client-info-stats">
              <span>
                <strong>Saldo:</strong>{' '}
                <span className="tabular-nums" style={{ color: Number(selectedClient.outstandingBalance || 0) > 0 ? 'var(--color-danger)' : Number(selectedClient.outstandingBalance || 0) < 0 ? 'var(--color-success)' : 'var(--text-primary)', fontWeight: 600 }}>
                  {Number(selectedClient.outstandingBalance || 0) < 0 ? `$${Math.abs(Math.round(Number(selectedClient.outstandingBalance))).toLocaleString('es-AR')} (A favor)` : `$${Math.round(Number(selectedClient.outstandingBalance || 0)).toLocaleString('es-AR')}`}
                </span>
              </span>
              <span><strong>Lista:</strong> <span style={{ fontWeight: 600 }}>{selectedClient.priceList === 'C' ? 'Lista Especial 2' : selectedClient.priceList === 'B' ? 'Lista Especial' : 'Lista 4 Oficial'}</span></span>
              {Number(selectedClient.discount || 0) > 0 && <span className="tabular-nums" style={{ color: 'var(--color-success)' }}><strong>Desc.:</strong> {selectedClient.discount}%</span>}
            </div>
            {Number(selectedClient.outstandingBalance || 0) > 0 && (
              <div className="tabular-nums" style={{ marginTop: '4px', padding: '6px 8px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#B91C1C', fontSize: '0.775rem', fontWeight: 600 }}>
                Deuda: ${Math.round(Number(selectedClient.outstandingBalance)).toLocaleString('es-AR')}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="order-creation-grid">
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="catalog-filters-row">
            <search className="search-input-wrapper" style={{ flex: 1.2 }}>
              <label htmlFor="vendedor-order-prod-search" className="sr-only">Buscar producto</label>
              <input id="vendedor-order-prod-search" type="text" className="input" placeholder="Buscar producto" autoCorrect="off" autoCapitalize="none" spellCheck={false} value={prodSearchQuery} onChange={(e) => setProdSearchQuery(e.target.value)} />
            </search>
            <div style={{ flex: 1 }}>
              <label htmlFor="vendedor-order-rubro" className="sr-only">Rubro</label>
              <select id="vendedor-order-rubro" className="input" value={filterRubroId} onChange={(e) => setFilterRubroId(e.target.value)} style={{ height: '40px', fontSize: '0.85rem', padding: '8px 12px' }}>
                <option value="">Todos los rubros</option>
                {rubros.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
              </select>
            </div>
          </div>

          <div className="catalog-grid" style={{ flex: 1, maxHeight: '600px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px', padding: '10px 4px' }}>
            {filteredProducts.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>Sin productos</div>
            ) : (
              filteredProducts.map((p) => {
                const price = getVendedorItemPrice(p, selectedClient);
                const isMelincue = p.description?.toUpperCase() === 'MELINCUE' || p.name?.toUpperCase().includes('MELINCUE');
                const hasCustomPrice = selectedClient && ((selectedClient.priceList === 'B' && (isMelincue || Number(p.listPriceB || 0) > 0)) || (selectedClient.priceList === 'C' && Number(p.listPriceC || 0) > 0) || Number(selectedClient.discount || 0) > 0);
                const imgSrc = p.imageUrl ? (p.imageUrl.startsWith('http') ? p.imageUrl : p.imageUrl.startsWith('/') ? `${p.imageUrl}?v=2.0` : `/uploads/products/${p.imageUrl}?v=2.0`) : null;
                const cartItem = cart.find((item) => item.product.id === p.id);
                const promoBadge = getProductPromoBadge(p.id, weeklyPromos, Boolean(p.isPesable));
                return (
                  <div key={p.id} className="product-card" style={{ backgroundColor: '#fff', borderRadius: '8px', border: cartItem ? '1.5px solid #10B981' : '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px', cursor: p.stock > 0 ? 'pointer' : 'default', position: 'relative' }} onClick={() => { if (p.stock > 0) onAddToCart(p); }}>
                    <div style={{ position: 'relative', height: '135px', width: '100%', backgroundColor: '#f8fafc', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="tabular-nums" style={{ position: 'absolute', top: '4px', left: '4px', backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', zIndex: 3 }}>#{p.sku || p.id}</span>
                      {promoBadge && p.stock > 0 && (<span style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', zIndex: 3, maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{promoBadge}</span>)}
                      {imgSrc ? (
                        <img src={imgSrc} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8' }}>
                          <Package size={30} color="#cbd5e1" aria-hidden="true" /><span style={{ fontSize: '0.66rem', marginTop: '4px', fontWeight: 600 }}>Sin foto</span>
                        </div>
                      )}
                      {cartItem && (<div className="tabular-nums" style={{ position: 'absolute', bottom: '4px', left: '4px', backgroundColor: '#10B981', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', zIndex: 3, display: 'flex', alignItems: 'center', gap: '4px' }}><ShoppingCart size={10} aria-hidden="true" /><span>{cartItem.quantity}</span></div>)}
                      {p.stock <= 0 && <span style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--color-danger)', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, zIndex: 3 }}>Agotado</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', textAlign: 'center', flex: 1 }}>
                      <span className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.2rem', color: hasCustomPrice ? 'var(--color-success)' : 'var(--text-primary)' }}>
                        ${price.toLocaleString('es-AR')}{p.isPesable && <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}> / Kg</span>}
                      </span>
                      <div style={{ fontWeight: 600, fontSize: '0.78rem', marginTop: '6px', lineHeight: '1.25', minHeight: '2.5em' }}>{p.name}</div>
                      <button type="button" className="tabular-nums" style={{ marginTop: '10px', width: '100%', padding: '7px 4px', borderRadius: '20px', backgroundColor: p.stock <= 0 ? 'var(--border-color)' : cartItem ? '#10B981' : 'var(--text-primary)', color: p.stock <= 0 ? 'var(--text-secondary)' : '#fff', border: 'none', fontWeight: 700, fontSize: '0.73rem', cursor: p.stock <= 0 ? 'not-allowed' : 'pointer' }} onClick={(e) => { e.stopPropagation(); onAddToCart(p); }} disabled={p.stock <= 0}>
                        {p.stock <= 0 ? 'Agotado' : cartItem ? `Agregar (+${cartItem.quantity})` : 'Agregar'}
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
            <ShoppingCart size={18} aria-hidden="true" /><span>Pedido</span>
          </h3>
          <div className="cart-list" style={{ flex: 1, backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
            {cart.length === 0 ? (
              <div style={{ display: 'flex', height: '150px', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-secondary)', gap: '8px' }}>
                <ShoppingCart size={24} aria-hidden="true" /><p style={{ fontSize: '0.8rem', margin: 0 }}>Carrito vacío</p>
              </div>
            ) : (
              <>
                {cart.map((item) => {
                  const basePrice = getVendedorItemPrice(item.product, selectedClient);
                  const evaluatedLine = promoEval.byProductId[item.product.id];
                  const itemPrice = evaluatedLine ? evaluatedLine.effectiveUnitPrice : basePrice;
                  const lineSubtotal = evaluatedLine ? evaluatedLine.lineSubtotal : Math.round(itemPrice * (item.product.isPesable ? item.quantity * (item.product.approximateWeight || 1) : item.quantity));
                  return (
                    <div key={item.product.id} className="list-item" style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span>{item.product.name}</span>
                          {item.product.isPesable && <span className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--color-danger)', fontWeight: 600 }}>({(item.quantity * (item.product.approximateWeight || 1)).toLocaleString('es-AR')} Kg)</span>}
                          {evaluatedLine?.promoApplied && (<span style={{ fontSize: '0.65rem', fontWeight: 700, backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: '4px', padding: '1px 5px' }}>{evaluatedLine.appliedPromoName || 'Oferta'}</span>)}
                        </div>
                        <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {evaluatedLine?.promoApplied && basePrice > itemPrice && (<span style={{ textDecoration: 'line-through', marginRight: '6px', opacity: 0.7 }}>${basePrice.toLocaleString('es-AR')}</span>)}
                          ${lineSubtotal.toLocaleString('es-AR')} (${itemPrice.toLocaleString('es-AR')}{item.product.isPesable ? '/Kg' : ' c/u'})
                        </div>
                        {item.quantity < (item.product.minOrderQuantity || 1) && (
                          <div style={{ marginTop: '3px', fontSize: '0.7rem', color: '#e30613', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="tabular-nums" style={{ fontWeight: 700 }}>Mín: {item.product.minOrderQuantity}</span>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer', fontWeight: 600 }}>
                              <input type="checkbox" checked={Boolean(item.isEmergencyOverride)} onChange={(e) => setCart(cart.map((c) => (c.product.id === item.product.id ? { ...c, isEmergencyOverride: e.target.checked } : c)))} />
                              Excepción Emergencia
                            </label>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button type="button" className="btn btn-secondary" style={{ padding: '2px 6px' }} aria-label={`Restar ${item.product.name}`} onClick={() => onUpdateCartQty(item.product.id, -1)}>-</button>
                        <span className="tabular-nums" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.quantity}</span>
                        <button type="button" className="btn btn-secondary" style={{ padding: '2px 6px' }} aria-label={`Sumar ${item.product.name}`} onClick={() => onUpdateCartQty(item.product.id, 1)}>+</button>
                        <button type="button" className="btn btn-ghost text-danger" style={{ padding: '4px' }} aria-label={`Quitar ${item.product.name}`} onClick={() => onUpdateCartQty(item.product.id, -item.quantity)}><Trash2 size={14} aria-hidden="true" /></button>
                      </div>
                    </div>
                  );
                })}
                {promoEval.bonusLines.map((bonus) => {
                  const cartProd = cart.find((c) => c.product.id === bonus.productId)?.product;
                  const reqStock = promoEval.stockRequiredByProduct[bonus.productId] || 0;
                  const lowBonusStock = cartProd && Number(cartProd.stock || 0) < reqStock;
                  return (
                    <div key={`bonus-${bonus.productId}`} className="list-item" style={{ padding: '7px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', backgroundColor: '#F0FDF4' }}>
                      <div style={{ flex: 1 }}>
                        <div className="tabular-nums" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#065F46' }}>+ {bonus.quantity} u. sin cargo · {bonus.productName}</div>
                        <div className="tabular-nums" style={{ fontSize: '0.72rem', color: lowBonusStock ? '#E30613' : '#047857', fontWeight: lowBonusStock ? 700 : 500 }}>
                          {lowBonusStock ? `Stock insuficiente (Disp: ${cartProd.stock}, Req: ${reqStock})` : bonus.promoName}
                        </div>
                      </div>
                      <span className="tabular-nums" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#065F46' }}>$0</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="vendedor-order-notes" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Notas</label>
              <textarea id="vendedor-order-notes" className="input" placeholder="Notas de entrega" style={{ width: '100%', fontSize: '0.8rem', padding: '8px', minHeight: '50px', resize: 'vertical' }} value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Total</span>
              <span className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--accent-color)' }}>${cartTotal.toLocaleString('es-AR')}</span>
            </div>
            <button type="button" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 600 }} onClick={onConfirmOrder} disabled={loading}>
              {loading ? 'Procesando...' : 'Confirmar pedido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
