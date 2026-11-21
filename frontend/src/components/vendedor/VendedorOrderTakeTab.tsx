import React, { useDeferredValue, useEffect, useMemo, useRef } from 'react';
import { Search, StickyNote, X } from 'lucide-react';
import {
  buildSearchIndex,
  filterIndexedItems,
  getVendedorItemPrice,
  sortVendedorCatalog,
} from './vendedorHelpers';
import { VendedorOrderCartPanel } from './VendedorOrderCartPanel';
import { evaluateFrontendCartPromos, getProductPromoBadge } from '../../utils/weeklyPromoCartEvaluator';
import type { Persona, Product, Rubro } from '../../types';
import type { WeeklyPromo } from '../admin/config/weeklyPromo.helpers';

interface VendedorOrderTakeTabProps {
  isActive?: boolean;
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
  onSetCartQty?: (productId: number, qty: number) => void;
  onConfirmOrder: () => void;
  onOpenNewClientModal: () => void;
}

const searchBoxStyle: React.CSSProperties = { position: 'relative', display: 'flex', alignItems: 'center', width: '100%' };
const searchIconStyle: React.CSSProperties = { position: 'absolute', left: '12px', color: 'var(--text-muted)', pointerEvents: 'none' };
const searchInputStyle: React.CSSProperties = { width: '100%', fontSize: '16px', padding: '11px 38px 11px 38px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: '#fff', color: 'var(--text-primary)' };
const clearBtnStyle: React.CSSProperties = { position: 'absolute', right: '8px', background: 'transparent', border: 'none', boxShadow: 'none', padding: '6px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const qtyInputStyle: React.CSSProperties = { width: '42px', height: '30px', textAlign: 'center', fontWeight: 700, fontSize: '16px', padding: '2px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff', color: 'var(--text-primary)' };

export const VendedorOrderTakeTab: React.FC<VendedorOrderTakeTabProps> = ({
  isActive = true,
  clients, products, rubros, weeklyPromos = [], selectedClient, setSelectedClient, clientFilter, setClientFilter,
  prodSearchQuery, setProdSearchQuery, filterRubroId, cart, setCart, orderNotes, setOrderNotes, loading,
  onAddToCart, onUpdateCartQty, onSetCartQty, onConfirmOrder,
}) => {
  const currentUserId = useMemo(() => {
    try {
      const raw = localStorage.getItem('auth_user');
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.id ? Number(parsed.id) : null;
    } catch {
      return null;
    }
  }, []);

  const deferredClientFilter = useDeferredValue(clientFilter);
  const deferredProdQuery = useDeferredValue(prodSearchQuery);

  const indexedClients = useMemo(() => {
    const ordered = !currentUserId
      ? clients
      : [...clients].sort((a, b) => {
          const aMine = Number((a as any).sellerId) === currentUserId ? 1 : 0;
          const bMine = Number((b as any).sellerId) === currentUserId ? 1 : 0;
          return bMine - aMine;
        });
    return buildSearchIndex(ordered, (c) => [c.name, c.cuit, c.city, c.address]);
  }, [clients, currentUserId]);

  const indexedProducts = useMemo(() => {
    const sorted = sortVendedorCatalog(products, rubros, filterRubroId);
    return buildSearchIndex(sorted, (p) => [p.name, p.sku, p.barcode, p.description]);
  }, [products, rubros, filterRubroId]);

  const promoBadgeByProductId = useMemo(() => {
    const map = new Map<number, string | null>();
    if (weeklyPromos.length === 0) return map;
    for (const p of products) {
      const badge = getProductPromoBadge(p.id, weeklyPromos, Boolean(p.isPesable));
      if (badge) map.set(p.id, badge);
    }
    return map;
  }, [products, weeklyPromos]);

  const filteredClients = useMemo(
    () => (deferredClientFilter.trim() ? filterIndexedItems(indexedClients, deferredClientFilter) : []),
    [indexedClients, deferredClientFilter],
  );

  const filteredProducts = useMemo(
    () => (deferredProdQuery.trim() ? filterIndexedItems(indexedProducts, deferredProdQuery) : []),
    [indexedProducts, deferredProdQuery],
  );

  const visibleProducts = useMemo(() => filteredProducts.slice(0, 50), [filteredProducts]);

  const cartById = useMemo(() => {
    const map = new Map<number, (typeof cart)[number]>();
    for (const item of cart) map.set(item.product.id, item);
    return map;
  }, [cart]);

  const promoEval = useMemo(
    () =>
      evaluateFrontendCartPromos({
        items: cart.map((curr) => ({
          productId: curr.product.id,
          productName: curr.product.name,
          quantity: curr.quantity,
          isPesable: Boolean(curr.product.isPesable),
          approximateWeight: curr.product.approximateWeight,
          baseUnitPrice: getVendedorItemPrice(curr.product, selectedClient),
        })),
        promos: weeklyPromos,
      }),
    [cart, selectedClient, weeklyPromos],
  );

  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSectionRef = useRef<HTMLDivElement | null>(null);
  const prodSearchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isActive && selectedClient) {
      prodSearchInputRef.current?.focus();
    }
  }, [isActive, selectedClient?.id]);

  const resetAndFocusProdSearch = () => {
    setProdSearchQuery('');
    prodSearchInputRef.current?.focus();
  };

  const handleSelectProduct = (product: Product) => {
    onAddToCart(product);
    resetAndFocusProdSearch();
  };

  const handleDirectQtyChange = (productId: number, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, '');
    if (!digits) return;
    const parsed = parseInt(digits, 10);
    if (parsed > 0 && onSetCartQty) onSetCartQty(productId, parsed);
  };

  return (
    <div className={`vendedor-order-shell${cart.length > 0 ? ' vendedor-order-shell--has-cart' : ''}`}>
      {/* 1. Lupa de Cliente */}
      <div className="card" style={{ padding: '12px' }}>
        {!selectedClient ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <search style={searchBoxStyle}>
              <Search size={18} style={searchIconStyle} aria-hidden="true" />
              <label htmlFor="vendedor-order-client-search" className="sr-only">Buscar cliente</label>
              <input
                id="vendedor-order-client-search"
                type="search"
                className="input"
                placeholder="Buscar cliente..."
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                style={searchInputStyle}
              />
              {clientFilter && (
                <button type="button" aria-label="Limpiar búsqueda de cliente" onClick={() => setClientFilter('')} style={clearBtnStyle}>
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </search>

            {deferredClientFilter.trim().length > 0 && (
              <div className="vendedor-order-results vendedor-order-results--clients">
                {filteredClients.length === 0 ? (
                  <div style={{ padding: '14px', textAlign: 'center', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>Sin clientes</div>
                ) : (
                  filteredClients.slice(0, 30).map((c, idx) => {
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
                          gap: '10px',
                          padding: '11px 12px',
                          border: 'none',
                          borderBottom: idx < Math.min(filteredClients.length, 30) - 1 ? '1px solid var(--border-color)' : 'none',
                          borderRadius: 0,
                          boxShadow: 'none',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          {(c.address || c.city) && (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {[c.address, c.city].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                        {debt > 0 && (
                          <span className="tabular-nums" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-corp-red)', flexShrink: 0 }}>
                            ${Math.round(debt).toLocaleString('es-AR')}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedClient.name}</div>
              <div className="tabular-nums" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {selectedClient.address || selectedClient.city || ''}
                {Number(selectedClient.outstandingBalance || 0) !== 0 && (
                  <span style={{ marginLeft: selectedClient.address || selectedClient.city ? '8px' : 0, fontWeight: 600, color: Number(selectedClient.outstandingBalance) > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    Saldo ${Math.round(Number(selectedClient.outstandingBalance)).toLocaleString('es-AR')}
                  </span>
                )}
              </div>
            </div>
            <button type="button" className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '0.8rem', flexShrink: 0 }} onClick={() => setSelectedClient(null)}>
              Cambiar
            </button>
          </div>
        )}
      </div>

      {/* 2. Lupa de Producto (Sin fotos, lista limpia) */}
      <div className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <search style={searchBoxStyle}>
          <Search size={18} style={searchIconStyle} aria-hidden="true" />
          <label htmlFor="vendedor-order-prod-search" className="sr-only">Buscar producto</label>
          <input
            ref={prodSearchInputRef}
            id="vendedor-order-prod-search"
            type="search"
            className="input"
            placeholder="Buscar producto..."
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={prodSearchQuery}
            onChange={(e) => setProdSearchQuery(e.target.value)}
            style={searchInputStyle}
          />
          {prodSearchQuery && (
            <button type="button" aria-label="Limpiar búsqueda de producto" onClick={resetAndFocusProdSearch} style={clearBtnStyle}>
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </search>

        {deferredProdQuery.trim().length > 0 && (
          <div className="vendedor-order-results vendedor-order-results--products">
            {filteredProducts.length === 0 ? (
              <div style={{ padding: '18px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sin productos</div>
            ) : (
              <>
                {visibleProducts.map((p, idx) => {
                  const price = getVendedorItemPrice(p, selectedClient);
                  const cartItem = cartById.get(p.id);
                  const promoBadge = promoBadgeByProductId.get(p.id) || null;
                  const outOfStock = p.stock <= 0;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '10px 12px',
                        borderBottom: idx < visibleProducts.length - 1 ? '1px solid var(--border-color)' : 'none',
                        backgroundColor: cartItem ? '#F0FDF4' : '#fff',
                        opacity: outOfStock ? 0.55 : 1,
                      }}
                    >
                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => handleSelectProduct(p)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          textAlign: 'left',
                          background: 'transparent',
                          border: 'none',
                          boxShadow: 'none',
                          padding: 0,
                          justifyContent: 'flex-start',
                          cursor: outOfStock ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <div style={{ minWidth: 0, width: '100%' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                            {p.name}
                          </div>
                          <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                            <span>#{p.sku || p.id}</span>
                            {p.isPesable && <span>· Kg</span>}
                            {promoBadge && !outOfStock && <span style={{ color: '#065F46', fontWeight: 700 }}>· {promoBadge}</span>}
                            {outOfStock && <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>· Agotado</span>}
                          </div>
                        </div>
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span className="tabular-nums" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          ${price.toLocaleString('es-AR')}
                        </span>
                        {cartItem ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button type="button" className="btn btn-secondary" style={{ padding: '4px 9px', minWidth: '32px' }} aria-label={`Restar ${p.name}`} onClick={() => onUpdateCartQty(p.id, -1)}>-</button>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              aria-label={`Cantidad de ${p.name}`}
                              className="tabular-nums"
                              style={qtyInputStyle}
                              value={cartItem.quantity}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => handleDirectQtyChange(p.id, e.target.value)}
                            />
                            <button type="button" className="btn btn-secondary" style={{ padding: '4px 9px', minWidth: '32px' }} aria-label={`Sumar ${p.name}`} onClick={() => onUpdateCartQty(p.id, 1)}>+</button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={outOfStock}
                            onClick={() => handleSelectProduct(p)}
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 700, borderRadius: '8px' }}
                            aria-label={`Agregar ${p.name}`}
                          >
                            +
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredProducts.length > 50 && (
                  <div className="tabular-nums" style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)' }}>
                    Mostrando 50 de {filteredProducts.length} · Escribí para filtrar
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 3. Nota / Comentarios del pedido */}
      <div className="card" style={{ padding: '12px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', width: '100%' }}>
          <StickyNote size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)', pointerEvents: 'none' }} aria-hidden="true" />
          <label htmlFor="vendedor-order-notes" className="sr-only">Nota</label>
          <textarea
            id="vendedor-order-notes"
            rows={1}
            className="input vendedor-note-input"
            placeholder="Nota"
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
          />
          {orderNotes && (
            <button
              type="button"
              aria-label="Limpiar nota"
              onClick={() => setOrderNotes('')}
              style={{ ...clearBtnStyle, top: '9px' }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Pedido */}
      <VendedorOrderCartPanel
        cart={cart}
        setCart={setCart}
        selectedClient={selectedClient}
        promoEval={promoEval}
        totalUnits={totalUnits}
        loading={loading}
        cartSectionRef={cartSectionRef}
        qtyInputStyle={qtyInputStyle}
        onUpdateCartQty={onUpdateCartQty}
        onDirectQtyChange={handleDirectQtyChange}
        onConfirmOrder={onConfirmOrder}
      />
    </div>
  );
};
