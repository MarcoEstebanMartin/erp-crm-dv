import { describe, expect, it } from 'vitest';
import { computeTripProfitabilityMetrics } from './reports-trips.engine';

describe('reports-trips.engine — Rentabilidad neta por viaje (FuelLog $/km + viáticos)', () => {
  it('estima combustible automáticamente según FuelLog del vehículo, suma viáticos y calcula utilidad neta del viaje', () => {
    const vehicleFuelLogsByVehicleId = new Map([
      [
        5,
        [
          { odometer: 100000, liters: 50, totalCost: 60000, status: 'SETTLED' as const },
          { odometer: 100500, liters: 50, totalCost: 75000, status: 'SETTLED' as const },
        ],
      ],
    ]);

    const result = computeTripProfitabilityMetrics({
      routes: [
        {
          id: 42,
          routeName: 'Ruta Norte - Bunge / Charlone',
          driverName: 'Gemini Reparto',
          vehicleId: 5,
          vehiclePlate: 'AA123BB',
          vehicleDescription: 'Accelo 815',
          status: 'COMPLETED',
          date: '2026-11-20T12:00:00.000Z',
          tripKm: 200,
          tripExpenses: 15000,
          orders: [
            {
              id: 1,
              // totalAmount incluye $5.000 de percepciones que NO deben inflar la utilidad
              totalAmount: 505000,
              persona: { city: 'Bunge' },
              items: [{ quantity: 10, subtotal: 500000, unitCostSnapshot: 35000 }],
            },
            {
              id: 2,
              totalAmount: 300000,
              persona: { city: 'Charlone' },
              items: [{ quantity: 10, subtotal: 300000, unitCostSnapshot: 23000 }],
            },
          ],
        },
      ],
      vehicleFuelLogsByVehicleId,
    });

    expect(result.trips).toHaveLength(1);
    const trip = result.trips[0];

    // Venta comercial = 500k + 300k = 800k; CMV = 350k + 230k = 580k; Utilidad bruta = 220k (27.5%)
    expect(trip.totalRevenue).toBe(800000);
    expect(trip.totalCost).toBe(580000);
    expect(trip.grossProfit).toBe(220000);
    expect(trip.grossMarginPct).toBe(27.5);
    expect(trip.cities).toEqual(['CHARLONE', 'EMILIO V. BUNGE']);

    // FuelLog (calculateVehicleFuelStats): $135.000 liquidados / 500 km = $270/km
    // 200 km * $270/km = $54.000 combustible + $15.000 viáticos = $69.000 costo total viaje
    expect(trip.costPerKm).toBe(270);
    expect(trip.estimatedFuelCost).toBe(54000);
    expect(trip.tripExpenses).toBe(15000);
    expect(trip.totalTripCost).toBe(69000);

    // Utilidad neta viaje = 220.000 - 69.000 = 151.000 (18.88% sobre 800.000)
    expect(trip.netProfit).toBe(151000);
    expect(trip.netMarginPct).toBe(18.88);
    expect(result.kpis).toEqual({
      totalRoutes: 1,
      routesWithTripCost: 1,
      totalRevenue: 800000,
      totalGrossProfit: 220000,
      totalTripCost: 69000,
      totalNetProfit: 151000,
      overallNetMarginPct: 18.88,
    });
  });

  it('funciona sin romper si la ruta no tiene km ni FuelLog cargado (costo viaje = viáticos únicamente)', () => {
    const result = computeTripProfitabilityMetrics({
      routes: [
        {
          id: 99,
          routeName: null,
          driverName: 'Gemini Reparto',
          vehicleId: null,
          vehiclePlate: 'SIN-PATENTE',
          status: 'COMPLETED',
          date: '2026-11-21T12:00:00.000Z',
          tripKm: null,
          tripExpenses: 8000,
          orders: [
            {
              id: 3,
              totalAmount: 100000,
              persona: { city: 'Villegas' },
              items: [{ quantity: 1, subtotal: 100000, unitCostSnapshot: 75000 }],
            },
          ],
        },
      ],
      vehicleFuelLogsByVehicleId: new Map(),
    });

    const trip = result.trips[0];
    expect(trip.routeName).toBe('Hoja de Ruta #99');
    expect(trip.tripKm).toBeNull();
    expect(trip.costPerKm).toBe(0);
    expect(trip.estimatedFuelCost).toBe(0);
    expect(trip.tripExpenses).toBe(8000);
    expect(trip.totalTripCost).toBe(8000);
    expect(trip.netProfit).toBe(17000);
    expect(trip.netMarginPct).toBe(17);
  });
});
