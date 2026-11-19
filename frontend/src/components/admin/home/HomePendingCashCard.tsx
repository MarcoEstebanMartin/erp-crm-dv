import { ChevronRight } from 'lucide-react';
import { useRendicionesAudit } from '../../rendiciones/useRendicionesAudit';
import RendicionAuditModal from '../../rendiciones/RendicionAuditModal';
import ArqueoResultModal from '../../rendiciones/ArqueoResultModal';

interface HomePendingCashCardProps {
  sellers: any[];
  routes: any[];
  fieldSettlements?: any[];
  loading: boolean;
  onOpenRendiciones: () => void;
  onRendicionCompleted?: () => void;
}

const formatPeso = (value: number) => `$${Math.round(value).toLocaleString('es-AR')}`;

export function HomePendingCashCard({
  sellers,
  routes,
  fieldSettlements = [],
  loading,
  onOpenRendiciones,
  onRendicionCompleted,
}: HomePendingCashCardProps) {
  const audit = useRendicionesAudit({ onSuccess: onRendicionCompleted });
  const pendingCount = sellers.length + routes.length + fieldSettlements.length;

  return (
    <section
      style={{
        width: '100%',
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '10px',
        border: '1px solid var(--border-color, #e5e5e7)',
        padding: '16px 20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3
            style={{
              fontSize: '0.96rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Rendiciones pendientes
          </h3>
          {pendingCount > 0 && (
            <span
              style={{
                backgroundColor: '#FEF2F2',
                color: '#E30613',
                border: '1px solid #FECACA',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {pendingCount}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenRendiciones}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: 0,
          }}
        >
          Ver rendiciones
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', padding: '6px 0' }}>
          Cargando...
        </div>
      ) : pendingCount === 0 ? (
        <div style={{ fontSize: '0.84rem', color: '#059669', fontWeight: 600, padding: '4px 0' }}>
          Al día
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {fieldSettlements.map((fs: any) => {
            const isDriver = fs.channel === 'DRIVER';
            const label = fs.routeLabel ? `${fs.collectorName} · ${fs.routeLabel}` : fs.collectorName;
            return (
              <CashRowButton
                key={`field-${fs.id}`}
                label={label}
                channelLabel={isDriver ? 'Repartidor' : 'Vendedor'}
                receiptCount={Number(fs.receiptCount || 0)}
                cash={Number(fs.expectedCash || 0)}
                checks={Number(fs.expectedChecksAmount || 0)}
                transfers={Number(fs.pendingTransfersAmount || 0)}
                total={Number(fs.totalPending || 0)}
                onClick={onOpenRendiciones}
              />
            );
          })}

          {sellers.map((s: any) => {
            const name = s.user?.username || `Vendedor #${s.user?.id}`;
            const count = s.transactions?.length || 0;
            const cash = Number(s.totalCash || 0);
            const checks = Number(s.totalChecks || 0);
            const transfers = Number(s.totalTransfers || 0);
            const total = Number(s.totalToCollect || 0);

            return (
              <CashRowButton
                key={`seller-${s.user?.id}`}
                label={name}
                receiptCount={count}
                cash={cash}
                checks={checks}
                transfers={transfers}
                total={total}
                onClick={() => audit.handleOpenAudit('seller', s)}
              />
            );
          })}

          {routes.map((r: any) => {
            const baseName = r.driverName || `Ruta #${r.routeId}`;
            const label = r.vehiclePlate ? `${baseName} (${r.vehiclePlate})` : baseName;
            const count = r.transactions?.length || 0;
            const cash = Number(r.totalCash || 0);
            const checks = Number(r.totalChecks || 0);
            const transfers = Number(r.totalTransfers || 0);
            const total = Number(r.totalToCollect || 0);

            return (
              <CashRowButton
                key={`route-${r.routeId}`}
                label={label}
                receiptCount={count}
                cash={cash}
                checks={checks}
                transfers={transfers}
                total={total}
                onClick={() => audit.handleOpenAudit('route', r)}
              />
            );
          })}
        </div>
      )}

      <RendicionAuditModal
        auditTarget={audit.auditTarget}
        errorMsg={audit.errorMsg}
        actionLoading={audit.actionLoading}
        realCash={audit.realCash}
        onRealCashChange={audit.setRealCash}
        realChecks={audit.realChecks}
        onRealChecksChange={audit.setRealChecks}
        declaredChecksList={audit.declaredChecksList}
        newCheckNumber={audit.newCheckNumber}
        onNewCheckNumberChange={audit.setNewCheckNumber}
        newCheckBank={audit.newCheckBank}
        onNewCheckBankChange={audit.setNewCheckBank}
        newCheckAmount={audit.newCheckAmount}
        onNewCheckAmountChange={audit.setNewCheckAmount}
        onAddCheck={audit.handleAddDeclaredCheck}
        onRemoveCheck={audit.handleRemoveDeclaredCheck}
        auditRouteNote={audit.auditRouteNote}
        onAuditRouteNoteChange={audit.setAuditRouteNote}
        auditNotes={audit.auditNotes}
        onAuditNotesChange={audit.setAuditNotes}
        onDeleteReceipt={audit.handleDeleteReceipt}
        onClose={audit.handleCloseAudit}
        onSubmit={audit.handleVerifySubmit}
      />

      <ArqueoResultModal
        arqueoResult={audit.arqueoResult}
        onClose={() => audit.setArqueoResult(null)}
      />
    </section>
  );
}

interface CashRowButtonProps {
  label: string;
  channelLabel?: 'Vendedor' | 'Repartidor';
  receiptCount: number;
  cash: number;
  checks: number;
  transfers: number;
  total: number;
  onClick: () => void;
}

function CashRowButton({ label, channelLabel, receiptCount, cash, checks, transfers, total, onClick }: CashRowButtonProps) {
  const isDriver = channelLabel === 'Repartidor';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', padding: '10px 14px', backgroundColor: 'var(--bg-light, #f9f9fb)',
        border: '1px solid var(--border-color, #e5e5e7)', borderRadius: '8px', fontSize: '0.84rem',
        cursor: 'pointer', gap: '8px', fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        {channelLabel && (
          <span
            style={{
              fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px',
              backgroundColor: isDriver ? '#eff6ff' : '#f3f4f6',
              color: isDriver ? '#1d4ed8' : '#374151',
              border: `1px solid ${isDriver ? '#bfdbfe' : '#e5e7eb'}`,
            }}
          >
            {channelLabel}
          </span>
        )}
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', padding: '2px 7px', borderRadius: '6px', fontWeight: 600 }}>
          {receiptCount} {receiptCount === 1 ? 'recibo' : 'recibos'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', color: 'var(--text-secondary)' }}>
        {cash > 0 && <span>Efectivo {formatPeso(cash)}</span>}
        {checks > 0 && <span>Cheques {formatPeso(checks)}</span>}
        {transfers > 0 && <span>Transf. {formatPeso(transfers)}</span>}
        <span
          style={{
            fontWeight: 700,
            color: 'var(--text-primary)',
            borderLeft: '1px solid var(--border-color)',
            paddingLeft: '12px',
          }}
        >
          Total {formatPeso(total)}
        </span>
      </div>
    </button>
  );
}
