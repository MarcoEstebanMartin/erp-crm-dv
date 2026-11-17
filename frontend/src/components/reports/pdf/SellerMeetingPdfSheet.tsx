import { forwardRef } from 'react';
import { AlertTriangle, CheckCircle2, Lightbulb, RefreshCw } from 'lucide-react';
import { formatArsCurrency, formatEsDate } from './pdfReportHelpers';

interface SellerMeetingPdfSheetProps {
  data: any;
}

const SHEET_STYLE = {
  width: '210mm',
  minHeight: '297mm',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  padding: '22mm 18mm',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  borderRadius: '4px',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  color: '#0f172a',
  boxSizing: 'border-box' as const
};

export const SellerMeetingPdfSheet = forwardRef<HTMLDivElement, SellerMeetingPdfSheetProps>(({ data }, ref) => {
  return (
    <div id="seller-meeting-report-container" ref={ref} style={SHEET_STYLE}>
      {!data ? (
        <div role="status" style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={24} className="spin" aria-hidden="true" style={{ marginBottom: '12px' }} />
          <div>Cargando...</div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '20px' }}>
            <img
              src="/logo.png"
              alt="Logo DV"
              style={{ height: '48px', width: 'auto', objectFit: 'contain' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                {data.seller.name}
              </h1>
              <div className="tabular-nums" style={{ fontSize: '0.78rem', color: '#475569', marginTop: '3px' }}>
                Período: <strong>{formatEsDate(data.period.startDate)}</strong> al <strong>{formatEsDate(data.period.endDate)}</strong>
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                Cartera asignada: <strong>{data.seller.totalAssignedClients}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
            <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Total vendido</div>
              <div className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '3px' }}>
                {formatArsCurrency(data.performance.totalSales)}
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                Ped: <strong>{data.performance.totalOrders}</strong> | Bultos: <strong>{data.performance.totalBultos}</strong>
              </div>
            </div>

            <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Cobertura</div>
              <div className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 800, color: data.performance.portfolioCoveragePct >= 60 ? '#166534' : '#991b1b', marginTop: '3px' }}>
                {data.performance.portfolioCoveragePct}%
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                <strong>{data.performance.activeBuyingClientsCount}</strong> de <strong>{data.seller.totalAssignedClients}</strong>
              </div>
            </div>

            <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Ticket promedio</div>
              <div className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0369a1', marginTop: '3px' }}>
                {formatArsCurrency(data.performance.averageTicketPerClient)}
              </div>
            </div>

            <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Deuda cartera</div>
              <div className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 800, color: data.collections.totalCarteraDebt > 1000000 ? '#991b1b' : '#0f172a', marginTop: '3px' }}>
                {formatArsCurrency(data.collections.totalCarteraDebt)}
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                Cobrado: <strong>{formatArsCurrency(data.collections.totalCollected)}</strong>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
              <Lightbulb size={16} color="#b45309" aria-hidden="true" />
              Puntos de reunión
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.actionInsights.map((insight: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: insight.type === 'warning' ? '#fff7ed' : insight.type === 'opportunity' ? '#eff6ff' : '#f0fdf4',
                    border: insight.type === 'warning' ? '1px solid #ffedd5' : insight.type === 'opportunity' ? '1px solid #dbeafe' : '1px solid #bbf7d0',
                    color: insight.type === 'warning' ? '#9a3412' : insight.type === 'opportunity' ? '#1e40af' : '#166534',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}
                >
                  {insight.type === 'warning' ? (
                    <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
                  ) : insight.type === 'opportunity' ? (
                    <Lightbulb size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
                  ) : (
                    <CheckCircle2 size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
                  )}
                  <div>
                    <strong style={{ fontSize: '0.78rem', display: 'block' }}>{insight.title}</strong>
                    <span style={{ fontSize: '0.74rem', opacity: 0.9 }}>{insight.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <h3 className="tabular-nums" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#991b1b', marginBottom: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                Clientes sin compras ({data.inactiveClients.length})
              </h3>
              {data.inactiveClients.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: '#166534', padding: '10px 0' }}>
                  Sin clientes inactivos en el período.
                </div>
              ) : (
                <table style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                      <th scope="col" style={{ padding: '5px 6px' }}>Cliente</th>
                      <th scope="col" style={{ padding: '5px 6px' }}>Localidad</th>
                      <th scope="col" style={{ padding: '5px 6px', textAlign: 'right' }}>Deuda ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.inactiveClients.map((client: any) => (
                      <tr key={client.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '4px 6px', fontWeight: 600, color: '#0f172a' }}>{client.name}</td>
                        <td style={{ padding: '4px 6px', color: '#64748b' }}>{client.city}</td>
                        <td className="tabular-nums" style={{ padding: '4px 6px', textAlign: 'right', color: client.balance > 0 ? '#991b1b' : '#64748b' }}>
                          {formatArsCurrency(client.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <h3 className="tabular-nums" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                Clientes con deuda ({data.debtorClients.length})
              </h3>
              {data.debtorClients.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '10px 0' }}>
                  Sin clientes con saldo pendiente.
                </div>
              ) : (
                <table style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                      <th scope="col" style={{ padding: '5px 6px' }}>Cliente</th>
                      <th scope="col" style={{ padding: '5px 6px' }}>Localidad</th>
                      <th scope="col" style={{ padding: '5px 6px', textAlign: 'right' }}>Saldo ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.debtorClients.map((client: any) => (
                      <tr key={client.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '4px 6px', fontWeight: 600, color: '#0f172a' }}>{client.name}</td>
                        <td style={{ padding: '4px 6px', color: '#64748b' }}>{client.city}</td>
                        <td className="tabular-nums" style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700, color: '#991b1b' }}>
                          {formatArsCurrency(client.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
              Top productos — {data.seller.name}
            </h3>
            <table style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                  <th scope="col" style={{ padding: '5px 6px' }}>#</th>
                  <th scope="col" style={{ padding: '5px 6px' }}>Producto</th>
                  <th scope="col" style={{ padding: '5px 6px' }}>Categoría</th>
                  <th scope="col" style={{ padding: '5px 6px', textAlign: 'center' }}>Bultos</th>
                  <th scope="col" style={{ padding: '5px 6px', textAlign: 'right' }}>Venta ($)</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((prod: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td className="tabular-nums" style={{ padding: '4px 6px', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '4px 6px', fontWeight: 600, color: '#0f172a' }}>{prod.name}</td>
                    <td style={{ padding: '4px 6px', color: '#64748b' }}>{prod.category}</td>
                    <td className="tabular-nums" style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 600 }}>{prod.quantity.toLocaleString('es-AR')}</td>
                    <td className="tabular-nums" style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700 }}>{formatArsCurrency(prod.amount)}</td>
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

SellerMeetingPdfSheet.displayName = 'SellerMeetingPdfSheet';
