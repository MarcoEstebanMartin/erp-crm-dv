import React from 'react';
import { Eye, Edit, Printer, Package } from 'lucide-react';
import { getOrderStatusInfo } from '../../utils/orderStatusHelper';
import { printOrderTicket } from '../admin/adminPrintHelpers';
import { sortVendedorCatalog } from './vendedorHelpers';
import type { Order, Product, Rubro } from '../../types';

interface VendedorHistoryTabProps {
  orders: Order[];
  onViewOrderDetails: (order: Order) => void;
  onEditOrder: (order: Order) => void;
}

export const VendedorHistoryTab: React.FC<VendedorHistoryTabProps> = ({
  orders,
  onViewOrderDetails,
  onEditOrder,
}) => {
  return (
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
            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px 0' }}>No registraste pedidos aún.</td></tr>
          ) : (
            orders.map((o) => {
              const statusInfo = getOrderStatusInfo(o);
              return (
                <tr key={o.id}>
                  <td style={{ fontSize: '0.8rem' }}>{new Date(o.createdAt).toLocaleDateString('es-AR')}</td>
                  <td style={{ fontWeight: 500 }}>{o.client?.name || o.persona?.name || 'S/D'}</td>
                  <td style={{ fontFamily: 'monospace' }}>{o.invoiceNumber || 'Pendiente'}</td>
                  <td>
                    <span className={o.billingType === 'OFFICIAL' ? 'badge badge-official' : 'badge badge-internal'}>
                      {o.billingType === 'OFFICIAL' ? 'Sucursal A' : 'Sucursal X'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>${Math.round(Number(o.totalAmount)).toLocaleString('es-AR')}</td>
                  <td>
                    <span className={`badge badge-${statusInfo.badgeClass}`} style={{ backgroundColor: statusInfo.color + '15', color: statusInfo.color, border: `1px solid ${statusInfo.color}30`, fontWeight: 600 }}>
                      {statusInfo.label}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} title="Ver Detalle" onClick={() => onViewOrderDetails(o)}><Eye size={12} /></button>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} title="Imprimir Ticket" onClick={() => printOrderTicket(o)}><Printer size={12} /></button>
                    {o.status === 'PENDING' && (
                      <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} title="Editar Pedido" onClick={() => onEditOrder(o)}><Edit size={12} /></button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

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
  products,
  rubros,
  searchQuery,
  setSearchQuery,
  filterRubroId,
  setFilterRubroId,
  onOpenPriceListModal,
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
        <div className="search-input-wrapper" style={{ flex: 1, minWidth: '250px' }}>
          <input type="text" className="input" placeholder="🔍 Buscar en el catálogo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: '180px' }}>
          <select className="input" style={{ height: '40px', fontSize: '0.85rem', padding: '8px 12px' }} value={filterRubroId} onChange={(e) => setFilterRubroId(e.target.value)}>
            <option value="">-- Todos los Rubros --</option>
            {rubros.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
          </select>
        </div>
        <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }} onClick={onOpenPriceListModal}>
          <span>📄 Listas PDF</span>
        </button>
      </div>

      <div className="catalog-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px', padding: '10px 4px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>No se encontraron productos.</div>
        ) : (
          filtered.map((p) => {
            const imgSrc = p.imageUrl ? (p.imageUrl.startsWith('http') ? p.imageUrl : p.imageUrl.startsWith('/') ? `${p.imageUrl}?v=2.0` : `/uploads/products/${p.imageUrl}?v=2.0`) : null;
            return (
              <div key={p.id} className="product-card" style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px', position: 'relative' }}>
                <div style={{ position: 'relative', height: '140px', width: '100%', backgroundColor: '#f8fafc', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ position: 'absolute', top: '4px', left: '4px', backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', zIndex: 3 }}>#{p.sku || p.id}</span>
                  {imgSrc ? (
                    <img src={imgSrc} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8' }}>
                      <Package size={30} color="#cbd5e1" /><span style={{ fontSize: '0.68rem', marginTop: '4px', fontWeight: 600 }}>Sin foto</span>
                    </div>
                  )}
                  {p.stock <= 0 && <span style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--color-danger)', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, zIndex: 3 }}>Agotado</span>}
                </div>
                <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>${Math.round(Number(p.listPrice)).toLocaleString('es-AR')}</span>
                <div style={{ fontWeight: 600, fontSize: '0.8rem', marginTop: '6px', textAlign: 'center' }}>{p.name}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
