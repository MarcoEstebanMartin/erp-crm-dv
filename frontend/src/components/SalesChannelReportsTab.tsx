import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  Store, 
  Truck, 
  Globe, 
  Phone, 
  ShoppingBag, 
  Users, 
  CreditCard, 
  TrendingUp, 
  RefreshCw,
  Layers,
  Calendar
} from 'lucide-react';

interface ChannelData {
  channel: 'MOSTRADOR' | 'PREVENTA_RUTA' | 'TIENDA_WEB' | 'TELEFONICO';
  sales: number;
  cost: number;
  profit: number;
  ordersCount: number;
  averageTicket: number;
  percentage: number;
}

interface MostradorProduct {
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

interface MostradorClient {
  id: number;
  name: string;
  city: string | null;
  ordersCount: number;
  totalAmount: number;
}

interface MostradorPaymentMethod {
  method: string;
  amount: number;
}

export default function SalesChannelReportsTab() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<{
    channels: ChannelData[];
    mostrador: {
      totalSales: number;
      totalOrders: number;
      averageTicket: number;
      topProducts: MostradorProduct[];
      topClients: MostradorClient[];
      paymentMethods: MostradorPaymentMethod[];
    };
  } | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.getSalesChannelStats(year, month);
      if (res && res.data) {
        setData(res.data);
      }
    } catch (e) {
      console.error('Error al cargar estadísticas de canales de venta:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [year, month]);

  const getChannelInfo = (channelKey: string) => {
    switch (channelKey) {
      case 'MOSTRADOR':
        return { name: 'Venta Depósito / Mostrador', icon: Store, color: '#E30613', bg: 'rgba(227, 6, 19, 0.08)' };
      case 'PREVENTA_RUTA':
        return { name: 'Preventa en Ruta', icon: Truck, color: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)' };
      case 'TIENDA_WEB':
        return { name: 'Tienda Web / Autogestión', icon: Globe, color: '#059669', bg: 'rgba(5, 150, 105, 0.08)' };
      case 'TELEFONICO':
        return { name: 'Venta Telefónica / Central', icon: Phone, color: '#d97706', bg: 'rgba(217, 119, 6, 0.08)' };
      default:
        return { name: channelKey, icon: Layers, color: '#64748b', bg: 'rgba(100, 116, 139, 0.08)' };
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH': return { label: 'Efectivo en Caja Depósito', color: '#10b981' };
      case 'BANK_TRANSFER': return { label: 'Transferencia Bancaria', color: '#3b82f6' };
      case 'CHECK': return { label: 'Cheque / Echeq', color: '#8b5cf6' };
      case 'CTA_CORRIENTE': return { label: 'Cuenta Corriente (A pagar)', color: '#f59e0b' };
      default: return { label: 'Otros Medios', color: '#64748b' };
    }
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const mostradorChannel = data?.channels.find(c => c.channel === 'MOSTRADOR');
  const rutaChannel = data?.channels.find(c => c.channel === 'PREVENTA_RUTA');
  const totalSalesAllChannels = data?.channels.reduce((acc, c) => acc + c.sales, 0) || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* HEADER & FILTROS DE PERÍODO */}
      <div 
        style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: '16px',
          padding: '20px', 
          backgroundColor: '#ffffff', 
          borderRadius: '12px', 
          border: '1px solid var(--border-color, #e2e8f0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)' 
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(227, 6, 19, 0.08)', color: '#E30613' }}>
              <Store size={22} />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
              Estadísticas de Venta de Depósito & Canales
            </h2>
          </div>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary, #64748b)', margin: '4px 0 0 0' }}>
            Análisis comercial detallado de ventas en mostrador/depósito presencial versus preventa en ruta y tienda web.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-light, #f8fafc)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <Calendar size={15} color="var(--text-secondary, #64748b)" />
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '0.84rem',
                fontWeight: 600,
                color: 'var(--text-primary, #0f172a)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {monthNames.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '0.84rem',
                fontWeight: 600,
                color: 'var(--text-primary, #0f172a)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchStats}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 12px',
              backgroundColor: 'var(--bg-light, #f8fafc)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '8px',
              color: 'var(--text-primary, #0f172a)',
              cursor: 'pointer',
              fontSize: '0.83rem',
              fontWeight: 500,
              transition: 'all 0.15s ease'
            }}
            title="Recargar datos"
          >
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none', marginRight: '6px' }} />
            Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary, #64748b)', marginBottom: '12px' }} />
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
            Cargando analíticas del depósito y canales...
          </span>
        </div>
      ) : data ? (
        <>
          {/* CARDS KPIS PRINCIPALES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
            {/* Card 1: Mostrador / Depósito */}
            <div 
              style={{ 
                padding: '20px', 
                backgroundColor: '#ffffff', 
                borderRadius: '12px', 
                border: '1px solid #E30613',
                boxShadow: '0 2px 8px rgba(227, 6, 19, 0.06)',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#E30613' }}>
                  Mostrador / Depósito
                </span>
                <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(227, 6, 19, 0.08)', color: '#E30613' }}>
                  <Store size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
                ${data.mostrador.totalSales.toLocaleString('es-AR')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
                <span>{data.mostrador.totalOrders} compras presenciales</span>
                <span style={{ fontWeight: 700, color: '#E30613' }}>
                  {mostradorChannel?.percentage || 0}% del total
                </span>
              </div>
            </div>

            {/* Card 2: Preventa en Ruta */}
            <div 
              style={{ 
                padding: '20px', 
                backgroundColor: '#ffffff', 
                borderRadius: '12px', 
                border: '1px solid var(--border-color, #e2e8f0)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#2563eb' }}>
                  Preventa en Ruta
                </span>
                <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: '#2563eb' }}>
                  <Truck size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
                ${(rutaChannel?.sales || 0).toLocaleString('es-AR')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
                <span>{rutaChannel?.ordersCount || 0} pedidos tomados</span>
                <span style={{ fontWeight: 700, color: '#2563eb' }}>
                  {rutaChannel?.percentage || 0}% del total
                </span>
              </div>
            </div>

            {/* Card 3: Ticket Promedio Mostrador */}
            <div 
              style={{ 
                padding: '20px', 
                backgroundColor: '#ffffff', 
                borderRadius: '12px', 
                border: '1px solid var(--border-color, #e2e8f0)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#059669' }}>
                  Ticket Prom. Mostrador
                </span>
                <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(5, 150, 105, 0.08)', color: '#059669' }}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
                ${data.mostrador.averageTicket.toLocaleString('es-AR')}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
                Promedio por cliente que asiste al local
              </div>
            </div>

            {/* Card 4: Total Todos los Canales */}
            <div 
              style={{ 
                padding: '20px', 
                backgroundColor: '#ffffff', 
                borderRadius: '12px', 
                border: '1px solid var(--border-color, #e2e8f0)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>
                  Total Todos los Canales
                </span>
                <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(100, 116, 139, 0.08)', color: '#64748b' }}>
                  <Layers size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
                ${totalSalesAllChannels.toLocaleString('es-AR')}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
                Consolidado mensual entregado
              </div>
            </div>
          </div>

          {/* BARRA VISUAL DE DISTRIBUCIÓN DE CANALES */}
          <div 
            style={{ 
              padding: '20px', 
              backgroundColor: '#ffffff', 
              borderRadius: '12px', 
              border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <h3 style={{ fontSize: '0.84rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary, #64748b)', margin: '0 0 12px 0' }}>
              Distribución Porcentual de Ventas por Canal
            </h3>

            {/* Barra segmentada */}
            <div style={{ height: '16px', width: '100%', backgroundColor: 'var(--bg-light, #f1f5f9)', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
              {data.channels.map((c, i) => {
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

            {/* Leyenda explicativa */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
              {data.channels.map((c, i) => {
                const info = getChannelInfo(c.channel);
                const Icon = info.icon;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: info.bg, color: info.color }}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{info.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
                        ${c.sales.toLocaleString('es-AR')} ({c.percentage}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TABLAS DETALLADAS: TOP PRODUCTOS MOSTRADOR & TOP CLIENTES MOSTRADOR */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {/* Top Productos más vendidos en Mostrador */}
            <div 
              style={{ 
                padding: '20px', 
                backgroundColor: '#ffffff', 
                borderRadius: '12px', 
                border: '1px solid var(--border-color, #e2e8f0)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingBag size={18} color="#E30613" />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                    Top Productos en Mostrador / Depósito
                  </h3>
                </div>
              </div>

              {data.mostrador.topProducts.length === 0 ? (
                <div style={{ padding: '30px 0', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>
                  No hay ventas registradas en mostrador para este período.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', color: 'var(--text-secondary, #64748b)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                        <th style={{ paddingBottom: '8px', fontWeight: 700 }}>Producto</th>
                        <th style={{ paddingBottom: '8px', fontWeight: 700, textAlign: 'center' }}>Unidades / Kilos</th>
                        <th style={{ paddingBottom: '8px', fontWeight: 700, textAlign: 'right' }}>Facturación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.mostrador.topProducts.map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                          <td style={{ padding: '10px 4px 10px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', width: '16px', textAlign: 'center' }}>{index + 1}</span>
                              {item.product.imageUrl ? (
                                <img src={item.product.imageUrl.startsWith('http') ? item.product.imageUrl : (item.product.imageUrl.startsWith('/') ? `${item.product.imageUrl}?v=1.3` : `/uploads/products/${item.product.imageUrl}?v=1.3`)} alt="" style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                              ) : (
                                <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>
                                  {item.product.sku.slice(0, 3)}
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{item.product.name}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)', fontFamily: 'monospace' }}>SKU: {item.product.sku}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '10px 4px', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                            {item.product.isPesable && item.weightSold > 0 ? (
                              <span>{item.weightSold.toFixed(2)} kg</span>
                            ) : (
                              <span>{item.unitsSold} u</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 0 10px 4px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                            ${item.totalRevenue.toLocaleString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Clientes de Mostrador */}
            <div 
              style={{ 
                padding: '20px', 
                backgroundColor: '#ffffff', 
                borderRadius: '12px', 
                border: '1px solid var(--border-color, #e2e8f0)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} color="#E30613" />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                    Top Clientes de Depósito / Mostrador
                  </h3>
                </div>
              </div>

              {data.mostrador.topClients.length === 0 ? (
                <div style={{ padding: '30px 0', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>
                  No hay clientes registrados en mostrador para este período.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', color: 'var(--text-secondary, #64748b)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                        <th style={{ paddingBottom: '8px', fontWeight: 700 }}>Cliente</th>
                        <th style={{ paddingBottom: '8px', fontWeight: 700, textAlign: 'center' }}>Compras</th>
                        <th style={{ paddingBottom: '8px', fontWeight: 700, textAlign: 'right' }}>Total Facturado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.mostrador.topClients.map((client, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                          <td style={{ padding: '10px 4px 10px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', width: '16px', textAlign: 'center' }}>{index + 1}</span>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{client.name}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)' }}>{client.city || 'Sin Localidad'}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                            <span style={{ padding: '3px 8px', borderRadius: '999px', backgroundColor: 'var(--bg-light, #f1f5f9)', color: 'var(--text-primary, #0f172a)', fontSize: '0.75rem', fontWeight: 600 }}>
                              {client.ordersCount} visitas
                            </span>
                          </td>
                          <td style={{ padding: '10px 0 10px 4px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                            ${client.totalAmount.toLocaleString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* FORMAS DE PAGO EN DEPOSITO MOSTRADOR */}
          <div 
            style={{ 
              padding: '20px', 
              backgroundColor: '#ffffff', 
              borderRadius: '12px', 
              border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <CreditCard size={18} color="#E30613" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                Composición de Pagos en Depósito / Mostrador
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {data.mostrador.paymentMethods.map((pm, i) => {
                const info = getPaymentMethodLabel(pm.method);
                const percent = data.mostrador.totalSales > 0 ? Math.round((pm.amount / data.mostrador.totalSales) * 100) : 0;
                return (
                  <div 
                    key={i} 
                    style={{ 
                      padding: '14px', 
                      backgroundColor: 'var(--bg-light, #f8fafc)', 
                      border: '1px solid var(--border-color, #e2e8f0)', 
                      borderRadius: '8px' 
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)', marginBottom: '6px' }}>
                      <span>{info.label}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>{percent}%</span>
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', marginBottom: '8px' }}>
                      ${pm.amount.toLocaleString('es-AR')}
                    </div>
                    <div style={{ height: '6px', width: '100%', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', backgroundColor: info.color, width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
