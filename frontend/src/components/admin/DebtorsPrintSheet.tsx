import React from 'react';

interface DebtorsPrintSheetProps {
  filteredDebtors: any[];
  groups: Record<string, any[]>;
  sellerLabel: string;
  selectedBranchFilter?: string;
}

const getBranchPrintMeta = (d: any, amountKey: 'debtA' | 'debtX') => {
  const branch = amountKey === 'debtA' ? d.branchA : d.branchX;
  if (branch) {
    return {
      flagged: Boolean(branch.needsFollowUp),
      label: branch.followUpLabel || '',
    };
  }
  const fallbackFlagged = Boolean(d.needsFollowUp ?? d.hasMultiplePendingInvoices);
  const fallbackLabel =
    d.followUpLabel || (d.hasMultiplePendingInvoices ? `${d.pendingInvoicesCount} boletas` : '');
  return { flagged: fallbackFlagged, label: fallbackLabel };
};

const getUniqueRoutesLabel = (rows: any[]): string => {
  const routes = Array.from(
    new Set(
      rows
        .map((d) => String(d.route || '').trim())
        .filter((r) => r.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, 'es'));
  return routes.join(', ');
};

const renderDebtorTable = (rows: any[], amountKey: 'debtA' | 'debtX') => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', lineHeight: 1.2, tableLayout: 'fixed' }}>
    <thead style={{ display: 'table-row-group' }}>
      <tr style={{ borderBottom: '1px solid #94a3b8' }}>
        <th style={{ textAlign: 'left', padding: '4px 6px', width: '38%' }}>
          {amountKey === 'debtA' ? 'Cliente (A)' : 'Cliente'}
        </th>
        <th style={{ textAlign: 'left', padding: '4px 6px', width: '30%' }}>Dirección</th>
        <th style={{ textAlign: 'right', padding: '4px 6px', width: '14%' }}>Saldo</th>
        <th style={{ textAlign: 'left', padding: '4px 6px', width: '18%' }}>Detalle</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((d) => {
        const { flagged, label } = getBranchPrintMeta(d, amountKey);
        return (
          <tr
            key={`${amountKey}-${d.id}`}
            style={{
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: flagged ? '#FED7AA' : 'transparent',
              breakInside: 'avoid',
              pageBreakInside: 'avoid',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
          >
            <td style={{ padding: '3px 6px', verticalAlign: 'top', fontWeight: flagged ? 700 : 600 }}>
              {d.name}
            </td>
            <td style={{ padding: '3px 6px', verticalAlign: 'top', fontSize: '0.66rem', color: '#475569' }}>
              {d.address || '-'}
            </td>
            <td className="tabular-nums" style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 700, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
              ${Math.round(Number(d[amountKey] || 0)).toLocaleString('es-AR')}
            </td>
            <td style={{ padding: '3px 6px', verticalAlign: 'top', fontWeight: 700, fontSize: '0.68rem', color: '#9A3412' }}>
              {label}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

export const DebtorsPrintSheet: React.FC<DebtorsPrintSheetProps> = ({
  filteredDebtors,
  groups,
  sellerLabel,
  selectedBranchFilter = 'ALL',
}) => {
  if (filteredDebtors.length === 0) return null;

  const showBranchA = selectedBranchFilter !== 'X';
  const showBranchX = selectedBranchFilter !== 'A';
  const cityKeys = Object.keys(groups).sort();
  const cityLabel = cityKeys.length === 1 ? cityKeys[0] : cityKeys.join(', ');
  const flaggedCount = filteredDebtors.filter((d) => {
    if (selectedBranchFilter === 'A') return Boolean(d.branchA?.needsFollowUp ?? d.needsFollowUp);
    if (selectedBranchFilter === 'X') return Boolean(d.branchX?.needsFollowUp ?? d.needsFollowUp);
    return (
      Boolean(d.branchA?.needsFollowUp) ||
      Boolean(d.branchX?.needsFollowUp) ||
      Boolean(d.needsFollowUp)
    );
  }).length;

  const singleCityRoutes = cityKeys.length === 1 ? getUniqueRoutesLabel(groups[cityKeys[0]] || []) : '';
  const showSellerMeta = Boolean(sellerLabel && sellerLabel !== 'Todos');
  const headerMetaParts: string[] = [];
  if (showSellerMeta) headerMetaParts.push(`Vendedor: ${sellerLabel}`);
  if (flaggedCount > 0) headerMetaParts.push(`A reclamar: ${flaggedCount}`);

  return (
    <div
      className="print-only"
      style={{
        padding: '12px',
        color: '#000',
        backgroundColor: '#fff',
        width: '100%',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px', borderBottom: '1.5px solid #1D1D1F', paddingBottom: '6px', marginBottom: '10px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1D1D1F' }}>
            Deudor de {cityLabel}
            {singleCityRoutes && (
              <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#475569', marginLeft: '6px' }}>
                ({singleCityRoutes})
              </span>
            )}
          </h1>
          {headerMetaParts.length > 0 && (
            <div style={{ fontSize: '0.76rem', color: '#334155', marginTop: '2px' }}>
              {headerMetaParts.join(' · ')}
            </div>
          )}
        </div>
        <div className="tabular-nums" style={{ textAlign: 'right', fontSize: '0.78rem', color: '#334155', whiteSpace: 'nowrap' }}>
          {new Date().toLocaleDateString('es-AR')}
        </div>
      </div>

      {cityKeys.map((city) => {
        const debtorsA = showBranchA ? groups[city].filter((d) => Number(d.debtA || 0) > 0) : [];
        const debtorsX = showBranchX ? groups[city].filter((d) => Number(d.debtX || 0) > 0) : [];
        const cityRoutes = getUniqueRoutesLabel(groups[city]);
        const cityTotal = groups[city].reduce((acc, d) => {
          if (selectedBranchFilter === 'A') return acc + Number(d.debtA || 0);
          if (selectedBranchFilter === 'X') return acc + Number(d.debtX || 0);
          return acc + Number(d.outstandingBalance || 0);
        }, 0);

        return (
          <div key={city} style={{ marginBottom: '14px' }}>
            {cityKeys.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700, fontSize: '0.78rem', marginBottom: '4px', breakAfter: 'avoid', pageBreakAfter: 'avoid' }}>
                <span>
                  {city}
                  {cityRoutes && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 500, color: '#475569', marginLeft: '6px' }}>
                      ({cityRoutes})
                    </span>
                  )}
                </span>
                <span className="tabular-nums">${Math.round(cityTotal).toLocaleString('es-AR')}</span>
              </div>
            )}

            {debtorsA.length > 0 && renderDebtorTable(debtorsA, 'debtA')}

            {debtorsX.length > 0 && (
              <div style={{ marginTop: debtorsA.length > 0 ? '14px' : '0' }}>
                {renderDebtorTable(debtorsX, 'debtX')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
