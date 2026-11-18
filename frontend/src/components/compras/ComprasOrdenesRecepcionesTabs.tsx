import { useMemo, useState, type FC } from 'react';
import { Plus, Eye, Truck } from 'lucide-react';
import { formatCuitDisplay, formatPurchaseOrderLotsSummary } from './providersHelpers';

interface ComprasOrdenesRecepcionesTabsProps {
  purchaseOrders: any[];
  onOpenCreateModal: () => void;
  onOpenReceiveModal: (order: any) => void;
  onViewDetailsModal: (order: any) => void;
}

type ReceptionFilter = 'ALL' | 'PENDING' | 'RECEIVED';

export const ComprasOrdenesRecepcionesTabs: FC<ComprasOrdenesRecepcionesTabsProps> = ({
  purchaseOrders,
  onOpenCreateModal,
  onOpenReceiveModal,
  onViewDetailsModal,
}) => {
  const [filter, setFilter] = useState<ReceptionFilter>('ALL');

  const pendingCount = useMemo(
    () => (purchaseOrders || []).filter((o) => o.status === 'PENDING').length,
    [purchaseOrders],
  );

  const visibleOrders = useMemo(() => {
    const list = (purchaseOrders || []).filter((o) =>
      filter === 'ALL' ? o.status !== 'CANCELLED' : o.status === filter,
    );
    return [...list].sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [purchaseOrders, filter]);

  const filterButtons: Array<{ id: ReceptionFilter; label: string }> = [
    { id: 'ALL', label: 'Todas' },
    { id: 'PENDING', label: pendingCount > 0 ? `En tránsito (${pendingCount})` : 'En tránsito' },
    { id: 'RECEIVED', label: 'Ingresadas' },
  ];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Recepciones</h3>
          <div style={{ display: 'inline-flex', gap: '4px', backgroundColor: 'var(--bg-app)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {filterButtons.map((btn) => (
              <button
                key={btn.id}
                type="button"
                className={filter === btn.id ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ padding: '4px 10px', fontSize: '0.76rem', height: '28px' }}
                onClick={() => setFilter(btn.id)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={onOpenCreateModal} style={{ height: '36px' }}>
          <Plus size={15} aria-hidden="true" /> Ingreso sin factura
        </button>
      </div>

      <div className="table-container table-container--sticky" role="region" aria-label="Recepciones de mercadería" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Fecha</th>
              <th scope="col">Proveedor</th>
              <th scope="col">Comprobante</th>
              <th scope="col">Artículos</th>
              <th scope="col">Lotes</th>
              <th scope="col">Estado</th>
              <th scope="col" style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleOrders.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center' }}>Sin recepciones registradas.</td></tr>
            ) : (
              visibleOrders.map((order) => {
                const cuit = formatCuitDisplay(order.persona?.cuit);
                const isPending = order.status === 'PENDING';
                const lotLabels = isPending ? ['Pendiente'] : formatPurchaseOrderLotsSummary(order);
                return (
                  <tr key={order.id}>
                    <td className="tabular-nums" style={{ fontWeight: 600 }}>#{order.id}</td>
                    <td className="tabular-nums">{new Date(order.receivedAt || order.updatedAt || order.createdAt).toLocaleDateString('es-AR')}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.persona?.name}</div>
                      {cuit && <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>CUIT: {cuit}</div>}
                    </td>
                    <td className="tabular-nums" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {order.supplierInvoice?.invoiceNumber || 'Sin factura'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {order.items?.map((item: any) => (
                          <span key={item.id} className="tabular-nums" style={{ fontSize: '0.78rem' }}>
                            {item.product?.name}: <strong>{item.quantity} u.</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {lotLabels.map((lbl, idx) => (
                          <span key={idx} className="tabular-nums" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            {lbl}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                        backgroundColor: isPending ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
                        color: isPending ? '#B78103' : 'var(--color-success)',
                      }}>
                        {isPending ? 'En tránsito' : 'Ingresada'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => onViewDetailsModal(order)}>
                          <Eye size={12} aria-hidden="true" /> Detalle
                        </button>
                        {isPending && (
                          <button type="button" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => onOpenReceiveModal(order)}>
                            <Truck size={12} aria-hidden="true" /> Recibir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
