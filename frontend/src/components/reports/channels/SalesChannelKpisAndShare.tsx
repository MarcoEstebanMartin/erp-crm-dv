import type { FC } from 'react';
import { Globe, Layers, Phone, Store, TrendingUp, Truck } from 'lucide-react';

export interface ChannelData {
  channel: 'MOSTRADOR' | 'PREVENTA_RUTA' | 'TIENDA_WEB' | 'TELEFONICO';
  sales: number;
  cost: number;
  profit: number;
  ordersCount: number;
  averageTicket: number;
  percentage: number;
}

export interface MostradorProduct {
  product: {
    id: number;
    sku: string;
    name: string;
    imageUrl?: string;
    commercialCategory?: string;
    isPesable?: boolean;
  };
  unitsSold: number;
  weightSold: number;
  totalRevenue: number;
}

export interface MostradorClient {
  id: number;
  name: string;
  city: string | null;
  ordersCount: number;
  totalAmount: number;
}

export interface MostradorPaymentMethod {
  method: string;
  amount: number;
}

const getChannelInfo = (channelKey: string) => {
  switch (channelKey) {
    case 'MOSTRADOR':
      return { name: 'Mostrador / Depósito', icon: Store, color: '#E30613', bg: 'rgba(227, 6, 19, 0.08)' };
    case 'PREVENTA_RUTA':
      return { name: 'Preventa en Ruta', icon: Truck, color: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)' };
    case 'TIENDA_WEB':
      return { name: 'Tienda Web', icon: Globe, color: '#059669', bg: 'rgba(5, 150, 105, 0.08)' };
    case 'TELEFONICO':
      return { name: 'Venta Telefónica', icon: Phone, color: '#d97706', bg: 'rgba(217, 119, 6, 0.08)' };
    default:
      return { name: channelKey, icon: Layers, color: '#64748b', bg: 'rgba(100, 116, 139, 0.08)' };
  }
};

interface SalesChannelKpisAndShareProps {
  channels: ChannelData[];
  mostradorTotalSales: number;
  mostradorTotalOrders: number;
  mostradorAvgTicket: number;
}

export const SalesChannelKpisAndShare: FC<SalesChannelKpisAndShareProps> = ({
  channels,
  mostradorTotalSales,
  mostradorTotalOrders,
  mostradorAvgTicket,
}) => {
  const mostradorChannel = channels.find(c => c.channel === 'MOSTRADOR');
  const rutaChannel = channels.find(c => c.channel === 'PREVENTA_RUTA');
  const totalSalesAllChannels = channels.reduce((acc, c) => acc + c.sales, 0) || 0;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E30613', boxShadow: '0 2px 8px rgba(227, 6, 19, 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#E30613' }}>Mostrador</span>
            <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(227, 6, 19, 0.08)', color: '#E30613' }}>
              <Store size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            ${mostradorTotalSales.toLocaleString('es-AR')}
          </div>
          <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
            <span>{mostradorTotalOrders} ventas</span>
            <span style={{ fontWeight: 700, color: '#E30613' }}>{mostradorChannel?.percentage || 0}%</span>
          </div>
        </div>

        <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2563eb' }}>Preventa en ruta</span>
            <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: '#2563eb' }}>
              <Truck size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            ${(rutaChannel?.sales || 0).toLocaleString('es-AR')}
          </div>
          <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
            <span>{rutaChannel?.ordersCount || 0} pedidos</span>
            <span style={{ fontWeight: 700, color: '#2563eb' }}>{rutaChannel?.percentage || 0}%</span>
          </div>
        </div>

        <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#059669' }}>Ticket prom. mostrador</span>
            <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(5, 150, 105, 0.08)', color: '#059669' }}>
              <TrendingUp size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', letterSpacing: '-0.5px' }}>
            ${mostradorAvgTicket.toLocaleString('es-AR')}
          </div>
        </div>

        <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Total canales</span>
            <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(100, 116, 139, 0.08)', color: '#64748b' }}>
              <Layers size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', letterSpacing: '-0.5px' }}>
            ${totalSalesAllChannels.toLocaleString('es-AR')}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <h3 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-secondary, #64748b)', margin: '0 0 12px 0' }}>
          Participación por canal
        </h3>

        <div style={{ height: '16px', width: '100%', backgroundColor: 'var(--bg-light, #f1f5f9)', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
          {channels.map((c, i) => {
            if (c.percentage <= 0) return null;
            const bg = c.channel === 'MOSTRADOR' ? '#E30613' : c.channel === 'PREVENTA_RUTA' ? '#2563eb' : c.channel === 'TIENDA_WEB' ? '#059669' : '#d97706';
            const info = getChannelInfo(c.channel);
            return (
              <div
                key={i}
                style={{ width: `${c.percentage}%`, backgroundColor: bg, height: '100%', transition: 'all 0.3s ease' }}
                title={`${info.name}: ${c.percentage}% ($${c.sales.toLocaleString('es-AR')})`}
              />
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
          {channels.map((c, i) => {
            const info = getChannelInfo(c.channel);
            const Icon = info.icon;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: info.bg, color: info.color }}>
                  <Icon size={16} aria-hidden="true" />
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{info.name}</div>
                  <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
                    ${c.sales.toLocaleString('es-AR')} ({c.percentage}%)
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
