import { forwardRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { formatArsCurrency, formatEsDate } from './pdfReportHelpers';

interface EmployeePdfSheetProps {
  data: any;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administración',
  FACTURACION: 'Facturación',
  VENDEDOR: 'Vendedor',
  DEPOSITO: 'Depósito',
};

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
  boxSizing: 'border-box' as const,
};

export const EmployeePdfSheet = forwardRef<HTMLDivElement, EmployeePdfSheetProps>(({ data }, ref) => {
  const emp = data?.employee;
  const summary = data?.summary;
  const breakdown = data?.breakdown;
  const collections = data?.collections;
  const ops = data?.operations;
  const topClients = (data?.topClients || []).slice(0, 5);
  const topProducts = (data?.topProducts || []).slice(0, 5);
  const roleLabel = emp ? ROLE_LABELS[emp.role] || emp.role : '';

  return (
    <div id="executive-report-container" ref={ref} style={SHEET_STYLE}>
      {!data || !emp || !summary ? (
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
              style={{ height: '52px', width: 'auto', objectFit: 'contain' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                Reporte de Empleado — {emp.fullName || emp.username}
              </h1>
              <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '3px', fontWeight: 600 }}>
                {roleLabel}{emp.position ? ` · ${emp.position}` : ''}
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                Período: <strong>{formatEsDate(data.period.startDate)}</strong> al <strong>{formatEsDate(data.period.endDate)}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
            <div style={{ padding: '11px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Ventas netas</div>
              <div className="tabular-nums" style={{ fontSize: '1.18rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {formatArsCurrency(summary.totalSales)}
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '3px' }}>
                <strong>{summary.totalOrders}</strong> pedidos | <strong>{summary.totalBultos}</strong> bultos
              </div>
            </div>

            <div style={{ padding: '11px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Ganancia bruta</div>
              <div className="tabular-nums" style={{ fontSize: '1.18rem', fontWeight: 800, color: summary.grossProfit >= 0 ? '#166534' : '#991b1b', marginTop: '4px' }}>
                {formatArsCurrency(summary.grossProfit)}
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.7rem', color: '#475569', marginTop: '3px', fontWeight: 600 }}>
                Margen: <strong>{summary.grossMarginPct}%</strong>
              </div>
            </div>

            <div style={{ padding: '11px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Cobranzas</div>
              <div className="tabular-nums" style={{ fontSize: '1.18rem', fontWeight: 800, color: '#0369a1', marginTop: '4px' }}>
                {formatArsCurrency(collections.totalCollected)}
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '3px' }}>
                Recibos digitales: <strong>{ops.fieldReceiptsCount}</strong>
              </div>
            </div>

            <div style={{ padding: '11px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Operación</div>
              <div className="tabular-nums" style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {summary.activeClientsCount} clientes | {ops.routesCount} repartos
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '4px' }}>
                Entregas: <strong>{ops.routeOrdersDelivered}</strong> | Cajas: <strong>{ops.cashDrawersCount}</strong> | Stock: <strong>{ops.stockMovementsCount}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div style={{ padding: '13px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                1. Desglose comercial y operativo
              </h3>
              <table className="tabular-nums" style={{ width: '100%', fontSize: '0.74rem', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '5px 0', color: '#475569' }}>Sucursal A (Oficial)</td>
                    <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 700 }}>{formatArsCurrency(breakdown.officialSales)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '5px 0', color: '#475569' }}>Sucursal X (Interna)</td>
                    <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 700 }}>{formatArsCurrency(breakdown.internalSales)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '5px 0', color: '#475569' }}>Mostrador (Retiro)</td>
                    <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>{formatArsCurrency(breakdown.localSales)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '5px 0', color: '#475569' }}>Ruta / Reparto</td>
                    <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>{formatArsCurrency(breakdown.routeSales)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '5px 0', color: '#475569' }}>Ticket promedio</td>
                    <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 700 }}>{formatArsCurrency(summary.averageTicket)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ padding: '13px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                2. Cobranzas por medio
              </h3>
              <div className="tabular-nums" style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#475569' }}>Efectivo</span>
                  <strong>{formatArsCurrency(collections.byMethod.cash)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#475569' }}>Transferencias</span>
                  <strong>{formatArsCurrency(collections.byMethod.transfer)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#475569' }}>Cheques</span>
                  <strong>{formatArsCurrency(collections.byMethod.check)}</strong>
                </div>
                {collections.byMethod.other > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#475569' }}>Otros medios</span>
                    <strong>{formatArsCurrency(collections.byMethod.other)}</strong>
                  </div>
                )}
                {ops.fieldReceiptsAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px' }}>
                    <span style={{ color: '#64748b' }}>Total en recibos digitales</span>
                    <strong>{formatArsCurrency(ops.fieldReceiptsAmount)}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
              3. Top 5 Clientes
            </h3>
            {topClients.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '6px 0' }}>Sin ventas a clientes en el período.</div>
            ) : (
              <table style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                    <th scope="col" style={{ padding: '5px 8px' }}>#</th>
                    <th scope="col" style={{ padding: '5px 8px' }}>Cliente</th>
                    <th scope="col" style={{ padding: '5px 8px' }}>Localidad</th>
                    <th scope="col" style={{ padding: '5px 8px', textAlign: 'center' }}>Pedidos</th>
                    <th scope="col" style={{ padding: '5px 8px', textAlign: 'right' }}>Venta ($)</th>
                    <th scope="col" style={{ padding: '5px 8px', textAlign: 'right' }}>Ganancia ($)</th>
                    <th scope="col" style={{ padding: '5px 8px', textAlign: 'right' }}>Margen %</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.map((client: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td className="tabular-nums" style={{ padding: '4px 8px', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '4px 8px', fontWeight: 600, color: '#0f172a' }}>{client.name}</td>
                      <td style={{ padding: '4px 8px', color: '#64748b' }}>{client.city}</td>
                      <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'center', color: '#475569' }}>{client.ordersCount}</td>
                      <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{formatArsCurrency(client.totalSales)}</td>
                      <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: client.profit >= 0 ? '#166534' : '#991b1b' }}>{formatArsCurrency(client.profit)}</td>
                      <td className="tabular-nums" style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: client.marginPct >= 20 ? '#166534' : '#b45309' }}>{client.marginPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
              4. Top 5 Productos
            </h3>
            {topProducts.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '6px 0' }}>Sin productos facturados en el período.</div>
            ) : (
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
                  {topProducts.map((prod: any, idx: number) => (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
});

EmployeePdfSheet.displayName = 'EmployeePdfSheet';
