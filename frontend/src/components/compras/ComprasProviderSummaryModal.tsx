import type { FC } from 'react';
import { X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import {
  buildProviderLedgerStatement,
  computeProviderPayableSummary,
  formatCentsArs,
  formatCuitDisplay,
} from './providersHelpers';

export interface ComprasProviderSummaryModalProps {
  accountSummaryModal: any | null;
  onClose: () => void;
  ledgerData: any[];
  loading?: boolean;
  errorMsg?: string | null;
}

export const ComprasProviderSummaryModal: FC<ComprasProviderSummaryModalProps> = ({
  accountSummaryModal,
  onClose,
  ledgerData,
  loading = false,
  errorMsg = null,
}) => {
  const statement = accountSummaryModal
    ? buildProviderLedgerStatement(ledgerData, accountSummaryModal)
    : { rows: [], finalPayableCents: 0, finalPayableAmount: 0 };

  const fallbackSummary = accountSummaryModal
    ? computeProviderPayableSummary(accountSummaryModal)
    : { payableCents: 0, favorCents: 0, overdueInvoicesCount: 0 };

  const effectivePayableCents =
    statement.rows.length > 0
      ? statement.finalPayableCents
      : fallbackSummary.payableCents > 0
        ? fallbackSummary.payableCents
        : fallbackSummary.favorCents > 0
          ? -fallbackSummary.favorCents
          : 0;

  const kpiLabel =
    effectivePayableCents > 0
      ? 'Saldo a pagar'
      : effectivePayableCents < 0
        ? 'Saldo a favor'
        : 'Al día';

  const kpiColor =
    effectivePayableCents > 0
      ? fallbackSummary.overdueInvoicesCount > 0
        ? '#E30613'
        : '#0f172a'
      : effectivePayableCents < 0
        ? '#059669'
        : '#64748b';

  const cuitFormatted = accountSummaryModal ? formatCuitDisplay(accountSummaryModal.cuit) : null;
  const subParts = accountSummaryModal
    ? [cuitFormatted ? `CUIT ${cuitFormatted}` : null, accountSummaryModal.phone || null, accountSummaryModal.city || null].filter(Boolean)
    : [];

  return (
    <NativeModalDialog
      isOpen={Boolean(accountSummaryModal)}
      onClose={onClose}
      ariaLabelledBy="prov-summary-modal-title"
      style={{ maxWidth: '860px', width: '94vw', padding: '24px' }}
    >
      {accountSummaryModal && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '16px',
              paddingBottom: '14px',
              borderBottom: '1px solid var(--border-color)',
              marginBottom: '16px',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h3 id="prov-summary-modal-title" style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700 }}>
                {accountSummaryModal.name}
              </h3>
              {subParts.length > 0 && (
                <div className="tabular-nums" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                  {subParts.join(' · ')}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {kpiLabel}
                </div>
                <div className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 700, color: kpiColor }}>
                  {formatCentsArs(Math.abs(effectivePayableCents))}
                </div>
              </div>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} aria-label="Cerrar">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          {errorMsg && (
            <div role="alert" className="alert alert-danger" style={{ marginBottom: '12px' }}>
              {errorMsg}
            </div>
          )}

          <div
            className="table-container table-container--sticky"
            role="region"
            aria-label="Cuenta corriente del proveedor"
            tabIndex={0}
            style={{ maxHeight: '400px', overflowY: 'auto' }}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Referencia</th>
                  <th scope="col">Detalle</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Pagos</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Compras</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                      Cargando movimientos...
                    </td>
                  </tr>
                ) : statement.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                      Sin movimientos registrados.
                    </td>
                  </tr>
                ) : (
                  statement.rows.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="tabular-nums" style={{ whiteSpace: 'nowrap' }}>
                        {item.date ? new Date(item.date).toLocaleDateString('es-AR') : '—'}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            backgroundColor: item.kindLabel === 'Pago' ? '#ecfdf5' : '#f1f5f9',
                            color: item.kindLabel === 'Pago' ? '#047857' : '#334155',
                          }}
                        >
                          {item.kindLabel}
                        </span>
                      </td>
                      <td className="tabular-nums">{item.reference || '—'}</td>
                      <td>{item.description || '—'}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                        {item.pagoCents > 0 ? formatCentsArs(item.pagoCents) : ''}
                      </td>
                      <td className="tabular-nums" style={{ textAlign: 'right', color: '#0f172a', fontWeight: 600 }}>
                        {item.compraCents > 0 ? formatCentsArs(item.compraCents) : ''}
                      </td>
                      <td
                        className="tabular-nums"
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: item.runningPayableCents < 0 ? '#059669' : '#0f172a',
                        }}
                      >
                        {item.runningPayableCents < 0
                          ? `A favor ${formatCentsArs(Math.abs(item.runningPayableCents))}`
                          : formatCentsArs(item.runningPayableCents)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="modal-footer" style={{ marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </>
      )}
    </NativeModalDialog>
  );
};
