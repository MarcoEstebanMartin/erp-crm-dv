import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  buildProviderLedgerStatement,
  computeSupplierInvoicesMetrics,
  formatPurchaseOrderLotsSummary,
} from '../providersHelpers';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const COMPRAS_DIR = path.resolve(TEST_DIR, '..');
const COMPONENTS_DIR = path.resolve(COMPRAS_DIR, '..');

function listTsFilesRecursive(dir: string, prefix = ''): Array<{ rel: string; content: string }> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: Array<{ rel: string; content: string }> = [];
  for (const entry of entries) {
    if (entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...listTsFilesRecursive(full, rel));
    } else if ((entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.endsWith('.test.ts')) {
      results.push({ rel, content: fs.readFileSync(full, 'utf8') });
    }
  }
  return results;
}

describe('Paso 2 Proveedores — Tránsito, Escáner IA, Lotes Limpios y Minimalismo', () => {
  it('computeSupplierInvoicesMetrics contabiliza enTransitoCount y deuda exacta; addDaysIso suma días sin drift', () => {
    const metrics = computeSupplierInvoicesMetrics([
      { totalAmount: '12500.50', paidAmount: '2500.50', status: 'PARTIALLY_PAID', receptionStatus: 'IN_TRANSIT', dueDate: '2099-01-01' },
      { totalAmount: '4000', paidAmount: '4000', status: 'PAID', receptionStatus: 'IN_TRANSIT', dueDate: '2020-01-01' },
      { totalAmount: '3000', paidAmount: '0', status: 'PENDING', receptionStatus: 'RECEIVED', dueDate: '2020-01-01' },
    ]);

    expect(metrics.enTransitoCount).toBe(2);
    expect(metrics.totalDeuda).toBe(13000);
    expect(metrics.vencidasCount).toBe(1);
    expect(metrics.totalVencidas).toBe(3000);
    expect(addDaysIso('2026-11-18', 15)).toBe('2026-12-03');
    expect(addDaysIso('2026-11-18', 30)).toBe('2026-12-18');
  });

  it('formatPurchaseOrderLotsSummary oculta S/L + centinela 2036 y formatea lotes reales limpios', () => {
    expect(formatPurchaseOrderLotsSummary({ stockMovements: [] })).toEqual(['Sin lote']);
    expect(
      formatPurchaseOrderLotsSummary({
        stockMovements: [
          { productLot: { lotNumber: 'S/L-SLOT-12', expirationDate: '2036-12-31T00:00:00Z' } },
        ],
      }),
    ).toEqual(['Sin lote']);

    expect(
      formatPurchaseOrderLotsSummary({
        stockMovements: [
          { productLot: { lotNumber: 'L889@B1', expirationDate: '2027-03-15T00:00:00Z' } },
          { productLot: { lotNumber: 'L889@B2', expirationDate: '2027-03-15T00:00:00Z' } },
          { productLot: { lotNumber: 'S/L', expirationDate: '2026-12-20T00:00:00Z' } },
        ],
      }),
    ).toEqual(['Lote L889 · Vto 15/03/2027', 'Sin lote · Vto 20/12/2026']);
  });

  it('buildProviderLedgerStatement clasifica retenciones practicadas (DEBIT) reduciendo saldo a pagar', () => {
    const res = buildProviderLedgerStatement([
      { id: 'si-1', type: 'CREDIT', sourceType: 'SUPPLIER_INVOICE', reference: 'Factura Nro 0001-10', description: 'Compra', amount: 10000 },
      { id: 'ret-1', type: 'DEBIT', sourceType: 'TAX_WITHHOLDING', reference: 'Retención Practicada Cert. Nro R-1', description: 'IIBB', amount: 1500 },
    ]);

    expect(res.rows).toHaveLength(2);
    expect(res.rows[1].kindLabel).toBe('Retención');
    expect(res.rows[1].pagoAmount).toBe(1500);
    expect(res.finalPayableAmount).toBe(8500);
  });

  it('Auditoría estática Step 2: 3 pestañas, escáner con select + 3 modos, <= 300 líneas y cero lotes sintéticos', () => {
    const allComprasFiles = [
      ...listTsFilesRecursive(COMPRAS_DIR, 'compras'),
      { rel: 'ComprasDashboard.tsx', content: fs.readFileSync(path.join(COMPONENTS_DIR, 'ComprasDashboard.tsx'), 'utf8') },
      { rel: 'PurchaseScannerModal.tsx', content: fs.readFileSync(path.join(COMPONENTS_DIR, 'PurchaseScannerModal.tsx'), 'utf8') },
    ];

    for (const file of allComprasFiles) {
      const lines = file.content.split(/\r?\n/).length;
      expect(lines, `${file.rel} tiene ${lines} líneas (máx 300)`).toBeLessThanOrEqual(300);
      expect(file.content, `${file.rel} contiene emoji/glifo`).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[✕✖▼]/u);
      expect(file.content, `${file.rel} contiene ej:`).not.toMatch(/\bej\s*:/i);
      expect(file.content, `${file.rel} contiene lote ficticio LOTE-PO-`).not.toContain('LOTE-PO-');
      expect(file.content, `${file.rel} contiene texto ficticio (6 meses)`).not.toContain('(6 meses)');
    }

    const dashSrc = allComprasFiles.find((f) => f.rel === 'ComprasDashboard.tsx')!.content;
    expect(dashSrc).toContain("label: 'Padrón'");
    expect(dashSrc).toContain("label: 'Facturas'");
    expect(dashSrc).toContain('Recepciones');
    expect(dashSrc).not.toContain('Órdenes de Compra');
    expect(dashSrc).not.toContain('aria-controls');

    const scannerFormSrc = allComprasFiles.find((f) => f.rel === 'compras/scanner/PurchaseScannerFormAndTotals.tsx')!.content;
    expect(scannerFormSrc).toContain('<select');
    expect(scannerFormSrc).toContain('id="scanner-provider-id"');
    expect(scannerFormSrc).not.toContain('scanner-supplier-name');
    expect(scannerFormSrc).toContain('IN_TRANSIT');
    expect(scannerFormSrc).toContain('IMMEDIATE');
    expect(scannerFormSrc).toContain('NONE');

    const facturasSrc = allComprasFiles.find((f) => f.rel === 'compras/ComprasFacturasProveedoresTabs.tsx')!.content;
    expect(facturasSrc).toContain('Escanear factura');
    expect(facturasSrc).toContain('Recibir');
  });
});
