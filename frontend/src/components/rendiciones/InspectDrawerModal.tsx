import { MapPin, X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { classifyDrawerHistoryRow } from './drawerHistoryHelpers';

interface InspectDrawerModalProps {
  inspectDrawer: any | null;
  inspectTxs: any[];
  loadingTxs: boolean;
  onClose: () => void;
}

export default function InspectDrawerModal({
  inspectDrawer,
  inspectTxs,
  loadingTxs,
  onClose,
}: InspectDrawerModalProps) {
  const isClosed = inspectDrawer?.status === 'CLOSED';
  const meta = inspectDrawer ? classifyDrawerHistoryRow(inspectDrawer) : null;
  const isDepo = Boolean(meta?.isDepo);
  const isCentral = Boolean(meta?.isCentral);
  const showOpenCloseTimes = isDepo || !isClosed;
  const currentExpected = inspectDrawer
    ? isClosed
      ? Number(inspectDrawer.closingBalance)
      : Number(inspectDrawer.openingBalance) +
        inspectTxs.reduce(
          (sum, t) => sum + (t.type === 'INCOME' ? Number(t.amount) : -Number(t.amount)),
          0
        )
    : 0;
  const diff = inspectDrawer
    ? Number(inspectDrawer.realBalance) - Number(inspectDrawer.closingBalance)
    : 0;

  return (
    <NativeModalDialog
      isOpen={Boolean(inspectDrawer)}
      onClose={onClose}
      ariaLabelledBy="inspect-drawer-title"
      style={{ maxWidth: '850px', width: '95vw', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}
    >
      {inspectDrawer && (
        <>
          <div className="modal-header" style={{ marginBottom: '20px' }}>
            <h3 id="inspect-drawer-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
              {inspectDrawer.status === 'OPEN' ? 'Caja Activa: ' : 'Arqueo: '}
              {isDepo
                ? 'Caja Oficina'
                : isCentral
                ? 'Caja Grande'
                : meta
                ? `${meta.badgeLabel} · ${meta.responsibleName}`
                : inspectDrawer.branch}
            </h3>
            <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} aria-label="Cerrar">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div className="card" style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                Información
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                <div>
                  <strong>Estado:</strong>{' '}
                  <span style={{ color: inspectDrawer.status === 'OPEN' ? '#3b82f6' : '#10b981', fontWeight: 600 }}>
                    {inspectDrawer.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
                  </span>
                </div>
                {showOpenCloseTimes ? (
                  <>
                    <div>
                      <strong>Apertura:</strong> {new Date(inspectDrawer.openedAt).toLocaleString('es-AR')}
                    </div>
                    <div>
                      <strong>Cierre:</strong>{' '}
                      {isClosed ? (
                        new Date(inspectDrawer.closedAt).toLocaleString('es-AR')
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>En operación</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div>
                    <strong>Fecha:</strong>{' '}
                    {new Date(inspectDrawer.closedAt || inspectDrawer.openedAt).toLocaleString('es-AR')}
                  </div>
                )}
                <div>
                  <strong>Usuario:</strong> {inspectDrawer.user?.username || 'Desconocido'}
                </div>
                {meta?.showRouteNote && (
                  <div style={{ color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <MapPin size={14} color="#0284c7" aria-hidden="true" />
                    <span>{inspectDrawer.routeNote}</span>
                  </div>
                )}
                {inspectDrawer.notes && (
                  <div style={{ marginTop: '2px' }}>
                    <strong>Observaciones:</strong>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>{inspectDrawer.notes}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                {inspectDrawer.status === 'OPEN' ? 'Estado Actual' : 'Conciliación'}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Fondo Inicial</span>
                  <strong className="tabular-nums" style={{ fontFamily: 'monospace' }}>
                    ${Number(inspectDrawer.openingBalance).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Esperado</span>
                  <strong className="tabular-nums" style={{ fontFamily: 'monospace' }}>
                    ${currentExpected.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  </strong>
                </div>
                {isClosed && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Declarado</span>
                      <strong className="tabular-nums" style={{ fontFamily: 'monospace' }}>
                        ${Number(inspectDrawer.realBalance).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </strong>
                    </div>
                    <div style={{ height: '1px', backgroundColor: '#cbd5e1', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: diff === 0 ? '#166534' : diff > 0 ? '#0f766e' : '#b91c1c' }}>
                      <span>Diferencia</span>
                      <span className="tabular-nums" style={{ fontFamily: 'monospace' }}>
                        {diff > 0 ? '+' : ''}${diff.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-light)', fontWeight: 600, fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)' }}>
              Movimientos ({inspectTxs.length})
            </div>

            {loadingTxs ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Cargando transacciones...
              </div>
            ) : inspectTxs.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Sin transacciones registradas.
              </div>
            ) : (
              <div className="table-container" role="region" aria-label="Movimientos de la caja" tabIndex={0} style={{ maxHeight: '250px', margin: 0, border: 'none', borderRadius: 0, boxShadow: 'none' }}>
                <table style={{ fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th scope="col">Hora</th>
                      <th scope="col">Recibo / Pedido</th>
                      <th scope="col">Cliente</th>
                      <th scope="col">Suc.</th>
                      <th scope="col">Medio</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectTxs.map((t) => (
                      <tr key={t.id}>
                        <td>{new Date(t.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ fontWeight: 600 }}>
                          {t.receiptNumber || (t.orderId ? `Pedido #${t.orderId}` : t.description || 'Movimiento interno')}
                        </td>
                        <td>{t.persona?.name || (t.orderId ? 'Consumidor Final' : '—')}</td>
                        <td>{t.billingType === 'OFFICIAL' ? 'A' : 'X'}</td>
                        <td>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              backgroundColor: t.paymentMethod === 'CASH' ? '#ecfdf5' : t.paymentMethod === 'CHECK' ? '#eff6ff' : '#f1f5f9',
                              color: t.paymentMethod === 'CASH' ? '#047857' : t.paymentMethod === 'CHECK' ? '#1d4ed8' : '#475569',
                            }}
                          >
                            {t.paymentMethod === 'CASH'
                              ? 'EFECTIVO'
                              : t.paymentMethod === 'CHECK'
                              ? 'CHEQUE'
                              : t.paymentMethod === 'BANK_TRANSFER'
                              ? 'TRANSFERENCIA'
                              : t.paymentMethod}
                          </span>
                        </td>
                        <td
                          className="tabular-nums"
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            color: t.type === 'OUTCOME' ? '#c53030' : 'inherit',
                          }}
                        >
                          {t.type === 'OUTCOME' ? '-' : ''}${Number(t.amount).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </>
      )}
    </NativeModalDialog>
  );
}
