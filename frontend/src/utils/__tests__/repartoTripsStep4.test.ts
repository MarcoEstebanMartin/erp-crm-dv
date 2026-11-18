import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildEditableOrderPool,
  computeTripDisplayMetrics,
  normalizeDriverOptions,
  normalizeFleetVehicleOptions,
  reorderStopIds,
  resolveEditRouteFormValues,
} from '../../components/reparto/repartoRouteHelpers';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(TEST_DIR, '../..');

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(SRC_DIR, relPath), 'utf8');
}

describe('Paso 4 — Entregas, Menú Logística y Armado de Viajes', () => {
  it('calcula métricas enteras BigInt de viajes (pedidos, bultos e importe)', () => {
    const metrics = computeTripDisplayMetrics([
      { id: 1, status: 'DELIVERED', bultosCount: 3, totalAmount: '12500.40' },
      { id: 2, status: 'PREPARED', bultosCount: 0, totalAmount: 8499.6 },
      { id: 3, status: 'CANCELLED', bultosCount: 5, totalAmount: 99999 },
    ]);

    expect(metrics).toEqual({
      ordersCount: 2,
      totalBultos: 4,
      totalAmountLabel: '$21.000',
    });
  });

  it('reordena paradas 1..N sin mutar cuando está en los extremos', () => {
    expect(reorderStopIds([10, 20, 30], 0, -1)).toEqual([10, 20, 30]);
    expect(reorderStopIds([10, 20, 30], 2, 1)).toEqual([10, 20, 30]);
    expect(reorderStopIds([10, 20, 30], 1, -1)).toEqual([20, 10, 30]);
    expect(reorderStopIds([10, 20, 30], 0, 1)).toEqual([20, 10, 30]);
  });

  it('combina pool de pedidos al editar un viaje sin duplicados y resuelve chofer/vehículo reales', () => {
    const pool = buildEditableOrderPool(
      [
        { id: 101, totalAmount: 1000 },
        { id: 102, totalAmount: 2000 },
      ],
      {
        id: 7,
        orders: [
          { id: 102, totalAmount: 2000 },
          { id: 99, totalAmount: 5000 },
        ],
      },
    );
    expect(pool.map((o) => o.id)).toEqual([102, 99, 101]);

    const drivers = normalizeDriverOptions({
      driverOptions: [{ employeeId: 75, fullName: 'Matías Rodríguez' }],
    });
    const vehicles = normalizeFleetVehicleOptions({
      fleetVehicles: [{ id: 3, plate: 'AB 919 WO', description: 'Mercedes-Benz Accelo 1016' }],
    });

    const editForm = resolveEditRouteFormValues(
      {
        id: 7,
        routeName: 'Sur Ruta 33',
        driverEmployeeId: 75,
        driverName: 'Matías Rodríguez',
        vehicleId: 3,
        vehiclePlate: 'AB 919 WO',
        orders: [{ id: 99 }],
      },
      drivers,
      vehicles,
    );

    expect(editForm).toEqual({
      routeName: 'Sur Ruta 33',
      driverEmployeeId: 75,
      driverName: 'Matías Rodríguez',
      companionName: '',
      vehicleId: 3,
      vehiclePlate: 'AB 919 WO',
      vehicleDescription: 'Mercedes-Benz Accelo 1016',
      selectedVehicleKey: 'AB 919 WO',
      orderIds: [99],
    });
  });

  it('expone acceso Logística en Sidebar y pestaña Entregas en Pedidos de AdminDashboard', () => {
    const sidebar = readSrc('components/Sidebar.tsx');
    expect(sidebar).toContain("id: 'logistica'");
    expect(sidebar).toContain("label: 'Logística'");

    const adminDashboard = readSrc('components/AdminDashboard.tsx');
    expect(adminDashboard).toContain("id: 'entregas'");
    expect(adminDashboard).toContain("label: 'Entregas'");
    expect(adminDashboard).toContain('<RepartoDashboard />');

    const ctrl = readSrc('components/reparto/useRepartoController.ts');
    expect(ctrl).toContain('dispatchQueue: true');
    expect(ctrl).toContain('setRuntimeGoogleMapsApiKey');
    expect(ctrl).toContain('api.updateDeliveryRoute');

    const createModal = readSrc('components/reparto/RepartoCreateRouteModal.tsx');
    expect(createModal).toContain("width: 'min(1320px, 95dvw)'");
    expect(createModal).toContain("height: 'min(760px, 90dvh)'");
    expect(createModal).toContain('fillHeight');
  });

  it('respeta zona ideal <= 300 líneas en todos los archivos nuevos y editados de Reparto', () => {
    const idealFiles = [
      'components/Sidebar.tsx',
      'components/AdminDashboard.tsx',
      'components/RepartoDashboard.tsx',
      'components/reparto/repartoRouteHelpers.ts',
      'components/reparto/useRepartoGpsAndSettle.ts',
      'components/reparto/useRepartoController.ts',
      'components/reparto/RepartoCreateRouteModal.tsx',
      'components/reparto/RepartoActiveRoutePanel.tsx',
    ];
    for (const relPath of idealFiles) {
      const lineCount = readSrc(relPath).split(/\r?\n/).length;
      expect(lineCount, `${relPath} tiene ${lineCount} líneas`).toBeLessThanOrEqual(300);
    }
  });
});
