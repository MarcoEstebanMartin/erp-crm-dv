import { Printer } from 'lucide-react';
import type { CollectorSettlementDTO } from '../../api/fieldReceipts.api';
import { api } from '../../utils/api';
import {
  buildFieldSettlementTicketData,
  formatTicketTimestampAr,
  printHandoverTicket80mm,
} from '../../utils/print/printHandoverTicket80mm';
import { formatCurrency } from './types';

interface RecentApprovedSettlementsCardProps {
  settlements: CollectorSettlementDTO[];
}

export function RecentApprovedSettlementsCard({
  settlements,
}: RecentApprovedSettlementsCardProps) {
  if (settlements.length === 0) return null;

  const receivedBy = api.getCurrentUser()?.username || 'Caja / Administración';

  return (
    <section className="card" style={{ padding: '16px 24px' }}>
      <details>
        <summary
          className="tabular-nums"
          style={{
            cursor: 'pointer',
            fontSize: '0.92rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            userSelect: 'none',
          }}
        >
          Rendiciones aprobadas ({settlements.length})
        </summary>
        <div style={{ marginTop: '12px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Comprobante</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Fecha y Hora</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Entregó</th>
                <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Efectivo</th>
                <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Total</th>
                <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Ticket</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => {
                const declaredCash = Math.round(Number(s.declaredCash ?? s.expectedCash ?? 0));
                const checks = Math.round(Number(s.expectedChecksAmount || 0));
                const transfers = Math.round(Number(s.pendingTransfersAmount || 0));
                const total = declaredCash + checks + transfers;
                const ts = formatTicketTimestampAr(s.approvedAt || s.createdAt);

                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td className="tabular-nums" style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 600 }}>
                      REND-{String(s.id).padStart(5, '0')}
                    </td>
                    <td className="tabular-nums" style={{ padding: '8px', color: 'var(--text-secondary)' }}>
                      {ts}
                    </td>
                    <td style={{ padding: '8px', fontWeight: 600 }}>
                      {(s.collector?.username || `Cobrador #${s.collectorUserId}`).toUpperCase()}
                    </td>
                    <td className="tabular-nums" style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCurrency(declaredCash)}
                    </td>
                    <td className="tabular-nums" style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                      {formatCurrency(total)}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.76rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                        onClick={() =>
                          printHandoverTicket80mm(
                            buildFieldSettlementTicketData(s, {
                              declaredCash,
                              receivedBy,
                              approvedAt: s.approvedAt || s.createdAt,
                              isReprint: true,
                            }),
                          )
                        }
                      >
                        <Printer size={13} aria-hidden="true" /> Reimprimir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
