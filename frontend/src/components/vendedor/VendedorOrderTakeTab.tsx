import React, { useMemo, useRef } from 'react';
import { Search, ShoppingCart, Trash2, X } from 'lucide-react';
import { getVendedorItemPrice, matchesSearchTokens, sortVendedorCatalog } from './vendedorHelpers';
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

const searchBoxStyle: React.CSSProperties = { position: 'relative', display: 'flex', alignItems: 'center', width: '100%' };
const searchIconStyle: React.CSSProperties = { position: 'absolute', left: '12px', color: 'var(--text-muted)', pointerEvents: 'none' };
const searchInputStyle: React.CSSProperties = { width: '100%', fontSize: '16px', padding: '11px 38px 11px 38px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: '#fff', color: 'var(--text-primary)' };
const clearBtnStyle: React.CSSProperties = { position: 'absolute', right: '8px', background: 'transparent', border: 'none', boxShadow: 'none', padding: '6px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

export const VendedorOrderTakeTab: React.FC<VendedorOrderTakeTabProps> = ({
  clients, products, rubros, weeklyPromos = [], selectedClient, setSelectedClient, clientFilter, setClientFilter,
  prodSearchQuery, setProdSearchQuery, filterRubroId, cart, setCart, orderNotes, setOrderNotes, loading,
  onAddToCart, onUpdateCartQty, onConfirmOrder,
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

  const filteredClients = useMemo(() => {
    const list = clients.filter((c) =>
      matchesSearchTokens([c.name, c.cuit, c.city, c.address], clientFilter),
    );
    if (!currentUserId) return list;
    return [...list].sort((a, b) => {
      const aMine = Number((a as any).sellerId) === currentUserId ? 1 : 0;
      const bMine = Number((b as any).sellerId) === currentUserId ? 1 : 0;
      return bMine - aMine;
    });
  }, [clients, clientFilter, currentUserId]);

  const filteredProducts = useMemo(
    () =>
      sortVendedorCatalog(
        products.filter((p) =>
          matchesSearchTokens([p.name, p.sku, p.barcode, p.description], prodSearchQuery),
        ),
        rubros,
        filterRubroId,
      ),
    [products, prodSearchQuery, rubros, filterRubroId],
  );

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

  const cartTotal = promoEval.totalAmount;
  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSectionRef = useRef<HTMLDivElement | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: cart.length > 0 ? '88px' : '16px' }}>
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

            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '210px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#fff' }}>
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
            <button type="button" aria-label="Limpiar búsqueda de producto" onClick={() => setProdSearchQuery('')} style={clearBtnStyle}>
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </search>

        <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#fff' }}>
          {filteredProducts.length === 0 ? (
            <div style={{ padding: '18px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sin productos</div>
          ) : (
            filteredProducts.map((p, idx) => {
              const price = getVendedorItemPrice(p, selectedClient);
              const cartItem = cart.find((item) => item.product.id === p.id);
              const promoBadge = getProductPromoBadge(p.id, weeklyPromos, Boolean(p.isPesable));
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
                    borderBottom: idx < filteredProducts.length - 1 ? '1px solid var(--border-color)' : 'none',
                    backgroundColor: cartItem ? '#F0FDF4' : '#fff',
                    opacity: outOfStock ? 0.55 : 1,
                  }}
                >
                  <button
                    type="button"
                    disabled={outOfStock}
                    onClick={() => onAddToCart(p)}
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
                        <span className="tabular-nums" style={{ minWidth: '22px', textAlign: 'center', fontWeight: 700, fontSize: '0.88rem' }}>{cartItem.quantity}</span>
                        <button type="button" className="btn btn-secondary" style={{ padding: '4px 9px', minWidth: '32px' }} aria-label={`Sumar ${p.name}`} onClick={() => onUpdateCartQty(p.id, 1)}>+</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => onAddToCart(p)}
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
            })
          )}
        </div>
      </div>

      {/* 3. Pedido */}
      {cart.length > 0 && (
        <div ref={cartSectionRef} className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShoppingCart size={16} aria-hidden="true" />
              Pedido ({totalUnits})
            </span>
            <span className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              ${cartTotal.toLocaleString('es-AR')}
            </span>
          </div>

          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#fff' }}>
            {cart.map((item, idx) => {
              const basePrice = getVendedorItemPrice(item.product, selectedClient);
              const evaluatedLine = promoEval.byProductId[item.product.id];
              const itemPrice = evaluatedLine ? evaluatedLine.effectiveUnitPrice : basePrice;
              const lineSubtotal = evaluatedLine ? evaluatedLine.lineSubtotal : Math.round(itemPrice * (item.product.isPesable ? item.quantity * (item.product.approximateWeight || 1) : item.quantity));
              return (
                <div key={item.product.id} style={{ padding: '9px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', borderBottom: idx < cart.length - 1 || promoEval.bonusLines.length > 0 ? '1px solid var(--border-color)' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>{item.product.name}</div>
                    <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      ${lineSubtotal.toLocaleString('es-AR')} (${itemPrice.toLocaleString('es-AR')}{item.product.isPesable ? '/Kg' : ' c/u'})
                    </div>
                    {item.quantity < (item.product.minOrderQuantity || 1) && (
                      <label style={{ marginTop: '3px', fontSize: '0.72rem', color: '#e30613', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 600 }}>
                        <input type="checkbox" checked={Boolean(item.isEmergencyOverride)} onChange={(e) => setCart(cart.map((c) => (c.product.id === item.product.id ? { ...c, isEmergencyOverride: e.target.checked } : c)))} />
                        Mín {item.product.minOrderQuantity} · Excepción
                      </label>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} aria-label={`Restar ${item.product.name}`} onClick={() => onUpdateCartQty(item.product.id, -1)}>-</button>
                    <span className="tabular-nums" style={{ fontSize: '0.86rem', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} aria-label={`Sumar ${item.product.name}`} onClick={() => onUpdateCartQty(item.product.id, 1)}>+</button>
                    <button type="button" className="btn btn-ghost text-danger" style={{ padding: '4px' }} aria-label={`Quitar ${item.product.name}`} onClick={() => onUpdateCartQty(item.product.id, -item.quantity)}><Trash2 size={14} aria-hidden="true" /></button>
                  </div>
                </div>
              );
            })}
            {promoEval.bonusLines.map((bonus) => (
              <div key={`bonus-${bonus.productId}`} style={{ padding: '7px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0FDF4' }}>
                <span className="tabular-nums" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#065F46' }}>+ {bonus.quantity} u. sin cargo · {bonus.productName}</span>
                <span className="tabular-nums" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#065F46' }}>$0</span>
              </div>
            ))}
          </div>

          <input
            id="vendedor-order-notes"
            type="text"
            className="input"
            placeholder="Notas de entrega (opcional)"
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            style={{ fontSize: '16px', padding: '10px 12px' }}
          />

          <button type="button" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 700, fontSize: '0.95rem' }} onClick={onConfirmOrder} disabled={loading}>
            {loading ? 'Procesando...' : 'Confirmar pedido'}
          </button>
        </div>
      )}

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
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.25)', backgroundColor: 'transparent', color: '#ffffff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
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
              style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-corp-red)', color: '#ffffff', fontSize: '0.82rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Enviando...' : selectedClient ? 'Confirmar' : 'Elegir cliente'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
