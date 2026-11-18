import { useEffect, useState } from 'react';
import { Calendar, RefreshCw, Store } from 'lucide-react';
import { api } from '../utils/api';
import {
  SalesChannelKpisAndShare,
  type ChannelData,
  type MostradorClient,
  type MostradorPaymentMethod,
  type MostradorProduct
} from './reports/channels/SalesChannelKpisAndShare';
import { SalesChannelMostradorTables } from './reports/channels/SalesChannelMostradorTables';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

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
      const payload = res?.channels ? res : res?.data;
      if (payload) {
        setData(payload);
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

  const yearOptions = Array.from(new Set([2025, 2026, 2027, new Date().getFullYear()])).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(227, 6, 19, 0.08)', color: '#E30613' }}>
            <Store size={20} aria-hidden="true" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
            Canales de Venta
          </h2>
        </div>

        <search aria-label="Período de canales" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-light, #f8fafc)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <Calendar size={15} color="var(--text-secondary, #64748b)" aria-hidden="true" />
            <label htmlFor="channels-month-select" className="visually-hidden">Mes</label>
            <select
              id="channels-month-select"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              style={{ backgroundColor: 'transparent', border: 'none', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)', outline: 'none', cursor: 'pointer' }}
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </select>

            <label htmlFor="channels-year-select" className="visually-hidden">Año</label>
            <select
              id="channels-year-select"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="tabular-nums"
              style={{ backgroundColor: 'transparent', border: 'none', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)', outline: 'none', cursor: 'pointer' }}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={fetchStats}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-light, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', color: 'var(--text-primary, #0f172a)', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 500 }}
          >
            <RefreshCw size={15} aria-hidden="true" style={{ animation: loading ? 'spin 1s linear infinite' : 'none', marginRight: '6px' }} />
            Actualizar
          </button>
        </search>
      </div>

      {loading ? (
        <div role="status" style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
          <RefreshCw size={28} aria-hidden="true" style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary, #64748b)', marginBottom: '10px' }} />
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
            Cargando...
          </span>
        </div>
      ) : data ? (
        <>
          <SalesChannelKpisAndShare
            channels={data.channels}
            mostradorTotalSales={data.mostrador.totalSales}
            mostradorTotalOrders={data.mostrador.totalOrders}
            mostradorAvgTicket={data.mostrador.averageTicket}
          />
          <SalesChannelMostradorTables
            topProducts={data.mostrador.topProducts}
            topClients={data.mostrador.topClients}
            paymentMethods={data.mostrador.paymentMethods}
            mostradorTotalSales={data.mostrador.totalSales}
          />
        </>
      ) : null}
    </div>
  );
}
