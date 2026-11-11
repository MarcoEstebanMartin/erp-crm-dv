import { useState, useMemo } from 'react';
import { api } from '../../utils/api';
import { orderApi } from '../../api/order.api';
import { OrderStatus } from '../../utils/types';
import { getOrderStatusInfo } from '../../utils/orderStatusHelper';
import { RefreshCw, Globe, Eye, Printer, Edit, Trash2 } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';
import { printOrderTicket } from './orderTicketPrinter';

interface OrdersTabProps {
  orders: any[];
  fetchData: () => void;
  setOrderDetailsModal: (order: any) => void;
  handleOpenEditOrder: (order: any) => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

function getWebOrderBadgeCode(order: any): string | null {
  if (order?.bultosDetails && typeof order.bultosDetails === 'object' && order.bultosDetails.webOrderId) {
    return String(order.bultosDetails.webOrderId);
  }
  if (typeof order?.notes === 'string') {
    const m = order.notes.trim().match(/^\[(DV-\d+)\]/i);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return order?.salesChannel === 'TIENDA_WEB' ? 'WEB' : null;
}

export default function OrdersTab({
  orders,
  fetchData,
  setOrderDetailsModal,
  handleOpenEditOrder,
  setErrorMsg,
  setSuccessMsg,
}: OrdersTabProps) {
  const confirm = useConfirm();
  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [syncingWeb, setSyncingWeb] = useState(false);

  const handleCancelOrder = async (id: number) => {
    if (
      !(await confirm(
        '¿Está seguro de que desea cancelar este pedido? Se restaurará el stock físico.',
        { type: 'danger' },
      ))
    )
      return;
    try {
      await api.updateOrderStatus(id, OrderStatus.CANCELLED);
      setSuccessMsg(`Pedido #${id} cancelado correctamente.`);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cancelar pedido.');
    }
  };

  const handleManualWebSync = async () => {
    setSyncingWeb(true);
    try {
      const resp = await orderApi.syncWebOrders();
      const report = resp?.data;
      fetchData();
      if (report?.importedCount > 0) {
        setSuccessMsg(
          `Ingresaron ${report.importedCount} pedido(s) nuevo(s) desde Tienda Web / WhatsApp.`,
        );
      } else {
        setSuccessMsg('Bandeja Tienda Web / WhatsApp sincronizada al día (sin pedidos pendientes).');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al sincronizar pedidos Web/WhatsApp.');
    } finally {
      setSyncingWeb(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o: any) => {
      if (orderStatusFilter !== 'ALL') {
        const statusInfo = getOrderStatusInfo(o);
        const logicalKey = statusInfo.label.toUpperCase().replace(' ', '_');
        let targetKey = orderStatusFilter;
        if (orderStatusFilter === 'RECIBIDO') targetKey = 'PENDIENTE';
        if (logicalKey !== targetKey) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const webCode = getWebOrderBadgeCode(o)?.toLowerCase() || '';
        const matchesClient = o.client?.name?.toLowerCase().includes(q);
        const matchesId = String(o.id).includes(q) || webCode.includes(q);
        return matchesClient || matchesId;
      }
      return true;
    });
  }, [orders, orderStatusFilter, searchQuery]);

  return (
    <div>
      <div
        className="actions-bar"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div className="search-input-wrapper">
          <input
            type="text"
            className="input"
            placeholder="Buscar por cliente, #pedido o código DV-XXXX..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="select"
          value={orderStatusFilter}
          onChange={(e) => setOrderStatusFilter(e.target.value)}
        >
          <option value="ALL">Todos los Estados</option>
          <option value="RECIBIDO">Pedidos Recibidos</option>
          <option value="ARMADO">Pedidos Armados (Pend. Facturación)</option>
          <option value="FACTURADO">Pedidos Facturados</option>
          <option value="EN_VIAJE">Pedidos en Viaje</option>
          <option value="ENTREGADO">Pedidos Entregados</option>
          <option value="CANCELADO">Cancelados</option>
        </select>

        <button
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          onClick={handleManualWebSync}
          disabled={syncingWeb}
          title="Sincronizar pedidos entrantes de donvenancio.com.ar y Bot WhatsApp"
        >
          <Globe size={15} />
          <span>{syncingWeb ? 'Sincronizando...' : 'Sincronizar Web'}</span>
        </button>

        <button className="btn btn-secondary" onClick={fetchData} title="Actualizar listado">
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
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0' }}>
                  No se encontraron pedidos.
                </td>
              </tr>
            ) : (
              filteredOrders.map((o) => {
                const webCode = getWebOrderBadgeCode(o);
                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 700 }}>
                      <div>#{o.id}</div>
                      {webCode && (
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: '3px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            backgroundColor: '#05966918',
                            color: '#059669',
                            border: '1px solid #05966940',
                          }}
                        >
                          Web · {webCode}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.client?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Items: {o.items.length}
                      </div>
                    </td>
                    <td>{new Date(o.createdAt).toLocaleDateString('es-AR')}</td>
                    <td style={{ fontWeight: 600 }}>
                      ${Math.round(Number(o.totalAmount)).toLocaleString('es-AR')}
                    </td>
                    <td>
                      <span
                        className={
                          o.billingType === 'OFFICIAL' ? 'badge badge-official' : 'badge badge-internal'
                        }
                      >
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
                              fontWeight: 600,
                            }}
                          >
                            {statusInfo.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px' }}
                          title="Ver Detalle"
                          onClick={() => setOrderDetailsModal(o)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px' }}
                          title="Imprimir Ticket"
                          onClick={() => printOrderTicket(o)}
                        >
                          <Printer size={14} />
                        </button>
                        {o.status === 'PENDING' && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px' }}
                            title="Editar Pedido"
                            onClick={() => handleOpenEditOrder(o)}
                          >
                            <Edit size={14} />
                          </button>
                        )}
                        {o.status !== 'CANCELLED' && o.status !== 'DELIVERED' && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', color: 'var(--color-danger)' }}
                            title="Cancelar"
                            onClick={() => handleCancelOrder(o.id)}
                          >
                            <Trash2 size={14} />
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
}
