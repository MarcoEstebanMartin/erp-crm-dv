import { Decimal } from 'decimal.js';
import {
  NumericInput,
  roundToIntegerPeso,
  roundToTwoDecimals,
  toDecimal,
} from '../core/money';
import { calculateVehicleFuelStats, VehicleFuelLogMetricInput } from './fuel.engine';
import {
  computeMarginPercent,
  normalizeCity,
  ReportLineItemInput,
  resolveItemHistoricalMetrics,
  resolveOrderCommercialRevenueDec,
} from './reports-core.engine';

export interface TripRouteOrderInput {
  id: number;
  totalAmount: NumericInput;
  persona?: { city?: string | null } | null;
  items: ReportLineItemInput[];
}

export interface TripRouteInput {
  id: number;
  routeName?: string | null;
  driverName: string;
  vehicleId?: number | null;
  vehiclePlate: string;
  vehicleDescription?: string | null;
  status: string;
  date: Date | string;
  tripKm?: NumericInput | null;
  tripExpenses?: NumericInput | null;
  orders: TripRouteOrderInput[];
}

export interface TripProfitabilityRow {
  id: number;
  routeName: string;
  driverName: string;
  vehicleId: number | null;
  vehiclePlate: string;
  vehicleDescription: string | null;
  status: string;
  date: string;
  cities: string[];
  orderCount: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPct: number;
  tripKm: number | null;
  costPerKm: number;
  estimatedFuelCost: number;
  tripExpenses: number;
  totalTripCost: number;
  netProfit: number;
  netMarginPct: number;
}

export interface TripProfitabilityResult {
  kpis: {
    totalRoutes: number;
    routesWithTripCost: number;
    totalRevenue: number;
    totalGrossProfit: number;
    totalTripCost: number;
    totalNetProfit: number;
    overallNetMarginPct: number;
  };
  trips: TripProfitabilityRow[];
}

export function computeTripProfitabilityMetrics(input: {
  routes: TripRouteInput[];
  vehicleFuelLogsByVehicleId: Map<number, VehicleFuelLogMetricInput[]>;
}): TripProfitabilityResult {
  const costPerKmCache = new Map<number, Decimal>();

  const getVehicleCostPerKm = (vehicleId?: number | null): Decimal => {
    if (!vehicleId) return new Decimal(0);
    const cached = costPerKmCache.get(vehicleId);
    if (cached) return cached;

    const logs = input.vehicleFuelLogsByVehicleId.get(vehicleId) || [];
    const costPerKm = logs.length >= 2 ? calculateVehicleFuelStats(logs).costPerKm : new Decimal(0);
    costPerKmCache.set(vehicleId, costPerKm);
    return costPerKm;
  };

  let sumRevenueDec = new Decimal(0);
  let sumGrossProfitDec = new Decimal(0);
  let sumTripCostDec = new Decimal(0);
  let routesWithTripCost = 0;

  const trips: TripProfitabilityRow[] = input.routes.map((route) => {
    let revenueDec = new Decimal(0);
    let costDec = new Decimal(0);
    const citySet = new Set<string>();

    for (const order of route.orders) {
      revenueDec = revenueDec.plus(resolveOrderCommercialRevenueDec(order));
      for (const item of order.items) {
        costDec = costDec.plus(resolveItemHistoricalMetrics(item).itemCostDec);
      }
      const city = normalizeCity(order.persona?.city);
      if (city !== 'Sin Localidad') citySet.add(city);
    }

    const grossProfitDec = revenueDec.minus(costDec);
    const grossMarginPct = computeMarginPercent(grossProfitDec, revenueDec, 2);

    const hasTripKm = route.tripKm !== undefined && route.tripKm !== null && toDecimal(route.tripKm).gt(0);
    const tripKmDec = hasTripKm ? roundToTwoDecimals(route.tripKm!) : new Decimal(0);
    const costPerKmDec = getVehicleCostPerKm(route.vehicleId);
    const estimatedFuelCostDec =
      tripKmDec.gt(0) && costPerKmDec.gt(0)
        ? roundToIntegerPeso(tripKmDec.times(costPerKmDec))
        : new Decimal(0);
    const tripExpensesDec = roundToIntegerPeso(route.tripExpenses || 0);
    const totalTripCostDec = estimatedFuelCostDec.plus(tripExpensesDec);
    const netProfitDec = grossProfitDec.minus(totalTripCostDec);
    const netMarginPct = computeMarginPercent(netProfitDec, revenueDec, 2);

    if (totalTripCostDec.gt(0) || hasTripKm) {
      routesWithTripCost += 1;
    }

    sumRevenueDec = sumRevenueDec.plus(revenueDec);
    sumGrossProfitDec = sumGrossProfitDec.plus(grossProfitDec);
    sumTripCostDec = sumTripCostDec.plus(totalTripCostDec);

    const isoDate =
      route.date instanceof Date ? route.date.toISOString() : String(route.date || '');

    return {
      id: route.id,
      routeName: route.routeName?.trim() || `Hoja de Ruta #${route.id}`,
      driverName: route.driverName,
      vehicleId: route.vehicleId ?? null,
      vehiclePlate: route.vehiclePlate,
      vehicleDescription: route.vehicleDescription ?? null,
      status: route.status,
      date: isoDate,
      cities: Array.from(citySet).sort((a, b) => a.localeCompare(b, 'es')),
      orderCount: route.orders.length,
      totalRevenue: roundToIntegerPeso(revenueDec).toNumber(),
      totalCost: roundToIntegerPeso(costDec).toNumber(),
      grossProfit: roundToIntegerPeso(grossProfitDec).toNumber(),
      grossMarginPct,
      tripKm: hasTripKm ? tripKmDec.toNumber() : null,
      costPerKm: roundToTwoDecimals(costPerKmDec).toNumber(),
      estimatedFuelCost: estimatedFuelCostDec.toNumber(),
      tripExpenses: tripExpensesDec.toNumber(),
      totalTripCost: totalTripCostDec.toNumber(),
      netProfit: roundToIntegerPeso(netProfitDec).toNumber(),
      netMarginPct,
    };
  });

  const sumNetProfitDec = sumGrossProfitDec.minus(sumTripCostDec);

  return {
    kpis: {
      totalRoutes: trips.length,
      routesWithTripCost,
      totalRevenue: roundToIntegerPeso(sumRevenueDec).toNumber(),
      totalGrossProfit: roundToIntegerPeso(sumGrossProfitDec).toNumber(),
      totalTripCost: roundToIntegerPeso(sumTripCostDec).toNumber(),
      totalNetProfit: roundToIntegerPeso(sumNetProfitDec).toNumber(),
      overallNetMarginPct: computeMarginPercent(sumNetProfitDec, sumRevenueDec, 2),
    },
    trips,
  };
}
