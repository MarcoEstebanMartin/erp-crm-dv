import React from 'react';
import { Plus, Eye, Truck } from 'lucide-react';

interface ComprasOrdenesRecepcionesTabsProps {
  activeSubTab: 'ordenes' | 'recepciones';
  purchaseOrders: any[];
  onOpenCreateModal: () => void;
  onOpenReceiveModal: (order: any) => void;
  onViewDetailsModal: (order: any) => void;
  onSelectScannerFile: (file: File) => void;
}

export const ComprasOrdenesRecepcionesTabs: React.FC<ComprasOrdenesRecepcionesTabsProps> = ({
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
          <h3 className="card-title" style={{ margin: 0 }}>📦 Auditoría de Ingreso de Mercadería</h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Historial detallado de mercancía física recibida con trazabilidad de lotes y vencimientos.</p>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>OC ID</th>
                <th>Fecha de Recepción</th>
                <th>Proveedor</th>
                <th>Artículos Recibidos</th>
                <th>Lotes Asignados</th>
                <th>Estado Físico</th>
              </tr>
            </thead>
            <tbody>
              {received.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center' }}>No hay ingresos de mercadería registrados.</td></tr>
              ) : (
                received.map((order) => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 600 }}>#{order.id}</td>
                    <td>{new Date(order.updatedAt || order.createdAt).toLocaleDateString('es-AR')}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.persona?.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>CUIT: {order.persona?.cuit}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {order.items?.map((item: any) => (
                          <span key={item.id} style={{ fontSize: '0.78rem' }}>• {item.product?.name}: <strong>{item.quantity} u.</strong></span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {order.items?.map((item: any) => (
                          <span key={item.id} style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            Lote PO-{order.id} (Vto: {item.expirationDate ? new Date(item.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '6 meses'})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                        Ingresado a Depósito
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
        <div>
          <h3 className="card-title" style={{ margin: 0 }}>📋 Órdenes de Compra a Proveedores</h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Control de abastecimiento impositivo y comercial con actualización automática de costos.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <label className="btn" style={{ backgroundColor: 'var(--color-corp-red)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', borderRadius: '8px', height: '38px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>📸 Escanear Factura (IA)</span>
            <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) onSelectScannerFile(e.target.files[0]); e.target.value = ''; }} />
          </label>
          <button className="btn btn-primary" onClick={onOpenCreateModal} style={{ height: '38px' }}>
            <Plus size={16} /> Nueva Orden de Compra
          </button>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha Emisión</th>
              <th>Proveedor</th>
              <th>Monto Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center' }}>No hay órdenes de compra registradas.</td></tr>
            ) : (
              purchaseOrders.map((order) => (
                <tr key={order.id}>
                  <td style={{ fontWeight: 600 }}>#{order.id}</td>
                  <td>{new Date(order.createdAt).toLocaleDateString('es-AR')}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{order.persona?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CUIT: {order.persona?.cuit}</div>
                  </td>
                  <td style={{ fontWeight: 700 }}>${Math.round(Number(order.totalAmount)).toLocaleString('es-AR')}</td>
                  <td>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: '12px', backgroundColor: order.status === 'RECEIVED' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: order.status === 'RECEIVED' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                      {order.status === 'PENDING' ? 'Pendiente' : 'Recibida'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onViewDetailsModal(order)}>
                        <Eye size={12} /> Detalles
                      </button>
                      {order.status === 'PENDING' && (
                        <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.78rem', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onOpenReceiveModal(order)}>
                          <Truck size={12} /> Recibir Mercadería
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
