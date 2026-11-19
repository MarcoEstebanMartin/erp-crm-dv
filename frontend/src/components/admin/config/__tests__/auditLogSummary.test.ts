import { describe, it, expect } from 'vitest';
import { formatAuditOperationSummary } from '../auditLogSummary';

describe('formatAuditOperationSummary — Resumen de Operación en Auditoría', () => {
  it('resume Visita de Preventa sin repetir el verbo de la acción', () => {
    const res = formatAuditOperationSummary({
      action: 'RECORD_ROUTE_VISIT',
      entityType: 'SaleRouteVisit',
      entityId: 12,
      resolvedContext: { entityLabel: 'Visita a ADRIANA MORAL' },
    });
    expect(res).toBe('ADRIANA MORAL');
  });

  it('resume Nuevo Pedido con separadores compactos', () => {
    const res = formatAuditOperationSummary({
      action: 'CREATE_ORDER',
      entityType: 'Order',
      entityId: 103,
      newValues: { total: 46786 },
      resolvedContext: { entityLabel: 'Pedido #103 — ADRIANA MORAL' },
    });
    expect(res).toBe('Pedido #103 · ADRIANA MORAL · $46.786');
  });

  it('resume Inicio de Sesión con rol e IP limpios', () => {
    expect(
      formatAuditOperationSummary({
        action: 'LOGIN',
        ipAddress: '::ffff:46.151.194.129',
        newValues: { role: 'VENDEDOR' },
      }),
    ).toBe('Vendedor · IP 46.151.194.129');

    expect(
      formatAuditOperationSummary({
        action: 'LOGIN',
        ipAddress: '127.0.0.1',
        newValues: { role: 'ADMIN' },
      }),
    ).toBe('Administrador · Red local');
  });

  it('resume Rendición de Caja y evita duplicar comprobantes en Facturación Directa', () => {
    expect(
      formatAuditOperationSummary({
        action: 'CLOSE_OPERATIVE_DRAWER_RENDICION',
        newValues: { transactionsCount: 1, realCash: 0 },
      }),
    ).toBe('Aprobada · 1 mov. · Efvo $0');

    expect(
      formatAuditOperationSummary({
        action: 'CREATE_DIRECT_INVOICE',
        entityType: 'Order',
        entityId: 100,
        newValues: { invoiceNumber: 'INT-00100', totalAmount: 178496 },
        resolvedContext: { entityLabel: 'Pedido #100 (INT-00100) — ABEL LLERA (INT-00100)' },
      }),
    ).toBe('Pedido #100 (INT-00100) · ABEL LLERA · $178.496');
  });
});
