import { describe, expect, it } from 'vitest';
import {
  getActiveAssignedDeliveryRoutes,
  hasDeliveryPermission,
  isRouteAssignedToUser,
} from '../repartoDriverMatcher';

describe('repartoDriverMatcher — Doble función Vendedor + Reparto', () => {
  const fabian = { id: 67, username: 'fabian', role: 'VENDEDOR', permissions: { canDeliver: true } };
  const norberto = { id: 68, username: 'norberto', role: 'VENDEDOR', permissions: { canDeliver: true } };
  const miguel = { id: 74, username: 'miguel', role: 'VENDEDOR', permissions: { canDeliver: true, canSell: true } };
  const diego = { id: 66, username: 'diego', role: 'VENDEDOR', permissions: null };

  it('detecta correctamente el permiso canDeliver solo en vendedores habilitados', () => {
    expect(hasDeliveryPermission(fabian)).toBe(true);
    expect(hasDeliveryPermission(norberto)).toBe(true);
    expect(hasDeliveryPermission(miguel)).toBe(true);
    expect(hasDeliveryPermission(diego)).toBe(false);
    expect(hasDeliveryPermission(null)).toBe(false);
  });

  it('vincula rutas por driverEmployee.userId con prioridad sobre el texto del nombre', () => {
    const routeById = {
      id: 101,
      status: 'IN_TRANSIT',
      driverName: 'F. Maya',
      driverEmployee: { id: 72, userId: 67, firstName: 'Fabián', lastName: 'Maya' },
    };

    expect(isRouteAssignedToUser(routeById, fabian)).toBe(true);
    expect(isRouteAssignedToUser(routeById, norberto)).toBe(false);
    expect(isRouteAssignedToUser(routeById, miguel)).toBe(false);
  });

  it('usa coincidencia normalizada sin tildes como respaldo en viajes legacy sin driverEmployee', () => {
    const legacyRoute = {
      id: 102,
      status: 'PENDING',
      driverName: 'Fabián Maya',
      driverEmployee: null,
    };

    expect(isRouteAssignedToUser(legacyRoute, fabian)).toBe(true);
    expect(isRouteAssignedToUser(legacyRoute, norberto)).toBe(false);
  });

  it('filtra solo viajes activos (excluyendo COMPLETED) asignados al usuario', () => {
    const routes = [
      { id: 1, status: 'PENDING', driverName: 'Miguel Alberca', driverEmployee: { userId: 74 } },
      { id: 2, status: 'IN_TRANSIT', driverName: 'Miguel Alberca', driverEmployee: { userId: 74 } },
      { id: 3, status: 'COMPLETED', driverName: 'Miguel Alberca', driverEmployee: { userId: 74 } },
      { id: 4, status: 'IN_TRANSIT', driverName: 'Norberto Ramos', driverEmployee: { userId: 68 } },
    ];

    const miguelActive = getActiveAssignedDeliveryRoutes(routes, miguel);
    expect(miguelActive.map((r) => r.id)).toEqual([1, 2]);

    const norbertoActive = getActiveAssignedDeliveryRoutes(routes, norberto);
    expect(norbertoActive.map((r) => r.id)).toEqual([4]);
  });
});
