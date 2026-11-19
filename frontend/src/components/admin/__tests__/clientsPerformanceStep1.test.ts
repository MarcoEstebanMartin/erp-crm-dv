import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_CITIES,
  PERSONA_ROLE_TABS,
  computeClientLocationAndRouteCounts,
  filterClientsInMemory,
  matchesClientSearchQuery,
} from '../clientsHelpers';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_DIR = path.resolve(TEST_DIR, '..');

function readAdminFile(filename: string): string {
  return fs.readFileSync(path.join(ADMIN_DIR, filename), 'utf8');
}

describe('Paso 1 Velocidad en Clientes — Buscador Fonético RAM, Conteos O(N) y Cero Doble Carga', () => {
  const sampleClients = [
    {
      id: 1,
      name: 'Despensa Vázquez Yésica',
      cuit: '27314567892',
      city: 'General Villegas',
      barrio: 'Centro',
      address: 'San Martín 420',
      phone: '3388445566',
      route: 'VILLEGAS CENTRO',
      saleRouteId: 10,
      saleRoute: { id: 10, name: 'Villegas Lunes' },
      sellerId: 7,
      isActive: true,
    },
    {
      id: 2,
      name: 'Autoservicio Cerezo',
      cuit: '30-71234567-8',
      city: 'Emilio V. Bunge',
      barrio: 'Estación',
      address: 'Belgrano 110',
      phone: '3388-501122',
      route: '',
      saleRouteId: null,
      sellerId: null,
      isActive: true,
    },
    {
      id: 3,
      name: 'Kiosco El Sol (Inactivo)',
      cuit: '20111222339',
      city: 'Pueblo Nuevo',
      address: 'Mitre 50',
      route: 'OTRA',
      saleRouteId: null,
      isActive: false,
    },
  ];

  const sampleRoutes = [
    { id: 10, name: 'Villegas Lunes' },
    { id: 11, name: 'Bunge Jueves' },
  ];

  it('matchesClientSearchQuery resuelve equivalencias fonéticas argentinas (b/v, s/z/c, y/i, tildes), orden invertido y CUIT con o sin guiones', () => {
    expect(matchesClientSearchQuery(sampleClients[0], 'basques yesika')).toBe(true);
    expect(matchesClientSearchQuery(sampleClients[0], 'villegas vazquez')).toBe(true);
    expect(matchesClientSearchQuery(sampleClients[0], '27-31456789-2')).toBe(true);
    expect(matchesClientSearchQuery(sampleClients[0], '31456789')).toBe(true);

    expect(matchesClientSearchQuery(sampleClients[1], 'sereso bunge')).toBe(true);
    expect(matchesClientSearchQuery(sampleClients[1], '30712345678')).toBe(true);
    expect(matchesClientSearchQuery(sampleClients[1], '30-71234567-8')).toBe(true);
    expect(matchesClientSearchQuery(sampleClients[1], 'inexistente')).toBe(false);
  });

  it('computeClientLocationAndRouteCounts y filterClientsInMemory calculan conteos y filtran en 1 pasada', () => {
    const { cityCounts, routeCounts, sellerCounts } = computeClientLocationAndRouteCounts(
      sampleClients,
      'client',
      false,
      sampleRoutes,
    );

    expect(cityCounts.ALL).toBe(2);
    expect(cityCounts['GENERAL VILLEGAS']).toBe(1);
    expect(cityCounts['EMILIO V. BUNGE']).toBe(1);
    expect(cityCounts.OTRAS).toBe(0);

    expect(routeCounts.ALL).toBe(2);
    expect(routeCounts[10]).toBe(1);
    expect(routeCounts.SIN_RUTA).toBe(1);

    expect(sellerCounts.ALL).toBe(2);
    expect(sellerCounts[7]).toBe(1);
    expect(sellerCounts.SIN_VENDEDOR).toBe(1);

    const filteredByRoute = filterClientsInMemory(sampleClients, {
      personaRoleFilter: 'client',
      showInactive: false,
      selectedCityFilter: 'ALL',
      selectedRouteFilter: '10',
      searchQuery: 'iesica',
      availableSaleRoutes: sampleRoutes,
    });
    expect(filteredByRoute.map((c) => c.id)).toEqual([1]);

    const filteredBySeller = filterClientsInMemory(sampleClients, {
      personaRoleFilter: 'client',
      showInactive: false,
      selectedCityFilter: 'ALL',
      selectedRouteFilter: 'ALL',
      selectedSellerFilter: '7',
      searchQuery: '',
      availableSaleRoutes: sampleRoutes,
    });
    expect(filteredBySeller.map((c) => c.id)).toEqual([1]);

    const filteredWithoutSeller = filterClientsInMemory(sampleClients, {
      personaRoleFilter: 'client',
      showInactive: false,
      selectedCityFilter: 'ALL',
      selectedRouteFilter: 'ALL',
      selectedSellerFilter: 'SIN_VENDEDOR',
      searchQuery: '',
      availableSaleRoutes: sampleRoutes,
    });
    expect(filteredWithoutSeller.map((c) => c.id)).toEqual([2]);

    const filteredInactive = filterClientsInMemory(sampleClients, {
      personaRoleFilter: 'client',
      showInactive: true,
      selectedCityFilter: 'OTRAS',
      selectedRouteFilter: 'ALL',
      searchQuery: '',
      availableSaleRoutes: sampleRoutes,
    });
    expect(filteredInactive.map((c) => c.id)).toEqual([3]);
  });

  it('ClientsTab usa useDeferredValue, elimina llamadas de red al tipear, expone solapa Proveedores y respeta modularidad <= 300 líneas', () => {
    const clientsTabSrc = readAdminFile('ClientsTab.tsx');
    const tableSrc = readAdminFile('ClientsPersonasTable.tsx');
    const helpersSrc = readAdminFile('clientsHelpers.ts');

    expect(PERSONA_ROLE_TABS).toContainEqual({ id: 'providers', label: 'Proveedores' });
    expect(clientsTabSrc).toContain('useDeferredValue');
    expect(clientsTabSrc).toContain('ComprasDashboard');
    expect(clientsTabSrc).toContain("personaRoleFilter === 'providers'");
    expect(clientsTabSrc).toContain('role="tabpanel"');
    expect(clientsTabSrc).not.toContain('api.getSellersList');
    expect(clientsTabSrc).not.toContain('api.getSaleRoutes');
    expect(clientsTabSrc).not.toMatch(/\[personaRoleFilter,\s*searchQuery/);

    expect(tableSrc).toContain('React.memo');
    expect(tableSrc).toContain('IntersectionObserver');

    expect(clientsTabSrc.split(/\r?\n/).length).toBeLessThanOrEqual(300);
    expect(tableSrc.split(/\r?\n/).length).toBeLessThanOrEqual(300);
    expect(helpersSrc.split(/\r?\n/).length).toBeLessThanOrEqual(300);
  });

  it('OFFICIAL_CITIES está ordenada alfabéticamente (es-AR) para el selector de Localidades', () => {
    const collator = new Intl.Collator('es-AR', { sensitivity: 'base' });
    const expected = [...OFFICIAL_CITIES].sort(collator.compare);
    expect(OFFICIAL_CITIES).toEqual(expected);
    expect(OFFICIAL_CITIES[0]).toBe('BANDERALÓ');
    expect(OFFICIAL_CITIES[OFFICIAL_CITIES.length - 1]).toBe('VILLA SAUZE');
  });
});
