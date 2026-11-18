import type { FC } from 'react';

interface ProfitabilityTablesAndMatrixProps {
  subView: 'clients' | 'products';
  filteredClients: any[];
  filteredProducts: any[];
  formatCurrency: (val: number) => string;
}

export const ProfitabilityTablesAndMatrix: FC<ProfitabilityTablesAndMatrixProps> = ({
  subView,
  filteredClients,
  filteredProducts,
  formatCurrency,
}) => {
  if (subView === 'clients') {
    return (
      <div
        className="table-container table-container--sticky"
        role="region"
        aria-label="Rentabilidad por cliente"
        tabIndex={0}
        style={{ margin: 0, border: '1px solid var(--border-color)', borderRadius: '10px' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
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
              filteredClients.map((client: any, idx: number) => {
                const isNegative = client.grossProfit < 0;
                return (
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
                    <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: isNegative ? 'var(--color-corp-red)' : '#047857' }}>
                      {formatCurrency(client.grossProfit)}
                    </td>
                    <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', backgroundColor: isNegative ? '#fef2f2' : '#f1f5f9', color: isNegative ? 'var(--color-corp-red)' : '#0f172a', fontWeight: 600, fontSize: '0.78rem' }}>
                        {client.marginPercent}%
                      </span>
                    </td>
                    <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {formatCurrency(client.averageTicket)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div
      className="table-container table-container--sticky"
      role="region"
      aria-label="Rentabilidad por producto"
      tabIndex={0}
      style={{ margin: 0, border: '1px solid var(--border-color)', borderRadius: '10px' }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
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
            filteredProducts.map((prod: any, idx: number) => {
              const isLow = prod.classification === 'LOW_MARGIN';
              return (
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
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: isLow ? 'var(--color-corp-red)' : '#047857' }}>
                    {formatCurrency(prod.grossProfit)}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', backgroundColor: isLow ? '#fef2f2' : '#f1f5f9', color: isLow ? 'var(--color-corp-red)' : '#0f172a', fontWeight: 600, fontSize: '0.78rem' }}>
                      {prod.marginPercent}%
                    </span>
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {prod.targetMargin}%
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        backgroundColor: isLow ? '#fef2f2' : prod.classification === 'STAR' ? '#ecfdf5' : '#f1f5f9',
                        color: isLow ? 'var(--color-corp-red)' : prod.classification === 'STAR' ? '#047857' : '#334155',
                      }}
                    >
                      {prod.classification === 'STAR'
                        ? 'Estrella'
                        : prod.classification === 'VOLUME'
                          ? 'Volumen'
                          : prod.classification === 'LOW_MARGIN'
                            ? 'Margen bajo'
                            : 'Oportunidad'}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
