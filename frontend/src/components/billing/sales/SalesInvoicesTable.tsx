import { AlertCircle, Plus, Zap } from 'lucide-react';
import type { SalesInvoiceTypeFilter } from './sales.types';
import { isOfficialInvoice } from './salesBilling.helpers';
import { isOrderPendingCae, resolveOrderPersona } from '../../../utils/orderSearchAndStatus.helper';

interface SalesInvoicesTableProps {
  salesInvoices: any[];
  loading: boolean;
  salesInvoiceTypeFilter: SalesInvoiceTypeFilter;
  requestingCaeOrderId?: number | null;
  onRequestOrderCae?: (orderId: number) => void;
  onOpenDirectInvoiceModal: () => void;
  onViewInvoice: (invoice: any) => void;
  handleCreateCreditNoteFromInvoice: (invoice: any) => void;
}

export function SalesInvoicesTable({
  salesInvoices,
  loading,
  salesInvoiceTypeFilter,
  requestingCaeOrderId,
  onRequestOrderCae,
  onOpenDirectInvoiceModal,
  onViewInvoice,
  handleCreateCreditNoteFromInvoice,
}: SalesInvoicesTableProps) {
  const visibleInvoices = salesInvoices.filter((inv) => {
    if (salesInvoiceTypeFilter === 'ALL') return true;
    const official = isOfficialInvoice(inv);
    return salesInvoiceTypeFilter === 'OFFICIAL' ? official : !official;
  });

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 className="card-title" style={{ margin: 0 }}>
            Facturas y Comprobantes de Venta Emitidos
          </h3>
          <p style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--text-secondary)' }}>
            Comprobantes fiscales autorizados, Pre-Facturas pendientes de CAE y presupuestos entregados.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenDirectInvoiceModal}
        >
          <Plus size={16} aria-hidden="true" />
          Emitir Factura Directa
        </button>
      </div>

      <div
        className="table-container table-container--sticky"
        role="region"
        aria-label="Facturas y comprobantes de venta emitidos"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Tipo</th>
              <th scope="col">Comprobante / CAE</th>
              <th scope="col">Cliente</th>
              <th scope="col">CUIT</th>
              <th scope="col" style={{ textAlign: 'right' }}>Neto Gravado</th>
              <th scope="col" style={{ textAlign: 'right' }}>IVA (21%)</th>
              <th scope="col" style={{ textAlign: 'right' }}>Percep. IIBB</th>
              <th scope="col" style={{ textAlign: 'right' }}>Total</th>
              <th scope="col" style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
                  Cargando comprobantes de venta...
                </td>
              </tr>
            ) : visibleInvoices.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
                  No se encontraron comprobantes emitidos.
                </td>
              </tr>
            ) : (
              visibleInvoices.map((inv) => {
                const persona = resolveOrderPersona(inv);
                const pendingCae = isOrderPendingCae(inv);
                const isOfficial = inv.billingType === 'OFFICIAL';
                const decimalOpts =
                  isOfficial && inv.invoiceType === 'FACTURA_A'
                    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                    : { minimumFractionDigits: 0, maximumFractionDigits: 0 };

                return (
                  <tr key={inv.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(inv.createdAt).toLocaleDateString('es-AR')}
                    </td>
                    <td>
                      <span
                        className={
                          isOfficial ? 'badge-minimal badge-minimal--solid' : 'badge-minimal'
                        }
                      >
                        {inv.invoiceType === 'FACTURA_A'
                          ? 'Factura A'
                          : inv.invoiceType === 'FACTURA_B'
                            ? 'Factura B'
                            : inv.invoiceType === 'FACTURA_C'
                              ? 'Factura C'
                              : 'Presup. X'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{inv.invoiceNumber}</div>
                      {inv.cae ? (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          CAE: {inv.cae}
                        </div>
                      ) : pendingCae ? (
                        <span className="badge-minimal badge-minimal--danger" style={{ marginTop: '3px', fontSize: '0.68rem' }}>
                          <AlertCircle size={11} aria-hidden="true" />
                          Sin CAE (Pre-Factura)
                        </span>
                      ) : null}
                    </td>
                    <td style={{ fontWeight: 500, color: '#111827' }}>
                      {persona?.name || inv.clientName || 'Consumidor Final'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{persona?.cuit || 'Sin CUIT'}</td>
                    <td style={{ textAlign: 'right' }}>
                      ${Number(inv.netAmount || 0).toLocaleString('es-AR', decimalOpts)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      ${Number(inv.taxAmount || 0).toLocaleString('es-AR', decimalOpts)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {Number(inv.percepcionAmount || 0) > 0
                        ? `$${Number(inv.percepcionAmount).toLocaleString('es-AR', decimalOpts)}`
                        : '$0'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                      ${Number(inv.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {pendingCae && onRequestOrderCae && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={requestingCaeOrderId === inv.id}
                            style={{
                              padding: '4px 9px',
                              fontSize: '0.75rem',
                              backgroundColor: '#E30613',
                              borderColor: '#E30613',
                            }}
                            onClick={() => onRequestOrderCae(inv.id)}
                            title="Solicitar CAE a AFIP/ARCA para autorizar esta Pre-Factura"
                          >
                            <Zap size={12} aria-hidden="true" />
                            {requestingCaeOrderId === inv.id ? 'Solicitando...' : 'Solicitar CAE'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 9px', fontSize: '0.76rem', color: '#111827' }}
                          onClick={() => onViewInvoice(inv)}
                        >
                          Ver Factura
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 9px', fontSize: '0.76rem' }}
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
