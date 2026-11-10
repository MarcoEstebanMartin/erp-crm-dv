import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';

export const ComprasCreateReceiveModals: React.FC<{
  showCreateModal: boolean;
  setShowCreateModal: (v: boolean) => void;
  providers: any[];
  products: any[];
  selectedProviderId: string;
  setSelectedProviderId: (v: string) => void;
  cart: { productId: number; name: string; sku: string; quantity: number; costPrice: number }[];
  setCart: React.Dispatch<React.SetStateAction<{ productId: number; name: string; sku: string; quantity: number; costPrice: number }[]>>;
  onCreateSubmit: (e: React.FormEvent) => void;
  showReceiveModal: any | null;
  setShowReceiveModal: (v: any | null) => void;
  invoiceNumber: string;
  setInvoiceNumber: (v: string) => void;
  lotAssignments: Record<number, { lotNumber: string; expirationDate: string }>;
  onLotAssignmentChange: (productId: number, field: 'lotNumber' | 'expirationDate', val: string) => void;
  onReceiveSubmit: (e: React.FormEvent) => void;
  viewDetailsModal: any | null;
  setViewDetailsModal: (v: any | null) => void;
}> = (p) => {
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<any | null>(null);
  const [quantityToAdd, setQuantityToAdd] = useState('10');
  const [costPriceToAdd, setCostPriceToAdd] = useState('');

  const filteredProductsForAdd = useMemo(() => {
    if (!searchProductQuery) return [];
    const q = searchProductQuery.toLowerCase();
    return p.products.filter((pr) => pr.name.toLowerCase().includes(q) || pr.sku.toLowerCase().includes(q)).slice(0, 12);
  }, [searchProductQuery, p.products]);

  const cartTotal = p.cart.reduce((acc, item) => acc + item.quantity * item.costPrice, 0);

  const handleAddToCart = () => {
    if (!selectedProductToAdd || !quantityToAdd || !costPriceToAdd) return;
    const qty = Number(quantityToAdd);
    const cost = Number(costPriceToAdd);
    if (qty <= 0 || cost <= 0) return alert('Cantidad y costo deben ser mayores a 0.');

    const existingIdx = p.cart.findIndex((i) => i.productId === selectedProductToAdd.id);
    if (existingIdx !== -1) {
      const updated = [...p.cart];
      updated[existingIdx].quantity += qty;
      updated[existingIdx].costPrice = cost;
      p.setCart(updated);
    } else {
      p.setCart((prev) => [...prev, { productId: selectedProductToAdd.id, name: selectedProductToAdd.name, sku: selectedProductToAdd.sku, quantity: qty, costPrice: cost }]);
    }
    setSelectedProductToAdd(null);
    setQuantityToAdd('10');
    setCostPriceToAdd('');
    setSearchProductQuery('');
  };

  return (
    <>
      {p.showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h3>Registrar Orden de Compra</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => p.setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={p.onCreateSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label>Proveedor (Obligatorio)</label>
                    <select className="select" value={p.selectedProviderId} onChange={(e) => p.setSelectedProviderId(e.target.value)} required>
                      <option value="">Seleccione proveedor...</option>
                      {p.providers.map((pr) => (<option key={pr.id} value={pr.id}>{pr.name} (CUIT: {pr.cuit})</option>))}
                    </select>
                  </div>

                  <div className="form-group" style={{ position: 'relative' }}>
                    <label>Buscar Producto a Comprar</label>
                    <input type="text" className="input" placeholder="Escriba SKU o Nombre..." value={searchProductQuery} onChange={(e) => setSearchProductQuery(e.target.value)} />
                    {filteredProductsForAdd.length > 0 && (
                      <div style={{ position: 'absolute', left: 0, right: 0, top: '65px', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto', zIndex: 100 }}>
                        {filteredProductsForAdd.map((pr) => (
                          <div key={pr.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: '0.8rem' }} onClick={() => { setSelectedProductToAdd(pr); setCostPriceToAdd(String(pr.costPrice)); }}>
                            <strong>{pr.sku}</strong> - {pr.name} (Costo actual: ${pr.costPrice})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedProductToAdd && (
                    <div style={{ backgroundColor: '#F8F8FA', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px' }}>Añadir: {selectedProductToAdd.name} ({selectedProductToAdd.sku})</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div className="form-group"><label>Cantidad</label><input type="number" className="input" value={quantityToAdd} onChange={(e) => setQuantityToAdd(e.target.value)} /></div>
                        <div className="form-group"><label>Costo Unitario ($)</label><input type="number" step="0.01" className="input" value={costPriceToAdd} onChange={(e) => setCostPriceToAdd(e.target.value)} /></div>
                      </div>
                      <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: '10px', fontSize: '0.8rem' }} onClick={handleAddToCart}>Añadir al Carrito de Compra</button>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>Artículos en la Orden</label>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', minHeight: '220px', maxHeight: '260px', overflowY: 'auto' }}>
                    {p.cart.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>No hay artículos agregados todavía.</div>
                    ) : (
                      p.cart.map((item) => (
                        <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #f0f0f0', fontSize: '0.8rem' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{item.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Cant: {item.quantity} u. @ ${item.costPrice}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontWeight: 700 }}>${Math.round(item.quantity * item.costPrice).toLocaleString()}</span>
                            <button type="button" className="btn btn-ghost" style={{ padding: '2px', color: 'var(--color-danger)' }} onClick={() => p.setCart((prev) => prev.filter((i) => i.productId !== item.productId))}>✖</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {p.cart.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '8px', backgroundColor: '#F8F8FA', borderRadius: '6px', fontWeight: 700, fontSize: '0.95rem' }}>
                      <span>Monto Neto Total:</span>
                      <span style={{ color: 'var(--accent-color)' }}>${Math.round(cartTotal).toLocaleString('es-AR')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => p.setShowCreateModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }} disabled={p.cart.length === 0}>Registrar Orden de Compra</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {p.showReceiveModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Recibir Orden de Compra #{p.showReceiveModal.id}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => p.setShowReceiveModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={p.onReceiveSubmit}>
              <div className="form-group">
                <label>Número de Factura del Proveedor</label>
                <input type="text" className="input" placeholder="ej: 0005-00045612" value={p.invoiceNumber} onChange={(e) => p.setInvoiceNumber(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                {p.showReceiveModal.items.map((item: any) => (
                  <div key={item.productId} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>{item.product?.name || `Producto #${item.productId}`} ({item.quantity} u.)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem' }}>Nro Lote</label>
                        <input type="text" className="input" value={p.lotAssignments[item.productId]?.lotNumber || ''} onChange={(e) => p.onLotAssignmentChange(item.productId, 'lotNumber', e.target.value)} required />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem' }}>Vencimiento</label>
                        <input type="date" className="input" value={p.lotAssignments[item.productId]?.expirationDate || ''} onChange={(e) => p.onLotAssignmentChange(item.productId, 'expirationDate', e.target.value)} required />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => p.setShowReceiveModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>Confirmar Recepción</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {p.viewDetailsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>Detalles de Orden de Compra #{p.viewDetailsModal.id}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => p.setViewDetailsModal(null)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
              <div><strong>Proveedor:</strong> {p.viewDetailsModal.persona?.name}</div>
              <div className="table-container" style={{ borderRadius: '6px' }}>
                <table style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr><th>Artículo</th><th style={{ textAlign: 'right' }}>Cant</th><th style={{ textAlign: 'right' }}>Costo</th><th style={{ textAlign: 'right' }}>Subtotal</th></tr>
                  </thead>
                  <tbody>
                    {p.viewDetailsModal.items?.map((item: any) => (
                      <tr key={item.id}>
                        <td>{item.product?.name || `Producto #${item.productId}`}</td>
                        <td style={{ textAlign: 'right' }}>{item.quantity} u.</td>
                        <td style={{ textAlign: 'right' }}>${Math.round(Number(item.costPrice)).toLocaleString('es-AR')}</td>
                        <td style={{ textAlign: 'right' }}>${Math.round(Number(item.subtotal)).toLocaleString('es-AR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#F8F8FA', borderRadius: '6px', fontWeight: 700 }}>
                <span>Total Neto:</span>
                <span>${Math.round(Number(p.viewDetailsModal.totalAmount)).toLocaleString('es-AR')}</span>
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => p.setViewDetailsModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
