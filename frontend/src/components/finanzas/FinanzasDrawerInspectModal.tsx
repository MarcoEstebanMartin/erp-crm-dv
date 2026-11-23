import React from 'react';
import { FileText, MapPin, X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { classifyDrawerHistoryRow, formatDrawerDateSummary } from '../rendiciones/drawerHistoryHelpers';
import { formatPaymentMethodLabel } from './finanzasHelpers';

interface FinanzasDrawerInspectModalProps {
  inspectingDrawer: any | null;
  onClose: () => void;
}

const formatPesos = (v: number) => `${v < 0 ? '-' : ''}$${Math.round(Math.abs(v)).toLocaleString('es-AR')}`;

export const FinanzasDrawerInspectModal: React.FC<FinanzasDrawerInspectModalProps> = ({
  inspectingDrawer,
  onClose,
}) => {
  const meta = inspectingDrawer ? classifyDrawerHistoryRow(inspectingDrawer) : null;
  const isCentral = Boolean(meta?.isCentral);
  const openingBal = Number(inspectingDrawer?.openingBalance ?? 0);
  const closingBal = Number(inspectingDrawer?.closingBalance ?? 0);
  const realBal = Number(inspectingDrawer?.realBalance ?? inspectingDrawer?.closingBalance ?? 0);
  const centralDiff = realBal - openingBal;
  const arqueoDiff = realBal - closingBal;
  const txs: any[] = inspectingDrawer?.transactions || [];

  let rowCash = 0;
  let rowCheck = 0;
  txs.forEach((t) => {
    const amt = Number(t.amount || 0);
    const sign = t.type === 'OUTCOME' ? -1 : 1;
    if (t.paymentMethod === 'CASH') rowCash += sign * amt;
    else if (t.paymentMethod === 'CHECK') rowCheck += sign * amt;
  });

  const dateInfo = inspectingDrawer ? formatDrawerDateSummary(inspectingDrawer, Boolean(meta?.isDepo)) : null;

  const summaryCards = isCentral
    ? [
        { label: 'Saldo Declarado', value: formatPesos(realBal), color: realBal < 0 ? '#c53030' : 'var(--text-primary)' },
        { label: 'Saldo Anterior', value: formatPesos(openingBal), color: openingBal < 0 ? '#c53030' : 'var(--text-primary)' },
        { label: 'Diferencia de Arqueo', value: centralDiff > 0 ? `+${formatPesos(centralDiff)}` : formatPesos(centralDiff), color: centralDiff === 0 ? 'var(--text-secondary)' : '#b45309' },
      ]
    : [
        { label: 'Arqueo Real', value: formatPesos(realBal), color: 'var(--text-primary)' },
        { label: 'Efectivo', value: formatPesos(rowCash), color: '#047857' },
        { label: 'Cheques', value: formatPesos(rowCheck), color: '#1d4ed8' },
        { label: 'Diferencia', value: arqueoDiff > 0 ? `+${formatPesos(arqueoDiff)}` : formatPesos(arqueoDiff), color: arqueoDiff === 0 ? '#047857' : arqueoDiff > 0 ? '#b45309' : '#c53030' },
      ];

  return (
    <NativeModalDialog
      isOpen={Boolean(inspectingDrawer)}
      onClose={onClose}
      ariaLabelledBy="fin-inspect-drawer-title"
      style={{ maxWidth: '880px', width: '95vw', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}
    >
      {inspectingDrawer && meta && (
        <>
          <div className="modal-header" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <FileText size={19} color="var(--color-corp-red)" aria-hidden="true" />
                <span style={{ padding: '2px 9px', borderRadius: '12px', fontSize: '0.73rem', fontWeight: 600, backgroundColor: meta.badgeBg, color: meta.badgeColor }}>
                  {meta.badgeLabel}
                </span>
                <h3 id="fin-inspect-drawer-title" style={{ margin: 0, fontSize: '1.12rem', fontWeight: 700 }}>
                  {isCentral ? 'Cierre de Caja Grande' : meta.responsibleName}
                </h3>
              </div>
              <div style={{ marginTop: '5px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span>{dateInfo?.primaryLabel}</span>
                {dateInfo?.rangeLabel && <span>{dateInfo.rangeLabel}</span>}
                {!isCentral && openingBal > 0 && <span>Fondo inicial: {formatPesos(openingBal)}</span>}
                {!isCentral && <span>Esperado: {formatPesos(closingBal)}</span>}
                {meta.showRouteNote && (
                  <span style={{ color: '#0284c7', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={13} aria-hidden="true" /> {inspectingDrawer.routeNote}
                  </span>
                )}
              </div>
            </div>
            <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} aria-label="Cerrar">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {summaryCards.map((card) => (
              <div key={card.label} style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{card.label}</span>
                <div className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 700, color: card.color, fontFamily: 'monospace', marginTop: '2px' }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {inspectingDrawer.notes && (
            <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.84rem', marginBottom: '16px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Observaciones: </span>
              <span>{inspectingDrawer.notes}</span>
            </div>
          )}

          {!isCentral && (
            txs.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Sin movimientos adjuntos.
              </div>
            ) : (
              <div className="table-container" role="region" aria-label="Movimientos del cierre" tabIndex={0}>
                <table style={{ fontSize: '0.84rem' }}>
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Comprobante</th>
                      <th scope="col">Cliente</th>
                      <th scope="col">Suc.</th>
                      <th scope="col">Medio</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txs.map((t: any) => {
                      const isOutcome = t.type === 'OUTCOME';
                      const concept = t.receiptNumber || (t.orderId ? `Pedido #${t.orderId}` : t.description || 'Movimiento interno');
                      return (
                        <tr key={t.id}>
                          <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                            {new Date(t.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td style={{ fontWeight: 600 }}>{concept}</td>
                          <td>{t.persona?.name || (t.orderId ? 'Consumidor Final' : '—')}</td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {t.billingType === 'OFFICIAL' ? 'A' : t.billingType === 'INTERNAL' ? 'X' : '—'}
                          </td>
                          <td>{formatPaymentMethodLabel(t.paymentMethod)}</td>
                          <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: isOutcome ? '#c53030' : '#047857' }}>
                            {isOutcome ? '-' : '+'}${Math.round(Number(t.amount || 0)).toLocaleString('es-AR')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}
    </NativeModalDialog>
  );
};
