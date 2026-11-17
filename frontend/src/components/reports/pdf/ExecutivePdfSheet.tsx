import { forwardRef } from 'react';
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { formatArsCurrency, formatEsDate } from './pdfReportHelpers';

interface ExecutivePdfSheetProps {
  data: any;
}

const SHEET_STYLE = {
  width: '210mm',
  minHeight: '297mm',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  padding: '24mm 20mm',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  borderRadius: '4px',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  color: '#0f172a',
  boxSizing: 'border-box' as const
};

export const ExecutivePdfSheet = forwardRef<HTMLDivElement, ExecutivePdfSheetProps>(({ data }, ref) => {
  return (
    <div id="executive-report-container" ref={ref} style={SHEET_STYLE}>
      {!data ? (
        <div role="status" style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={24} className="spin" aria-hidden="true" style={{ marginBottom: '12px' }} />
          <div>Cargando...</div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '22px' }}>
            <img
              src="/logo.png"
              alt="Logo DV"
              style={{ height: '56px', width: 'auto', objectFit: 'contain' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                Reporte Ejecutivo
              </h1>
              <div className="tabular-nums" style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
                Período: <strong>{formatEsDate(data.period.startDate)}</strong> al <strong>{formatEsDate(data.period.endDate)}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '22px' }}>
            <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Ventas totales</div>
              <div className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {formatArsCurrency(data.summary.totalSales)}
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.72rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', color: data.summary.salesGrowthPct >= 0 ? '#166534' : '#991b1b', fontWeight: 600 }}>
                {data.summary.salesGrowthPct >= 0 ? <TrendingUp size={14} aria-hidden="true" /> : <TrendingDown size={14} aria-hidden="true" />}
                <span>{data.summary.salesGrowthPct >= 0 ? `+${data.summary.salesGrowthPct}%` : `${data.summary.salesGrowthPct}%`} vs ant.</span>
              </div>
            </div>

            <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Ganancia bruta</div>
              <div className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#166534', marginTop: '4px' }}>
                {formatArsCurrency(data.summary.grossProfit)}
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px', fontWeight: 600 }}>
                Margen: <strong style={{ color: '#166534' }}>{data.summary.grossMarginPct}%</strong>
              </div>
            </div>

            <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Cobranza</div>
              <div className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0369a1', marginTop: '4px' }}>
                {formatArsCurrency(data.collections.totalCollected)}
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.72rem', color: '#991b1b', marginTop: '4px' }}>
                Deuda: <strong>{formatArsCurrency(data.collections.totalPendingDebt)}</strong>
              </div>
            </div>

            <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Volumen</div>
              <div className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {data.summary.totalBultos.toLocaleString('es-AR')} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>bultos</span>
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                <strong>{data.summary.totalOrders}</strong> pedidos
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '22px' }}>
            <div style={{ padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                1. Facturación por sucursal
              </h3>
              <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#64748b' }}>
                    <th scope="col" style={{ padding: '4px 0' }}>Sucursal</th>
                    <th scope="col" style={{ padding: '4px 0', textAlign: 'right' }}>Venta ($)</th>
                    <th scope="col" style={{ padding: '4px 0', textAlign: 'right' }}>Ganancia ($)</th>
                    <th scope="col" style={{ padding: '4px 0', textAlign: 'right' }}>Margen %</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 0', fontWeight: 600, color: '#1e40af' }}>Sucursal A (Oficial)</td>
                    <td className="tabular-nums" style={{ padding: '6px 0', textAlign: 'right' }}>{formatArsCurrency(data.billingBreakdown.official.sales)}</td>
                    <td className="tabular-nums" style={{ padding: '6px 0', textAlign: 'right', color: '#166534' }}>{formatArsCurrency(data.billingBreakdown.official.grossProfit)}</td>
                    <td className="tabular-nums" style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>
                      {data.billingBreakdown.official.sales > 0 ? Math.round((data.billingBreakdown.official.grossProfit / data.billingBreakdown.official.sales) * 100) : 0}%
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', fontWeight: 600, color: '#b45309' }}>Sucursal X (Interna)</td>
                    <td className="tabular-nums" style={{ padding: '6px 0', textAlign: 'right' }}>{formatArsCurrency(data.billingBreakdown.internal.sales)}</td>
                    <td className="tabular-nums" style={{ padding: '6px 0', textAlign: 'right', color: '#166534' }}>{formatArsCurrency(data.billingBreakdown.internal.grossProfit)}</td>
                    <td className="tabular-nums" style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>
                      {data.billingBreakdown.internal.sales > 0 ? Math.round((data.billingBreakdown.internal.grossProfit / data.billingBreakdown.internal.sales) * 100) : 0}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                2. Cobranzas por medio
              </h3>
              <div className="tabular-nums" style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#475569' }}>Efectivo</span>
                  <strong>{formatArsCurrency(data.collections.byMethod.cash)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#475569' }}>Transferencias</span>
                  <strong>{formatArsCurrency(data.collections.byMethod.transfer)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#475569' }}>Cheques</span>
                  <strong>{formatArsCurrency(data.collections.byMethod.check)}</strong>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '22px' }}>
            <h3 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a', marginBottom: '10px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
              3. Top 10 Clientes
            </h3>
            <table style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                  <th scope="col" style={{ padding: '5px 8px' }}>#</th>
                  <th scope="col" style={{ padding: '5px 8px' }}>Cliente</th>
                  <th scope="col" style={{ padding: '5px 8px' }}>Localidad</th>
                  <th scope="col" style={{ padding: '5px 8px', textAlign: 'right' }}>Suc. A</th>
                  <th scope="col" style={{ padding: '5px 8px', textAlign: 'right' }}>Suc. X</th>
                  <th scope="col" style={{ padding: '5px 8px', textAlign: 'right' }}>Venta ($)</th>
                  <th scope="col" style={{ padding: '5px 8px', textAlign: 'right' }}>Ganancia ($)</th>
                  <th scope="col" style={{ padding: '5px 8px', textAlign: 'right' }}>Margen %</th>
                </tr>
              </thead>
              <tbody>
                {data.topClients && data.topClients.map((client: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td className="tabular-nums" style={{ padding: '4px 8px', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '4px 8px', fontWeight: 600, color: '#0f172a' }}>{client.name}</td>
                    <td style={{ padding: '4px 8px', color: '#64748b' }}>{client.city}</td>
                    <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'right', color: '#475569' }}>{formatArsCurrency(client.officialSales)}</td>
                    <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'right', color: '#475569' }}>{formatArsCurrency(client.internalSales)}</td>
                    <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatArsCurrency(client.totalSales)}</td>
                    <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>{formatArsCurrency(client.profit)}</td>
                    <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: client.marginPct >= 20 ? '#166534' : '#b45309' }}>{client.marginPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: '22px' }}>
            <h3 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a', marginBottom: '10px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
              4. Top Productos
            </h3>
            <table style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                  <th scope="col" style={{ padding: '5px 8px' }}>#</th>
                  <th scope="col" style={{ padding: '5px 8px' }}>Producto</th>
                  <th scope="col" style={{ padding: '5px 8px' }}>Categoría</th>
                  <th scope="col" style={{ padding: '5px 8px', textAlign: 'center' }}>Bultos</th>
                  <th scope="col" style={{ padding: '5px 8px', textAlign: 'right' }}>Venta ($)</th>
                  <th scope="col" style={{ padding: '5px 8px', textAlign: 'right' }}>Margen %</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((prod: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td className="tabular-nums" style={{ padding: '4px 8px', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '4px 8px', fontWeight: 600, color: '#0f172a' }}>{prod.name}</td>
                    <td style={{ padding: '4px 8px', color: '#64748b' }}>{prod.category}</td>
                    <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 600 }}>{prod.quantity.toLocaleString('es-AR')}</td>
                    <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{formatArsCurrency(prod.amount)}</td>
                    <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: prod.marginPct >= 20 ? '#166534' : '#b45309' }}>{prod.marginPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a', marginBottom: '10px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
              5. Ventas por Localidad
            </h3>
            <table style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th scope="col" style={{ padding: '5px 8px' }}>Localidad</th>
                  <th scope="col" style={{ padding: '5px 8px', textAlign: 'center' }}>Pedidos</th>
                  <th scope="col" style={{ padding: '5px 8px', textAlign: 'right' }}>Sucursal A</th>
                  <th scope="col" style={{ padding: '5px 8px', textAlign: 'right' }}>Sucursal X</th>
                  <th scope="col" style={{ padding: '5px 8px', textAlign: 'right' }}>Total ($)</th>
                </tr>
              </thead>
              <tbody>
                {data.citiesSummary.map((c: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '4px 8px', fontWeight: 600, color: '#0f172a' }}>{c.cityName}</td>
                    <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'center', color: '#64748b' }}>{c.ordersCount}</td>
                    <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'right', color: '#475569' }}>{formatArsCurrency(c.officialSales || 0)}</td>
                    <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'right', color: '#475569' }}>{formatArsCurrency(c.internalSales || 0)}</td>
                    <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatArsCurrency(c.totalSales || c.sales || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});

ExecutivePdfSheet.displayName = 'ExecutivePdfSheet';
