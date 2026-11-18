import { useMemo, useState, type FC } from 'react';
import { Check, DollarSign, Trash2 } from 'lucide-react';
import {
  computeInvoiceDueDaysInfo,
  formatCentsArs,
  formatCuitDisplay,
  formatMoneyArs,
  parseExactCents,
} from './providersHelpers';
export { ComprasProveedoresTab } from './ComprasProveedoresTab';

type DebtFilter = 'ALL' | 'PENDING' | 'OVERDUE' | 'PAID';

const TONE_STYLES: Record<'paid' | 'overdue' | 'warning' | 'neutral', { bg: string; color: string }> = {
  paid: { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  overdue: { bg: '#FFF0F0', color: 'var(--color-danger)' },
  warning: { bg: 'var(--color-warning-bg)', color: '#B78103' },
  neutral: { bg: '#f1f5f9', color: '#475569' },
};

export const ComprasFacturasTab: FC<{
  isAdmin: boolean;
  supplierMetrics: {
    totalDeuda: number; vencidasCount: number; totalVencidas: number;
    proximasCount: number; totalProximas: number; enTransitoCount: number;
  };
  filteredInvoices: any[];
  supplierQuery: string;
  setSupplierQuery: (v: string) => void;
  branchFilter: 'ALL' | 'OFFICIAL' | 'INTERNAL';
  setBranchFilter: (v: 'ALL' | 'OFFICIAL' | 'INTERNAL') => void;
  onOpenAccountSummary: (provider: any) => void;
  onOpenPayInvoice: (inv: any) => void;
  onDeleteInvoice: (id: number, num: string) => void;
}> = ({
  isAdmin,
  supplierMetrics,
  filteredInvoices,
  supplierQuery,
  setSupplierQuery,
  branchFilter,
  setBranchFilter,
  onOpenAccountSummary,
  onOpenPayInvoice,
  onDeleteInvoice,
}) => {
  const [debtFilter, setDebtFilter] = useState<DebtFilter>('ALL');

  const visibleInvoices = useMemo(() => {
    const now = new Date();
    return (filteredInvoices || []).filter((inv) => {
      if (debtFilter === 'ALL') return true;
      if (debtFilter === 'PAID') return inv.status === 'PAID';
      if (debtFilter === 'PENDING') return inv.status !== 'PAID';
      const dueInfo = computeInvoiceDueDaysInfo(inv.dueDate, inv.status, now);
      return inv.status !== 'PAID' && dueInfo.tone === 'overdue';
    });
  }, [filteredInvoices, debtFilter]);

  return (
    <div>
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Deuda pendiente total</span>
            <span className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700 }}>{formatMoneyArs(supplierMetrics.totalDeuda)}</span>
          </div>
          <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--color-danger)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-danger)', fontWeight: 600 }}>Facturas vencidas ({supplierMetrics.vencidasCount})</span>
            <span className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-danger)' }}>{formatMoneyArs(supplierMetrics.totalVencidas)}</span>
          </div>
          <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--color-warning)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', color: '#B78103', fontWeight: 600 }}>Vencimientos 7d ({supplierMetrics.proximasCount})</span>
            <span className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#B78103' }}>{formatMoneyArs(supplierMetrics.totalProximas)}</span>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Cuentas Corrientes</h3>
          <search aria-label="Filtrar cuentas corrientes de proveedores" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label htmlFor="compras-cc-search" className="visually-hidden">Buscar proveedor o comprobante</label>
            <input
              id="compras-cc-search"
              type="text"
              placeholder="Buscar proveedor o comprobante..."
              className="input"
              style={{ fontSize: '0.8rem', padding: '6px 12px', width: '230px' }}
              value={supplierQuery}
              onChange={(e) => setSupplierQuery(e.target.value)}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <label htmlFor="compras-cc-debt" className="visually-hidden">Estado de deuda</label>
            <select
              id="compras-cc-debt"
              className="input"
              style={{ fontSize: '0.8rem', padding: '6px 10px', minWidth: '130px' }}
              value={debtFilter}
              onChange={(e) => setDebtFilter(e.target.value as DebtFilter)}
            >
              <option value="ALL">Todas</option>
              <option value="PENDING">Pendientes</option>
              <option value="OVERDUE">Vencidas</option>
              <option value="PAID">Saldadas</option>
            </select>
            <label htmlFor="compras-cc-branch" className="visually-hidden">Sucursal</label>
            <select
              id="compras-cc-branch"
              className="input"
              style={{ fontSize: '0.8rem', padding: '6px 10px', minWidth: '130px' }}
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value as 'ALL' | 'OFFICIAL' | 'INTERNAL')}
            >
              <option value="ALL">Todas</option>
              <option value="OFFICIAL">Sucursal A</option>
              <option value="INTERNAL">Sucursal X</option>
            </select>
          </search>
        </div>

        <div className="table-container table-container--sticky" role="region" aria-label="Cuentas corrientes de proveedores" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Proveedor</th>
                <th scope="col">Comprobante</th>
                <th scope="col">Emisión</th>
                <th scope="col">Vto.</th>
                <th scope="col">Días</th>
                <th scope="col" style={{ textAlign: 'right' }}>Total</th>
                <th scope="col" style={{ textAlign: 'right' }}>Pagado</th>
                <th scope="col" style={{ textAlign: 'right' }}>Saldo</th>
                <th scope="col" style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center' }}>Sin comprobantes encontrados.</td></tr>
              ) : (
                visibleInvoices.map((inv) => {
                  const isCreditNote = String(inv.invoiceType || '').toUpperCase().startsWith('NOTA_CREDITO');
                  const dueInfo = isCreditNote
                    ? { label: 'Nota de Crédito', tone: 'paid' as const, diffDays: null }
                    : computeInvoiceDueDaysInfo(inv.dueDate, inv.status);
                  const toneStyle = TONE_STYLES[dueInfo.tone];
                  const isOverdue = dueInfo.tone === 'overdue';
                  const cuit = formatCuitDisplay(inv.persona?.cuit);
                  const pendingCents = isCreditNote ? 0 : Math.max(0, parseExactCents(inv.totalAmount) - parseExactCents(inv.paidAmount));
                  return (
                    <tr key={inv.id} style={isOverdue ? { backgroundColor: '#FFF5F5' } : undefined}>
                      <td>
                        {inv.persona ? (
                          <button
                            type="button"
                            onClick={() => onOpenAccountSummary(inv.persona)}
                            style={{ background: 'none', border: 'none', padding: 0, margin: 0, fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}
                          >
                            {inv.persona.name}
                          </button>
                        ) : (
                          <span style={{ fontWeight: 600 }}>—</span>
                        )}
                        {cuit && <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>CUIT: {cuit}</div>}
                      </td>
                      <td>
                        <div className="tabular-nums" style={{ fontFamily: 'monospace', fontWeight: 600 }}>{inv.invoiceNumber}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {inv.invoiceType?.replace('_', ' ')} · {inv.billingType === 'OFFICIAL' ? 'Suc. A' : 'Suc. X'}
                        </div>
                      </td>
                      <td className="tabular-nums">{new Date(inv.issueDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</td>
                      <td className="tabular-nums">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : 'S/D'}</td>
                      <td>
                        <span className="tabular-nums" style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: toneStyle.bg, color: toneStyle.color, whiteSpace: 'nowrap' }}>
                          {dueInfo.label}
                        </span>
                      </td>
                      <td className="tabular-nums" style={{ textAlign: 'right', color: isCreditNote ? '#059669' : undefined, fontWeight: isCreditNote ? 600 : undefined }}>
                        {isCreditNote ? `-${formatMoneyArs(inv.totalAmount)}` : formatMoneyArs(inv.totalAmount)}
                      </td>
                      <td className="tabular-nums" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {isCreditNote ? '—' : formatMoneyArs(inv.paidAmount)}
                      </td>
                      <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, color: isCreditNote ? '#059669' : pendingCents > 0 ? (isOverdue ? 'var(--color-danger)' : 'var(--text-primary)') : 'var(--color-success)' }}>
                        {isCreditNote ? 'Aplicada' : formatCentsArs(pendingCents)}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {isCreditNote ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                              Crédito
                            </span>
                          ) : inv.status === 'PAID' ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Check size={12} aria-hidden="true" /> Saldada
                            </span>
                          ) : (
                            <button type="button" onClick={() => onOpenPayInvoice(inv)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <DollarSign size={13} aria-hidden="true" /> Pagar
                            </button>
                          )}
                          <button type="button" onClick={() => onDeleteInvoice(inv.id, inv.invoiceNumber)} className="btn btn-ghost" style={{ padding: '4px', color: 'var(--color-danger)' }} aria-label={`Anular factura ${inv.invoiceNumber}`} title="Anular factura">
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
