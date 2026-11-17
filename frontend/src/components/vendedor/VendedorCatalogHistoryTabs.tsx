import React from 'react';
import { Eye, Edit, Package, FileText, Search } from 'lucide-react';
import { getOrderStatusInfo } from '../../utils/orderStatusHelper';
import { formatIntegerARS } from '../../utils/currency';
import { sortVendedorCatalog } from './vendedorHelpers';
import type { Order, Product, Rubro } from '../../types';

interface VendedorHistoryTabProps {
  orders: Order[];
  onViewOrderDetails: (order: Order) => void;
  onEditOrder: (order: Order) => void;
}

export const VendedorHistoryTab: React.FC<VendedorHistoryTabProps> = ({ orders, onViewOrderDetails, onEditOrder }) => (
  <>
    <div className="table-container table-container--sticky vendedor-history-table-desktop" role="region" aria-label="Historial de pedidos" tabIndex={0}>
      <table>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Cliente</th>
            <th scope="col">Total</th>
            <th scope="col">Estado</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px 0' }}>Sin pedidos</td></tr>
          ) : (
            orders.map((o) => {
              const statusInfo = getOrderStatusInfo(o);
              return (
                <tr key={o.id}>
                  <td className="tabular-nums" style={{ fontSize: '0.8rem' }}>{new Date(o.createdAt).toLocaleDateString('es-AR')}</td>
                  <td style={{ fontWeight: 500 }}>{o.client?.name || o.persona?.name || '-'}</td>
                  <td className="tabular-nums" style={{ fontWeight: 600 }}>{formatIntegerARS(o.totalAmount)}</td>
                  <td>
                    <span className={`badge badge-${statusInfo.badgeClass}`} style={{ backgroundColor: statusInfo.color + '15', color: statusInfo.color, border: `1px solid ${statusInfo.color}30`, fontWeight: 600 }}>
                      {statusInfo.label}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} title="Ver detalle" aria-label={`Ver detalle pedido #${o.id}`} onClick={() => onViewOrderDetails(o)}><Eye size={12} aria-hidden="true" /></button>
                    {o.status === 'PENDING' && (
                      <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} title="Editar pedido" aria-label={`Editar pedido #${o.id}`} onClick={() => onEditOrder(o)}><Edit size={12} aria-hidden="true" /></button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>

    <div className="vendedor-history-cards" aria-label="Historial de pedidos móvil">
      {orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>Sin pedidos</div>
      ) : (
        orders.map((o) => {
          const statusInfo = getOrderStatusInfo(o);
          return (
            <div key={`m-${o.id}`} className="card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{o.client?.name || o.persona?.name || '-'}</div>
                  <div className="tabular-nums" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    {new Date(o.createdAt).toLocaleDateString('es-AR')} · Pedido #{o.id}
                  </div>
                </div>
                <span className={`badge badge-${statusInfo.badgeClass}`} style={{ backgroundColor: statusInfo.color + '15', color: statusInfo.color, border: `1px solid ${statusInfo.color}30`, fontWeight: 600, flexShrink: 0 }}>
                  {statusInfo.label}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                <span className="tabular-nums" style={{ fontWeight: 700, fontSize: '1rem' }}>{formatIntegerARS(o.totalAmount)}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} aria-label={`Ver detalle pedido #${o.id}`} onClick={() => onViewOrderDetails(o)}><Eye size={14} aria-hidden="true" /></button>
                  {o.status === 'PENDING' && (
                    <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} aria-label={`Editar pedido #${o.id}`} onClick={() => onEditOrder(o)}><Edit size={14} aria-hidden="true" /></button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  </>
);

interface VendedorCatalogReadOnlyTabProps {
  products: Product[];
  rubros: Rubro[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterRubroId: string;
  setFilterRubroId: (id: string) => void;
  onOpenPriceListModal: () => void;
}

export const VendedorCatalogReadOnlyTab: React.FC<VendedorCatalogReadOnlyTabProps> = ({
  products, rubros, searchQuery, setSearchQuery, filterRubroId, setFilterRubroId, onOpenPriceListModal,
}) => {
  const filtered = sortVendedorCatalog(
    products.filter((p) => {
      if (filterRubroId && Number(p.rubroId) !== Number(filterRubroId)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        return (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
      }
      return true;
    }),
    rubros,
    filterRubroId,
  );

  return (
    <div className="no-print">
      <div className="actions-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <search className="search-input-wrapper" style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <label htmlFor="vendedor-catalog-search" className="sr-only">Buscar producto</label>
          <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          <input id="vendedor-catalog-search" type="text" className="input" placeholder="Buscar producto" autoCorrect="off" autoCapitalize="none" spellCheck={false} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ paddingLeft: '34px' }} />
        </search>
        <div className="form-group" style={{ margin: 0, minWidth: '180px' }}>
          <label htmlFor="vendedor-catalog-rubro" className="sr-only">Rubro</label>
          <select id="vendedor-catalog-rubro" className="input" style={{ height: '40px', fontSize: '0.85rem', padding: '8px 12px' }} value={filterRubroId} onChange={(e) => setFilterRubroId(e.target.value)}>
            <option value="">Todos los rubros</option>
            {rubros.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
          </select>
        </div>
        <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }} onClick={onOpenPriceListModal}>
          <FileText size={14} aria-hidden="true" />
          <span>Listas PDF</span>
        </button>
      </div>

      <div className="catalog-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px', padding: '10px 4px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>Sin productos</div>
        ) : (
          filtered.map((p) => {
            const imgSrc = p.imageUrl ? (p.imageUrl.startsWith('http') ? p.imageUrl : p.imageUrl.startsWith('/') ? `${p.imageUrl}?v=2.0` : `/uploads/products/${p.imageUrl}?v=2.0`) : null;
            return (
              <div key={p.id} className="product-card" style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px', position: 'relative' }}>
                <div style={{ position: 'relative', height: '140px', width: '100%', backgroundColor: '#f8fafc', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="tabular-nums" style={{ position: 'absolute', top: '4px', left: '4px', backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', zIndex: 3 }}>#{p.sku || p.id}</span>
                  {imgSrc ? (
                    <img src={imgSrc} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8' }}>
                      <Package size={30} color="#cbd5e1" aria-hidden="true" /><span style={{ fontSize: '0.68rem', marginTop: '4px', fontWeight: 600 }}>Sin foto</span>
                    </div>
                  )}
                  {p.stock <= 0 && <span style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--color-danger)', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, zIndex: 3 }}>Agotado</span>}
                </div>
                <span className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{formatIntegerARS(p.listPrice)}</span>
                <div style={{ fontWeight: 600, fontSize: '0.8rem', marginTop: '6px', textAlign: 'center' }}>{p.name}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
