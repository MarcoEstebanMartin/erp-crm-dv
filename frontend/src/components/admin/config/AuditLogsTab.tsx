import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { api } from '../../../utils/api';

function resolveAuditBadge(actionRaw: string) {
  const act = actionRaw.toUpperCase();
  if (act === 'LOGIN_FAILED') return { label: 'Ingreso Fallido', bg: '#FDEDEC', color: '#C0392B' };
  if (act === 'LOGIN') return { label: 'Inicio de Sesión', bg: '#E8F8F5', color: '#117A65' };
  if (act === 'CHANGE_OWN_PASSWORD') return { label: 'Cambio de Clave Propia', bg: '#EBF5FB', color: '#2980B9' };
  if (act.includes('CREATE_USER')) return { label: 'Creación de Empleado', bg: '#FDEDEC', color: '#C0392B' };
  if (act.includes('UPDATE_USER')) return { label: 'Edición de Empleado', bg: '#EBF5FB', color: '#2980B9' };
  if (act.includes('TOGGLE_USER')) return { label: 'Cambio Estado Empleado', bg: '#FEF9E7', color: '#B7950B' };
  if (act.includes('DELETE_USER')) return { label: 'Eliminación de Empleado', bg: '#FDEDEC', color: '#C0392B' };
  if (act.includes('DELETE_SUPPLIER') || act.includes('PURCHASE')) return { label: 'Factura de Compra', bg: '#FDEDEC', color: '#C0392B' };
  if (act.includes('UPDATE_PERSONA') || act.includes('CREATE_PERSONA')) return { label: 'Cliente / Proveedor', bg: '#EBF5FB', color: '#2980B9' };
  if (act.includes('RECORD_PERSONA_PAYMENT') || act.includes('PAYMENT')) return { label: 'Cobro / Recibo', bg: '#E8F8F5', color: '#117A65' };
  if (act.includes('INVOICE') || act.includes('ORDER')) return { label: 'Gestión de Pedido', bg: '#EBF5FB', color: '#2980B9' };
  if (act.includes('CONFIRM_ARMADO')) return { label: 'Armado de Pedido', bg: '#FEF9E7', color: '#B7950B' };
  if (act.includes('COLLECTION') || act.includes('RENDICION')) return { label: 'Rendición de Cobranza', bg: '#E8F8F5', color: '#117A65' };
  if (act.includes('STOCK')) return { label: 'Ajuste de Stock', bg: '#FEF9E7', color: '#B7950B' };
  if (act.includes('CREDIT')) return { label: 'Nota de Crédito', bg: '#FDEDEC', color: '#C0392B' };
  if (act.includes('CONFIG')) return { label: 'Configuración Servidor', bg: '#F4ECF7', color: '#8E44AD' };
  if (act.includes('SYNC') || act.includes('RECONCILE')) return { label: 'Auditoría de Saldos', bg: '#EBF5FB', color: '#2980B9' };
  return { label: actionRaw || 'Operación', bg: '#F1F5F9', color: '#475569' };
}

function formatAuditMessage(l: any): string {
  let rawMsg = l.message;
  if (!rawMsg) {
    const actionMap: Record<string, string> = {
      CREATE_USER: 'Creó una nueva cuenta de empleado',
      UPDATE_USER: 'Modificó datos o contraseña de empleado',
      TOGGLE_USER_STATUS: 'Cambió estado activo/desactivado de empleado',
      DELETE_USER: 'Eliminó una cuenta de empleado',
      LOGIN: 'Inició sesión en el sistema',
      LOGIN_FAILED: l.errorMessage || 'Intento de ingreso rechazado',
      CHANGE_OWN_PASSWORD: 'Actualizó su propia contraseña de acceso',
      UPDATE_CONFIG: 'Modificó la configuración general del servidor',
      RECONCILE_STOCK: 'Ejecutó auditoría y control de desvío de stock',
      SYNC_BALANCES: 'Sincronizó saldos de cuentas corrientes',
    };
    const actText = actionMap[l.action] || l.action || 'Realizó una operación';
    const entText = l.entityType ? `en ${l.entityType}` : '';
    const idText = l.entityId ? `(ID ${l.entityId})` : '';

    let detail = '';
    if (l.newValues) {
      if (l.newValues.username) detail += ` [Usuario: ${l.newValues.username}]`;
      if (l.newValues.role) detail += ` [Rol: ${l.newValues.role}]`;
    }
    if (l.ipAddress) detail += ` [IP: ${l.ipAddress}]`;
    rawMsg = `${actText} ${entText} ${idText}${detail}`.trim();
  }

  return rawMsg
    .replace(/DELETE_SUPPLIER_INVOICE/g, 'Eliminó factura de compra')
    .replace(/UPDATE_PERSONA/g, 'Actualizó ficha de cliente/proveedor')
    .replace(/CREATE_PERSONA/g, 'Creó ficha de cliente/proveedor')
    .replace(/RECORD_PERSONA_PAYMENT/g, 'Registró cobro/recibo de cliente')
    .replace(/INVOICE_ORDER/g, 'Facturó el pedido')
    .replace(/CREATE_ORDER/g, 'Creó el pedido')
    .replace(/CONFIRM_ARMADO/g, 'Confirmó armado de pedido en depósito')
    .replace(/CREATE_COLLECTION/g, 'Registró rendición de cobranza')
    .replace(/SupplierInvoice/g, 'Factura de Compra')
    .replace(/CreditNote/g, 'Nota de Crédito')
    .replace(/CashDrawer/g, 'Caja Registradora')
    .replace(/Transaction/g, 'Movimiento Financiero')
    .replace(/Persona/g, 'Cliente/Proveedor')
    .replace(/Order/g, 'Pedido')
    .replace(/User/g, 'Empleado');
}

export default function AuditLogsTab() {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);

  useEffect(() => {
    api.getAuditLogs(auditPage, 30)
      .then((res: any) => {
        setAuditLogs(res?.logs || []);
        const totalPages = Number(res?.pagination?.totalPages ?? res?.totalPages ?? 1);
        setAuditTotalPages(Math.max(1, totalPages));
      })
      .catch(() => {
        setAuditLogs([]);
        setAuditTotalPages(1);
      });
  }, [auditPage]);

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="var(--color-primary)" /> Registro de Auditoría del Sistema
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Historial completo en español de ingresos y operaciones realizadas por usuarios y procesos automáticos.
          </p>
        </div>
      </div>

      <div className="table-container">
        <table style={{ width: '100%', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 12px' }}>Fecha y Hora</th>
              <th style={{ padding: '10px 12px' }}>Usuario en Sesión</th>
              <th style={{ padding: '10px 12px' }}>Acción / Categoría</th>
              <th style={{ padding: '10px 12px' }}>Detalle de la Operación</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  No hay registros de auditoría disponibles en esta página.
                </td>
              </tr>
            ) : (
              auditLogs.map((l) => {
                const rawUser = l.user?.username || l.username;
                const displayUser =
                  !rawUser || rawUser.toLowerCase() === 'system' || rawUser.toLowerCase() === 'sistema'
                    ? '⚙️ Sistema (Automático)'
                    : rawUser;
                const actionBadge = resolveAuditBadge(l.action || l.category || '');

                return (
                  <tr key={l.id}>
                    <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {new Date(l.createdAt).toLocaleString('es-AR')}
                    </td>
                    <td style={{ fontWeight: 600 }}>{displayUser}</td>
                    <td>
                      <span className="badge" style={{ backgroundColor: actionBadge.bg, color: actionBadge.color, fontWeight: 700, fontSize: '0.78rem', padding: '2px 8px' }}>
                        {actionBadge.label}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-primary)' }}>{formatAuditMessage(l)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <button className="btn btn-secondary" onClick={() => setAuditPage((p) => Math.max(1, p - 1))} disabled={auditPage <= 1}>
          Anterior
        </button>
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
          Página {auditPage} de {auditTotalPages}
        </span>
        <button className="btn btn-secondary" onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))} disabled={auditPage >= auditTotalPages}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
