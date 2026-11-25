import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { apiClient } from '../../../api/apiClient';

interface SensitiveEventItem {
  id: string;
  kind: 'VOID_OFFICE_RECEIPT' | 'VOID_FIELD_RECEIPT' | 'CASH_DISCREPANCY';
  occurredAt: string;
  actor: string;
  reference: string;
  subject: string;
  amount: number;
  reason: string;
}

interface SensitiveEventsPayload {
  days: number;
  summary: {
    totalCount: number;
    voidedReceiptsCount: number;
    voidedReceiptsAmount: number;
    cashDiscrepanciesCount: number;
    cashDiscrepanciesNet: number;
  };
  events: SensitiveEventItem[];
}

function formatDateTimeShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hh}:${mm}`;
}

function formatAmount(amount: number, signed = false): string {
  const rounded = Math.round(Number(amount || 0));
  const abs = Math.abs(rounded).toLocaleString('es-AR');
  if (rounded < 0) return `-$${abs}`;
  if (signed && rounded > 0) return `+$${abs}`;
  return `$${abs}`;
}

export const HomeSensitiveEventsStrip: React.FC = () => {
  const isAdmin =
    typeof window !== 'undefined' && localStorage.getItem('user_role') === 'ADMIN';
  const [days, setDays] = useState<1 | 7>(7);
  const [data, setData] = useState<SensitiveEventsPayload | null>(null);
  const [hasAnyInWeek, setHasAnyInWeek] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    apiClient
      .get<{ status: string; data: SensitiveEventsPayload }>(`/admin/sensitive-events?days=${days}`)
      .then((res) => {
        if (cancelled) return;
        const payload = res?.data;
        if (!payload) return;
        setData(payload);
        if (days === 7 && payload.summary.totalCount > 0) {
          setHasAnyInWeek(true);
        }
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, days]);

  if (!isAdmin || !data) return null;
  if (data.summary.totalCount === 0 && !hasAnyInWeek) return null;

  const { summary, events } = data;
  const parts: string[] = [];
  if (summary.voidedReceiptsCount > 0) {
    const label = summary.voidedReceiptsCount === 1 ? 'anulación' : 'anulaciones';
    parts.push(`${summary.voidedReceiptsCount} ${label} (${formatAmount(summary.voidedReceiptsAmount)})`);
  }
  if (summary.cashDiscrepanciesCount > 0) {
    const label = summary.cashDiscrepanciesCount === 1 ? 'diferencia de caja' : 'diferencias de caja';
    parts.push(`${summary.cashDiscrepanciesCount} ${label} (${formatAmount(summary.cashDiscrepanciesNet, true)})`);
  }

  return (
    <details
      style={{
        marginBottom: '16px',
        background: '#ffffff',
        border: summary.totalCount > 0 ? '1px solid #fecaca' : '1px solid #e5e7eb',
        borderRadius: '10px',
        overflow: 'hidden',
      }}
    >
      <summary
        style={{
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '9px 14px',
          cursor: 'pointer',
          fontSize: '0.82rem',
          fontWeight: 600,
          color: '#111827',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: summary.totalCount > 0 ? '#E30613' : '#9ca3af',
              flexShrink: 0,
            }}
          />
          <span className="tabular-nums" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {parts.length > 0 ? parts.join(' · ') : 'Sin eventos hoy'}
          </span>
        </span>

        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            role="group"
            aria-label="Período"
            style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: '6px', padding: '2px', gap: '2px' }}
          >
            {([1, 7] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setDays(opt)}
                style={{
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 7px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: days === opt ? '#111827' : 'transparent',
                  color: days === opt ? '#ffffff' : '#4b5563',
                }}
              >
                {opt === 1 ? 'Hoy' : '7 días'}
              </button>
            ))}
          </span>
          <ChevronDown size={14} color="#6b7280" aria-hidden="true" />
        </span>
      </summary>

      {events.length > 0 && (
        <div style={{ borderTop: '1px solid #f3f4f6', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6' }}>
                <th scope="col" style={{ padding: '7px 12px' }}>Fecha</th>
                <th scope="col" style={{ padding: '7px 12px' }}>Usuario</th>
                <th scope="col" style={{ padding: '7px 12px' }}>Comprobante</th>
                <th scope="col" style={{ padding: '7px 12px' }}>Detalle</th>
                <th scope="col" style={{ padding: '7px 12px', textAlign: 'right' }}>Monto</th>
                <th scope="col" style={{ padding: '7px 12px' }}>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const isCashDiff = ev.kind === 'CASH_DISCREPANCY';
                return (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                    <td className="tabular-nums" style={{ padding: '7px 12px', whiteSpace: 'nowrap', color: '#6b7280' }}>
                      {formatDateTimeShort(ev.occurredAt)}
                    </td>
                    <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', fontWeight: 600, color: '#111827' }}>
                      {ev.actor}
                    </td>
                    <td className="tabular-nums" style={{ padding: '7px 12px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {ev.reference}
                    </td>
                    <td style={{ padding: '7px 12px', color: '#374151' }}>{ev.subject}</td>
                    <td
                      className="tabular-nums"
                      style={{
                        padding: '7px 12px',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        fontWeight: 700,
                        color: isCashDiff && ev.amount > 0 ? '#059669' : '#E30613',
                      }}
                    >
                      {formatAmount(ev.amount, isCashDiff)}
                    </td>
                    <td style={{ padding: '7px 12px', color: '#4b5563' }}>{ev.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
};
