import React, { useMemo, useRef, useState } from 'react';
import { Trash2, ShoppingCart, UserPlus, Package, Sparkles } from 'lucide-react';
import { cleanCityName, getWhatsAppLink, getVendedorItemPrice, matchesSearchTokens, sortVendedorCatalog } from './vendedorHelpers';
import { evaluateFrontendCartPromos, getProductPromoBadge } from '../../utils/weeklyPromoCartEvaluator';
import { VendedorAiOrderModal } from './VendedorAiOrderModal';
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
  const [showAllClients, setShowAllClients] = useState(false);

  const currentUserId = useMemo(() => {
    try {
      const raw = localStorage.getItem('auth_user');
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.id ? Number(parsed.id) : null;
    } catch {
      return null;
    }
  }, []);

  const hasOwnClients = useMemo(
    () => Boolean(currentUserId && clients.some((c) => Number((c as any).sellerId) === currentUserId)),
    [clients, currentUserId],
  );

  const filteredClientsForSelect = useMemo(() => {
    const isSearching = clientFilter.trim().length > 0;
    const list = clients.filter((c) => {
      if (hasOwnClients && !isSearching && !showAllClients && Number((c as any).sellerId) !== currentUserId) {
        return false;
      }
      const matchesSearch = matchesSearchTokens([c.name, c.cuit, c.city, c.address], clientFilter);
      const matchesCity = selectedCityFilters.length === 0 || selectedCityFilters.includes(cleanCityName(c.city));
      return matchesSearch && matchesCity;
    });
    if (!hasOwnClients) return list;
    return [...list].sort((a, b) => {
      const aMine = Number((a as any).sellerId) === currentUserId ? 1 : 0;
      const bMine = Number((b as any).sellerId) === currentUserId ? 1 : 0;
      return bMine - aMine;
    });
  }, [clients, clientFilter, selectedCityFilters, hasOwnClients, showAllClients, currentUserId]);

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
  const cartSectionRef = useRef<HTMLDivElement | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div style={{ paddingBottom: cart.length > 0 ? '84px' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setAiModalOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.84rem', fontWeight: 700 }}
        >
          <Sparkles size={15} color="var(--color-corp-red)" aria-hidden="true" />
          Pedido IA
        </button>
      </div>
      <div className="card" style={{ marginBottom: '14px', padding: '14px' }}>
        {!selectedClient ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <search style={{ flex: 1 }}>
                <label htmlFor="vendedor-order-client-search" className="sr-only">Buscar cliente</label>
                <input
                  id="vendedor-order-client-search"
                  type="search"
                  className="input"
                  placeholder="Buscar cliente por nombre o CUIT"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  style={{ fontSize: '0.9rem', padding: '10px 12px', width: '100%' }}
                />
              </search>
              <button type="button" className="btn btn-secondary" style={{ padding: '10px 12px', flexShrink: 0 }} title="Nuevo cliente" aria-label="Nuevo cliente" onClick={onOpenNewClientModal}>
                <UserPlus size={16} aria-hidden="true" />
              </button>
            </div>

            {(uniqueCities.length > 1 || hasOwnClients) && (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '2px', scrollbarWidth: 'none' }}>
                {hasOwnClients && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowAllClients(false)}
                      style={{ padding: '4px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 700, border: '1px solid', borderColor: !showAllClients ? 'var(--color-corp-red)' : 'var(--border-color)', backgroundColor: !showAllClients ? 'rgba(var(--color-corp-red-rgb), 0.08)' : '#fff', color: !showAllClients ? 'var(--color-corp-red)' : 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'pointer' }}
                    >
                      Mis clientes
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAllClients(true)}
                      style={{ padding: '4px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid', borderColor: showAllClients ? 'var(--text-primary)' : 'var(--border-color)', backgroundColor: showAllClients ? 'var(--text-primary)' : '#fff', color: showAllClients ? '#fff' : 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'pointer' }}
                    >
                      Todos
                    </button>
                  </>
                )}
                {uniqueCities.length > 1 && (
                  <>
                    <button type="button" onClick={() => setSelectedCityFilters([])} style={{ padding: '4px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid', borderColor: selectedCityFilters.length === 0 ? 'var(--text-primary)' : 'var(--border-color)', backgroundColor: selectedCityFilters.length === 0 ? 'var(--text-primary)' : '#fff', color: selectedCityFilters.length === 0 ? '#fff' : 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'pointer' }}>Todas</button>
                    {uniqueCities.map((city) => {
                      const isActive = selectedCityFilters.includes(city);
                      return (
                        <button key={city} type="button" onClick={() => setSelectedCityFilters(isActive ? selectedCityFilters.filter((c) => c !== city) : [...selectedCityFilters, city])} style={{ padding: '4px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid', borderColor: isActive ? 'var(--accent-color)' : 'var(--border-color)', backgroundColor: isActive ? 'rgba(var(--color-corp-red-rgb), 0.06)' : '#fff', color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                          {city}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
              {filteredClientsForSelect.length === 0 ? (
                <div style={{ padding: '14px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Sin clientes</div>
              ) : (
                filteredClientsForSelect.slice(0, 25).map((c) => {
                  const debt = Number(c.outstandingBalance || 0);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedClient(c); setClientFilter(''); }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.address || '-'}{c.city ? ` · ${c.city}` : ''}
                        </div>
                      </div>
                      {debt > 0 && (
                        <span className="tabular-nums" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-corp-red)', backgroundColor: 'rgba(var(--color-corp-red-rgb), 0.06)', padding: '3px 8px', borderRadius: '10px', flexShrink: 0 }}>
                          Debe ${Math.round(debt).toLocaleString('es-AR')}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-primary)' }}>{selectedClient.name}</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  {selectedClient.address || '-'}
                  {selectedClient.phone && (
                    <>
                      {' · '}
                      <span className="tabular-nums">{selectedClient.phone}</span>
                      <a href={getWhatsAppLink(selectedClient.phone)} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '6px', color: '#166534', fontWeight: 600 }}>WhatsApp</a>
                    </>
                  )}
                </div>
              </div>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem', flexShrink: 0 }} onClick={() => setSelectedClient(null)}>
                Cambiar
              </button>
            </div>
            <div className="client-info-stats" style={{ fontSize: '0.78rem' }}>
              <span>
                <strong>Saldo:</strong>{' '}
                <span className="tabular-nums" style={{ color: Number(selectedClient.outstandingBalance || 0) > 0 ? 'var(--color-danger)' : Number(selectedClient.outstandingBalance || 0) < 0 ? 'var(--color-success)' : 'var(--text-primary)', fontWeight: 600 }}>
                  {Number(selectedClient.outstandingBalance || 0) < 0 ? `$${Math.abs(Math.round(Number(selectedClient.outstandingBalance))).toLocaleString('es-AR')} (A favor)` : `$${Math.round(Number(selectedClient.outstandingBalance || 0)).toLocaleString('es-AR')}`}
                </span>
              </span>
              <span><strong>Lista:</strong> <span style={{ fontWeight: 600 }}>{selectedClient.priceList === 'C' ? 'Lista Especial 2' : selectedClient.priceList === 'B' ? 'Lista Especial' : 'Lista 4 Oficial'}</span></span>
              {Number(selectedClient.discount || 0) > 0 && <span className="tabular-nums" style={{ color: 'var(--color-success)' }}><strong>Desc.:</strong> {selectedClient.discount}%</span>}
            </div>
          </div>
        )}
      </div>

      <div className="order-creation-grid">
        <div ref={cartSectionRef} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
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

        <div ref={cartSectionRef} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
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

      {cart.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(68px + env(safe-area-inset-bottom, 0px))',
            left: '12px',
            right: '12px',
            zIndex: 1030,
            maxWidth: '520px',
            margin: '0 auto',
            backgroundColor: '#111827',
            color: '#ffffff',
            borderRadius: '12px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.22)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="tabular-nums" style={{ fontSize: '0.74rem', color: '#9ca3af', fontWeight: 600 }}>
              {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}
            </div>
            <div className="tabular-nums" style={{ fontSize: '1.08rem', fontWeight: 700 }}>
              ${cartTotal.toLocaleString('es-AR')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => cartSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.25)',
                backgroundColor: 'transparent',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Ver
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (!selectedClient) {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  return;
                }
                onConfirmOrder();
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--color-corp-red)',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Enviando...' : selectedClient ? 'Confirmar' : 'Elegir cliente'}
            </button>
          </div>
        </div>
      )}

      <VendedorAiOrderModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        clients={clients}
        products={products}
        selectedClient={selectedClient}
        onApplyDraft={({ client, items, orderNotes: aiNotes }) => {
          if (client && !selectedClient) {
            setSelectedClient(client);
          }
          if (items.length > 0) {
            setCart((prev) => {
              const next = [...prev];
              for (const entry of items) {
                const idx = next.findIndex((c) => Number(c.product.id) === Number(entry.product.id));
                if (idx >= 0) {
                  next[idx] = { ...next[idx], quantity: next[idx].quantity + entry.quantity };
                } else {
                  next.push({ product: entry.product, quantity: entry.quantity });
                }
              }
              return next;
            });
          }
          if (aiNotes) {
            setOrderNotes(orderNotes ? `${orderNotes} · ${aiNotes}` : aiNotes);
          }
        }}
      />
    </div>
  );
};
