import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Store, Truck } from 'lucide-react';
import { api } from '../../utils/api';
import { ORDERS_QUERY_KEYS, PENDING_ROUTES_QUERY_KEY } from '../../hooks/queries';
import {
  formatDeliveryRouteOptionLabel,
  formatOrderDeliverySummary,
  parseDeliverySelectionValue,
} from '../../utils/orderDeliveryHelpers';

interface OrderDeliveryBadgeControlProps {
  order: any;
  pendingRoutes?: any[];
  compact?: boolean;
  readOnly?: boolean;
  onUpdated?: (updatedOrder: any) => void;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

export function OrderDeliveryBadgeControl({
  order,
  pendingRoutes = [],
  compact = false,
  readOnly = false,
  onUpdated,
  onError,
  onSuccess,
}: OrderDeliveryBadgeControlProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  if (!order?.id) return null;

  const summary = formatOrderDeliverySummary(order);
  const routeOptions = [...pendingRoutes];
  if (
    summary.routeId &&
    summary.routeStatus === 'PENDING' &&
    !routeOptions.some((r) => Number(r.id) === summary.routeId)
  ) {
    routeOptions.unshift(
      order.deliveryRoute || {
        id: summary.routeId,
      },
    );
  }

  const invalidateDeliveryCaches = () => {
    void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEYS.all });
    void queryClient.invalidateQueries({ queryKey: PENDING_ROUTES_QUERY_KEY });
  };

  const handleSelectionChange = async (nextValue: string) => {
    if (saving || summary.isLocked) return;
    const payload = parseDeliverySelectionValue(nextValue);
    setSaving(true);
    try {
      const updatedOrder = await api.updateOrderDelivery(order.id, payload);
      invalidateDeliveryCaches();
      onSuccess?.(`Entrega actualizada en pedido #${order.id}.`);
      onUpdated?.(updatedOrder);
    } catch (err: any) {
      onError?.(err?.message || 'Error al actualizar modalidad de entrega.');
    } finally {
      setSaving(false);
    }
  };

  const canDeliverNow = summary.canMarkPickedUp || summary.canMarkDirectDelivered;

  const handleMarkDelivered = async () => {
    if (saving || !canDeliverNow) return;
    setSaving(true);
    try {
      const updatedOrder = await api.updateOrderDelivery(
        order.id,
        summary.canMarkPickedUp
          ? { deliveryMethod: 'PICKUP', markPickedUp: true }
          : { deliveryMethod: 'DELIVERY', markDelivered: true },
      );
      invalidateDeliveryCaches();
      onSuccess?.(
        summary.canMarkPickedUp
          ? `Pedido #${order.id} entregado en local.`
          : `Pedido #${order.id} entregado.`,
      );
      onUpdated?.(updatedOrder);
    } catch (err: any) {
      onError?.(err?.message || 'Error al registrar la entrega.');
    } finally {
      setSaving(false);
    }
  };

  if (readOnly || summary.isLocked) {
    const Icon = summary.method === 'PICKUP' ? Store : Truck;
    return (
      <span
        className="badge-minimal"
        title={summary.subLabel || summary.badgeLabel}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: compact ? '0.72rem' : '0.8rem',
          padding: compact ? '2px 7px' : '4px 9px',
        }}
      >
        <Icon size={12} aria-hidden="true" />
        <span>{summary.badgeLabel}</span>
      </span>
    );
  }

  const Icon = summary.method === 'PICKUP' ? Store : Truck;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: compact ? 'nowrap' : 'wrap',
        maxWidth: '100%',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          minWidth: 0,
        }}
      >
        <Icon
          size={compact ? 13 : 15}
          aria-hidden="true"
          style={{ color: summary.method === 'PICKUP' ? '#111827' : '#4B5563', flexShrink: 0 }}
        />
        <select
          className="select"
          aria-label={`Modalidad de entrega pedido #${order.id}`}
          value={summary.selectValue}
          disabled={saving}
          onChange={(e) => void handleSelectionChange(e.target.value)}
          title={summary.subLabel || summary.badgeLabel}
          style={{
            height: compact ? '26px' : '32px',
            padding: compact ? '2px 22px 2px 7px' : '4px 26px 4px 9px',
            fontSize: compact ? '0.73rem' : '0.82rem',
            fontWeight: summary.routeId || summary.method === 'PICKUP' ? 600 : 500,
            minWidth: compact ? '138px' : '190px',
            maxWidth: compact ? '195px' : '280px',
            backgroundColor: summary.method === 'PICKUP' ? '#F3F4F6' : '#FFFFFF',
            color: '#111827',
            borderColor: '#D1D5DB',
          }}
        >
          <option value="DELIVERY_UNASSIGNED">Reparto · Sin viaje</option>
          <option value="PICKUP">{summary.isPickedUp ? 'Retirado en local' : 'Retiro local'}</option>
          {routeOptions.length > 0 && (
            <optgroup label="Viajes pendientes">
              {routeOptions.map((route) => (
                <option key={route.id} value={`ROUTE:${route.id}`}>
                  {formatDeliveryRouteOptionLabel(route)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {canDeliverNow && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving}
          onClick={() => void handleMarkDelivered()}
          title={summary.canMarkPickedUp ? 'Registrar entrega por mostrador' : 'Registrar entrega directa'}
          style={{
            height: compact ? '26px' : '32px',
            padding: compact ? '0 8px' : '0 12px',
            fontSize: compact ? '0.72rem' : '0.8rem',
            fontWeight: 600,
            backgroundColor: '#111827',
            borderColor: '#111827',
            color: '#FFFFFF',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Check size={12} aria-hidden="true" />
          <span>{saving ? '...' : 'Entregar'}</span>
        </button>
      )}
    </div>
  );
}
