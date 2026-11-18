import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Eye, X } from 'lucide-react';
import { api } from '../../utils/api';
import { ORDERS_QUERY_KEYS, PENDING_ROUTES_QUERY_KEY } from '../../hooks/queries';
import { formatOrderDeliverySummary } from '../../utils/orderDeliveryHelpers';
import { getOrderStatusInfo } from '../../utils/orderStatusHelper';
import { NativeModalDialog } from '../modals/NativeModalDialog';

interface AdminSummaryCardModalProps {
  summaryCardModal: { open: boolean; cardKey: string; cardLabel: string } | null;
  orders?: any[];
  onClose: () => void;
  onSelectOrderDetails: (order: any) => void;
  onViewAllInOrdersTab: (cardKey: string) => void;
  onNavigateOperationalTab: (tab: 'fulfillment' | 'entregas') => void;
  onOrderDelivered?: () => void;
  setErrorMsg?: (msg: string | null) => void;
  setSuccessMsg?: (msg: string | null) => void;
}

export const AdminSummaryCardModal: React.FC<AdminSummaryCardModalProps> = ({
  summaryCardModal,
  onClose,
  onSelectOrderDetails,
  onViewAllInOrdersTab,
  onNavigateOperationalTab,
  onOrderDelivered,
  setErrorMsg,
  setSuccessMsg,
}) => {
  const queryClient = useQueryClient();
  const [cardOrders, setCardOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deliveringId, setDeliveringId] = useState<number | null>(null);

  const isOpen = Boolean(summaryCardModal?.open);
  const cardKey = summaryCardModal?.cardKey || '';
  const isFulfillmentStage = cardKey === 'RECIBIDO' || cardKey === 'EN_ARMADO';
  const showStatusColumn = cardKey === 'EN_ARMADO';

  useEffect(() => {
    if (!isOpen || !cardKey) return;
    let active = true;
    setLoading(true);
    api
      .getOrdersPage({ statusGroup: cardKey, page: 1, limit: 30 })
      .then((res) => {
        if (active) setCardOrders(res.orders || []);
      })
      .catch(() => {
        if (active) setCardOrders([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, cardKey]);

  const handleQuickDeliver = async (order: any) => {
    const summary = formatOrderDeliverySummary(order);
    if (deliveringId !== null || (!summary.canMarkPickedUp && !summary.canMarkDirectDelivered)) return;
    setDeliveringId(order.id);
    try {
      await api.updateOrderDelivery(
        order.id,
        summary.canMarkPickedUp
          ? { deliveryMethod: 'PICKUP', markPickedUp: true }
          : { deliveryMethod: 'DELIVERY', markDelivered: true },
      );
      setCardOrders((prev) => prev.filter((item) => item.id !== order.id));
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: PENDING_ROUTES_QUERY_KEY });
      onOrderDelivered?.();
      setSuccessMsg?.(`Pedido #${order.id} entregado.`);
    } catch (err: any) {
      setErrorMsg?.(err?.message || 'Error al registrar entrega.');
    } finally {
      setDeliveringId(null);
    }
  };

  if (!summaryCardModal || !summaryCardModal.open) return null;

  return (
    <NativeModalDialog
      isOpen={Boolean(summaryCardModal?.open)}
      onClose={onClose}
      ariaLabelledBy="summary-card-modal-title"
      style={{ maxWidth: '1080px', width: '95vw', maxHeight: '90vh', padding: '20px 24px' }}
    >
      <div className="modal-header" style={{ paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
        <h3 id="summary-card-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
          {summaryCardModal.cardLabel}
        </h3>
        <button type="button" aria-label="Cerrar" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div style={{ padding: '4px 0 12px 0', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Cargando...
          </div>
        ) : cardOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Sin pedidos
          </div>
        ) : (
          <div
            className="table-container table-container--sticky"
            role="region"
            aria-labelledby="summary-card-modal-title"
            tabIndex={0}
            style={{ maxHeight: '500px', overflowY: 'auto', flex: 1, scrollbarGutter: 'stable', overscrollBehavior: 'contain' }}
          >
            <table style={{ width: '100%', fontSize: '0.84rem' }}>
              <thead>
                <tr>
                  <th scope="col">Pedido</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Vendedor</th>
                  <th scope="col" className="text-right">Total</th>
                  {showStatusColumn && <th scope="col">Estado</th>}
                  <th scope="col">Ruta</th>
                  <th scope="col"><span className="visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {cardOrders.map((o) => {
                  const statusInfo = getOrderStatusInfo(o);
                  const deliverySummary = formatOrderDeliverySummary(o);
                  const canDeliver = deliverySummary.canMarkPickedUp || deliverySummary.canMarkDirectDelivered;
                  const clientName = o.client?.name || o.persona?.name || 'Sin datos';
                  const city = o.client?.city || o.persona?.city;
                  const clientRoute =
                    o.persona?.saleRoute?.name || o.client?.saleRoute?.name || o.persona?.route || o.client?.route || o.deliveryZone || '-';
                  const driverPlate = [o.deliveryRoute?.driverName, o.deliveryRoute?.vehiclePlate]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <tr key={o.id}>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>#{o.id}</div>
                        {o.invoiceNumber && (
                          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>{o.invoiceNumber}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{clientName}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
                          <span>{o.items?.length || 0} ítems</span>
                          {city && <span>· {city}</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>
                        <div>{new Date(o.createdAt).toLocaleDateString('es-AR')}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {new Date(o.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td>{o.seller?.username || '-'}</td>
                      <td className="text-right" style={{ fontWeight: 700, fontSize: '0.88rem', fontVariantNumeric: 'tabular-nums' }}>
                        ${Math.round(Number(o.totalAmount)).toLocaleString('es-AR')}
                      </td>
                      {showStatusColumn && (
                        <td>
                          <span
                            className={`badge badge-${statusInfo.badgeClass}`}
                            style={{
                              backgroundColor: `${statusInfo.color}15`,
                              color: statusInfo.color,
                              border: `1px solid ${statusInfo.color}30`,
                              fontSize: '0.72rem',
                              padding: '3px 8px',
                              fontWeight: 700,
                              borderRadius: '12px',
                            }}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                      )}
                      <td>
                        {o.deliveryRoute ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                              Viaje #{o.deliveryRoute.id}{o.deliveryRoute.routeName ? ` · ${o.deliveryRoute.routeName}` : ''}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                              {driverPlate || (o.deliveryRoute.status === 'IN_TRANSIT' ? 'En calle' : o.deliveryRoute.status === 'COMPLETED' ? 'Entregado' : 'Asignado')}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {o.deliveryMethod === 'PICKUP' ? 'Retiro local' : clientRoute}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {canDeliver && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={deliveringId !== null}
                              style={{ padding: '4px 10px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, backgroundColor: '#111827', borderColor: '#111827', color: '#ffffff' }}
                              onClick={() => void handleQuickDeliver(o)}
                            >
                              <Check size={13} aria-hidden="true" />
                              {deliveringId === o.id ? '...' : 'Entregar'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
                            onClick={() => {
                              onSelectOrderDetails(o);
                              onClose();
                            }}
                          >
                            <Eye size={13} aria-hidden="true" /> Ver
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: 0 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onNavigateOperationalTab(isFulfillmentStage ? 'fulfillment' : 'entregas')}
        >
          {isFulfillmentStage ? 'Ir a Armado' : 'Ir a Entregas'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => onViewAllInOrdersTab(summaryCardModal.cardKey)}>
          Ver en Historial
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </NativeModalDialog>
  );
};
