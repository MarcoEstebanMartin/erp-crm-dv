import { describe, it, expect } from 'vitest';
import { classifyDrawerHistoryRow, formatDrawerDateSummary } from '../drawerHistoryHelpers';

describe('classifyDrawerHistoryRow', () => {
  it('clasifica un registro legacy "VENDEDOR: ADMIN" como Administración y oculta el pin de ciudad', () => {
    const res = classifyDrawerHistoryRow({
      drawerType: 'VENDEDOR',
      branch: 'VENDEDOR: ADMIN',
      routeNote: 'GENERAL VILLEGAS',
    });

    expect(res.kind).toBe('ADMINISTRACION');
    expect(res.badgeLabel).toBe('Administración');
    expect(res.responsibleName).toBe('Admin');
    expect(res.showRouteNote).toBe(false);
  });

  it('clasifica un registro nuevo "ADMINISTRACION: ADMIN" como Administración', () => {
    const res = classifyDrawerHistoryRow({
      drawerType: 'ADMINISTRACION',
      branch: 'ADMINISTRACION: ADMIN',
      routeNote: null,
    });

    expect(res.kind).toBe('ADMINISTRACION');
    expect(res.badgeLabel).toBe('Administración');
    expect(res.responsibleName).toBe('Admin');
    expect(res.showRouteNote).toBe(false);
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

  it('clasifica Oficina y Caja Grande correctamente', () => {
    const depo = classifyDrawerHistoryRow({ drawerType: 'DEPOSITO', branch: 'DEPOSITO', user: { username: 'admin' } });
    expect(depo.kind).toBe('DEPOSITO');
    expect(depo.badgeLabel).toBe('Oficina');
    expect(depo.showRouteNote).toBe(false);

    const central = classifyDrawerHistoryRow({ drawerType: 'CENTRAL', branch: 'CENTRAL', user: { username: 'admin' } });
    expect(central.kind).toBe('CENTRAL');
    expect(central.badgeLabel).toBe('Caja Grande');
    expect(central.showRouteNote).toBe(false);
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
