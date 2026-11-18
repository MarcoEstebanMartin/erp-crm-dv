import type { FC } from 'react';
import { Plus, Check, DollarSign, Trash2, ScanLine, Truck } from 'lucide-react';
import { formatCuitDisplay, formatMoneyArs } from './providersHelpers';
export { ComprasProveedoresTab } from './ComprasProveedoresTab';

export const ComprasFacturasTab: FC<{
  isAdmin: boolean;
  supplierMetrics: {
    totalDeuda: number; vencidasCount: number; totalVencidas: number;
    proximasCount: number; totalProximas: number; enTransitoCount: number;
  };
  filteredInvoices: any[];
  supplierQuery: string;
  setSupplierQuery: (v: string) => void;
  supplierStartDate: string;
  setSupplierStartDate: (v: string) => void;
  supplierEndDate: string;
  setSupplierEndDate: (v: string) => void;
  branchFilter: 'ALL' | 'OFFICIAL' | 'INTERNAL';
  setBranchFilter: (v: 'ALL' | 'OFFICIAL' | 'INTERNAL') => void;
  invoiceReceptionFilter: 'ALL' | 'IN_TRANSIT';
  setInvoiceReceptionFilter: (v: 'ALL' | 'IN_TRANSIT') => void;
  onOpenSupplierModal: () => void;
  onSelectScannerFile: (file: File) => void;
  onOpenReceiveInvoice: (inv: any) => void;
  onOpenPayInvoice: (inv: any) => void;
  onDeleteInvoice: (id: number, num: string) => void;
}> = ({
  isAdmin, supplierMetrics, filteredInvoices, supplierQuery, setSupplierQuery,
  supplierStartDate, setSupplierStartDate, supplierEndDate, setSupplierEndDate,
  branchFilter, setBranchFilter, invoiceReceptionFilter, setInvoiceReceptionFilter,
  onOpenSupplierModal, onSelectScannerFile, onOpenReceiveInvoice, onOpenPayInvoice, onDeleteInvoice,
}) => {
  return (
    <div>
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
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
          <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>En tránsito</span>
            <span className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700 }}>{supplierMetrics.enTransitoCount}</span>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Facturas</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <search aria-label="Filtrar facturas de compra" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <label htmlFor="compras-inv-search" className="visually-hidden">Buscar factura o proveedor</label>
              <input id="compras-inv-search" type="text" placeholder="Buscar factura o proveedor..." className="input" style={{ fontSize: '0.8rem', padding: '6px 12px', width: '210px' }} value={supplierQuery} onChange={(e) => setSupplierQuery(e.target.value)} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
              <label htmlFor="compras-inv-start" className="visually-hidden">Desde</label>
              <input id="compras-inv-start" type="date" className="input" style={{ fontSize: '0.8rem', padding: '6px 10px' }} value={supplierStartDate} onChange={(e) => setSupplierStartDate(e.target.value)} />
              <label htmlFor="compras-inv-end" className="visually-hidden">Hasta</label>
              <input id="compras-inv-end" type="date" className="input" style={{ fontSize: '0.8rem', padding: '6px 10px' }} value={supplierEndDate} onChange={(e) => setSupplierEndDate(e.target.value)} />
              <label htmlFor="compras-inv-branch" className="visually-hidden">Sucursal</label>
              <select id="compras-inv-branch" className="input" style={{ fontSize: '0.8rem', padding: '6px 10px', minWidth: '140px' }} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value as 'ALL' | 'OFFICIAL' | 'INTERNAL')}>
                <option value="ALL">Todas</option>
                <option value="OFFICIAL">Sucursal A</option>
                <option value="INTERNAL">Sucursal X</option>
              </select>
              <label htmlFor="compras-inv-reception" className="visually-hidden">Estado de mercadería</label>
              <select id="compras-inv-reception" className="input" style={{ fontSize: '0.8rem', padding: '6px 10px', minWidth: '135px' }} value={invoiceReceptionFilter} onChange={(e) => setInvoiceReceptionFilter(e.target.value as 'ALL' | 'IN_TRANSIT')}>
                <option value="ALL">Todos los ingresos</option>
                <option value="IN_TRANSIT">En tránsito</option>
              </select>
            </search>
            <label htmlFor="compras-scanner-input" className="btn" style={{ backgroundColor: 'var(--color-corp-red)', color: '#FFFFFF', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0 14px', height: '36px', margin: 0, fontWeight: 600, fontSize: '0.82rem' }}>
              <ScanLine size={15} aria-hidden="true" />
              <span>Escanear factura</span>
              <input id="compras-scanner-input" type="file" accept="image/*,application/pdf" className="visually-hidden" onChange={(e) => { if (e.target.files?.[0]) onSelectScannerFile(e.target.files[0]); e.target.value = ''; }} />
            </label>
            <button type="button" className="btn btn-primary" style={{ height: '36px' }} onClick={onOpenSupplierModal}><Plus size={15} aria-hidden="true" /> Nueva factura</button>
          </div>
        </div>

        <div className="table-container table-container--sticky" role="region" aria-label="Facturas de compra" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Emisión</th><th scope="col">Vto.</th><th scope="col">Tipo</th><th scope="col">Sucursal</th>
                <th scope="col">Comprobante</th><th scope="col">Proveedor</th><th scope="col">Neto</th><th scope="col">IVA</th>
                <th scope="col">Total</th><th scope="col">Pagado</th><th scope="col">Mercadería</th><th scope="col">Estado</th>
                <th scope="col" style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr><td colSpan={13} style={{ textAlign: 'center' }}>Sin comprobantes encontrados.</td></tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'PAID';
                  const cuit = formatCuitDisplay(inv.persona?.cuit);
                  const canReceive = inv.receptionStatus === 'IN_TRANSIT' && Boolean(inv.purchaseOrder);
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
                        {cuit && <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>CUIT: {cuit}</div>}
                      </td>
                      <td className="tabular-nums">{formatMoneyArs(inv.netAmount)}</td>
                      <td className="tabular-nums">{formatMoneyArs(inv.taxAmount)}</td>
                      <td className="tabular-nums" style={{ fontWeight: 700 }}>{formatMoneyArs(inv.totalAmount)}</td>
                      <td className="tabular-nums">{formatMoneyArs(inv.paidAmount)}</td>
                      <td>
                        {inv.receptionStatus === 'IN_TRANSIT' ? (
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--color-warning-bg)', color: '#B78103' }}>En tránsito</span>
                        ) : inv.receptionStatus === 'RECEIVED' ? (
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}>Ingresada</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: inv.status === 'PAID' ? 'var(--color-success-bg)' : isOverdue ? '#FFF0F0' : 'var(--color-warning-bg)', color: inv.status === 'PAID' ? 'var(--color-success)' : isOverdue ? 'var(--color-danger)' : '#B78103' }}>
                          {inv.status === 'PAID' ? 'Saldada' : isOverdue ? 'Vencida' : 'Pendiente'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {canReceive && (
                            <button type="button" onClick={() => onOpenReceiveInvoice(inv)} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Truck size={13} aria-hidden="true" /> Recibir
                            </button>
                          )}
                          {inv.status === 'PAID' ? (
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
