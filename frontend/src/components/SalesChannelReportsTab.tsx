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
  Layers
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
        return { name: 'Venta Depósito / Mostrador', icon: Store, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
      case 'PREVENTA_RUTA':
        return { name: 'Preventa en Ruta', icon: Truck, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
      case 'TIENDA_WEB':
        return { name: 'Tienda Web / Autogestión', icon: Globe, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
      case 'TELEFONICO':
        return { name: 'Venta Telefónica / Central', icon: Phone, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
      default:
        return { name: channelKey, icon: Layers, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' };
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH': return { label: 'Efectivo en Caja Depósito', color: 'bg-emerald-500' };
      case 'BANK_TRANSFER': return { label: 'Transferencia Bancaria', color: 'bg-blue-500' };
      case 'CHECK': return { label: 'Cheque / Echeq', color: 'bg-purple-500' };
      case 'CTA_CORRIENTE': return { label: 'Cuenta Corriente (A pagar)', color: 'bg-amber-500' };
      default: return { label: 'Otros Medios', color: 'bg-slate-500' };
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
    <div className="space-y-6 text-slate-100 font-sans">
      {/* HEADER & FILTROS DE PERÍODO */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-rose-500" />
            <h2 className="text-xl font-semibold tracking-tight text-white">Estadísticas de Venta de Depósito & Canales</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Análisis comercial de ventas en mostrador/depósito presencial vs. preventa móvil y tienda digital.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-rose-500 transition-colors"
          >
            {monthNames.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>{name}</option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-rose-500 transition-colors"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-all active:scale-95 disabled:opacity-50"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-500' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800 rounded-xl">
          <RefreshCw className="w-8 h-8 animate-spin text-rose-500 mb-3" />
          <p className="text-xs text-slate-400 font-medium">Procesando estadísticas de canales y depósito...</p>
        </div>
      ) : data ? (
        <>
          {/* CARDS KPIS DESTACADOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Venta Depósito / Mostrador */}
            <div className="bg-slate-900/70 border border-rose-500/30 p-5 rounded-xl backdrop-blur-sm hover:border-rose-500/50 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Mostrador / Depósito</span>
                <div className="p-2 bg-rose-500/10 rounded-lg border border-rose-500/20 text-rose-500 group-hover:scale-105 transition-transform">
                  <Store className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight mb-1">
                ${data.mostrador.totalSales.toLocaleString('es-AR')}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{data.mostrador.totalOrders} compras presenciales</span>
                <span className="font-medium text-rose-400">
                  {mostradorChannel?.percentage || 0}% del total
                </span>
              </div>
            </div>

            {/* Card 2: Preventa en Ruta */}
            <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-xl backdrop-blur-sm hover:border-blue-500/30 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Preventa en Ruta</span>
                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400 group-hover:scale-105 transition-transform">
                  <Truck className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight mb-1">
                ${(rutaChannel?.sales || 0).toLocaleString('es-AR')}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{rutaChannel?.ordersCount || 0} pedidos tomados</span>
                <span className="font-medium text-blue-400">
                  {rutaChannel?.percentage || 0}% del total
                </span>
              </div>
            </div>

            {/* Card 3: Ticket Promedio Mostrador */}
            <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-xl backdrop-blur-sm hover:border-emerald-500/30 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Ticket Prom. Mostrador</span>
                <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400 group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight mb-1">
                ${data.mostrador.averageTicket.toLocaleString('es-AR')}
              </div>
              <div className="text-xs text-slate-400">
                Promedio por cliente que asiste al local
              </div>
            </div>

            {/* Card 4: Facturación Global Consolidada */}
            <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-xl backdrop-blur-sm hover:border-slate-700 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Todos los Canales</span>
                <div className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-300 group-hover:scale-105 transition-transform">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight mb-1">
                ${totalSalesAllChannels.toLocaleString('es-AR')}
              </div>
              <div className="text-xs text-slate-400">
                Consolidado mensual entregado
              </div>
            </div>
          </div>

          {/* BARRA DE DISTRIBUCIÓN PORCENTUAL DE CANALES */}
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl backdrop-blur-md">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Distribución Porcentual de Ventas por Canal
            </h3>
            <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden flex">
              {data.channels.map((c, i) => {
                if (c.percentage <= 0) return null;
                const info = getChannelInfo(c.channel);
                const bgClass = c.channel === 'MOSTRADOR' ? 'bg-rose-500' : c.channel === 'PREVENTA_RUTA' ? 'bg-blue-500' : c.channel === 'TIENDA_WEB' ? 'bg-emerald-500' : 'bg-amber-500';
                return (
                  <div
                    key={i}
                    style={{ width: `${c.percentage}%` }}
                    className={`${bgClass} transition-all duration-500 hover:opacity-90 relative group`}
                    title={`${info.name}: ${c.percentage}% ($${c.sales.toLocaleString('es-AR')})`}
                  />
                );
              })}
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
              {data.channels.map((c, i) => {
                const info = getChannelInfo(c.channel);
                const Icon = info.icon;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${info.bg} ${info.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-200">{info.name}</div>
                      <div className="text-slate-400 text-[11px]">
                        ${c.sales.toLocaleString('es-AR')} ({c.percentage}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TABLAS DETALLADAS: TOP PRODUCTOS MOSTRADOR & TOP CLIENTES MOSTRADOR */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Productos más vendidos en Mostrador */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-rose-500" />
                  <h3 className="text-sm font-semibold text-white">Top Productos en Depósito / Mostrador</h3>
                </div>
                <span className="text-[11px] text-slate-400">Mayor rotación en retiro presencial</span>
              </div>

              {data.mostrador.topProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No hay ventas registradas en mostrador para este período.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                        <th className="pb-2 font-medium">Producto</th>
                        <th className="pb-2 font-medium text-center">Unidades / Kilos</th>
                        <th className="pb-2 font-medium text-right">Facturación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {data.mostrador.topProducts.map((item, index) => (
                        <tr key={index} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 pr-2">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[10px] font-bold text-slate-500 w-4 text-center">{index + 1}</span>
                              {item.product.imageUrl ? (
                                <img src={item.product.imageUrl} alt="" className="w-7 h-7 rounded object-cover border border-slate-800" />
                              ) : (
                                <div className="w-7 h-7 rounded bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-[10px]">
                                  {item.product.sku.slice(0, 3)}
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-slate-200 line-clamp-1">{item.product.name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">SKU: {item.product.sku}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 text-center font-medium text-slate-300">
                            {item.product.isPesable && item.weightSold > 0 ? (
                              <span>{item.weightSold.toFixed(2)} kg</span>
                            ) : (
                              <span>{item.unitsSold} u</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right font-semibold text-slate-100">
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
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-rose-500" />
                  <h3 className="text-sm font-semibold text-white">Top Clientes de Depósito / Mostrador</h3>
                </div>
                <span className="text-[11px] text-slate-400">Clientes que compran en local</span>
              </div>

              {data.mostrador.topClients.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No hay clientes registrados en mostrador para este período.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                        <th className="pb-2 font-medium">Cliente</th>
                        <th className="pb-2 font-medium text-center">Compras</th>
                        <th className="pb-2 font-medium text-right">Total Vendido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {data.mostrador.topClients.map((client, index) => (
                        <tr key={index} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 pr-2">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[10px] font-bold text-slate-500 w-4 text-center">{index + 1}</span>
                              <div>
                                <div className="font-medium text-slate-200 line-clamp-1">{client.name}</div>
                                <div className="text-[10px] text-slate-500">{client.city || 'Sin Localidad'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px]">
                              {client.ordersCount} visitas
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-semibold text-slate-100">
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
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl backdrop-blur-md">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-semibold text-white">Composición de Pagos en Depósito / Mostrador</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.mostrador.paymentMethods.map((pm, i) => {
                const info = getPaymentMethodLabel(pm.method);
                const percent = data.mostrador.totalSales > 0 ? Math.round((pm.amount / data.mostrador.totalSales) * 100) : 0;
                return (
                  <div key={i} className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-lg">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span>{info.label}</span>
                      <span className="font-medium text-slate-300">{percent}%</span>
                    </div>
                    <div className="text-lg font-bold text-white mb-2">
                      ${pm.amount.toLocaleString('es-AR')}
                    </div>
                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full ${info.color}`} style={{ width: `${percent}%` }} />
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
