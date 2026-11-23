import { describe, it, expect } from 'vitest';
import {
  classifyDrawerHistoryRow,
  formatDrawerDateSummary,
  summarizeDrawerActivity,
} from '../drawerHistoryHelpers';

describe('classifyDrawerHistoryRow', () => {
  it('clasifica un registro legacy "VENDEDOR: ADMIN" como Cobro Oficina y oculta el pin de ciudad', () => {
    const res = classifyDrawerHistoryRow({
      drawerType: 'VENDEDOR',
      branch: 'VENDEDOR: ADMIN',
      routeNote: 'GENERAL VILLEGAS',
    });

    expect(res.kind).toBe('ADMINISTRACION');
    expect(res.badgeLabel).toBe('Cobro Oficina');
    expect(res.responsibleName).toBe('Admin');
    expect(res.showRouteNote).toBe(false);
  });

  it('clasifica un registro nuevo "ADMINISTRACION: ADMIN" como Cobro Oficina con resumen de recibo', () => {
    const res = classifyDrawerHistoryRow({
      drawerType: 'ADMINISTRACION',
      branch: 'ADMINISTRACION: ADMIN',
      routeNote: null,
      transactions: [
        { type: 'INCOME', receiptNumber: 'REC-00042', persona: { name: 'Supermercado Norte' } },
      ],
    });

    expect(res.kind).toBe('ADMINISTRACION');
    expect(res.badgeLabel).toBe('Cobro Oficina');
    expect(res.responsibleName).toBe('Admin');
    expect(res.showRouteNote).toBe(false);
    expect(res.activitySummary).toBe('Recibo · Supermercado Norte');
  });

  it('clasifica a Diego Lejarza como Vendedor y oculta el pin de ciudad del cliente', () => {
    const res = classifyDrawerHistoryRow({
      drawerType: 'VENDEDOR',
      branch: 'VENDEDOR: DIEGO',
      routeNote: 'INTENDENTE ALVEAR',
    });

    expect(res.kind).toBe('VENDEDOR');
    expect(res.badgeLabel).toBe('Vendedor');
    expect(res.responsibleName).toBe('Diego Lejarza');
    expect(res.showRouteNote).toBe(false);
  });

  it('muestra routeNote únicamente para Repartidor', () => {
    const res = classifyDrawerHistoryRow({
      drawerType: 'REPARTIDOR',
      branch: 'REPARTIDOR: AGUSTIN (Ruta #12)',
      routeNote: 'General Villegas',
    });

    expect(res.kind).toBe('REPARTIDOR');
    expect(res.badgeLabel).toBe('Repartidor');
    expect(res.responsibleName).toBe('Agustín Montiel');
    expect(res.showRouteNote).toBe(true);
  });

  it('clasifica Caja Oficina y Caja Grande correctamente', () => {
    const depo = classifyDrawerHistoryRow({
      drawerType: 'DEPOSITO',
      branch: 'DEPOSITO',
      user: { username: 'admin' },
      transactions: [
        { type: 'INCOME', receiptNumber: 'REC-00100', persona: { name: 'Cliente A' } },
        { type: 'INCOME', orderId: 55, persona: { name: 'Cliente B' } },
      ],
    });
    expect(depo.kind).toBe('DEPOSITO');
    expect(depo.badgeLabel).toBe('Caja Oficina');
    expect(depo.showRouteNote).toBe(false);
    expect(depo.activitySummary).toBe('1 recibo · 1 venta');

    const central = classifyDrawerHistoryRow({ drawerType: 'CENTRAL', branch: 'CENTRAL', user: { username: 'admin' } });
    expect(central.kind).toBe('CENTRAL');
    expect(central.badgeLabel).toBe('Caja Grande');
    expect(central.showRouteNote).toBe(false);
    expect(central.activitySummary).toBeNull();
  });
});

describe('summarizeDrawerActivity', () => {
  it('resume un solo recibo, venta, rendición o gasto de forma clara', () => {
    expect(summarizeDrawerActivity([])).toBeNull();
    expect(
      summarizeDrawerActivity([{ type: 'INCOME', receiptNumber: 'REC-00012' }]),
    ).toBe('Recibo REC-00012');
    expect(
      summarizeDrawerActivity([{ type: 'INCOME', orderId: 88, persona: { name: 'Kiosco Central' } }]),
    ).toBe('Venta #88 · Kiosco Central');
    expect(
      summarizeDrawerActivity([{ type: 'INCOME', description: 'Ingreso Rendición de Fondos - VENDEDOR: DIEGO' }]),
    ).toBe('1 rendición');
    expect(
      summarizeDrawerActivity([{ type: 'OUTCOME', description: 'Flete' }]),
    ).toBe('1 gasto');
  });

  it('resume múltiples movimientos agrupados por tipo', () => {
    expect(
      summarizeDrawerActivity([
        { type: 'INCOME', receiptNumber: 'REC-001' },
        { type: 'INCOME', receiptNumber: 'REC-002' },
        { type: 'INCOME', orderId: 10 },
        { type: 'OUTCOME', description: 'Nafta' },
      ]),
    ).toBe('2 recibos · 1 venta · 1 gasto');
  });
});

describe('formatDrawerDateSummary', () => {
  it('en rendiciones (no Oficina) devuelve solo una fecha sin rango duplicado', () => {
    const res = formatDrawerDateSummary(
      {
        openedAt: new Date(2026, 10, 19, 17, 29, 0),
        closedAt: new Date(2026, 10, 19, 17, 29, 0),
      },
      false,
    );

    expect(res.primaryLabel).toBe('19/11/26 · 17:29');
    expect(res.rangeLabel).toBeNull();
  });

  it('en Caja Diaria (Oficina) del mismo día muestra rango de horario compacto', () => {
    const res = formatDrawerDateSummary(
      {
        openedAt: new Date(2026, 10, 19, 14, 57, 0),
        closedAt: new Date(2026, 10, 19, 15, 45, 0),
      },
      true,
    );

    expect(res.primaryLabel).toBe('19/11/26 · 15:45');
    expect(res.rangeLabel).toBe('14:57 → 15:45');
  });

  it('en Caja Diaria (Oficina) que cruza de día muestra ambas fechas y horas en el rango', () => {
    const res = formatDrawerDateSummary(
      {
        openedAt: new Date(2026, 10, 16, 14, 17, 0),
        closedAt: new Date(2026, 10, 19, 14, 28, 0),
      },
      true,
    );

    expect(res.primaryLabel).toBe('19/11/26 · 14:28');
    expect(res.rangeLabel).toBe('16/11 14:17 → 19/11 14:28');
  });
});
