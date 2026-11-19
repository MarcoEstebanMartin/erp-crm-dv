import type { Dispatch, FC, FormEvent, SetStateAction } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import {
  computeRouteSettlementTotals,
  formatFieldReceiptBreakdown,
  type RouteSettlementRow,
} from './repartoSettlementHelpers';

interface RepartoSettleRouteModalProps {
  show: boolean;
  settleRoute: any | null;
  settlements: RouteSettlementRow[];
  setSettlements: Dispatch<SetStateAction<RouteSettlementRow[]>>;
  bankAccounts: any[];
  errorMsg: string | null;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}

export const RepartoSettleRouteModal: FC<RepartoSettleRouteModalProps> = ({
  show,
  settleRoute,
  settlements,
  setSettlements,
  bankAccounts,
  errorMsg,
  onClose,
  onSubmit,
}) => {
  const totals = computeRouteSettlementTotals(settlements);

  return (
    <NativeModalDialog
      isOpen={show && Boolean(settleRoute)}
      onClose={onClose}
      ariaLabelledBy="reparto-settle-modal-title"
      style={{ maxWidth: '1160px', width: '94vw', padding: '24px' }}
    >
      {settleRoute && (
        <>
          <div className="modal-header">
            <h3 id="reparto-settle-modal-title" className="tabular-nums">
              Liquidación de Viaje #{settleRoute.id}
            </h3>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '4px' }}
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div
            className="tabular-nums"
            style={{
              marginBottom: '12px',
              padding: '10px 14px',
              backgroundColor: '#f3e8fd',
              borderRadius: '6px',
              fontSize: '0.82rem',
              color: '#681da8',
            }}
          >
            Chofer: <strong>{settleRoute.driverName}</strong>
            {settleRoute.companionName && (
              <>
                {' '}| Acompañante: <strong>{settleRoute.companionName}</strong>
              </>
            )}
            {' '}| Patente: <strong>{settleRoute.vehiclePlate}</strong> | Pedidos:{' '}
            <strong>{settleRoute.orders?.length || 0}</strong>
          </div>

          <div
            className="tabular-nums"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '10px',
              marginBottom: '14px',
            }}
          >
            <div style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Efectivo</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#15803d' }}>
                ${totals.totalCash.toLocaleString('es-AR')}
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Transferencia</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0369a1' }}>
                ${totals.totalTransfer.toLocaleString('es-AR')}
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Cheques</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#6d28d9' }}>
                ${totals.totalCheck.toLocaleString('es-AR')}
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>A Cuenta (C/C)</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#b78103' }}>
                ${totals.totalCredit.toLocaleString('es-AR')}
              </div>
            </div>
          </div>

          <form onSubmit={onSubmit}>
            <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>
                Entregas y Cobros
              </h4>
              <div
                className="table-container"
                role="region"
                aria-label="Entregas y cobros del viaje"
                tabIndex={0}
                style={{ maxHeight: '52vh', minHeight: '320px', overflowY: 'auto' }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                      <th scope="col" style={{ padding: '8px 4px' }}>Cliente</th>
                      <th scope="col" style={{ padding: '8px 4px' }}>Comprobante</th>
                      <th scope="col" style={{ padding: '8px 6px', textAlign: 'right', width: '105px' }}>Importe</th>
                      <th scope="col" style={{ padding: '8px 4px', width: '165px' }}>Medio de Pago</th>
                      <th scope="col" style={{ padding: '8px 4px' }}>Detalles Cobro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((set, idx) => (
                      <tr key={set.orderId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '8px 4px', fontWeight: 600 }}>{set.clientName}</td>
                        <td className="tabular-nums" style={{ padding: '8px 4px' }}>{set.invoiceNumber}</td>
                        <td className="tabular-nums" style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>
                          ${Math.round(Number(set.amount || 0)).toLocaleString('es-AR')}
                        </td>
                        <td style={{ padding: '8px 4px' }}>
                          {set.lockedByFieldReceipt ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                backgroundColor: '#dcfce7',
                                color: '#15803d',
                                border: '1px solid #86efac',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <CheckCircle size={12} aria-hidden="true" />
                              Recibo en calle
                            </span>
                          ) : (
                            <select
                              aria-label={`Medio de pago ${set.clientName}`}
                              className="input"
                              style={{ padding: '2px 4px', fontSize: '0.78rem', height: '28px' }}
                              value={set.paymentMethod}
                              onChange={(e) => {
                                const val = e.target.value as RouteSettlementRow['paymentMethod'];
                                setSettlements((prev) =>
                                  prev.map((s, i) =>
                                    i === idx
                                      ? { ...s, paymentMethod: val, isEcheq: val === 'CHECK' ? Boolean(s.isEcheq) : false }
                                      : s,
                                  ),
                                );
                              }}
                            >
                              <option value="CREDITO">A Cuenta (C/C)</option>
                              <option value="CASH">Efectivo</option>
                              <option value="BANK_TRANSFER">Transferencia</option>
                              <option value="CHECK">Cheque</option>
                            </select>
                          )}
                        </td>
                        <td style={{ padding: '8px 4px' }}>
                          {set.paymentMethod === 'FIELD_RECEIPT' && set.fieldReceipts && (
                            <div className="tabular-nums" style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
                              {set.fieldReceipts.receiptNumbers.join(', ')} ·{' '}
                              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                {formatFieldReceiptBreakdown(set.fieldReceipts)}
                              </span>
                            </div>
                          )}
                          {set.paymentMethod === 'BANK_TRANSFER' && (
                            <select
                              aria-label={`Cuenta bancaria ${set.clientName}`}
                              className="input"
                              style={{ padding: '2px 4px', fontSize: '0.75rem', height: '28px' }}
                              value={set.bankAccountId}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSettlements((prev) => prev.map((s, i) => (i === idx ? { ...s, bankAccountId: val } : s)));
                              }}
                            >
                              {bankAccounts.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                          )}
                          {set.paymentMethod === 'CHECK' && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <input
                                type="text"
                                aria-label={`Número de cheque ${set.clientName}`}
                                placeholder="N° Cheque"
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                className="input tabular-nums"
                                style={{ padding: '2px 6px', fontSize: '0.76rem', height: '28px', width: '105px' }}
                                value={set.checkNumber}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSettlements((prev) => prev.map((s, i) => (i === idx ? { ...s, checkNumber: val } : s)));
                                }}
                                required
                              />
                              <input
                                type="text"
                                aria-label={`Emisor de cheque ${set.clientName}`}
                                placeholder="Emisor"
                                className="input"
                                style={{ padding: '2px 6px', fontSize: '0.76rem', height: '28px', flex: '1 1 120px', minWidth: '110px' }}
                                value={set.checkIssuer}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSettlements((prev) => prev.map((s, i) => (i === idx ? { ...s, checkIssuer: val } : s)));
                                }}
                                required
                              />
                              <label
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  color: set.isEcheq ? '#0369a1' : 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  padding: '0 8px',
                                  height: '28px',
                                  borderRadius: '4px',
                                  border: `1px solid ${set.isEcheq ? '#7dd3fc' : 'var(--border-color)'}`,
                                  backgroundColor: set.isEcheq ? '#f0f9ff' : 'transparent',
                                  userSelect: 'none',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  aria-label={`Es eCheq ${set.clientName}`}
                                  checked={Boolean(set.isEcheq)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSettlements((prev) => prev.map((s, i) => (i === idx ? { ...s, isEcheq: checked } : s)));
                                  }}
                                  style={{ width: '14px', height: '14px', margin: 0, accentColor: '#0284c7', cursor: 'pointer' }}
                                />
                                <span>eCheq</span>
                              </label>
                            </div>
                          )}
                          {set.paymentMethod === 'CASH' && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Custodia chofer (A rendir)</span>
                          )}
                          {set.paymentMethod === 'CREDITO' && (
                            <span style={{ fontSize: '0.72rem', color: '#b78103', fontWeight: 600 }}>Deuda en C/C</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                style={{
                  backgroundColor: '#FFF2F2',
                  borderLeft: '4px solid var(--color-danger)',
                  color: 'var(--color-danger)',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  marginBottom: '14px',
                  fontWeight: 600,
                }}
              >
                {errorMsg}
              </div>
            )}

            <div className="modal-footer" style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ backgroundColor: 'var(--color-corp-red)', borderColor: 'var(--color-corp-red)' }}
              >
                Liquidar Viaje
              </button>
            </div>
          </form>
        </>
      )}
    </NativeModalDialog>
  );
};
