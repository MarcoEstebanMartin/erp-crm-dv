import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { adminAuditSubService } from '../admin/admin-audit.service';

describe('AdminAuditSubService — Enriquecimiento legible de AuditLog (Paso 1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resuelve entityLabel y productsById en bloque sin mutar los códigos originales de DB', async () => {
    const rawLogs = [
      {
        id: 101,
        userId: 1,
        action: 'ASSIGN_WMS_LOCATION',
        entityType: 'Product',
        entityId: 1626,
        oldValues: null,
        newValues: { locationCode: 'D1-R01-C04-A', quantity: 24, mode: 'RELOCATE' },
        status: 'SUCCESS',
        createdAt: new Date('2026-11-14T10:00:00Z'),
        user: { id: 1, username: 'admin', role: 'ADMIN' },
      },
      {
        id: 102,
        userId: 2,
        action: 'ADJUST_STOCK_BATCH',
        entityType: 'Product',
        entityId: 0,
        oldValues: null,
        newValues: {
          count: 2,
          adjustments: [
            { productId: 1626, previousPhysical: 10, newPhysical: 8, appliedDelta: -2 },
            { productId: 1713, previousPhysical: 5, newPhysical: 12, appliedDelta: 7 },
          ],
        },
        status: 'SUCCESS',
        createdAt: new Date('2026-11-14T09:50:00Z'),
        user: { id: 2, username: 'dario', role: 'FACTURACION' },
      },
      {
        id: 103,
        userId: 1,
        action: 'CLEAR_WMS_LOCATION',
        entityType: 'ProductLot',
        entityId: 1713,
        oldValues: null,
        newValues: { locationCode: 'D1-R02-C01-B', mode: 'UNASSIGN', movedUnitsToUnassigned: 6 },
        status: 'SUCCESS',
        createdAt: new Date('2026-11-14T09:40:00Z'),
        user: { id: 1, username: 'admin', role: 'ADMIN' },
      },
      {
        id: 104,
        userId: 3,
        action: 'INVOICE_ORDER',
        entityType: 'Order',
        entityId: 845,
        oldValues: null,
        newValues: { invoiceNumber: '00005-00001234', total: 48200 },
        status: 'SUCCESS',
        createdAt: new Date('2026-11-14T09:30:00Z'),
        user: { id: 3, username: 'esteban', role: 'ADMIN' },
      },
    ];

    vi.spyOn(prisma, '$transaction').mockResolvedValue([rawLogs, 4] as any);
    const productFindSpy = vi.spyOn(prisma.product, 'findMany').mockResolvedValue([
      { id: 1626, name: 'Yerba Playadito 1kg', sku: '0102' },
      { id: 1713, name: 'Queso Barra Cremigal', sku: '0340' },
    ] as any);
    vi.spyOn(prisma.order, 'findMany').mockResolvedValue([
      { id: 845, invoiceNumber: '00005-00001234', persona: { name: 'Kiosco San Martín' } },
    ] as any);
    vi.spyOn(prisma.persona, 'findMany').mockResolvedValue([] as any);

    const res = await adminAuditSubService.getAuditLogs(1, 30);

    expect(res.pagination).toEqual({ total: 4, page: 1, limit: 30, totalPages: 1 });
    expect(productFindSpy).toHaveBeenCalledTimes(1);

    // 1. ASSIGN_WMS_LOCATION conserva códigos originales y suma contexto
    expect(res.logs[0].action).toBe('ASSIGN_WMS_LOCATION');
    expect(res.logs[0].entityType).toBe('Product');
    expect(res.logs[0].resolvedContext?.entityLabel).toBe('Yerba Playadito 1kg (SKU 0102)');

    // 2. ADJUST_STOCK_BATCH resuelve todos los productos del lote
    expect(res.logs[1].resolvedContext?.productsById).toEqual({
      1626: { name: 'Yerba Playadito 1kg', sku: '0102' },
      1713: { name: 'Queso Barra Cremigal', sku: '0340' },
    });

    // 3. CLEAR_WMS_LOCATION resuelve Producto aun cuando entityType sea ProductLot
    expect(res.logs[2].resolvedContext?.entityLabel).toBe('Queso Barra Cremigal (SKU 0340)');

    // 4. Order resuelve número de comprobante y cliente
    expect(res.logs[3].resolvedContext?.entityLabel).toBe('Pedido #845 (00005-00001234) — Kiosco San Martín');
  });

  it('no falla si una entidad referenciada ya fue eliminada o si un delegate no existe en mocks', async () => {
    const rawLogs = [
      {
        id: 201,
        userId: 1,
        action: 'UPDATE_PERSONA',
        entityType: 'Persona',
        entityId: 99999,
        oldValues: null,
        newValues: null,
        status: 'SUCCESS',
        createdAt: new Date('2026-11-14T08:00:00Z'),
        user: { id: 1, username: 'admin', role: 'ADMIN' },
      },
    ];

    vi.spyOn(prisma, '$transaction').mockResolvedValue([rawLogs, 1] as any);
    vi.spyOn(prisma.persona, 'findMany').mockResolvedValue([] as any);

    const res = await adminAuditSubService.getAuditLogs(1, 30);
    expect(res.logs).toHaveLength(1);
    expect(res.logs[0].action).toBe('UPDATE_PERSONA');
    expect(res.logs[0].resolvedContext).toBeUndefined();
  });
});
