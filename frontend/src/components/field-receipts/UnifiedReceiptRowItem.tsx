import React from 'react';
import { Ban, FileDown } from 'lucide-react';
import {
  type FieldReceiptDTO,
  type OfficeReceiptDTO,
} from '../../api/fieldReceipts.api';

export interface UnifiedReceiptRow {
  key: string;
  origin: 'OFFICE' | 'SELLER' | 'DRIVER';
  date: string;
  receiptNumber: string;
  clientName: string;
  collectorName: string;
  paymentMethodLabel: string;
  amount: number;
  isVoided: boolean;
  voidedByName?: string | null;
  voidReason?: string | null;
  voidBlockedReason?: string | null;
  verified: boolean;
  viewUrl: string | null;
  officeReceipt?: OfficeReceiptDTO;
  fieldReceipt?: FieldReceiptDTO;
}

interface UnifiedReceiptRowItemProps {
  row: UnifiedReceiptRow;
  busyPdfKey: string | null;
  onDownloadOfficePdf: (row: UnifiedReceiptRow) => void;
  onOpenWhatsApp: (row: UnifiedReceiptRow) => void;
  onResendWhatsApp: (receiptId: number) => Promise<void>;
  onRejectCheck: (paymentId: number) => Promise<void>;
  onDeleteOfficeReceipt: (receipt: OfficeReceiptDTO) => Promise<void>;
  onVoidFieldReceipt: (receipt: FieldReceiptDTO) => Promise<void>;
}

const WhatsAppLogo: React.FC = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12.031 2C6.506 2 2.02 6.486 2.02 12.011c0 1.766.461 3.49 1.337 5.008L2 22l5.106-1.339a9.97 9.97 0 0 0 4.925 1.298h.004c5.524 0 10.011-4.487 10.011-10.012A9.946 9.946 0 0 0 19.11 4.93 9.946 9.946 0 0 0 12.031 2Zm5.878 14.165c-.248.698-1.448 1.335-2.002 1.416-.513.076-1.162.108-1.875-.118-.432-.137-.987-.32-1.696-.627-2.984-1.288-4.933-4.307-5.082-4.506-.148-.199-1.212-1.613-1.212-3.077 0-1.464.767-2.184 1.039-2.482.273-.298.595-.372.793-.372.198 0 .396.002.57.01.183.01.428-.07.67.512.248.596.843 2.058.918 2.207.074.149.124.323.025.522-.099.199-.149.323-.297.497-.149.174-.313.389-.446.522-.149.149-.304.31-.13.608.173.298.771 1.273 1.656 2.062 1.137 1.014 2.096 1.328 2.394 1.477.298.149.471.124.645-.075.174-.199.744-.869.943-1.167.198-.298.397-.248.67-.149.272.1 1.735.818 2.033.967.297.149.496.224.57.348.075.124.075.72-.173 1.418Z" />
  </svg>
);

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}, ${hh}:${mm}`;
}

export const UnifiedReceiptRowItem: React.FC<UnifiedReceiptRowItemProps> = ({
  row,
  busyPdfKey,
  onDownloadOfficePdf,
  onOpenWhatsApp,
  onResendWhatsApp,
  onRejectCheck,
  onDeleteOfficeReceipt,
  onVoidFieldReceipt,
}) => {
  const isPdfBusy = busyPdfKey === `pdf-${row.key}`;

  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ padding: '10px', whiteSpace: 'nowrap', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
        {formatDateTime(row.date)}
      </td>
      <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{row.receiptNumber}</strong>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '1px 7px',
              borderRadius: '999px',
              background: row.origin === 'OFFICE' ? '#eff6ff' : row.origin === 'DRIVER' ? '#f0fdf4' : '#f3f4f6',
              color: row.origin === 'OFFICE' ? '#1d4ed8' : row.origin === 'DRIVER' ? '#15803d' : '#374151',
            }}
          >
            {row.origin === 'OFFICE' ? 'Oficina' : row.origin === 'DRIVER' ? 'Repartidor' : 'Vendedor'}
          </span>
          {row.isVoided && (
            <span
              title={row.voidReason || 'Anulado'}
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: '999px',
                background: '#fef2f2',
                color: '#E30613',
                border: '1px solid #fecaca',
              }}
            >
              Anulado
            </span>
          )}
        </div>
      </td>
      <td style={{ padding: '10px' }}>
        <div style={{ fontWeight: 600, color: row.isVoided ? '#6b7280' : '#111827' }}>{row.clientName}</div>
        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          {row.collectorName}
          {row.isVoided && (row.voidedByName || row.voidReason) && (
            <span style={{ color: '#b91c1c' }}>
              {' · '}Anuló {row.voidedByName || 'Admin'}
              {row.voidReason ? `: ${row.voidReason}` : ''}
            </span>
          )}
        </div>
      </td>
      <td style={{ padding: '10px', whiteSpace: 'nowrap', color: '#374151' }}>
        {row.paymentMethodLabel}
        {!row.verified && !row.isVoided && (
          <span style={{ marginLeft: '6px', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '999px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
            Pendiente
          </span>
        )}
      </td>
      <td
        style={{
          padding: '10px',
          textAlign: 'right',
          whiteSpace: 'nowrap',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: row.isVoided ? '#9ca3af' : '#111827',
          textDecoration: row.isVoided ? 'line-through' : 'none',
        }}
      >
        ${row.amount.toLocaleString('es-AR')}
      </td>
      <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {row.officeReceipt && !row.isVoided && (
            <button
              type="button"
              onClick={() => onDownloadOfficePdf(row)}
              disabled={isPdfBusy}
              title="Descargar PDF"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                height: '28px',
                padding: '0 9px',
                borderRadius: '6px',
                border: '1px solid #18181b',
                background: '#18181b',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: isPdfBusy ? 'wait' : 'pointer',
                opacity: isPdfBusy ? 0.65 : 1,
              }}
            >
              <FileDown size={13} aria-hidden="true" /> {isPdfBusy ? '…' : 'PDF'}
            </button>
          )}
          {!row.officeReceipt && !row.isVoided && row.viewUrl && (
            <a
              href={row.viewUrl}
              target="_blank"
              rel="noreferrer"
              title="Abrir PDF"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                height: '28px',
                padding: '0 9px',
                borderRadius: '6px',
                border: '1px solid #18181b',
                background: '#18181b',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <FileDown size={13} aria-hidden="true" /> PDF
            </a>
          )}
          {!row.isVoided && (
            <button
              type="button"
              onClick={() => onOpenWhatsApp(row)}
              title="Enviar por WhatsApp"
              aria-label="Enviar por WhatsApp"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                padding: 0,
                borderRadius: '6px',
                border: '1px solid #16a34a',
                background: '#fff',
                color: '#16a34a',
                cursor: 'pointer',
              }}
            >
              <WhatsAppLogo />
            </button>
          )}
          {row.fieldReceipt && row.fieldReceipt.whatsappStatus !== 'DELIVERED' && !row.isVoided && (
            <button
              type="button"
              onClick={() => void onResendWhatsApp(row.fieldReceipt!.id)}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              Reenviar API
            </button>
          )}
          {row.fieldReceipt && !row.isVoided && row.fieldReceipt.payments.some((p) => p.paymentMethod === 'CHECK' && p.status !== 'REJECTED') && (
            <button
              type="button"
              onClick={() => {
                const chk = row.fieldReceipt!.payments.find((p) => p.paymentMethod === 'CHECK' && p.status !== 'REJECTED');
                if (chk) void onRejectCheck(chk.id);
              }}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff', color: '#b91c1c', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              Rechazar Cheque
            </button>
          )}
          {!row.isVoided && (
            <button
              type="button"
              disabled={Boolean(row.voidBlockedReason)}
              onClick={() => {
                if (row.voidBlockedReason) return;
                if (row.officeReceipt) void onDeleteOfficeReceipt(row.officeReceipt);
                else if (row.fieldReceipt) void onVoidFieldReceipt(row.fieldReceipt);
              }}
              title={row.voidBlockedReason || 'Anular recibo'}
              aria-label={row.voidBlockedReason || 'Anular recibo'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                padding: 0,
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                background: '#fff',
                color: row.voidBlockedReason ? '#d1d5db' : '#6b7280',
                cursor: row.voidBlockedReason ? 'not-allowed' : 'pointer',
              }}
            >
              <Ban size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
