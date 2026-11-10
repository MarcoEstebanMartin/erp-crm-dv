import { MapPin } from 'lucide-react';

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
  onClose
}: InspectDrawerModalProps) {
  if (!inspectDrawer) return null;

  const isClosed = inspectDrawer.status === 'CLOSED';
  const currentExpected = isClosed
    ? Number(inspectDrawer.closingBalance)
    : Number(inspectDrawer.openingBalance) +
      inspectTxs.reduce(
        (sum, t) => sum + (t.type === 'INCOME' ? Number(t.amount) : -Number(t.amount)),
        0
      );
  const diff = Number(inspectDrawer.realBalance) - Number(inspectDrawer.closingBalance);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '850px', width: '95%', padding: '24px' }}
      >
        <div className="modal-header" style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
            {inspectDrawer.status === 'OPEN' ? 'Detalle de Caja Activa: ' : 'Arqueo Histórico: '}
            {inspectDrawer.branch === 'DEPOSITO' ? 'Caja Depósito' : inspectDrawer.branch}
          </h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          {/* Información General */}
          <div className="card" style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Información de la Caja
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <div>
                <strong>Estado:</strong>{' '}
                <span style={{ color: inspectDrawer.status === 'OPEN' ? '#3b82f6' : '#10b981', fontWeight: 600 }}>
                  {inspectDrawer.status === 'OPEN' ? 'ABIERTA' : 'CERRADA'}
                </span>
              </div>
              <div>
                <strong>Apertura:</strong> {new Date(inspectDrawer.openedAt).toLocaleString('es-AR')}
              </div>
              {isClosed ? (
                <div>
                  <strong>Cierre:</strong> {new Date(inspectDrawer.closedAt).toLocaleString('es-AR')}
                </div>
              ) : (
                <div>
                  <strong>Cierre:</strong>{' '}
                  <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Caja en operación</span>
                </div>
              )}
              <div>
                <strong>Procesado por:</strong> {inspectDrawer.user?.username || 'Desconocido'}
              </div>
              {inspectDrawer.routeNote && (
                <div style={{ color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  <MapPin size={14} color="#0284c7" />
                  <span>Pueblo / Ruta: {inspectDrawer.routeNote}</span>
                </div>
              )}
              {inspectDrawer.notes && (
                <div style={{ marginTop: '2px' }}>
                  <strong>Observaciones:</strong>{' '}
                  <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{inspectDrawer.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Conciliación Financiera */}
          <div className="card" style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              {inspectDrawer.status === 'OPEN' ? 'Caja Activa (Estado Actual)' : 'Cierre y Conciliación'}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Fondo Inicial:</span>
                <strong style={{ fontFamily: 'monospace' }}>
                  ${Number(inspectDrawer.openingBalance).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Esperado (Sistema):</span>
                <strong style={{ fontFamily: 'monospace' }}>
                  ${currentExpected.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </strong>
              </div>
              {isClosed && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Declarado (Arqueo):</span>
                    <strong style={{ fontFamily: 'monospace' }}>
                      ${Number(inspectDrawer.realBalance).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </strong>
                  </div>
                  <div style={{ height: '1px', backgroundColor: '#cbd5e1', margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: diff === 0 ? '#166534' : diff > 0 ? '#0f766e' : '#b91c1c' }}>
                    <span>Diferencia:</span>
                    <span style={{ fontFamily: 'monospace' }}>
                      {diff > 0 ? '+' : ''}${diff.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Listado de Transacciones */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-light)', fontWeight: 600, fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)' }}>
            {inspectDrawer.status === 'OPEN'
              ? 'Movimientos Registrados (Caja Activa)'
              : 'Comprobantes y Cobros Conciliados en este Cierre'}
          </div>

          {loadingTxs ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Cargando transacciones conciliadas...
            </div>
          ) : inspectTxs.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              No hay transacciones individuales registradas en esta caja (ej: arqueo de solo fondos iniciales).
            </div>
          ) : (
            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border-color)', zIndex: 1 }}>
                  <tr style={{ color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '10px' }}>Fecha/Hora</th>
                    <th style={{ padding: '10px' }}>Recibo/Pedido</th>
                    <th style={{ padding: '10px' }}>Cliente</th>
                    <th style={{ padding: '10px' }}>Suc.</th>
                    <th style={{ padding: '10px' }}>Medio</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectTxs.map((t) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px' }}>
                        {new Date(t.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 600 }}>
                        {t.receiptNumber || `Pedido #${t.orderId || 'S/N'}`}
                      </td>
                      <td style={{ padding: '10px' }}>{t.persona?.name || 'Varios/General'}</td>
                      <td style={{ padding: '10px' }}>{t.billingType === 'OFFICIAL' ? 'A' : 'X'}</td>
                      <td style={{ padding: '10px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            backgroundColor: t.paymentMethod === 'CASH' ? '#ecfdf5' : t.paymentMethod === 'CHECK' ? '#eff6ff' : '#f1f5f9',
                            color: t.paymentMethod === 'CASH' ? '#047857' : t.paymentMethod === 'CHECK' ? '#1d4ed8' : '#475569'
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
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                        ${Number(t.amount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '8px 20px' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
