import { Decimal } from 'decimal.js';
import {
  NumericInput,
  roundToIntegerPeso,
  roundToTwoDecimals,
  toDecimal,
} from '../core/money';

export type FuelTypeValue = 'NAFTA' | 'DIESEL';
export type FuelLogStatusValue = 'PENDING' | 'SETTLED';

export interface FuelSettlementLogInput {
  id: number;
  fuelType: FuelTypeValue;
  liters: NumericInput;
}

export interface FuelSettlementRatesInput {
  dieselPricePerLiter?: NumericInput | null;
  naftaPricePerLiter?: NumericInput | null;
  dieselTotalCost?: NumericInput | null;
  naftaTotalCost?: NumericInput | null;
}

export interface FuelSettlementItemResult {
  id: number;
  fuelType: FuelTypeValue;
  liters: Decimal;
  pricePerLiter: Decimal;
  totalCost: Decimal;
}

export interface FuelSettlementResult {
  items: FuelSettlementItemResult[];
  dieselLiters: Decimal;
  naftaLiters: Decimal;
  dieselPricePerLiter: Decimal | null;
  naftaPricePerLiter: Decimal | null;
  dieselTotal: Decimal;
  naftaTotal: Decimal;
  grandTotal: Decimal;
}

export interface VehicleFuelLogMetricInput {
  odometer: number;
  liters: NumericInput;
  totalCost?: NumericInput | null;
  status: FuelLogStatusValue;
}

export interface VehicleFuelStatsResult {
  logsCount: number;
  pendingCount: number;
  totalLiters: Decimal;
  pendingLiters: Decimal;
  settledLiters: Decimal;
  vehicleSpent: Decimal;
  kmTraveled: number;
  litersPer100Km: Decimal;
  kmPerLiter: Decimal;
  costPerKm: Decimal;
}

function hasPositiveValue(val?: NumericInput | null): val is NumericInput {
  if (val === undefined || val === null || val === '') return false;
  return toDecimal(val).greaterThan(0);
}

function settleFuelGroup(
  groupLogs: FuelSettlementLogInput[],
  fuelType: FuelTypeValue,
  pricePerLiterInput?: NumericInput | null,
  totalCostInput?: NumericInput | null,
): {
  items: FuelSettlementItemResult[];
  totalLiters: Decimal;
  pricePerLiter: Decimal;
  groupTotal: Decimal;
} {
  const totalLiters = groupLogs.reduce(
    (acc, log) => acc.plus(toDecimal(log.liters)),
    new Decimal(0),
  );

  if (totalLiters.lte(0)) {
    throw new Error(`Los litros seleccionados de ${fuelType} deben ser mayores a 0.`);
  }

  const label = fuelType === 'DIESEL' ? 'Diesel' : 'Nafta';

  if (hasPositiveValue(totalCostInput)) {
    const exactGroupTotal = roundToIntegerPeso(totalCostInput);
    const derivedPricePerLiter = roundToTwoDecimals(exactGroupTotal.dividedBy(totalLiters));

    const items: FuelSettlementItemResult[] = groupLogs.map((log) => {
      const lit = roundToTwoDecimals(log.liters);
      const exactShare = exactGroupTotal.times(lit).dividedBy(totalLiters);
      return {
        id: log.id,
        fuelType,
        liters: lit,
        pricePerLiter: derivedPricePerLiter,
        totalCost: roundToIntegerPeso(exactShare),
      };
    });

    // Ajuste de residuo de redondeo (± pesos enteros) sobre el ticket con más litros
    // para que la suma de los tickets coincida exactamente con el total pagado.
    const sumAssigned = items.reduce((acc, item) => acc.plus(item.totalCost), new Decimal(0));
    const diff = exactGroupTotal.minus(sumAssigned);
    if (!diff.isZero() && items.length > 0) {
      let maxIdx = 0;
      for (let i = 1; i < items.length; i += 1) {
        if (items[i].liters.greaterThan(items[maxIdx].liters)) {
          maxIdx = i;
        }
      }
      items[maxIdx].totalCost = items[maxIdx].totalCost.plus(diff);
    }

    return {
      items,
      totalLiters: roundToTwoDecimals(totalLiters),
      pricePerLiter: derivedPricePerLiter,
      groupTotal: exactGroupTotal,
    };
  }

  if (hasPositiveValue(pricePerLiterInput)) {
    const unitPrice = roundToTwoDecimals(pricePerLiterInput);
    const items: FuelSettlementItemResult[] = groupLogs.map((log) => {
      const lit = roundToTwoDecimals(log.liters);
      return {
        id: log.id,
        fuelType,
        liters: lit,
        pricePerLiter: unitPrice,
        totalCost: roundToIntegerPeso(lit.times(unitPrice)),
      };
    });

    const groupTotal = items.reduce((acc, item) => acc.plus(item.totalCost), new Decimal(0));

    return {
      items,
      totalLiters: roundToTwoDecimals(totalLiters),
      pricePerLiter: unitPrice,
      groupTotal,
    };
  }

  throw new Error(`Ingresá el precio por litro o el total pagado para ${label}.`);
}

/**
 * Calcula la liquidación semanal de tickets pendientes de combustible
 * soportando tarifas separadas para DIESEL y NAFTA en pesos enteros.
 */
export function calculateFuelSettlement(
  logs: FuelSettlementLogInput[],
  rates: FuelSettlementRatesInput,
): FuelSettlementResult {
  if (logs.length === 0) {
    throw new Error('Seleccioná al menos un ticket para liquidar.');
  }

  const dieselLogs = logs.filter((l) => l.fuelType === 'DIESEL');
  const naftaLogs = logs.filter((l) => l.fuelType === 'NAFTA');

  const items: FuelSettlementItemResult[] = [];
  let dieselLiters = new Decimal(0);
  let naftaLiters = new Decimal(0);
  let dieselPricePerLiter: Decimal | null = null;
  let naftaPricePerLiter: Decimal | null = null;
  let dieselTotal = new Decimal(0);
  let naftaTotal = new Decimal(0);

  if (dieselLogs.length > 0) {
    const res = settleFuelGroup(
      dieselLogs,
      'DIESEL',
      rates.dieselPricePerLiter,
      rates.dieselTotalCost,
    );
    items.push(...res.items);
    dieselLiters = res.totalLiters;
    dieselPricePerLiter = res.pricePerLiter;
    dieselTotal = res.groupTotal;
  }

  if (naftaLogs.length > 0) {
    const res = settleFuelGroup(
      naftaLogs,
      'NAFTA',
      rates.naftaPricePerLiter,
      rates.naftaTotalCost,
    );
    items.push(...res.items);
    naftaLiters = res.totalLiters;
    naftaPricePerLiter = res.pricePerLiter;
    naftaTotal = res.groupTotal;
  }

  const grandTotal = dieselTotal.plus(naftaTotal);

  return {
    items,
    dieselLiters,
    naftaLiters,
    dieselPricePerLiter,
    naftaPricePerLiter,
    dieselTotal,
    naftaTotal,
    grandTotal,
  };
}

/**
 * Calcula métricas de consumo y gasto de un vehículo.
 * El rendimiento (L/100 km y km/L) se calcula inmediatamente incluso con tickets pendientes sin precio.
 */
export function calculateVehicleFuelStats(
  logs: VehicleFuelLogMetricInput[],
): VehicleFuelStatsResult {
  const ordered = [...logs].sort((a, b) => a.odometer - b.odometer);
  const logsCount = ordered.length;

  let pendingCount = 0;
  let totalLiters = new Decimal(0);
  let pendingLiters = new Decimal(0);
  let settledLiters = new Decimal(0);
  let vehicleSpent = new Decimal(0);

  for (const log of ordered) {
    const lit = toDecimal(log.liters);
    totalLiters = totalLiters.plus(lit);

    if (log.status === 'PENDING') {
      pendingCount += 1;
      pendingLiters = pendingLiters.plus(lit);
    } else {
      settledLiters = settledLiters.plus(lit);
      if (log.totalCost !== undefined && log.totalCost !== null) {
        vehicleSpent = vehicleSpent.plus(roundToIntegerPeso(log.totalCost));
      }
    }
  }

  let kmTraveled = 0;
  let litersPer100Km = new Decimal(0);
  let kmPerLiter = new Decimal(0);
  let costPerKm = new Decimal(0);

  if (logsCount >= 2) {
    const firstOdo = ordered[0].odometer;
    const lastOdo = ordered[logsCount - 1].odometer;
    kmTraveled = Math.max(0, lastOdo - firstOdo);

    const litersForKm = ordered
      .slice(1)
      .reduce((acc, log) => acc.plus(toDecimal(log.liters)), new Decimal(0));

    if (kmTraveled > 0 && litersForKm.greaterThan(0)) {
      litersPer100Km = roundToTwoDecimals(litersForKm.dividedBy(kmTraveled).times(100));
      kmPerLiter = roundToTwoDecimals(new Decimal(kmTraveled).dividedBy(litersForKm));
      if (vehicleSpent.greaterThan(0)) {
        costPerKm = roundToTwoDecimals(vehicleSpent.dividedBy(kmTraveled));
      }
    }
  }

  return {
    logsCount,
    pendingCount,
    totalLiters: roundToTwoDecimals(totalLiters),
    pendingLiters: roundToTwoDecimals(pendingLiters),
    settledLiters: roundToTwoDecimals(settledLiters),
    vehicleSpent: roundToIntegerPeso(vehicleSpent),
    kmTraveled,
    litersPer100Km,
    kmPerLiter,
    costPerKm,
  };
}
