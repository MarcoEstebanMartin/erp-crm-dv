import { useState, useMemo } from 'react';
import { RefreshCw, Globe, Eye, Printer, Edit, Trash2 } from 'lucide-react';
import { api } from '../../utils/api';
import { orderApi } from '../../api/order.api';
import { OrderStatus } from '../../utils/types';
import { getOrderStatusInfo } from '../../utils/orderStatusHelper';
import { useConfirm } from '../../context/ConfirmContext';
import { printOrderTicket } from './orderTicketPrinter';
import {
  formatBigIntARS,
  toOrderIntegerPesosBigInt,
} from '../../utils/fulfillmentCardMeta.helper';
import {
  getWebOrderBadgeCode,
  matchesOrderSearch,
  matchesOrderStatusFilter,
  resolveOrderPersona,
} from '../../utils/orderSearchAndStatus.helper';

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
    ) {
      return;
    }
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
      if (!matchesOrderStatusFilter(o, orderStatusFilter)) return false;
      return matchesOrderSearch(o, searchQuery);
    });
  }, [orders, orderStatusFilter, searchQuery]);

  return (
    <div>
      <search aria-label="Filtrar historial de pedidos">
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
            <label htmlFor="orders-history-search" className="visually-hidden">
              Buscar pedidos por cliente, #pedido, factura o código DV
            </label>
            <input
              id="orders-history-search"
              name="q"
              type="search"
              className="input"
              placeholder="Buscar por cliente, CUIT, #pedido o código DV-XXXX..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="orders-history-status" className="visually-hidden">
              Filtrar por estado
            </label>
            <select
              id="orders-history-status"
              name="status"
              className="select"
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
            >
              <option value="ALL">Todos los Estados</option>
              <option value="RECIBIDO">Pedidos Recibidos</option>
              <option value="EN_PICKING">Pedidos en Picking</option>
              <option value="ARMADO">Pedidos Armados (Pend. Facturación)</option>
              <option value="FACTURADO">Pedidos Facturados</option>
              <option value="EN_VIAJE">Pedidos en Viaje</option>
              <option value="ENTREGADO">Pedidos Entregados</option>
              <option value="CANCELADO">Cancelados</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleManualWebSync}
            disabled={syncingWeb}
            title="Sincronizar pedidos entrantes de donvenancio.com.ar y Bot WhatsApp"
          >
            <Globe size={15} aria-hidden="true" />
            <span>{syncingWeb ? 'Sincronizando...' : 'Sincronizar Web'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchData}
            title="Actualizar listado"
            aria-label="Actualizar historial de pedidos"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>
      </search>

      <div
        className="table-container table-container--sticky"
        role="region"
        aria-label="Historial de pedidos"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Nro Pedido</th>
              <th scope="col">Cliente</th>
              <th scope="col">Fecha</th>
              <th scope="col" style={{ textAlign: 'right' }}>Monto Total</th>
              <th scope="col">Canal</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
                  No se encontraron pedidos.
                </td>
              </tr>
            ) : (
              filteredOrders.map((o) => {
                const webCode = getWebOrderBadgeCode(o);
                const persona = resolveOrderPersona(o);
                const statusInfo = getOrderStatusInfo(o);
                const isCancelled = o.status === 'CANCELLED';

                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      <div>#{o.id}</div>
                      {webCode && (
                        <span className="badge-minimal" style={{ marginTop: '3px', fontSize: '0.68rem' }}>
                          Web · {webCode}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#111827' }}>
                        {persona?.name || o.clientName || 'Consumidor Final'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {persona?.city ? `${persona.city} · ` : ''}
                        Ítems: {o.items?.length || 0}
                        {o.invoiceNumber ? ` · ${o.invoiceNumber}` : ''}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(o.createdAt).toLocaleDateString('es-AR')}
                    </td>
                    <td style={{ fontWeight: 700, textAlign: 'right', color: '#111827' }}>
                      {formatBigIntARS(toOrderIntegerPesosBigInt(o.totalAmount))}
                    </td>
                    <td>
                      <span
                        className={
                          o.billingType === 'OFFICIAL'
                            ? 'badge-minimal badge-minimal--solid'
                            : 'badge-minimal'
                        }
                      >
                        {o.billingType === 'OFFICIAL' ? 'Sucursal A' : 'Sucursal X'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={isCancelled ? 'badge-minimal badge-minimal--danger' : 'badge-minimal'}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '6px 9px' }}
                          title="Ver Detalle"
                          aria-label={`Ver detalle del pedido #${o.id}`}
                          onClick={() => setOrderDetailsModal(o)}
                        >
                          <Eye size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '6px 9px' }}
                          title="Imprimir Ticket"
                          aria-label={`Imprimir ticket del pedido #${o.id}`}
                          onClick={() => printOrderTicket(o)}
                        >
                          <Printer size={14} aria-hidden="true" />
                        </button>
                        {o.status === 'PENDING' && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '6px 9px' }}
                            title="Editar Pedido"
                            aria-label={`Editar pedido #${o.id}`}
                            onClick={() => handleOpenEditOrder(o)}
                          >
                            <Edit size={14} aria-hidden="true" />
                          </button>
                        )}
                        {o.status !== 'CANCELLED' && o.status !== 'DELIVERED' && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '6px 9px', color: '#E30613', borderColor: 'rgba(227, 6, 19, 0.25)' }}
                            title="Cancelar Pedido"
                            aria-label={`Cancelar pedido #${o.id}`}
                            onClick={() => handleCancelOrder(o.id)}
                          >
                            <Trash2 size={14} aria-hidden="true" />
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
