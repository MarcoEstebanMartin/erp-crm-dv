import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import {
  AUDIT_MODULES,
  getAllKnownAuditActionCodes,
  getAllKnownEntityTypeCodes,
  resolveAuditBadge,
  translateEntityType,
} from '../auditLogDictionary';
import { formatAuditMessage, formatAuditPesos } from '../auditLogFormatter';
import AuditLogsFilterBar from '../AuditLogsFilterBar';

const BACKEND_ACTION_CODES = [
  'LOGIN', 'LOGIN_FAILED', 'CHANGE_OWN_PASSWORD',
  'CREATE_USER', 'UPDATE_USER', 'TOGGLE_USER_STATUS', 'DELETE_USER',
  'CREATE_EMPLOYEE', 'UPDATE_EMPLOYEE', 'UPDATE_CONFIG',
  'ASSIGN_WMS_LOCATION', 'CLEAR_WMS_LOCATION', 'UPSERT_WAREHOUSE_CELL', 'RESET_WAREHOUSE_CELL',
  'ADJUST_STOCK', 'ADJUST_STOCK_BATCH', 'RECONCILE_STOCK_DRIFT',
  'UPDATE_LOT', 'DELETE_LOT', 'TRANSFER_LOT_STOCK',
  'CREATE_PRODUCT', 'UPDATE_PRODUCT', 'UPDATE_PRODUCT_IMAGE', 'IMPORT_PRODUCT_IMAGE_ZIP',
  'IMPORT_PRODUCTS_CSV', 'BULK_UPDATE_PRICES', 'REVERT_PRICES_UNDO',
  'SYNC_FROM_PRODUCTION_CATALOG', 'EXCEL_IMPORT',
  'CREATE_RUBRO', 'UPDATE_RUBRO', 'DELETE_RUBRO',
  'CREATE_WEEKLY_PROMO', 'TOGGLE_WEEKLY_PROMO', 'DELETE_WEEKLY_PROMO',
  'CREATE_PERSONA', 'UPDATE_PERSONA', 'DELETE_PERSONA', 'CLIENT_VISIT_FAIL',
  'CREATE_ORDER', 'UPDATE_ORDER_ITEMS', 'UPDATE_ORDER_WEIGHTS', 'CONFIRM_ARMADO',
  'UPDATE_ORDER_STATUS', 'INVOICE_ORDER', 'CREATE_DIRECT_INVOICE',
  'CREATE_CREDIT_NOTE', 'APPROVE_CREDIT_NOTE', 'REJECT_CREDIT_NOTE',
  'CREATE_PURCHASE_ORDER', 'RECEIVE_PURCHASE_ORDER',
  'CREATE_SUPPLIER_INVOICE', 'DELETE_SUPPLIER_INVOICE',
  'CREATE_TAX_WITHHOLDING', 'UPDATE_PERCEPTION_TYPE',
  'RECORD_PERSONA_PAYMENT', 'CREATE_COLLECTION', 'DELETE_COLLECTION_RECEIPT',
  'CLOSE_OPERATIVE_DRAWER_RENDICION', 'OPEN_CASH_DRAWER', 'CLOSE_CASH_DRAWER', 'CLOSE_CENTRAL_DRAWER',
  'CREATE_BANK_ACCOUNT', 'UPDATE_BANK_ACCOUNT', 'DEPOSIT_CASH_TO_BANK', 'VERIFY_BANK_TRANSFER',
  'CREATE_EXPENSE', 'BULK_CREATE_EXPENSES', 'IMPORT_EXPENSES_EXCEL', 'DELETE_EXPENSE',
  'CREATE_DELIVERY_ROUTE', 'UPDATE_DELIVERY_ROUTE_STATUS', 'DELETE_DELIVERY_ROUTE',
  'TRANSFER_ROUTE_CUSTODY', 'SETTLE_DELIVERY_ROUTE',
  'CREATE_SALE_ROUTE', 'UPDATE_SALE_ROUTE', 'DELETE_SALE_ROUTE',
  'UPDATE_SALE_ROUTE_SEQUENCE', 'ADD_CLIENT_TO_ROUTE', 'RECORD_ROUTE_VISIT',
  'CREATE_VEHICLE', 'UPDATE_VEHICLE', 'DELETE_VEHICLE',
  'CREATE_VEHICLE_MAINTENANCE', 'DELETE_VEHICLE_MAINTENANCE',
  'CREATE_VEHICLE_EXPIRY', 'UPDATE_VEHICLE_EXPIRY', 'DELETE_VEHICLE_EXPIRY',
  'CREATE_FUEL_LOG', 'DELETE_FUEL_LOG', 'ENCRYPTED_DATABASE_BACKUP',
];

describe('Auditoría en Español y Contexto Real (Paso 1)', () => {
  it('traduce el 100% de las acciones y entidades del backend sin dejar códigos crudos ni (ID 0)', () => {
    const knownActions = new Set(getAllKnownAuditActionCodes());
    for (const action of BACKEND_ACTION_CODES) {
      expect(knownActions.has(action)).toBe(true);

      const badge = resolveAuditBadge(action);
      expect(badge.label).not.toContain('_');
      expect(badge.label).not.toBe(action);

      const message = formatAuditMessage({
        action,
        entityType: 'Product',
        entityId: 0,
        oldValues: null,
        newValues: {},
      });
      expect(message).not.toContain('_');
      expect(message).not.toContain(action);
      expect(message).not.toMatch(/\bProduct\b/);
      expect(message).not.toContain('(ID 0)');
      expect(message).not.toContain('#0');
    }

    for (const ent of getAllKnownEntityTypeCodes()) {
      const label = translateEntityType(ent);
      expect(label).not.toContain('_');
      expect(label.length).toBeGreaterThan(2);
    }
  });

  it('formatea ASSIGN_WMS_LOCATION, ADJUST_STOCK_BATCH, UPDATE_PRODUCT, TOGGLE_USER_STATUS y UPDATE_ORDER_STATUS con datos reales', () => {
    const wmsMsg = formatAuditMessage({
      action: 'ASSIGN_WMS_LOCATION',
      entityType: 'Product',
      entityId: 1626,
      newValues: { locationCode: 'D1-R01-C04-A', quantity: 24, mode: 'RELOCATE' },
      resolvedContext: { entityLabel: 'Yerba Playadito 1kg (SKU 0102)' },
    });
    expect(wmsMsg).toBe('Ubicó 24 u. en posición D1-R01-C04-A — Yerba Playadito 1kg (SKU 0102)');

    const batchSingleMsg = formatAuditMessage({
      action: 'ADJUST_STOCK_BATCH',
      entityType: 'Product',
      entityId: 0,
      newValues: {
        count: 1,
        adjustments: [{ productId: 1626, previousPhysical: 10, newPhysical: 8, appliedDelta: -2 }],
      },
      resolvedContext: { productsById: { 1626: { name: 'Yerba Playadito 1kg', sku: '0102' } } },
    });
    expect(batchSingleMsg).toBe('Ajustó stock físico de Yerba Playadito 1kg (SKU 0102): de 10 → 8 u. (-2 u.)');

    const batchMultiMsg = formatAuditMessage({
      action: 'ADJUST_STOCK_BATCH',
      entityType: 'Product',
      entityId: 0,
      newValues: {
        count: 2,
        adjustments: [
          { productId: 1626, previousPhysical: 10, newPhysical: 8, appliedDelta: -2 },
          { productId: 1713, previousPhysical: 5, newPhysical: 12, appliedDelta: 7 },
        ],
      },
      resolvedContext: {
        productsById: {
          1626: { name: 'Yerba Playadito 1kg', sku: '0102' },
          1713: { name: 'Queso Cremigal', sku: '0340' },
        },
      },
    });
    expect(batchMultiMsg).toBe('Ajustó stock de 2 productos: Yerba Playadito 1kg (10 → 8 u.), Queso Cremigal (5 → 12 u.)');

    const prodPriceMsg = formatAuditMessage({
      action: 'UPDATE_PRODUCT',
      entityType: 'Product',
      entityId: 1626,
      oldValues: { listPrice: 3200 },
      newValues: { listPrice: 3500 },
      resolvedContext: { entityLabel: 'Yerba Playadito 1kg (SKU 0102)' },
    });
    expect(prodPriceMsg).toBe('Modificó Yerba Playadito 1kg (SKU 0102): Lista A: $3.200 → $3.500');

    const toggleUserMsg = formatAuditMessage({
      action: 'TOGGLE_USER_STATUS',
      entityType: 'User',
      entityId: 75,
      oldValues: { username: 'matias', isActive: true },
      newValues: { username: 'matias', isActive: false },
    });
    expect(toggleUserMsg).toBe('Desactivó el acceso del empleado matias');

    const orderStatusMsg = formatAuditMessage({
      action: 'UPDATE_ORDER_STATUS',
      entityType: 'Order',
      entityId: 845,
      oldValues: { status: 'PENDING' },
      newValues: { status: 'PREPARED' },
      resolvedContext: { entityLabel: 'Pedido #845 — Kiosco San Martín' },
    });
    expect(orderStatusMsg).toBe('Cambió estado de Pedido #845 — Kiosco San Martín: Pendiente → Armado');
  });

  it('aplica traductor de respaldo para acciones futuras desconocidas y redondeo exacto en pesos enteros', () => {
    const badge = resolveAuditBadge('CREATE_NEW_FEATURE');
    const msg = formatAuditMessage({ action: 'CREATE_NEW_FEATURE', entityType: 'Product', entityId: 0 });
    expect(badge.label).toBe('Alta de Funcionalidad');
    expect(msg).not.toContain('_');
    expect(msg).not.toContain('CREATE_NEW_FEATURE');

    expect(formatAuditPesos('48199.80')).toBe('$48.200');
    expect(formatAuditPesos('48199.49')).toBe('$48.199');
    expect(formatAuditPesos('-1500.50')).toBe('-$1.501');
  });

  it('incluye módulo Cambios de precios, botón rápido en AuditLogsFilterBar y diff completo de Lista A/B/C', () => {
    expect(AUDIT_MODULES.some((m) => m.value === 'PRICES' && m.label === 'Cambios de precios')).toBe(true);

    const msg = formatAuditMessage({
      action: 'UPDATE_PRODUCT',
      entityType: 'Product',
      entityId: 1626,
      oldValues: { listPrice: 10000, listPriceB: 9500, listPriceC: 9000 },
      newValues: { listPrice: 11000, listPriceB: 10450, listPriceC: 9900 },
      resolvedContext: { entityLabel: 'Queso Cremoso (SKU 0001)' },
    });
    expect(msg).toBe(
      'Modificó Queso Cremoso (SKU 0001): Lista A: $10.000 → $11.000 · Lista B: $9.500 → $10.450 · Lista C: $9.000 → $9.900',
    );

    const noop = () => {};
    const html = renderToStaticMarkup(
      React.createElement(AuditLogsFilterBar, {
        draftFilters: { module: 'PRICES' },
        users: [],
        hasActiveFilters: true,
        onDraftChange: noop,
        onApply: noop,
        onReset: noop,
      }),
    );
    expect(html).toContain('Cambios de precios');
    expect(html).toContain('aria-pressed="true"');
  });
});
