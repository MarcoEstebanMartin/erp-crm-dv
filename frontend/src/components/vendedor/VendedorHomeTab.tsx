import React from 'react';
import {
  ArrowRight,
  History,
  Navigation,
  Receipt,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import type { SaleRoute } from '../../types';
import type { AssignableDeliveryRoute } from '../reparto/repartoDriverMatcher';

interface VendedorHomeTabProps {
  vendedorRoutes: SaleRoute[];
  selectedRouteId: number | null;
  cartCount: number;
  canDeliver?: boolean;
  activeDeliveryRoutes?: AssignableDeliveryRoute[];
  onGoToSell: () => void;
  onGoToRoute: () => void;
  onGoToCollect: () => void;
  onGoToHistory: () => void;
  onGoToReparto?: () => void;
}

/**
 * Pantalla inicial minimalista del vendedor con dos acciones principales
 * (vender a un cliente o comenzar ruta) y accesos secundarios directos.
 */
export const VendedorHomeTab: React.FC<VendedorHomeTabProps> = ({
  vendedorRoutes,
  selectedRouteId,
  cartCount,
  canDeliver = false,
  activeDeliveryRoutes = [],
  onGoToSell,
  onGoToRoute,
  onGoToCollect,
  onGoToHistory,
  onGoToReparto,
}) => {
  const activeRoute = vendedorRoutes.find((r) => r.id === selectedRouteId) || vendedorRoutes[0];
  const routeBadge = activeRoute ? `${activeRoute.name}${activeRoute.dayOfWeek ? ` · ${activeRoute.dayOfWeek}` : ''}` : 'Sin ruta';
  const primaryTrip = activeDeliveryRoutes[0] || null;
  const primaryStopsCount = Array.isArray(primaryTrip?.orders) ? primaryTrip.orders.length : 0;
  const tripSubtitle = primaryTrip
    ? [
        `${primaryStopsCount} ${primaryStopsCount === 1 ? 'parada' : 'paradas'}`,
        primaryTrip.vehiclePlate ? String(primaryTrip.vehiclePlate).trim() : null,
        activeDeliveryRoutes.length > 1 ? `+${activeDeliveryRoutes.length - 1} más` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div className="vendedor-home-shell">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {canDeliver && primaryTrip && onGoToReparto && (
          <button
            type="button"
            className="vendedor-home-reparto-card"
            onClick={onGoToReparto}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '18px',
              borderRadius: '12px',
              border: '1px solid #4338CA',
              backgroundColor: '#EEF2FF',
              color: '#1E1B4B',
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: '0 2px 6px rgba(67, 56, 202, 0.12)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#4338CA', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Truck size={22} aria-hidden="true" />
              </div>
              <div>
                <div style={{ fontSize: '1.02rem', fontWeight: 700, lineHeight: 1.2 }}>
                  {primaryTrip.status === 'IN_TRANSIT' ? 'Viaje en curso' : 'Viaje asignado hoy'}
                </div>
                <div className="tabular-nums" style={{ fontSize: '0.8rem', color: '#4338CA', fontWeight: 600, marginTop: '4px' }}>
                  {tripSubtitle}
                </div>
              </div>
            </div>
            <ArrowRight size={20} aria-hidden="true" style={{ flexShrink: 0, color: '#4338CA' }} />
          </button>
        )}
        <button
          type="button"
          className="vendedor-home-action-btn"
          onClick={onGoToSell}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '20px 18px',
            borderRadius: '12px',
            border: '1px solid #111827',
            backgroundColor: '#111827',
            color: '#ffffff',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: '0 2px 8px rgba(17, 24, 39, 0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShoppingCart size={22} aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>
                Vender a un cliente
              </div>
              {cartCount > 0 && (
                <div className="tabular-nums" style={{ fontSize: '0.78rem', color: '#86efac', fontWeight: 600, marginTop: '4px' }}>
                  {cartCount} {cartCount === 1 ? 'producto' : 'productos'} en carrito
                </div>
              )}
            </div>
          </div>
          <ArrowRight size={20} aria-hidden="true" style={{ flexShrink: 0, opacity: 0.85 }} />
        </button>

        <button
          type="button"
          className="vendedor-home-action-btn"
          onClick={onGoToRoute}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '20px 18px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            backgroundColor: '#ffffff',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: 'rgba(var(--color-corp-red-rgb), 0.08)', color: 'var(--color-corp-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Navigation size={22} aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>
                Comenzar ruta de venta
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '4px' }}>
                {routeBadge}
              </div>
            </div>
          </div>
          <ArrowRight size={20} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
        <button
          type="button"
          className="vendedor-home-action-btn"
          onClick={onGoToCollect}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '16px 8px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            backgroundColor: '#ffffff',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 600,
          }}
        >
          <Receipt size={20} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />
          <span>Cobrar</span>
        </button>

        <button
          type="button"
          className="vendedor-home-action-btn"
          onClick={onGoToHistory}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '16px 8px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            backgroundColor: '#ffffff',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 600,
          }}
        >
          <History size={20} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />
          <span>Historial</span>
        </button>
      </div>
    </div>
  );
};
