import type { FC } from 'react';
import { Plus, Check, DollarSign, Trash2 } from 'lucide-react';
export { ComprasProveedoresTab } from './ComprasProveedoresTab';

export const ComprasFacturasTab: FC<{
  isAdmin: boolean;
  supplierMetrics: { totalDeuda: number; vencidasCount: number; totalVencidas: number; proximasCount: number; totalProximas: number };
  filteredInvoices: any[];
  supplierQuery: string;
  setSupplierQuery: (v: string) => void;
  supplierStartDate: string;
  setSupplierStartDate: (v: string) => void;
  supplierEndDate: string;
  setSupplierEndDate: (v: string) => void;
  branchFilter: 'ALL' | 'OFFICIAL' | 'INTERNAL';
  setBranchFilter: (v: 'ALL' | 'OFFICIAL' | 'INTERNAL') => void;
  onOpenSupplierModal: () => void;
  onOpenPayInvoice: (inv: any) => void;
  onDeleteInvoice: (id: number, num: string) => void;
}> = ({
  isAdmin, supplierMetrics, filteredInvoices, supplierQuery, setSupplierQuery,
  supplierStartDate, setSupplierStartDate, supplierEndDate, setSupplierEndDate,
  branchFilter, setBranchFilter, onOpenSupplierModal, onOpenPayInvoice, onDeleteInvoice,
}) => {
  return (
    <div>
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Deuda Pendiente Total</span>
            <span className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 700 }}>${Math.round(supplierMetrics.totalDeuda).toLocaleString('es-AR')}</span>
          </div>
          <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--color-danger)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-danger)', fontWeight: 600 }}>Facturas Vencidas ({supplierMetrics.vencidasCount})</span>
            <span className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-danger)' }}>${Math.round(supplierMetrics.totalVencidas).toLocaleString('es-AR')}</span>
          </div>
          <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--color-warning)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', color: '#B78103', fontWeight: 600 }}>Vencimientos 7d ({supplierMetrics.proximasCount})</span>
            <span className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#B78103' }}>${Math.round(supplierMetrics.totalProximas).toLocaleString('es-AR')}</span>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Facturas de Compra</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <search aria-label="Filtrar facturas de compra" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <label htmlFor="compras-inv-search" className="visually-hidden">Buscar factura o proveedor</label>
              <input id="compras-inv-search" type="text" placeholder="Buscar factura o proveedor..." className="input" style={{ fontSize: '0.8rem', padding: '6px 12px' }} value={supplierQuery} onChange={(e) => setSupplierQuery(e.target.value)} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
              <label htmlFor="compras-inv-start" className="visually-hidden">Desde</label>
              <input id="compras-inv-start" type="date" className="input" style={{ fontSize: '0.8rem', padding: '6px 12px' }} value={supplierStartDate} onChange={(e) => setSupplierStartDate(e.target.value)} />
              <label htmlFor="compras-inv-end" className="visually-hidden">Hasta</label>
              <input id="compras-inv-end" type="date" className="input" style={{ fontSize: '0.8rem', padding: '6px 12px' }} value={supplierEndDate} onChange={(e) => setSupplierEndDate(e.target.value)} />
              <label htmlFor="compras-inv-branch" className="visually-hidden">Sucursal</label>
              <select id="compras-inv-branch" className="input" style={{ fontSize: '0.8rem', padding: '6px 12px', minWidth: '165px' }} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value as 'ALL' | 'OFFICIAL' | 'INTERNAL')}>
                <option value="ALL">Todas las sucursales</option>
                <option value="OFFICIAL">Sucursal A</option>
                <option value="INTERNAL">Sucursal X</option>
              </select>
            </search>
            <button type="button" className="btn btn-primary" onClick={onOpenSupplierModal}><Plus size={16} aria-hidden="true" /> Nueva Factura</button>
          </div>
        </div>

        <div className="table-container table-container--sticky" role="region" aria-label="Facturas de compra" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Emisión</th>
                <th scope="col">Vto.</th>
                <th scope="col">Tipo</th>
                <th scope="col">Sucursal</th>
                <th scope="col">Comprobante</th>
                <th scope="col">Proveedor</th>
                <th scope="col">Neto</th>
                <th scope="col">IVA</th>
                <th scope="col">Total</th>
                <th scope="col">Pagado</th>
                <th scope="col">Estado</th>
                <th scope="col" style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr><td colSpan={12} style={{ textAlign: 'center' }}>Sin comprobantes encontrados.</td></tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'PAID';
                  return (
                    <tr key={inv.id} style={isOverdue ? { backgroundColor: '#FFF5F5' } : undefined}>
                      <td className="tabular-nums">{new Date(inv.issueDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</td>
                      <td className="tabular-nums">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : 'S/D'}</td>
                      <td style={{ fontWeight: 600 }}>{inv.invoiceType?.replace('_', ' ')}</td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: inv.billingType === 'OFFICIAL' ? '#E8F5E9' : '#ECEFF1', color: inv.billingType === 'OFFICIAL' ? '#2E7D32' : '#37474F' }}>
                          {inv.billingType === 'OFFICIAL' ? 'Suc. A' : 'Suc. X'}
                        </span>
                      </td>
                      <td className="tabular-nums" style={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{inv.persona?.name}</div>
                        <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>CUIT: {inv.persona?.cuit}</div>
                      </td>
                      <td className="tabular-nums">${Number(inv.netAmount || 0).toLocaleString('es-AR')}</td>
                      <td className="tabular-nums">${Number(inv.taxAmount || 0).toLocaleString('es-AR')}</td>
                      <td className="tabular-nums" style={{ fontWeight: 700 }}>${Number(inv.totalAmount || 0).toLocaleString('es-AR')}</td>
                      <td className="tabular-nums">${Number(inv.paidAmount || 0).toLocaleString('es-AR')}</td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: inv.status === 'PAID' ? 'var(--color-success-bg)' : isOverdue ? '#FFF0F0' : 'var(--color-warning-bg)', color: inv.status === 'PAID' ? 'var(--color-success)' : isOverdue ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                          {inv.status === 'PAID' ? 'Saldada' : isOverdue ? 'Vencida' : 'Pendiente'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          {inv.status === 'PAID' ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Check size={12} aria-hidden="true" /> Saldada
                            </span>
                          ) : (
                            <button type="button" onClick={() => onOpenPayInvoice(inv)} className="btn" style={{ padding: '4px 10px', fontSize: '0.76rem', fontWeight: 600, backgroundColor: 'var(--color-success)', color: '#FFFFFF', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <DollarSign size={13} aria-hidden="true" /> Pagar
                            </button>
                          )}
                          <button type="button" onClick={() => onDeleteInvoice(inv.id, inv.invoiceNumber)} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--color-danger)' }} aria-label={`Anular factura ${inv.invoiceNumber}`} title="Anular factura">
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
