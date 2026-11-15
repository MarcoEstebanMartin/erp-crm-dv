import { Plus, Zap } from 'lucide-react';
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
          marginBottom: '16px',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 className="card-title" style={{ margin: 0 }}>
            Facturas y Comprobantes de Venta Emitidos
          </h3>
          <p style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--text-secondary)' }}>
            Comprobantes con facturación fiscal (incluyendo Pre-Facturas pendientes de CAE) o presupuestos entregados.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenDirectInvoiceModal}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          Emitir Factura Directa
        </button>
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
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center' }}>
                  Cargando comprobantes de venta...
                </td>
              </tr>
            ) : visibleInvoices.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center' }}>
                  No se encontraron comprobantes emitidos.
                </td>
              </tr>
            ) : (
              visibleInvoices.map((inv) => {
                const persona = resolveOrderPersona(inv);
                const pendingCae = isOrderPendingCae(inv);
                const decimalOpts =
                  inv.billingType === 'OFFICIAL' && inv.invoiceType === 'FACTURA_A'
                    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                    : { minimumFractionDigits: 0, maximumFractionDigits: 0 };

                return (
                  <tr key={inv.id}>
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
                                : 'var(--text-primary)',
                        }}
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
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '2px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#FEF3C7',
                            color: '#B45309',
                            border: '1px solid #F59E0B',
                          }}
                        >
                          Sin CAE (Pre-Factura)
                        </span>
                      ) : null}
                    </td>
                    <td>{persona?.name || inv.clientName || 'Consumidor Final'}</td>
                    <td>{persona?.cuit || 'Sin CUIT'}</td>
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
                      $
                      {Number(inv.totalAmount).toLocaleString('es-AR', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {pendingCae && onRequestOrderCae && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={requestingCaeOrderId === inv.id}
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.76rem',
                              backgroundColor: '#D97706',
                              borderColor: '#D97706',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            onClick={() => onRequestOrderCae(inv.id)}
                            title="Solicitar CAE a AFIP/ARCA para autorizar esta Pre-Factura"
                          >
                            <Zap size={12} />
                            {requestingCaeOrderId === inv.id ? 'Solicitando...' : 'Solicitar CAE'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                          onClick={() => onViewInvoice(inv)}
                        >
                          Ver Factura
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.78rem',
                            color: 'var(--color-danger, #dc2626)',
                            borderColor: 'var(--color-danger, #dc2626)',
                            backgroundColor: 'transparent',
                            transition: 'all 0.2s',
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
