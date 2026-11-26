import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../../utils/api';
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
import {
  UnifiedReceiptRowItem,
  type UnifiedReceiptRow,
} from './UnifiedReceiptRowItem';

type ReceiptOriginFilter = 'ALL' | 'OFFICE' | 'SELLER' | 'DRIVER';

interface FieldReceiptEntry {
  collectorName: string;
  channel: 'SELLER' | 'DRIVER';
  receipt: FieldReceiptDTO;
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

function toPublicReceiptData(r: OfficeReceiptDTO): PublicReceiptData {
  return {
    id: r.id,
    receiptNumber: r.receiptNumber,
    billingType: r.billingType,
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
  };
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

  const userRole = api.getCurrentUser()?.role || '';

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
  }, [officeReceipts, fieldReceipts, userRole]);

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
                <th scope="col" style={{ padding: '8px 10px' }}>Fecha</th>
                <th scope="col" style={{ padding: '8px 10px' }}>Recibo</th>
                <th scope="col" style={{ padding: '8px 10px' }}>Cliente</th>
                <th scope="col" style={{ padding: '8px 10px' }}>Medio</th>
                <th scope="col" style={{ padding: '8px 10px', textAlign: 'right' }}>Monto</th>
                <th scope="col" style={{ padding: '8px 10px', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, 100).map((row) => (
                <UnifiedReceiptRowItem
                  key={row.key}
                  row={row}
                  busyPdfKey={busyPdfKey}
                  onDownloadOfficePdf={(r) => void handleOfficePdfDownload(r)}
                  onOpenWhatsApp={handleOpenWhatsAppModal}
                  onResendWhatsApp={onResendWhatsApp}
                  onRejectCheck={onRejectCheck}
                  onDeleteOfficeReceipt={onDeleteOfficeReceipt}
                  onVoidFieldReceipt={onVoidFieldReceipt}
                />
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
