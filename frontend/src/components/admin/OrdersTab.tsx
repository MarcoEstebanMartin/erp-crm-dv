import React, { useState, useMemo } from 'react';
import { api } from '../../utils/api';
import { OrderStatus } from '../../utils/types';
import { getOrderStatusInfo } from '../../utils/orderStatusHelper';
import { 
  RefreshCw, 
  Eye, 
  Printer, 
  Edit, 
  Trash2 
} from 'lucide-react';

import { useConfirm } from '../../context/ConfirmContext';

interface OrdersTabProps {
  orders: any[];
  fetchData: () => void;
  setOrderDetailsModal: (order: any) => void;
  handleOpenEditOrder: (order: any) => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export default function OrdersTab({
  orders,
  fetchData,
  setOrderDetailsModal,
  handleOpenEditOrder,
  setErrorMsg,
  setSuccessMsg
}: OrdersTabProps) {
  const confirm = useConfirm();
  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');

  // Cancel order handler
  const handleCancelOrder = async (id: number) => {
    if (!await confirm('¿Está seguro de que desea cancelar este pedido? Se restaurará el stock físico.', { type: 'danger' })) return;
    try {
      await api.updateOrderStatus(id, OrderStatus.CANCELLED);
      setSuccessMsg(`Pedido #${id} cancelado correctamente.`);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cancelar pedido.');
    }
  };

  // Print order ticket
  const printTicket = (order: any) => {
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) return;

    const companyLogo = localStorage.getItem('company_nombre_fantasia') || 'DV DISTRIBUIDORA';
    const companySub = localStorage.getItem('company_razon_social') || 'Mayorista de Alimentos & Bebidas';
    const companyCuitVal = localStorage.getItem('company_cuit') || '30-71717171-9';

    printWindow.document.write(`
      <html>
        <head>
          <title>Comprobante Pedido #${order.id}</title>
          <style>
            body { font-family: monospace; padding: 20px; color: #000; font-size: 13px; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { font-size: 1.6rem; font-weight: bold; margin-bottom: 4px; }
            .divider { border-top: 1px dashed #000; margin: 12px 0; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 4px; }
            td { padding: 4px 0; }
            .text-right { text-align: right; }
            .footer { text-align: center; margin-top: 30px; font-size: 0.85rem; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">${companyLogo}</div>
            <div>${companySub}</div>
            <div>CUIT: ${companyCuitVal}</div>
            <div>Fecha: ${new Date(order.createdAt || Date.now()).toLocaleString('es-AR')}</div>
            <div><strong>PEDIDO NRO: ${order.id}</strong></div>
          </div>
          <div class="divider"></div>
          <div><strong>Cliente:</strong> ${order.client?.name}</div>
          <div><strong>CUIT:</strong> ${order.client?.cuit || 'Consumidor Final'}</div>
          <div><strong>Dirección:</strong> ${order.client?.address || 'Retira en local'}</div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th>Articulo</th>
                <th class="text-right">Cant</th>
                <th class="text-right">Unit</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item: any) => {
                const price = Number(item.unitPrice ?? item.price ?? 0);
                const isPesable = item.product?.isPesable || (item.weight && Number(item.weight) > 0);
                const subtotal = item.subtotal ? Number(item.subtotal) : (isPesable ? item.quantity * (item.product?.approximateWeight || 1) * price : item.quantity * price);
                const cantDisplay = isPesable && item.weight ? `${item.quantity} u (${Number(item.weight).toFixed(2)} kg)` : (isPesable ? `${item.quantity} u (${(item.quantity * (item.product?.approximateWeight || 1)).toLocaleString()} kg aprox)` : `${item.quantity} u`);
                return `
                  <tr>
                    <td>${item.product?.name || 'Artículo'}</td>
                    <td class="text-right">${cantDisplay}</td>
                    <td class="text-right">$${Math.round(price).toLocaleString('es-AR')}${isPesable ? '/Kg' : ''}</td>
                    <td class="text-right">$${Math.round(subtotal).toLocaleString('es-AR')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem;">
            <span>TOTAL A PAGAR:</span>
            <span>$${Math.round(Number(order.totalAmount)).toLocaleString('es-AR')}</span>
          </div>
          <div style="margin-top: 6px;"><strong>Canal Facturación:</strong> ${order.billingType === 'OFFICIAL' ? 'Sucursal A (Con CAE/AFIP)' : 'Sucursal X (Presupuesto Interno)'}</div>
          <div><strong>Nro Comprobante:</strong> ${order.invoiceNumber || 'No Facturado (Pendiente)'}</div>
          <div class="divider"></div>
          <div class="footer">
            <p>¡Muchas gracias por su compra!</p>
            <p>Para reclamos o logística conserve este ticket</p>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter orders locally
  const filteredOrders = useMemo(() => {
    return orders.filter((o: any) => {
      // Status filter
      if (orderStatusFilter !== 'ALL') {
        const statusInfo = getOrderStatusInfo(o);
        const logicalKey = statusInfo.label.toUpperCase().replace(' ', '_');
        
        let targetKey = orderStatusFilter;
        if (orderStatusFilter === 'RECIBIDO') targetKey = 'PENDIENTE';
        
        if (logicalKey !== targetKey) return false;
      }
      // Search query filter (client name or ID)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesClient = o.client?.name?.toLowerCase().includes(q);
        const matchesId = String(o.id).includes(q);
        return matchesClient || matchesId;
      }
      return true;
    });
  }, [orders, orderStatusFilter, searchQuery]);

  return (
    <div>
      <div className="actions-bar" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', marginBottom: '16px' }}>
        <div className="search-input-wrapper">
          <input
            type="text"
            className="input"
            placeholder="Buscar pedidos por cliente o nro de pedido..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <select className="select" value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
          <option value="ALL">Todos los Estados</option>
          <option value="RECIBIDO">Pedidos Recibidos</option>
          <option value="ARMADO">Pedidos Armados (Pend. Facturación)</option>
          <option value="FACTURADO">Pedidos Facturados</option>
          <option value="EN_VIAJE">Pedidos en Viaje</option>
          <option value="ENTREGADO">Pedidos Entregados</option>
          <option value="CANCELADO">Cancelados</option>
        </select>

        <button className="btn btn-secondary" onClick={fetchData}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nro Pedido</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Monto Total</th>
              <th>Canal</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0' }}>No se encontraron pedidos.</td>
              </tr>
            ) : (
              filteredOrders.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 700 }}>#{o.id}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.client?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Items: {o.items.length}</div>
                  </td>
                  <td>{new Date(o.createdAt).toLocaleDateString('es-AR')}</td>
                  <td style={{ fontWeight: 600 }}>${Math.round(Number(o.totalAmount)).toLocaleString('es-AR')}</td>
                  <td>
                    <span className={o.billingType === 'OFFICIAL' ? 'badge badge-official' : 'badge badge-internal'}>
                      {o.billingType === 'OFFICIAL' ? 'Sucursal A' : 'Sucursal X'}
                    </span>
                  </td>
                  <td>
                    {(() => {
                      const statusInfo = getOrderStatusInfo(o);
                      return (
                        <span 
                          className={`badge badge-${statusInfo.badgeClass}`}
                          style={{
                            backgroundColor: statusInfo.color + '15',
                            color: statusInfo.color,
                            border: `1px solid ${statusInfo.color}30`,
                            fontWeight: 600
                          }}
                        >
                          {statusInfo.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px' }} title="Ver Detalle" onClick={() => setOrderDetailsModal(o)}>
                        <Eye size={14} />
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px' }} title="Imprimir Ticket" onClick={() => printTicket(o)}>
                        <Printer size={14} />
                      </button>
                      {o.status === 'PENDING' && (
                        <button className="btn btn-secondary" style={{ padding: '6px 10px' }} title="Editar Pedido" onClick={() => handleOpenEditOrder(o)}>
                          <Edit size={14} />
                        </button>
                      )}
                      {o.status !== 'CANCELLED' && o.status !== 'DELIVERED' && (
                        <button className="btn btn-secondary" style={{ padding: '6px 10px', color: 'var(--color-danger)' }} title="Cancelar" onClick={() => handleCancelOrder(o.id)}>
                          <Trash2 size={14} />
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
}
