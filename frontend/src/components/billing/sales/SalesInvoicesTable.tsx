import { Plus } from 'lucide-react';
import type { SalesInvoiceTypeFilter } from './sales.types';
import { isOfficialInvoice } from './salesBilling.helpers';

interface SalesInvoicesTableProps {
  salesInvoices: any[];
  loading: boolean;
  salesInvoiceTypeFilter: SalesInvoiceTypeFilter;
  setSalesInvoiceTypeFilter: (filter: SalesInvoiceTypeFilter) => void;
  onOpenDirectInvoiceModal: () => void;
  onViewInvoice: (invoice: any) => void;
  handleCreateCreditNoteFromInvoice: (invoice: any) => void;
}

export function SalesInvoicesTable({
  salesInvoices,
  loading,
  salesInvoiceTypeFilter,
  setSalesInvoiceTypeFilter,
  onOpenDirectInvoiceModal,
  onViewInvoice,
  handleCreateCreditNoteFromInvoice
}: SalesInvoicesTableProps) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 className="card-title" style={{ margin: '0' }}>🧾 Facturas y Comprobantes de Venta Emitidos</h3>
          <p style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--text-secondary)' }}>
            Solo se muestran pedidos con facturación fiscal o presupuestos en estado entregado.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            className="select"
            value={salesInvoiceTypeFilter}
            onChange={(e) => setSalesInvoiceTypeFilter(e.target.value as SalesInvoiceTypeFilter)}
            style={{ width: '150px' }}
          >
            <option value="ALL">Todos</option>
            <option value="OFFICIAL">Oficiales (A/B)</option>
            <option value="INTERNAL">Internos (Presup.)</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={onOpenDirectInvoiceModal}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            Emitir Factura Directa
          </button>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Comprobante / CAE</th>
              <th>Cliente</th>
              <th>CUIT</th>
              <th>Neto Gravado</th>
              <th>IVA (21%)</th>
              <th>Percep. IIBB</th>
              <th>Total</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center' }}>Cargando comprobantes de venta...</td>
              </tr>
            ) : salesInvoices.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center' }}>No se encontraron comprobantes emitidos.</td>
              </tr>
            ) : (
              salesInvoices
                .filter((inv) => {
                  if (salesInvoiceTypeFilter === 'ALL') return true;
                  const official = isOfficialInvoice(inv);
                  return salesInvoiceTypeFilter === 'OFFICIAL' ? official : !official;
                })
                .map((inv) => {
                  const decimalOpts =
                    inv.billingType === 'OFFICIAL' && inv.invoiceType === 'FACTURA_A'
                      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      : { minimumFractionDigits: 0, maximumFractionDigits: 0 };

                  return (
                    <tr key={inv.id} style={{ transition: 'background-color 0.2s hover' }}>
                      <td>{new Date(inv.createdAt).toLocaleDateString('es-AR')}</td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor:
                              inv.invoiceType === 'FACTURA_A'
                                ? '#E1F5FE'
                                : inv.invoiceType === 'FACTURA_B'
                                  ? '#E8F5E9'
                                  : '#ECEFF1',
                            color:
                              inv.invoiceType === 'FACTURA_A'
                                ? '#0288D1'
                                : inv.invoiceType === 'FACTURA_B'
                                  ? '#2E7D32'
                                  : 'var(--text-primary)'
                          }}
                        >
                          {inv.invoiceType === 'FACTURA_A'
                            ? 'Factura A'
                            : inv.invoiceType === 'FACTURA_B'
                              ? 'Factura B'
                              : inv.invoiceType === 'FACTURA_C'
                                ? 'Factura C'
                                : 'Factura'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{inv.invoiceNumber}</div>
                        {inv.cae && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>CAE: {inv.cae}</div>
                        )}
                      </td>
                      <td>{inv.persona?.name || 'Consumidor Final'}</td>
                      <td>{inv.persona?.cuit || 'Sin CUIT'}</td>
                      <td>${Number(inv.netAmount || 0).toLocaleString('es-AR', decimalOpts)}</td>
                      <td>${Number(inv.taxAmount || 0).toLocaleString('es-AR', decimalOpts)}</td>
                      <td>
                        {Number(inv.percepcionAmount || 0) > 0 ? (
                          <span style={{ color: 'var(--color-warning)', fontWeight: 500 }}>
                            ${Number(inv.percepcionAmount).toLocaleString('es-AR', decimalOpts)}
                          </span>
                        ) : (
                          '$0'
                        )}
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        ${Number(inv.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                            onClick={() => onViewInvoice(inv)}
                          >
                            Ver Factura
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.78rem',
                              color: 'var(--color-danger, #dc2626)',
                              borderColor: 'var(--color-danger, #dc2626)',
                              backgroundColor: 'transparent',
                              transition: 'all 0.2s'
                            }}
                            onClick={() => handleCreateCreditNoteFromInvoice(inv)}
                            title="Emitir Nota de Crédito para este comprobante"
                          >
                            Nota Crédito
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
  );
}
