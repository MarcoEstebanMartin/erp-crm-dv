import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DebtorsByCityReportView } from '../DebtorsByCityReportView';
import { DebtorsPrintSheet } from '../DebtorsPrintSheet';

const sampleDebtors = [
  {
    id: 1,
    name: 'ANNARATONE SERGIO ADRIAN',
    address: 'Mitre 123',
    city: 'Alvear',
    route: 'Alvear',
    outstandingBalance: 171220,
    debtA: 171220,
    debtX: 0,
    pendingInvoicesCount: 1,
    hasMultiplePendingInvoices: false,
    needsFollowUp: false,
    followUpLabel: null,
    branchA: {
      pendingCount: 1,
      fullPendingCount: 1,
      hasPartialRemainder: false,
      oldestPendingShortDate: '18/11',
      oldestPendingDays: 6,
      needsFollowUp: false,
      followUpReason: 'CURRENT',
      followUpLabel: null,
    },
    branchX: {
      pendingCount: 0,
      fullPendingCount: 0,
      hasPartialRemainder: false,
      oldestPendingShortDate: null,
      oldestPendingDays: null,
      needsFollowUp: false,
      followUpReason: 'NONE',
      followUpLabel: null,
    },
    sellerId: 1,
    sellerName: 'FABIAN',
  },
  {
    id: 2,
    name: 'SOSA GABRIELA BELEN',
    address: 'San Martin 450',
    city: 'Alvear',
    route: 'Alvear',
    outstandingBalance: 1481291,
    debtA: 770927,
    debtX: 710364,
    pendingInvoicesCount: 5,
    hasMultiplePendingInvoices: true,
    needsFollowUp: true,
    followUpLabel: 'A: 2 + resto 5/11 · X: 1 + resto 12/11',
    branchA: {
      pendingCount: 3,
      fullPendingCount: 2,
      hasPartialRemainder: true,
      oldestPendingShortDate: '5/11',
      oldestPendingDays: 19,
      needsFollowUp: true,
      followUpReason: 'PARTIAL_AND_MORE',
      followUpLabel: '2 + resto 5/11',
    },
    branchX: {
      pendingCount: 2,
      fullPendingCount: 1,
      hasPartialRemainder: true,
      oldestPendingShortDate: '12/11',
      oldestPendingDays: 12,
      needsFollowUp: true,
      followUpReason: 'PARTIAL_AND_MORE',
      followUpLabel: '1 + resto 12/11',
    },
    sellerId: 1,
    sellerName: 'FABIAN',
  },
  {
    id: 3,
    name: 'TERESA DENIS',
    address: 'Belgrano 80',
    city: 'Alvear',
    route: 'Alvear',
    outstandingBalance: 44691,
    debtA: 0,
    debtX: 44691,
    pendingInvoicesCount: 1,
    hasMultiplePendingInvoices: false,
    needsFollowUp: true,
    followUpLabel: '12/11',
    branchA: {
      pendingCount: 0,
      fullPendingCount: 0,
      hasPartialRemainder: false,
      oldestPendingShortDate: null,
      oldestPendingDays: null,
      needsFollowUp: false,
      followUpReason: 'NONE',
      followUpLabel: null,
    },
    branchX: {
      pendingCount: 1,
      fullPendingCount: 1,
      hasPartialRemainder: false,
      oldestPendingShortDate: '12/11',
      oldestPendingDays: 12,
      needsFollowUp: true,
      followUpReason: 'OVERDUE_SINGLE',
      followUpLabel: '12/11',
    },
    sellerId: 1,
    sellerName: 'FABIAN',
  },
];

describe('Deudores — Resaltado automático y etiquetas estilo fibrón/lapicera', () => {
  it('muestra filtro "A reclamar", resaltado ámbar y etiquetas exactas en pantalla', () => {
    const noop = () => {};
    const html = renderToStaticMarkup(
      React.createElement(DebtorsByCityReportView, {
        debtorsReport: sampleDebtors,
        availableCities: ['Alvear'],
        selectedCities: ['Alvear'],
        setSelectedCities: noop,
        availableSellers: [{ id: 1, username: 'fabian' }],
        selectedSellerFilter: 'ALL',
        setSelectedSellerFilter: noop,
        selectedBranchFilter: 'ALL',
        setSelectedBranchFilter: noop,
        setShowResumenModal: noop,
        setPaymentModal: noop,
      }),
    );

    expect(html).toContain('A reclamar (2)');
    expect(html).toContain('A: 2 + resto 5/11 · X: 1 + resto 12/11');
    expect(html).toContain('12/11');
    expect(html).toContain('#FFF7ED');
    expect(html).toContain('class="card no-print"');
  });

  it('imprime la hoja con resaltado exacto (print-color-adjust) y detalle separado por sucursal A y X', () => {
    const html = renderToStaticMarkup(
      React.createElement(DebtorsPrintSheet, {
        filteredDebtors: sampleDebtors,
        groups: { Alvear: sampleDebtors },
        sellerLabel: 'FABIAN',
      }),
    );

    expect(html).toContain('A reclamar: 2');
    expect(html).toContain('2 + resto 5/11');
    expect(html).toContain('1 + resto 12/11');
    expect(html).toContain('12/11');
    expect(html).toContain('#FED7AA');
    expect(html).toContain('print-color-adjust:exact');
    expect(html).toContain('>Cliente (A)</th>');
    expect(html).toContain('>Cliente</th>');
    expect(html).toContain('>Dirección</th>');
    expect(html).not.toContain('>Ruta</th>');
    expect(html).toContain('(Alvear)');
    expect(html).toContain('display:table-row-group');
    expect(html.indexOf('>Cliente (A)</th>')).toBeLessThan(html.indexOf('>Cliente</th>'));
    expect(html).not.toContain('margin-bottom:22px;break-inside:avoid');
  });

  it('oculta "Vendedor: Todos" en el encabezado de impresión', () => {
    const html = renderToStaticMarkup(
      React.createElement(DebtorsPrintSheet, {
        filteredDebtors: sampleDebtors,
        groups: { Alvear: sampleDebtors },
        sellerLabel: 'Todos',
      }),
    );

    expect(html).not.toContain('Vendedor: Todos');
    expect(html).toContain('Deudor de Alvear');
    expect(html).toContain('(Alvear)');
  });

  it('respeta el filtro de sucursal al imprimir (solo A o solo X)', () => {
    const htmlA = renderToStaticMarkup(
      React.createElement(DebtorsPrintSheet, {
        filteredDebtors: sampleDebtors,
        groups: { Alvear: sampleDebtors },
        sellerLabel: 'FABIAN',
        selectedBranchFilter: 'A',
      }),
    );

    expect(htmlA).toContain('>Cliente (A)</th>');
    expect(htmlA).not.toContain('>Cliente</th>');
    expect(htmlA).toContain('ANNARATONE SERGIO ADRIAN');
    expect(htmlA).not.toContain('TERESA DENIS');

    const htmlX = renderToStaticMarkup(
      React.createElement(DebtorsPrintSheet, {
        filteredDebtors: sampleDebtors,
        groups: { Alvear: sampleDebtors },
        sellerLabel: 'FABIAN',
        selectedBranchFilter: 'X',
      }),
    );

    expect(htmlX).toContain('>Cliente</th>');
    expect(htmlX).not.toContain('>Cliente (A)</th>');
    expect(htmlX).toContain('TERESA DENIS');
    expect(htmlX).not.toContain('ANNARATONE SERGIO ADRIAN');
  });
});
