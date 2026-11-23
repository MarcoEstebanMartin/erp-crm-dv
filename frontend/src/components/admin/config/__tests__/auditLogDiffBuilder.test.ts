import { describe, it, expect } from 'vitest';
import { buildAuditLogInspection } from '../auditLogDiffBuilder';
import { AUDIT_MODULES, resolveAuditModuleLabel } from '../auditLogDictionary';

describe('Inspección Detallada y Módulos de Auditoría (Paso 2)', () => {
  it('UPDATE_PRODUCT muestra solo campos modificados en pesos exactos y filtra claves internas/sensibles', () => {
    const inspection = buildAuditLogInspection({
      id: 410,
      action: 'UPDATE_PRODUCT',
      entityType: 'Product',
      entityId: 1626,
      status: 'SUCCESS',
      ipAddress: '::ffff:192.168.1.25',
      user: { username: 'admin', role: 'ADMIN' },
      resolvedContext: {
        entityLabel: 'Yerba Playadito 1kg (SKU 0102)',
        rubrosById: { 4: { name: 'Infusiones' } },
      },
      oldValues: {
        listPrice: '3200.00',
        listPriceB: '3100.00',
        isActive: true,
        updatedAt: '2026-11-10T10:00:00Z',
        passwordHash: '$2a$10$secret',
        pwdVer: 'abc123',
      },
      newValues: {
        listPrice: 3500,
        listPriceB: 3100,
        isActive: true,
        rubroId: 4,
        updatedAt: '2026-11-14T10:00:00Z',
      },
    });

    expect(inspection.hasBeforeColumn).toBe(true);
    expect(inspection.errorBanner).toBeUndefined();
    expect(inspection.metadata).toEqual(
      expect.arrayContaining([
        { label: 'Registro', value: '#410' },
        { label: 'Módulo', value: 'Stock y Catálogo' },
        { label: 'Afecta a', value: 'Yerba Playadito 1kg (SKU 0102)' },
        { label: 'Origen IP', value: '192.168.1.25' },
        { label: 'Resultado', value: 'Exitoso' },
      ]),
    );

    expect(inspection.changes).toEqual([
      { key: 'listPrice', label: 'Precio Lista A', before: '$3.200', after: '$3.500' },
      { key: 'rubroId', label: 'Rubro', before: '—', after: 'Infusiones' },
    ]);
  });

  it('ADJUST_STOCK_BATCH construye batchItems completos con nombres resueltos, stock previo/nuevo y diferencia', () => {
    const inspection = buildAuditLogInspection({
      id: 502,
      action: 'ADJUST_STOCK_BATCH',
      entityType: 'Product',
      entityId: 0,
      status: 'SUCCESS',
      user: { username: 'dario', role: 'FACTURACION' },
      resolvedContext: {
        productsById: {
          1626: { name: 'Yerba Playadito 1kg', sku: '0102' },
          1713: { name: 'Queso Cremigal', sku: '0340' },
        },
      },
      newValues: {
        count: 2,
        adjustments: [
          { productId: 1626, previousPhysical: 10, newPhysical: 8, appliedDelta: -2 },
          { productId: 1713, previousPhysical: 5, newPhysical: 12 },
        ],
      },
    });

    expect(inspection.metadata).toContainEqual({ label: 'Módulo', value: 'Stock y Catálogo' });
    expect(inspection.batchItems).toEqual([
      {
        productId: 1626,
        productLabel: 'Yerba Playadito 1kg (SKU 0102)',
        before: '10 u.',
        after: '8 u.',
        delta: '-2 u.',
        tone: 'negative',
      },
      {
        productId: 1713,
        productLabel: 'Queso Cremigal (SKU 0340)',
        before: '5 u.',
        after: '12 u.',
        delta: '+7 u.',
        tone: 'positive',
      },
    ]);
  });

  it('LOGIN_FAILED y TOGGLE_USER_STATUS traducen campos, formatean IP local y exponen errorBanner', () => {
    const failedLogin = buildAuditLogInspection({
      id: 601,
      action: 'LOGIN_FAILED',
      entityType: 'User',
      entityId: 22,
      status: 'WARNING',
      errorMessage: 'Contraseña incorrecta.',
      ipAddress: '127.0.0.1',
      newValues: { username: 'marcos' },
    });

    expect(failedLogin.errorBanner).toBe('Contraseña incorrecta.');
    expect(failedLogin.metadata).toContainEqual({ label: 'Origen IP', value: 'Red local' });
    expect(failedLogin.metadata).toContainEqual({ label: 'Módulo', value: 'Sistema' });
    expect(failedLogin.changes).toEqual([{ key: 'username', label: 'Usuario', after: 'marcos' }]);

    const toggleUser = buildAuditLogInspection({
      id: 602,
      action: 'TOGGLE_USER_STATUS',
      entityType: 'User',
      entityId: 75,
      status: 'SUCCESS',
      oldValues: { username: 'matias', isActive: true },
      newValues: { username: 'matias', isActive: false },
    });

    expect(toggleUser.hasBeforeColumn).toBe(true);
    expect(toggleUser.changes).toEqual([
      { key: 'isActive', label: 'Estado activo', before: 'Activo', after: 'Inactivo' },
    ]);
    expect(resolveAuditModuleLabel('TOGGLE_USER_STATUS', 'User')).toBe('Sistema');
    expect(AUDIT_MODULES).toHaveLength(6);
  });
});
