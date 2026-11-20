import { describe, expect, it } from 'vitest';
import {
  calculateFuelSettlement,
  calculateVehicleFuelStats,
} from '../fuel.engine';

describe('fuel.engine — Liquidación semanal y consumo', () => {
  it('liquida tickets mixtos de Diesel y Nafta por precio por litro en pesos enteros', () => {
    const res = calculateFuelSettlement(
      [
        { id: 1, fuelType: 'DIESEL', liters: '99.27' },
        { id: 2, fuelType: 'DIESEL', liters: '80.00' },
        { id: 3, fuelType: 'NAFTA', liters: '42.50' },
      ],
      {
        dieselPricePerLiter: '1420.50',
        naftaPricePerLiter: '1310.00',
      },
    );

    expect(res.dieselLiters.toNumber()).toBe(179.27);
    expect(res.naftaLiters.toNumber()).toBe(42.5);
    expect(res.items[0].totalCost.toNumber()).toBe(141013); // 99.27 * 1420.50 = 141013.035 -> 141013
    expect(res.items[1].totalCost.toNumber()).toBe(113640); // 80 * 1420.50 = 113640
    expect(res.items[2].totalCost.toNumber()).toBe(55675);  // 42.5 * 1310 = 55675
    expect(res.dieselTotal.toNumber()).toBe(254653);
    expect(res.naftaTotal.toNumber()).toBe(55675);
    expect(res.grandTotal.toNumber()).toBe(310328);
  });

  it('prorratea el total semanal exacto sin diferencia de redondeo al peso entero', () => {
    const res = calculateFuelSettlement(
      [
        { id: 10, fuelType: 'DIESEL', liters: '33.33' },
        { id: 11, fuelType: 'DIESEL', liters: '33.33' },
        { id: 12, fuelType: 'DIESEL', liters: '33.34' },
      ],
      {
        dieselTotalCost: '150001',
      },
    );

    const sumTickets = res.items.reduce((acc, i) => acc + i.totalCost.toNumber(), 0);
    expect(sumTickets).toBe(150001);
    expect(res.dieselTotal.toNumber()).toBe(150001);
    expect(res.grandTotal.toNumber()).toBe(150001);
    expect(res.dieselPricePerLiter?.toNumber()).toBe(1500.01);
  });

  it('exige tarifa si faltan datos para un combustible seleccionado', () => {
    expect(() =>
      calculateFuelSettlement(
        [
          { id: 1, fuelType: 'DIESEL', liters: 50 },
          { id: 2, fuelType: 'NAFTA', liters: 30 },
        ],
        { dieselPricePerLiter: 1400 },
      ),
    ).toThrow(/Nafta/);
  });

  it('calcula L/100 km y km/L inmediatamente con tickets pendientes (sin importe)', () => {
    const stats = calculateVehicleFuelStats([
      { odometer: 165858, liters: 90, totalCost: null, status: 'PENDING' },
      { odometer: 166358, liters: 100, totalCost: null, status: 'PENDING' },
    ]);

    expect(stats.logsCount).toBe(2);
    expect(stats.pendingCount).toBe(2);
    expect(stats.totalLiters.toNumber()).toBe(190);
    expect(stats.pendingLiters.toNumber()).toBe(190);
    expect(stats.vehicleSpent.toNumber()).toBe(0);
    expect(stats.kmTraveled).toBe(500);
    expect(stats.litersPer100Km.toNumber()).toBe(20);
    expect(stats.kmPerLiter.toNumber()).toBe(5);
    expect(stats.costPerKm.toNumber()).toBe(0);
  });

  it('suma únicamente el gasto de tickets liquidados y calcula costo por km', () => {
    const stats = calculateVehicleFuelStats([
      { odometer: 10000, liters: 50, totalCost: 70000, status: 'SETTLED' },
      { odometer: 10500, liters: 50, totalCost: 75000, status: 'SETTLED' },
      { odometer: 11000, liters: 50, totalCost: null, status: 'PENDING' },
    ]);

    expect(stats.kmTraveled).toBe(1000);
    expect(stats.litersPer100Km.toNumber()).toBe(10);
    expect(stats.vehicleSpent.toNumber()).toBe(145000);
    expect(stats.pendingLiters.toNumber()).toBe(50);
    expect(stats.costPerKm.toNumber()).toBe(145);
  });
});
