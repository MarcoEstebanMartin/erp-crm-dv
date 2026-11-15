import type { FC } from 'react';
import { Plus, Eye, Truck, ScanLine } from 'lucide-react';

interface ComprasOrdenesRecepcionesTabsProps {
  activeSubTab: 'ordenes' | 'recepciones';
  purchaseOrders: any[];
  onOpenCreateModal: () => void;
  onOpenReceiveModal: (order: any) => void;
  onViewDetailsModal: (order: any) => void;
  onSelectScannerFile: (file: File) => void;
}

export const ComprasOrdenesRecepcionesTabs: FC<ComprasOrdenesRecepcionesTabsProps> = ({
  activeSubTab,
  purchaseOrders,
  onOpenCreateModal,
  onOpenReceiveModal,
  onViewDetailsModal,
  onSelectScannerFile,
}) => {
  if (activeSubTab === 'recepciones') {
    const received = purchaseOrders.filter((o) => o.status === 'RECEIVED');
    return (
      <div className="card">
        <div style={{ marginBottom: '16px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Ingresos de Mercadería</h3>
        </div>

        <div className="table-container table-container--sticky" role="region" aria-label="Ingresos de mercadería" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">OC ID</th>
                <th scope="col">Fecha</th>
                <th scope="col">Proveedor</th>
                <th scope="col">Artículos</th>
                <th scope="col">Lotes</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {received.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center' }}>Sin ingresos registrados.</td></tr>
              ) : (
                received.map((order) => (
                  <tr key={order.id}>
                    <td className="tabular-nums" style={{ fontWeight: 600 }}>#{order.id}</td>
                    <td className="tabular-nums">{new Date(order.updatedAt || order.createdAt).toLocaleDateString('es-AR')}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.persona?.name}</div>
                      <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>CUIT: {order.persona?.cuit}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {order.items?.map((item: any) => (
                          <span key={item.id} className="tabular-nums" style={{ fontSize: '0.78rem' }}>{item.product?.name}: <strong>{item.quantity} u.</strong></span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {order.items?.map((item: any) => (
                          <span key={item.id} className="tabular-nums" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            Lote PO-{order.id} ({item.expirationDate ? new Date(item.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '6 meses'})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                        Ingresado
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 className="card-title" style={{ margin: 0 }}>Órdenes de Compra</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <label htmlFor="compras-scanner-input" className="btn" style={{ backgroundColor: 'var(--color-corp-red)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', borderRadius: '8px', height: '38px', margin: 0 }}>
            <ScanLine size={15} aria-hidden="true" />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Escanear Factura</span>
            <input id="compras-scanner-input" type="file" accept="image/*,application/pdf" className="visually-hidden" onChange={(e) => { if (e.target.files?.[0]) onSelectScannerFile(e.target.files[0]); e.target.value = ''; }} />
          </label>
          <button type="button" className="btn btn-primary" onClick={onOpenCreateModal} style={{ height: '38px' }}>
            <Plus size={16} aria-hidden="true" /> Nueva Orden
          </button>
        </div>
      </div>

      <div className="table-container table-container--sticky" role="region" aria-label="Órdenes de compra" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Fecha</th>
              <th scope="col">Proveedor</th>
              <th scope="col">Total</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center' }}>Sin órdenes registradas.</td></tr>
            ) : (
              purchaseOrders.map((order) => (
                <tr key={order.id}>
                  <td className="tabular-nums" style={{ fontWeight: 600 }}>#{order.id}</td>
                  <td className="tabular-nums">{new Date(order.createdAt).toLocaleDateString('es-AR')}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{order.persona?.name}</div>
                    <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CUIT: {order.persona?.cuit}</div>
                  </td>
                  <td className="tabular-nums" style={{ fontWeight: 700 }}>${Math.round(Number(order.totalAmount)).toLocaleString('es-AR')}</td>
                  <td>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: '12px', backgroundColor: order.status === 'RECEIVED' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: order.status === 'RECEIVED' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                      {order.status === 'PENDING' ? 'Pendiente' : 'Recibida'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onViewDetailsModal(order)}>
                        <Eye size={12} aria-hidden="true" /> Detalle
                      </button>
                      {order.status === 'PENDING' && (
                        <button type="button" className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.78rem', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onOpenReceiveModal(order)}>
                          <Truck size={12} aria-hidden="true" /> Recibir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
