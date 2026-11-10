import React from 'react';
import { type ClientProfile, formatMoney } from './portal.types';
import { portalAccountOrdersStyles as styles } from './portalAccountOrders.styles';

interface PortalAccountViewProps {
  client: ClientProfile;
  isLoadingAccount: boolean;
  recentOrders: any[];
}

export const PortalAccountView: React.FC<PortalAccountViewProps> = ({
  client,
  isLoadingAccount,
  recentOrders
}) => {
  return (
    <div style={styles.tabContent}>
      <div style={styles.accountCardHeader}>
        <div style={styles.accountMetricBox}>
          <span style={styles.accountMetricLabel}>Saldo Total Acumulado</span>
          <span style={{ ...styles.accountMetricValue, color: client.outstandingBalance > 0 ? '#dc2626' : '#059669' }}>
            {formatMoney(client.outstandingBalance)}
          </span>
          <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {client.outstandingBalance > 0
              ? 'Saldo a regularizar según plazo acordado'
              : 'Sin saldos pendientes de pago'}
          </span>
        </div>

        <div style={styles.accountMetricBox}>
          <span style={styles.accountMetricLabel}>Límite de Crédito Otorgado</span>
          <span style={{ ...styles.accountMetricValue, color: '#2563eb' }}>
            {formatMoney(client.creditLimit)}
          </span>
          <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Plazo acordado: {client.paymentTermDays || 30} días
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: '24px',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', marginBottom: '16px' }}>
          📄 Resumen de Comprobantes y Movimientos Recientes
        </h3>
        {isLoadingAccount ? (
          <div style={styles.loadingBox}>Cargando estado de cuenta...</div>
        ) : recentOrders.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '14px' }}>No hay movimientos registrados.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>N° Movimiento</th>
                <th style={styles.th}>Fecha</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Monto Total</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id}>
                  <td style={styles.td}>#{o.movementId || o.id}</td>
                  <td style={styles.td}>{new Date(o.createdAt).toLocaleDateString('es-AR')}</td>
                  <td style={styles.td}>{o.invoiceType || 'Presupuesto'}</td>
                  <td style={styles.td}>
                    <span style={styles.statusPill(o.status)}>{o.status}</span>
                  </td>
                  <td style={{ ...styles.td, fontWeight: 700, color: '#0f172a' }}>
                    {formatMoney(Number(o.totalAmount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

interface PortalOrdersViewProps {
  recentOrders: any[];
  onRepeatOrder: (order: any) => void;
}

export const PortalOrdersView: React.FC<PortalOrdersViewProps> = ({
  recentOrders,
  onRepeatOrder
}) => {
  return (
    <div style={styles.tabContent}>
      <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', marginBottom: '16px' }}>
        📦 Historial y Seguimiento de Pedidos
      </h3>

      {recentOrders.length === 0 ? (
        <div style={styles.emptyBox}>No has realizado pedidos recientemente.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {recentOrders.map((ord) => (
            <div key={ord.id} style={styles.orderHistoryCard}>
              <div style={styles.orderHistoryHeader}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '16px', color: '#0f172a' }}>
                    Pedido #{ord.movementId || ord.id}
                  </span>
                  <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '12px' }}>
                    📅 {new Date(ord.createdAt).toLocaleString('es-AR')}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={styles.statusPill(ord.status)}>
                    {ord.status === 'PENDING'
                      ? '⏳ En Revisión'
                      : ord.status === 'PREPARED'
                        ? '✅ Preparado'
                        : ord.status === 'DELIVERED'
                          ? '🚚 Entregado'
                          : ord.status}
                  </span>
                  <button onClick={() => onRepeatOrder(ord)} style={styles.btnSecondarySmall}>
                    🔄 Repetir Pedido
                  </button>
                </div>
              </div>

              <div style={styles.orderHistoryItems}>
                {ord.items &&
                  ord.items.map((it: any) => (
                    <div key={it.id} style={styles.orderItemRow}>
                      <span style={{ color: '#0f172a', fontWeight: 500 }}>
                        {it.product?.name || `Producto #${it.productId}`}
                      </span>
                      <span style={{ color: '#475569', fontSize: '13px' }}>
                        {it.quantity} un. x {formatMoney(Number(it.unitPrice))} ={' '}
                        <strong style={{ color: '#0f172a' }}>{formatMoney(Number(it.subtotal))}</strong>
                      </span>
                    </div>
                  ))}
              </div>

              <div style={styles.orderHistoryFooter}>
                <span style={{ fontSize: '14px', color: '#64748b' }}>Total Estimado con IVA:</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#059669' }}>
                  {formatMoney(Number(ord.totalAmount))}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
