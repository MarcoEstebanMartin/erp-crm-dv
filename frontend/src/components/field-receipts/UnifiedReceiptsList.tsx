import React, { useMemo, useState } from 'react';
import { Ban, FileDown, Search } from 'lucide-react';
import {
  type FieldReceiptDTO,
  type OfficeReceiptDTO,
  type SavedClientWhatsAppDTO,
} from '../../api/fieldReceipts.api';
import {
  downloadReceiptPdf,
  type PublicReceiptData,
} from '../../utils/receiptPdfGenerator';
import {
  buildFieldReceiptWhatsAppMessage,
  buildOfficeReceiptWhatsAppMessage,
} from '../../utils/receiptWhatsApp';
import {
  ReceiptWhatsAppSendModal,
  type ReceiptWhatsAppTarget,
} from './ReceiptWhatsAppSendModal';

type ReceiptOriginFilter = 'ALL' | 'OFFICE' | 'SELLER' | 'DRIVER';

interface FieldReceiptEntry {
  collectorName: string;
  channel: 'SELLER' | 'DRIVER';
  receipt: FieldReceiptDTO;
}

interface UnifiedReceiptRow {
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

interface UnifiedReceiptsListProps {
  officeReceipts: OfficeReceiptDTO[];
  fieldReceipts: FieldReceiptEntry[];
  onDeleteOfficeReceipt: (receipt: OfficeReceiptDTO) => Promise<void>;
  onVoidFieldReceipt: (receipt: FieldReceiptDTO) => Promise<void>;
  onRejectCheck: (paymentId: number) => Promise<void>;
  onResendWhatsApp: (receiptId: number) => Promise<void>;
  onClientWhatsAppSaved?: (saved: SavedClientWhatsAppDTO) => void;
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

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  BANK_TRANSFER: 'Transferencia',
  CHECK: 'Cheque',
  OTHER: 'Otro',
};

const arDateKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function getOfficeVoidBlockedReason(r: OfficeReceiptDTO, userRole: string): string | null {
  if (userRole === 'ADMIN') return null;
  if (userRole !== 'FACTURACION') return 'Sin permisos para anular';
  if (r.verified) return 'Solo Admin: recibo ya verificado';
  if (r.cashDrawer?.status === 'CLOSED') return 'Solo Admin: caja cerrada';
  if (arDateKeyFmt.format(new Date(r.createdAt)) !== arDateKeyFmt.format(new Date())) {
    return 'Solo Admin: recibo de día anterior';
  }
  return null;
}

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
  onClientWhatsAppSaved,
}) => {
  const [originFilter, setOriginFilter] = useState<ReceiptOriginFilter>('ALL');
  const [search, setSearch] = useState('');
  const [busyPdfKey, setBusyPdfKey] = useState<string | null>(null);
  const [waTarget, setWaTarget] = useState<ReceiptWhatsAppTarget | null>(null);
  const [savedPhones, setSavedPhones] = useState<Record<number, { phone: string; whatsappVerifiedAt: string }>>({});

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
    order: r.order,
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

  const handleOpenWhatsAppModal = (row: UnifiedReceiptRow) => {
    if (row.officeReceipt) {
      const r = row.officeReceipt;
      const personaId = r.persona?.id ?? r.personaId ?? null;
      const override = personaId ? savedPhones[personaId] : undefined;
      setWaTarget({
        personaId,
        clientName: row.clientName,
        phone: override?.phone ?? r.persona?.phone ?? null,
        whatsappVerifiedAt: override?.whatsappVerifiedAt ?? r.persona?.whatsappVerifiedAt ?? null,
        receiptLabel: row.receiptNumber,
        amount: row.amount,
        messageText: buildOfficeReceiptWhatsAppMessage(r),
        publicReceiptData: toPublicReceiptData(r),
      });
      return;
    }
    if (row.fieldReceipt) {
      const r = row.fieldReceipt;
      const personaId = r.persona?.id ?? r.personaId;
      const override = savedPhones[personaId];
      setWaTarget({
        personaId,
        clientName: row.clientName,
        phone: override?.phone ?? r.persona?.phone ?? null,
        whatsappVerifiedAt: override?.whatsappVerifiedAt ?? r.persona?.whatsappVerifiedAt ?? null,
        receiptLabel: row.receiptNumber,
        amount: row.amount,
        messageText: buildFieldReceiptWhatsAppMessage(r, window.location.origin),
        fieldReceiptId: r.id,
      });
    }
  };

  const userRole = typeof window !== 'undefined' ? localStorage.getItem('user_role') || '' : '';

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
      isVoided: Boolean(r.voidedAt),
      voidedByName: r.voidedBy?.username ?? null,
      voidReason: r.voidReason ?? null,
      voidBlockedReason: r.voidedAt ? null : getOfficeVoidBlockedReason(r, userRole),
      verified: Boolean(r.verified),
      viewUrl: r.verificationCode
        ? `/recibo/${r.id}?v=${encodeURIComponent(r.verificationCode)}`
        : `/recibo/${r.id}`,
      officeReceipt: r,
    }));

    const fieldRows: UnifiedReceiptRow[] = fieldReceipts.map(({ collectorName, channel, receipt }) => {
      const methods = Array.from(
        new Set(receipt.payments.map((p) => METHOD_LABELS[p.paymentMethod] || p.paymentMethod)),
      );
      return {
        key: `field-${receipt.id}`,
        origin: channel,
        date: receipt.capturedAt,
        receiptNumber: receipt.receiptNumber || receipt.provisionalCode,
        clientName: receipt.persona?.name || 'Cliente sin nombre',
        collectorName,
        paymentMethodLabel: methods.length > 0 ? methods.join(' + ') : 'Cobro en calle',
        amount: Math.round(Number(receipt.totalAmount || 0)),
        isVoided: receipt.status === 'VOIDED',
        verified: receipt.status === 'VERIFIED',
        viewUrl: receipt.pdfUrl || null,
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

  const sellerCount = useMemo(
    () => fieldReceipts.filter((f) => f.channel === 'SELLER').length,
    [fieldReceipts],
  );
  const driverCount = useMemo(
    () => fieldReceipts.filter((f) => f.channel === 'DRIVER').length,
    [fieldReceipts],
  );

  const filterTabs: { id: ReceiptOriginFilter; label: string; count: number }[] = [
    { id: 'ALL', label: 'Todos', count: unifiedRows.length },
    { id: 'OFFICE', label: 'Oficina', count: officeReceipts.length },
    { id: 'SELLER', label: 'Vendedores', count: sellerCount },
    { id: 'DRIVER', label: 'Repartidores', count: driverCount },
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
                          onClick={() => void handleOfficePdfDownload(row)}
                          disabled={busyPdfKey === `pdf-${row.key}`}
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
                            cursor: busyPdfKey === `pdf-${row.key}` ? 'wait' : 'pointer',
                            opacity: busyPdfKey === `pdf-${row.key}` ? 0.65 : 1,
                          }}
                        >
                          <FileDown size={13} aria-hidden="true" /> {busyPdfKey === `pdf-${row.key}` ? '…' : 'PDF'}
                        </button>
                      )}
                      {!row.officeReceipt && row.viewUrl && (
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
                          onClick={() => handleOpenWhatsAppModal(row)}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ReceiptWhatsAppSendModal
        target={waTarget}
        onClose={() => setWaTarget(null)}
        onSaved={(saved) => {
          setSavedPhones((prev) => ({
            ...prev,
            [saved.id]: {
              phone: saved.phone,
              whatsappVerifiedAt: saved.whatsappVerifiedAt,
            },
          }));
          onClientWhatsAppSaved?.(saved);
        }}
      />
    </section>
  );
};
