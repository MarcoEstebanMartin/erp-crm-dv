import { Decimal } from 'decimal.js';
import AppError from '../utils/AppError';
import { roundToIntegerPeso, sumIntegerAmounts } from '../core/money';

export type DispatchDeliveryMethod = 'DELIVERY' | 'PICKUP';

export interface RoadVehicleCandidateInput {
  plate: string;
  brand?: string | null;
  model?: string | null;
  status?: string | null;
}

export interface EmployeeDriverInput {
  id: number;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  isActive?: boolean;
  userId?: number | null;
}

export interface DispatchDriverCandidate {
  employeeId: number;
  userId: number | null;
  fullName: string;
  shortName: string;
  position: string;
  department: string;
  isPrimaryDriver: boolean;
}

export interface OrderDeliveryValidationInput {
  order: {
    id: number;
    status: string;
    invoiceNumber?: string | null;
    deliveryMethod: DispatchDeliveryMethod;
    deliveryRouteId: number | null;
    currentRouteStatus?: string | null;
    deliveredAt?: Date | string | null;
  };
  targetMethod: DispatchDeliveryMethod;
  targetRoute?: { id: number; status: string } | null;
  markPickedUp?: boolean;
}

export interface OrderDeliveryAssignmentPlan {
  deliveryMethod: DispatchDeliveryMethod;
  deliveryRouteId: number | null;
  clearSequence: boolean;
  stampDeliveredAt: boolean;
  clearDeliveredAt: boolean;
}

export interface StopSequenceEntry {
  orderId: number;
  deliverySequence: number;
}

export interface TripSummaryOrderInput {
  status?: string | null;
  bultosCount?: number | null;
  totalAmount: string | number | { toString(): string };
}

export interface TripSummaryMetrics {
  ordersCount: number;
  totalBultos: number;
  totalAmountPesos: number;
}

const NON_DELIVERY_FLEET_PLATES = new Set([
  'DEP-GRAL',
  'OTF 197',
  'AF 747 KX',
  'AD 032 KX',
]);

/**
 * Determina si un vehículo de la flota está habilitado para reparto vial,
 * excluyendo autoelevadores, registros administrativos, vehículos particulares/gerenciales
 * y unidades fuera de servicio.
 */
export function isRoadFleetVehicle(vehicle: RoadVehicleCandidateInput): boolean {
  const status = (vehicle.status ?? 'ACTIVE').trim().toUpperCase();
  if (status !== 'ACTIVE') return false;

  const plate = (vehicle.plate || '').trim().toUpperCase();
  const brand = (vehicle.brand || '').trim().toUpperCase();
  if (!plate) return false;
  if (plate.startsWith('ELEV-') || NON_DELIVERY_FLEET_PLATES.has(plate)) return false;
  if (brand === 'AUTOELEVADOR' || brand === 'ADMINISTRACION') return false;

  return true;
}

/**
 * Construye y ordena la nómina real de conductores activos desde Employee,
 * priorizando el personal de Logística / Choferes y excluyendo socios de Dirección.
 */
export function buildDispatchDriverCandidates(
  employees: EmployeeDriverInput[],
): DispatchDriverCandidate[] {
  return employees
    .filter((emp) => {
      if (emp.isActive === false) return false;
      const dept = (emp.department || '').trim().toUpperCase();
      const isDriverRole = /chofer|repart/i.test(emp.position || '');
      if (dept === 'DIRECCION' && !isDriverRole) return false;
      return true;
    })
    .map((emp) => {
      const first = (emp.firstName || '').trim();
      const last = (emp.lastName || '').trim();
      const fullName = [first, last].filter(Boolean).join(' ');
      const dept = (emp.department || '').trim().toUpperCase();
      const position = (emp.position || '').trim();
      const isPrimaryDriver = dept === 'LOGISTICA' || /chofer|repart/i.test(position);

      return {
        employeeId: emp.id,
        userId: emp.userId ?? null,
        fullName,
        shortName: first || fullName,
        position,
        department: dept,
        isPrimaryDriver,
      };
    })
    .sort((a, b) => {
      if (a.isPrimaryDriver !== b.isPrimaryDriver) {
        return a.isPrimaryDriver ? -1 : 1;
      }
      return a.fullName.localeCompare(b.fullName, 'es');
    });
}

/**
 * Resuelve la modalidad por defecto al emitir o cargar un comprobante:
 * - Venta directa de mostrador -> PICKUP (Retiro local)
 * - Preventa / Tienda Web / Carga general -> DELIVERY (Reparto)
 */
export function resolveDefaultDeliveryMethod(params: {
  salesChannel?: string | null;
  isDirectCounterInvoice?: boolean;
  explicitMethod?: DispatchDeliveryMethod | null;
}): DispatchDeliveryMethod {
  if (params.explicitMethod === 'DELIVERY' || params.explicitMethod === 'PICKUP') {
    return params.explicitMethod;
  }
  if (params.isDirectCounterInvoice === true) {
    return 'PICKUP';
  }
  return 'DELIVERY';
}

/**
 * Valida reglas operativas y de trazabilidad al asignar un pedido a un viaje o a retiro en local.
 */
export function validateOrderDeliveryAssignment(
  params: OrderDeliveryValidationInput,
): OrderDeliveryAssignmentPlan {
  const { order, targetMethod, targetRoute, markPickedUp } = params;

  if (order.status === 'CANCELLED') {
    throw new AppError('No se puede modificar la entrega de un pedido cancelado.', 400);
  }

  const lockedOnActiveOrFinishedRoute =
    order.deliveryRouteId !== null &&
    (order.currentRouteStatus === 'IN_TRANSIT' || order.currentRouteStatus === 'COMPLETED');

  if (
    lockedOnActiveOrFinishedRoute &&
    (targetMethod === 'PICKUP' || (targetRoute?.id ?? null) !== order.deliveryRouteId)
  ) {
    throw new AppError(
      `El pedido #${order.id} pertenece a un viaje en curso o completado y no puede reasignarse.`,
      400,
    );
  }

  if (targetMethod === 'PICKUP') {
    if (targetRoute) {
      throw new AppError('Un pedido de retiro en local no puede tener un viaje asignado.', 400);
    }
    if (markPickedUp === true && !order.invoiceNumber) {
      throw new AppError(
        'El pedido debe facturarse antes de registrar su entrega por retiro en local.',
        400,
      );
    }
    return {
      deliveryMethod: 'PICKUP',
      deliveryRouteId: null,
      clearSequence: true,
      stampDeliveredAt: Boolean(markPickedUp),
      clearDeliveredAt: markPickedUp === false,
    };
  }

  if (targetRoute && targetRoute.status !== 'PENDING') {
    throw new AppError('Solo se pueden asignar pedidos a viajes en estado Pendiente.', 400);
  }

  return {
    deliveryMethod: 'DELIVERY',
    deliveryRouteId: targetRoute ? targetRoute.id : null,
    clearSequence: !targetRoute,
    stampDeliveredAt: false,
    clearDeliveredAt: true,
  };
}

/**
 * Deduplica IDs preservando el orden exacto de paradas (1, 2, 3...).
 */
export function normalizeStopSequences(orderIds: number[]): StopSequenceEntry[] {
  const seen = new Set<number>();
  const result: StopSequenceEntry[] = [];
  for (const rawId of orderIds) {
    const orderId = Number(rawId);
    if (!Number.isInteger(orderId) || orderId <= 0 || seen.has(orderId)) continue;
    seen.add(orderId);
    result.push({ orderId, deliverySequence: result.length + 1 });
  }
  return result;
}

/**
 * Calcula pedidos activos, bultos totales e importe total en pesos enteros (Decimal.js ROUND_HALF_UP).
 */
export function computeTripSummaryMetrics(orders: TripSummaryOrderInput[]): TripSummaryMetrics {
  const activeOrders = orders.filter((o) => o.status !== 'CANCELLED');
  if (activeOrders.length === 0) {
    return { ordersCount: 0, totalBultos: 0, totalAmountPesos: 0 };
  }

  const bultosList = activeOrders.map((o) => {
    const rounded = roundToIntegerPeso(o.bultosCount ?? 1);
    return Decimal.max(1, rounded);
  });

  const amountsList = activeOrders.map((o) => roundToIntegerPeso(o.totalAmount?.toString() ?? '0'));

  return {
    ordersCount: activeOrders.length,
    totalBultos: sumIntegerAmounts(bultosList).toNumber(),
    totalAmountPesos: sumIntegerAmounts(amountsList).toNumber(),
  };
}
