import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import StockKpiCards from '../../stock/StockKpiCards';
import StockInventoryTable from '../../stock/StockInventoryTable';
import { DebtorsByCityReportView } from '../DebtorsByCityReportView';

const sampleStats = {
  totalUnits: 120,
  locatedUnits: 80,
  unassignedUnits: 40,
  totalCost: 555939218,
  totalRetailVal: 709102739,
  goodStockCount: 298,
  lowStockCount: 0,
  outOfStockCount: 66,
};

const sampleProducts = [
  {
    id: 1,
    sku: '0001',
    name: 'Queso Cremoso',
    stock: 162,
    minStock: 10,
    costPrice: 8451.52,
    listPrice: 11156,
    isWeighable: true,
    avgWeight: 4,
    lots: [{ id: 10, lotNumber: 'S/L', stock: 162, location: 'S/U' }],
  },
];

const sampleDebtors = [
  {
    id: 101,
    name: 'Cliente Uno',
    city: 'Río Cuarto',
    route: 'Ruta 1',
    sellerId: 1,
    debtA: 1287053,
    debtX: 983081,
    outstandingBalance: 2270134,
  },
];

describe('Visibilidad de totales sensibles (solo rol ADMIN)', () => {
  it('StockKpiCards muestra Valorización (Costo) y Valorización (Venta) solo a ADMIN', () => {
    const adminHtml = renderToStaticMarkup(
      React.createElement(StockKpiCards, {
        stats: sampleStats,
        filteredCount: 364,
        totalCount: 364,
        canViewCosts: true,
        canViewValuation: true,
      }),
    );
    expect(adminHtml).toContain('Valorización (Costo)');
    expect(adminHtml).toContain('Valorización (Venta)');
    expect(adminHtml).toContain('Catálogo Activo');

    const facturacionHtml = renderToStaticMarkup(
      React.createElement(StockKpiCards, {
        stats: sampleStats,
        filteredCount: 364,
        totalCount: 364,
        canViewCosts: true,
        canViewValuation: false,
      }),
    );
    expect(facturacionHtml).not.toContain('Valorización (Costo)');
    expect(facturacionHtml).not.toContain('Valorización (Venta)');
    expect(facturacionHtml).not.toContain('Margen latente');
    expect(facturacionHtml).toContain('Unidades Físicas');
    expect(facturacionHtml).toContain('Catálogo Activo');
  });

  it('StockInventoryTable oculta columnas VALOR COSTO y VALOR VENTA a no-ADMIN', () => {
    const noop = () => {};
    const adminHtml = renderToStaticMarkup(
      React.createElement(StockInventoryTable, {
        filteredProducts: sampleProducts,
        isQuickInventoryMode: false,
        showEmptyLots: false,
        pendingAdjustments: {},
        onPendingAdjustmentChange: noop,
        onViewHistory: noop,
        onOpenLotManager: noop,
        onOpenAdjustModal: noop,
        canViewCosts: true,
        canViewValuation: true,
        canMutateStock: true,
      }),
    );
    expect(adminHtml).toContain('COSTO UNIT.');
    expect(adminHtml).toContain('VALOR COSTO');
    expect(adminHtml).toContain('VALOR VENTA');

    const facturacionHtml = renderToStaticMarkup(
      React.createElement(StockInventoryTable, {
        filteredProducts: sampleProducts,
        isQuickInventoryMode: false,
        showEmptyLots: false,
        pendingAdjustments: {},
        onPendingAdjustmentChange: noop,
        onViewHistory: noop,
        onOpenLotManager: noop,
        onOpenAdjustModal: noop,
        canViewCosts: true,
        canViewValuation: false,
        canMutateStock: false,
      }),
    );
    expect(facturacionHtml).toContain('COSTO UNIT.');
    expect(facturacionHtml).not.toContain('VALOR COSTO');
    expect(facturacionHtml).not.toContain('VALOR VENTA');
  });

  it('DebtorsByCityReportView oculta las 3 tarjetas de montos (Sucursal A, Sucursal X, Total) a no-ADMIN', () => {
    const noop = () => {};
    const baseProps = {
      debtorsReport: sampleDebtors,
      availableCities: ['Río Cuarto'],
      selectedCities: ['Río Cuarto'],
      setSelectedCities: noop,
      availableSellers: [],
      selectedSellerFilter: 'ALL',
      setSelectedSellerFilter: noop,
      selectedBranchFilter: 'ALL',
      setSelectedBranchFilter: noop,
      setShowResumenModal: noop,
      setPaymentModal: noop,
    };

    const adminHtml = renderToStaticMarkup(
      React.createElement(DebtorsByCityReportView, { ...baseProps, canViewTotals: true }),
    );
    expect(adminHtml).toContain('<div class="stat-label">Clientes</div>');
    expect(adminHtml).toContain('<div class="stat-label">Sucursal A</div>');
    expect(adminHtml).toContain('<div class="stat-label">Sucursal X</div>');
    expect(adminHtml).toContain('<div class="stat-label">Total</div>');

    const facturacionHtml = renderToStaticMarkup(
      React.createElement(DebtorsByCityReportView, { ...baseProps, canViewTotals: false }),
    );
    expect(facturacionHtml).toContain('<div class="stat-label">Clientes</div>');
    expect(facturacionHtml).not.toContain('<div class="stat-label">Sucursal A</div>');
    expect(facturacionHtml).not.toContain('<div class="stat-label">Sucursal X</div>');
    expect(facturacionHtml).not.toContain('<div class="stat-label">Total</div>');
  });
});
