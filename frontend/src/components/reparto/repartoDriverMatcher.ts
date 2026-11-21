export interface StaffUserIdentity {
  id?: number | null;
  username?: string | null;
  role?: string | null;
  permissions?: {
    canSell?: boolean;
    canPick?: boolean;
    canDeliver?: boolean;
    canCollect?: boolean;
    canManageStock?: boolean;
  } | null;
}

export interface AssignableDeliveryRoute {
  id?: number;
  status?: string | null;
  driverName?: string | null;
  vehiclePlate?: string | null;
  orders?: Array<{ id?: number }>;
  driverEmployee?: {
    id?: number | null;
    userId?: number | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}

export function normalizeDriverText(value?: string | null): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function hasDeliveryPermission(user?: StaffUserIdentity | null): boolean {
  return Boolean(user?.permissions?.canDeliver);
}

/**
 * Determina si una hoja de ruta de reparto pertenece al usuario autenticado.
 * Prioriza el vínculo exacto por `driverEmployee.userId` y utiliza coincidencia
 * normalizada (sin tildes) sobre `driverName` solo como respaldo para viajes legacy.
 */
export function isRouteAssignedToUser(
  route: AssignableDeliveryRoute,
  user?: StaffUserIdentity | null,
): boolean {
  if (!user) return false;

  const employeeUserId = route.driverEmployee?.userId;
  if (employeeUserId != null && user.id != null) {
    return Number(employeeUserId) === Number(user.id);
  }

  const normalizedUser = normalizeDriverText(user.username);
  const normalizedDriver = normalizeDriverText(route.driverName);
  if (!normalizedUser || !normalizedDriver) return false;

  return normalizedDriver.includes(normalizedUser) || normalizedUser.includes(normalizedDriver);
}

export function getActiveAssignedDeliveryRoutes<T extends AssignableDeliveryRoute>(
  routes: T[],
  user?: StaffUserIdentity | null,
): T[] {
  if (!user) return [];
  return routes.filter((route) => route.status !== 'COMPLETED' && isRouteAssignedToUser(route, user));
}
