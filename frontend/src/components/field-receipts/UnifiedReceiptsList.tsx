import React, { useMemo, useState } from 'react';
import { ExternalLink, FileDown, Search, Send, Trash2 } from 'lucide-react';
import {
  buildManualWhatsAppUrl,
  buildOfficeReceiptWhatsAppUrl,
  type FieldReceiptDTO,
  type OfficeReceiptDTO,
} from '../../api/fieldReceipts.api';
import {
  downloadReceiptPdf,
  shareOrDownloadReceiptPdf,
  type PublicReceiptData,
} from '../../utils/receiptPdfGenerator';
import { buildOfficeReceiptWhatsAppMessage } from '../../utils/receiptWhatsApp';

type ReceiptOriginFilter = 'ALL' | 'OFFICE' | 'FIELD';

interface FieldReceiptEntry {
  collectorName: string;
  receipt: FieldReceiptDTO;
}

interface UnifiedReceiptRow {
  key: string;
  origin: 'OFFICE' | 'FIELD';
  date: string;
  receiptNumber: string;
  clientName: string;
  collectorName: string;
  paymentMethodLabel: string;
  amount: number;
  isVoided: boolean;
  verified: boolean;
  viewUrl: string | null;
  whatsappUrl: string;
  officeReceipt?: OfficeReceiptDTO;
  fieldReceipt?: FieldReceiptDTO;
}

interface UnifiedReceiptsListProps {
  officeReceipts: OfficeReceiptDTO[];
  fieldReceipts: FieldReceiptEntry[];
  onDeleteOfficeReceipt: (receipt: OfficeReceiptDTO) => Promise<void>;
  onVoidFieldReceipt: (receiptId: number) => Promise<void>;
  onRejectCheck: (paymentId: number) => Promise<void>;
  onResendWhatsApp: (receiptId: number) => Promise<void>;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  BANK_TRANSFER: 'Transferencia',
  CHECK: 'Cheque',
  OTHER: 'Otro',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}, ${hh}:${mm}`;
}

export const UnifiedReceiptsList: React.FC<UnifiedReceiptsListProps> = ({
  officeReceipts,
  fieldReceipts,
  onDeleteOfficeReceipt,
  onVoidFieldReceipt,
  onRejectCheck,
  onResendWhatsApp,
}) => {
  const [originFilter, setOriginFilter] = useState<ReceiptOriginFilter>('ALL');
  const [search, setSearch] = useState('');
  const [busyPdfKey, setBusyPdfKey] = useState<string | null>(null);

  const toPublicReceiptData = (r: OfficeReceiptDTO): PublicReceiptData => ({
    id: r.id,
    receiptNumber: r.receiptNumber,
    amount: r.amount,
    paymentMethod: r.paymentMethod,
    description: r.description,
    createdAt: r.createdAt,
    verified: r.verified,
    verificationCode: r.verificationCode,
    publicUrl: r.publicUrl,
    persona: r.persona ? { id: r.persona.id, name: r.persona.name } : null,
    user: r.user,
    bankAccount: r.bankAccount,
  });

  const handleOfficePdfDownload = async (row: UnifiedReceiptRow) => {
    const r = row.officeReceipt;
    if (!r || busyPdfKey) return;
    setBusyPdfKey(`pdf-${row.key}`);
    try {
      await downloadReceiptPdf(toPublicReceiptData(r));
    } finally {
      setBusyPdfKey(null);
    }
  };

  const handleOfficeWhatsAppPdf = async (row: UnifiedReceiptRow) => {
    const r = row.officeReceipt;
    if (!r || busyPdfKey) return;
    setBusyPdfKey(`wa-${row.key}`);
    try {
      await shareOrDownloadReceiptPdf(toPublicReceiptData(r), {
        shareText: buildOfficeReceiptWhatsAppMessage(r),
        whatsappUrl: row.whatsappUrl,
      });
    } catch {
      // Usuario canceló compartir en el celular
    } finally {
      setBusyPdfKey(null);
    }
  };

  const unifiedRows = useMemo<UnifiedReceiptRow[]>(() => {
    const officeRows: UnifiedReceiptRow[] = officeReceipts.map((r) => ({
      key: `office-${r.id}`,
      origin: 'OFFICE',
      date: r.createdAt,
      receiptNumber: r.receiptNumber || `REC-${String(r.id).padStart(5, '0')}`,
      clientName: r.persona?.name || 'Cliente sin nombre',
      collectorName: r.user?.username || 'Oficina',
      paymentMethodLabel: METHOD_LABELS[r.paymentMethod] || r.paymentMethod,
      amount: Math.round(Number(r.amount || 0)),
      isVoided: false,
      verified: Boolean(r.verified),
      viewUrl: r.verificationCode
        ? `/recibo/${r.id}?v=${encodeURIComponent(r.verificationCode)}`
        : `/recibo/${r.id}`,
      whatsappUrl: buildOfficeReceiptWhatsAppUrl(r),
      officeReceipt: r,
    }));

    const fieldRows: UnifiedReceiptRow[] = fieldReceipts.map(({ collectorName, receipt }) => {
      const methods = Array.from(
        new Set(receipt.payments.map((p) => METHOD_LABELS[p.paymentMethod] || p.paymentMethod)),
      );
      return {
        key: `field-${receipt.id}`,
        origin: 'FIELD',
        date: receipt.capturedAt,
        receiptNumber: receipt.receiptNumber || receipt.provisionalCode,
        clientName: receipt.persona?.name || 'Cliente sin nombre',
        collectorName,
        paymentMethodLabel: methods.length > 0 ? methods.join(' + ') : 'Cobro en calle',
        amount: Math.round(Number(receipt.totalAmount || 0)),
        isVoided: receipt.status === 'VOIDED',
        verified: receipt.status === 'VERIFIED',
        viewUrl: receipt.pdfUrl || null,
        whatsappUrl: buildManualWhatsAppUrl(receipt),
        fieldReceipt: receipt,
      };
    });

    return [...officeRows, ...fieldRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [officeReceipts, fieldReceipts]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unifiedRows.filter((row) => {
      if (originFilter !== 'ALL' && row.origin !== originFilter) return false;
      if (!q) return true;
      return (
        row.clientName.toLowerCase().includes(q) ||
        row.receiptNumber.toLowerCase().includes(q) ||
        row.collectorName.toLowerCase().includes(q) ||
        row.paymentMethodLabel.toLowerCase().includes(q)
      );
    });
  }, [unifiedRows, originFilter, search]);

  const filterTabs: { id: ReceiptOriginFilter; label: string; count: number }[] = [
    { id: 'ALL', label: 'Todos', count: unifiedRows.length },
    { id: 'OFFICE', label: 'Oficina', count: officeReceipts.length },
    { id: 'FIELD', label: 'Calle', count: fieldReceipts.length },
  ];

  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div role="tablist" aria-label="Filtrar recibos por origen" style={{ display: 'inline-flex', gap: '4px', padding: '3px', background: '#f3f4f6', borderRadius: '8px' }}>
          {filterTabs.map((tab) => {
            const active = originFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setOriginFilter(tab.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: active ? '#111827' : 'transparent',
                  color: active ? '#fff' : '#4b5563',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {tab.label}
                <span style={{ opacity: active ? 0.85 : 0.65, fontVariantNumeric: 'tabular-nums' }}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '340px' }}>
          <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente, N° o cobrador..."
            aria-label="Buscar recibos"
            style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.84rem', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: '0.85rem', color: '#6b7280' }}>
          Sin recibos para mostrar.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '8px 10px' }}>Fecha</th>
                <th style={{ padding: '8px 10px' }}>Recibo</th>
                <th style={{ padding: '8px 10px' }}>Cliente</th>
                <th style={{ padding: '8px 10px' }}>Medio</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Monto</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, 100).map((row) => (
                <tr key={row.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
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
                          background: row.origin === 'OFFICE' ? '#eff6ff' : '#f3f4f6',
                          color: row.origin === 'OFFICE' ? '#1d4ed8' : '#374151',
                        }}
                      >
                        {row.origin === 'OFFICE' ? 'Oficina' : 'Calle'}
                      </span>
                      {row.isVoided && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#E30613' }}>ANULADO</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{row.clientName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{row.collectorName}</div>
                  </td>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap', color: '#374151' }}>
                    {row.paymentMethodLabel}
                    {!row.verified && !row.isVoided && (
                      <span style={{ marginLeft: '6px', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '999px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: row.isVoided ? '#9ca3af' : '#111827' }}>
                    ${row.amount.toLocaleString('es-AR')}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {row.officeReceipt && !row.isVoided && (
                        <button
                          type="button"
                          onClick={() => void handleOfficePdfDownload(row)}
                          disabled={busyPdfKey === `pdf-${row.key}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 9px',
                            borderRadius: '6px',
                            border: '1px solid #18181b',
                            background: '#18181b',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: busyPdfKey === `pdf-${row.key}` ? 'wait' : 'pointer',
                            opacity: busyPdfKey === `pdf-${row.key}` ? 0.65 : 1,
                          }}
                        >
                          <FileDown size={12} aria-hidden="true" /> {busyPdfKey === `pdf-${row.key}` ? 'PDF…' : 'PDF'}
                        </button>
                      )}
                      {row.viewUrl && (
                        <a
                          href={row.viewUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', color: '#374151', fontSize: '0.75rem', textDecoration: 'none' }}
                        >
                          <ExternalLink size={12} aria-hidden="true" /> Ver
                        </a>
                      )}
                      {!row.isVoided && row.officeReceipt && (
                        <button
                          type="button"
                          onClick={() => void handleOfficeWhatsAppPdf(row)}
                          disabled={busyPdfKey === `wa-${row.key}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #16a34a',
                            background: '#fff',
                            color: '#15803d',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: busyPdfKey === `wa-${row.key}` ? 'wait' : 'pointer',
                            opacity: busyPdfKey === `wa-${row.key}` ? 0.65 : 1,
                          }}
                        >
                          <Send size={12} aria-hidden="true" /> {busyPdfKey === `wa-${row.key}` ? 'Enviando…' : 'WhatsApp'}
                        </button>
                      )}
                      {!row.isVoided && !row.officeReceipt && (
                        <a
                          href={row.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #16a34a', color: '#15803d', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}
                        >
                          <Send size={12} aria-hidden="true" /> WhatsApp
                        </a>
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
                          onClick={() => {
                            if (row.officeReceipt) void onDeleteOfficeReceipt(row.officeReceipt);
                            else if (row.fieldReceipt) void onVoidFieldReceipt(row.fieldReceipt.id);
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          <Trash2 size={12} aria-hidden="true" /> Anular
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
