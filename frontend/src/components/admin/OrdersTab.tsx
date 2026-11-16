import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Globe, Eye, Printer, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../utils/api';
import { orderApi } from '../../api/order.api';
import { ORDERS_QUERY_KEYS, useOrdersPageQuery } from '../../hooks/queries';
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
  resolveOrderPersona,
} from '../../utils/orderSearchAndStatus.helper';

const ORDERS_PAGE_LIMIT = 50;

interface OrdersTabProps {
  initialStatusFilter?: string;
  ordersVersion?: number;
  fetchData: () => void;
  setOrderDetailsModal: (order: any) => void;
  handleOpenEditOrder: (order: any) => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export default function OrdersTab({
  initialStatusFilter = 'ALL',
  ordersVersion = 0,
  fetchData,
  setOrderDetailsModal,
  handleOpenEditOrder,
  setErrorMsg,
  setSuccessMsg,
}: OrdersTabProps) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>(initialStatusFilter || 'ALL');
  const [page, setPage] = useState(1);
  const [syncingWeb, setSyncingWeb] = useState(false);

  useEffect(() => {
    setOrderStatusFilter(initialStatusFilter || 'ALL');
    setPage(1);
  }, [initialStatusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    data: ordersPageData,
    isLoading: loading,
    isFetching,
    error: queryError,
    refetch,
  } = useOrdersPageQuery({
    page,
    limit: ORDERS_PAGE_LIMIT,
    statusGroup: orderStatusFilter,
    search: debouncedSearch,
  });

  useEffect(() => {
    if (queryError) {
      setErrorMsg((queryError as any)?.message || 'Error al cargar pedidos.');
    }
  }, [queryError, setErrorMsg]);

  useEffect(() => {
    if (ordersVersion > 0) {
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEYS.all });
    }
  }, [ordersVersion, queryClient]);

  const orders: any[] = ordersPageData?.orders || [];
  const pagination = ordersPageData?.pagination || {
    total: 0,
    page: 1,
    limit: ORDERS_PAGE_LIMIT,
    totalPages: 1,
  };

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
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEYS.all });
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
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEYS.all });
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
              onChange={(e) => {
                setOrderStatusFilter(e.target.value);
                setPage(1);
              }}
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
            onClick={() => void refetch()}
            disabled={isFetching}
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
            {loading && orders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
                  Cargando...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
                  No se encontraron pedidos.
                </td>
              </tr>
            ) : (
              orders.map((o) => {
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

        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.84rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: '#fafafa',
          }}
        >
          <span className="tabular-nums">
            Página <strong>{pagination.page}</strong> de <strong>{pagination.totalPages}</strong> ·{' '}
            <strong>{pagination.total.toLocaleString('es-AR')}</strong> pedidos
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '5px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} aria-hidden="true" /> Anterior
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '5px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            >
              Siguiente <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
