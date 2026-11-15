import type { FC } from 'react';

interface ProfitabilityTablesAndMatrixProps {
  subView: 'clients' | 'products' | 'matrix';
  filteredClients: any[];
  filteredProducts: any[];
  allProducts: any[];
  formatCurrency: (val: number) => string;
}

export const ProfitabilityTablesAndMatrix: FC<ProfitabilityTablesAndMatrixProps> = ({
  subView,
  filteredClients,
  filteredProducts,
  allProducts,
  formatCurrency,
}) => {
  if (subView === 'clients') {
    return (
      <div
        className="table-container table-container--sticky"
        role="region"
        aria-label="Rentabilidad por cliente"
        tabIndex={0}
        style={{ margin: 0, border: '1px solid #e2e8f0', borderRadius: '8px' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <tr>
              <th scope="col" style={{ padding: '10px 12px', width: '40px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>#</th>
              <th scope="col" style={{ padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Cliente</th>
              <th scope="col" style={{ padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Localidad</th>
              <th scope="col" style={{ padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Vendedor</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Facturación ($)</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Costo ($)</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 700 }}>Margen bruto ($)</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 700 }}>Margen (%)</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Ticket prom.</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Sin resultados.
                </td>
              </tr>
            ) : (
              filteredClients.map((client: any, idx: number) => (
                <tr key={client.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {client.businessName}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                    {client.city}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                    {client.sellerName}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right' }}>
                    {formatCurrency(client.totalRevenue)}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                    {formatCurrency(client.totalCost)}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#047857' }}>
                    {formatCurrency(client.grossProfit)}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700, fontSize: '0.78rem' }}>
                      {client.marginPercent}%
                    </span>
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right' }}>
                    {formatCurrency(client.averageTicket)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (subView === 'products') {
    return (
      <div
        className="table-container table-container--sticky"
        role="region"
        aria-label="Rentabilidad por producto"
        tabIndex={0}
        style={{ margin: 0, border: '1px solid #e2e8f0', borderRadius: '8px' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <tr>
              <th scope="col" style={{ padding: '10px 12px', width: '40px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>#</th>
              <th scope="col" style={{ padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>SKU / Producto</th>
              <th scope="col" style={{ padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Rubro</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Vendidos</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Facturación ($)</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 700 }}>Margen real ($)</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 700 }}>Margen real (%)</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Margen obj. (%)</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Sin resultados.
                </td>
              </tr>
            ) : (
              filteredProducts.map((prod: any, idx: number) => (
                <tr key={prod.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{prod.name}</div>
                    <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{prod.sku}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                    {prod.rubroName}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right' }}>
                    {prod.quantitySold}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right' }}>
                    {formatCurrency(prod.totalRevenue)}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#7e22ce' }}>
                    {formatCurrency(prod.grossProfit)}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff', fontWeight: 700, fontSize: '0.78rem' }}>
                      {prod.marginPercent}%
                    </span>
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {prod.targetMargin}%
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {prod.classification === 'STAR' && (
                      <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '0.72rem', fontWeight: 700 }}>
                        Estrella
                      </span>
                    )}
                    {prod.classification === 'VOLUME' && (
                      <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.72rem', fontWeight: 700 }}>
                        Volumen
                      </span>
                    )}
                    {prod.classification === 'OPPORTUNITY' && (
                      <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: '#fffbe6', color: '#d97706', border: '1px solid #fef08a', fontSize: '0.72rem', fontWeight: 700 }}>
                        Oportunidad
                      </span>
                    )}
                    {prod.classification === 'LOW_MARGIN' && (
                      <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: '#fef2f2', color: '#e30613', border: '1px solid #fecaca', fontSize: '0.72rem', fontWeight: 700 }}>
                        Margen bajo
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  const quadrants = [
    { key: 'STAR', title: 'Estrellas (Alto margen + volumen)', bg: '#f0fdf4', border: '#bbf7d0', headerBorder: '#dcfce7', titleColor: '#166534', badgeColor: '#047857' },
    { key: 'OPPORTUNITY', title: 'Oportunidades (Alto margen + bajo vol.)', bg: '#fffbe6', border: '#fef08a', headerBorder: '#fef9c3', titleColor: '#854d0e', badgeColor: '#d97706' },
    { key: 'VOLUME', title: 'Volumen (Bajo margen + alto vol.)', bg: '#eff6ff', border: '#bfdbfe', headerBorder: '#dbeafe', titleColor: '#1e40af', badgeColor: '#1d4ed8' },
    { key: 'LOW_MARGIN', title: 'Margen bajo (< 15%)', bg: '#fef2f2', border: '#fecaca', headerBorder: '#fee2e2', titleColor: '#991b1b', badgeColor: '#e30613' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
      {quadrants.map((q) => (
        <div key={q.key} style={{ backgroundColor: q.bg, border: `1px solid ${q.border}`, borderRadius: '8px', padding: '16px' }}>
          <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: `1px solid ${q.headerBorder}`, fontWeight: 600, color: q.titleColor, fontSize: '0.88rem' }}>
            {q.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {allProducts.filter((p: any) => p.classification === q.key).map((p: any) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${q.headerBorder}`, fontSize: '0.82rem' }}>
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{p.name}</strong>
                  <span className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Margen: <strong style={{ color: q.badgeColor }}>{p.marginPercent}%</strong>
                  </span>
                </div>
                <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(p.grossProfit)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
