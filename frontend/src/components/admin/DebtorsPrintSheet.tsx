import React from 'react';

interface DebtorsPrintSheetProps {
  filteredDebtors: any[];
  groups: Record<string, any[]>;
  sellerLabel: string;
}

const renderDebtorTable = (rows: any[], amountKey: 'debtA' | 'debtX') => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', tableLayout: 'fixed' }}>
    <thead>
      <tr style={{ borderBottom: '1px solid #94a3b8' }}>
        <th style={{ textAlign: 'left', padding: '6px 8px', width: '55%' }}>Cliente</th>
        <th style={{ textAlign: 'left', padding: '6px 8px', width: '25%' }}>Ruta</th>
        <th style={{ textAlign: 'right', padding: '6px 8px', width: '20%' }}>Saldo</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((d) => (
        <tr key={`${amountKey}-${d.id}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <td style={{ padding: '7px 8px', verticalAlign: 'top' }}>
            <div style={{ fontWeight: 600 }}>{d.name}</div>
            {d.address && <div style={{ fontSize: '0.72rem', color: '#475569' }}>{d.address}</div>}
          </td>
          <td style={{ padding: '7px 8px', verticalAlign: 'top' }}>{d.route || '-'}</td>
          <td className="tabular-nums" style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 700, verticalAlign: 'top' }}>
            ${Math.round(Number(d[amountKey] || 0)).toLocaleString('es-AR')}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const DebtorsPrintSheet: React.FC<DebtorsPrintSheetProps> = ({
  filteredDebtors,
  groups,
  sellerLabel,
}) => {
  if (filteredDebtors.length === 0) return null;

  const cityKeys = Object.keys(groups).sort();
  const cityLabel = cityKeys.length === 1 ? cityKeys[0] : cityKeys.join(', ');

  return (
    <div className="print-only" style={{ padding: '16px', color: '#000', backgroundColor: '#fff', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #1D1D1F', paddingBottom: '10px', marginBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#1D1D1F' }}>
            Deudor de {cityLabel}
          </h1>
          <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '4px' }}>
            Vendedor: {sellerLabel}
          </div>
        </div>
        <div className="tabular-nums" style={{ textAlign: 'right', fontSize: '0.85rem', color: '#334155' }}>
          {new Date().toLocaleDateString('es-AR')}
        </div>
      </div>

      {cityKeys.map((city) => {
        const debtorsA = groups[city].filter((d) => Number(d.debtA || 0) > 0);
        const debtorsX = groups[city].filter((d) => Number(d.debtX || 0) > 0);
        const cityTotal = groups[city].reduce((acc, d) => acc + d.outstandingBalance, 0);

        return (
          <div key={city} style={{ marginBottom: '22px', breakInside: 'avoid' }}>
            {cityKeys.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 10px', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
                <span>{city}</span>
                <span className="tabular-nums">${Math.round(cityTotal).toLocaleString('es-AR')}</span>
              </div>
            )}

            {debtorsA.length > 0 && renderDebtorTable(debtorsA, 'debtA')}

            {debtorsX.length > 0 && (
              <div style={{ marginTop: debtorsA.length > 0 ? '24px' : '0' }}>
                {renderDebtorTable(debtorsX, 'debtX')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
