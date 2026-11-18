import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildProviderLedgerStatement,
  computeProviderPayableSummary,
  formatCentsArs,
  formatCuitDisplay,
  matchesProviderSearchQuery,
  parseExactCents,
} from '../providersHelpers';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const COMPRAS_DIR = path.resolve(TEST_DIR, '..');
const COMPONENTS_DIR = path.resolve(COMPRAS_DIR, '..');

function readComprasFile(name: string): string {
  return fs.readFileSync(path.join(COMPRAS_DIR, name), 'utf8');
}

describe('Paso 1 Proveedores — Helpers exactos, Búsqueda RAM, ARCA y Minimalismo', () => {
  it('parseExactCents y formatCentsArs operan en centavos exactos sin flotantes rotos ni signos negativos fantasma', () => {
    expect(parseExactCents('150000.55')).toBe(15000055);
    expect(parseExactCents('-150000')).toBe(-15000000);
    expect(formatCentsArs(15000000)).toBe('$150.000');
    expect(formatCentsArs(15000055)).toBe('$150.000,55');
    expect(formatCentsArs(0)).toBe('$0');
    expect(formatCuitDisplay('30555386997')).toBe('30-55538699-7');
  });

  it('matchesProviderSearchQuery resuelve sin tildes, fonética argentina, CUIT con/sin guiones, rubro y contactos', () => {
    const prov = {
      name: 'CREMIGAL S.R.L.',
      cuit: '30-55538699-7',
      rubro: 'Lácteos',
      city: 'GENERAL GALARZA',
      address: 'RUTA NAC. 12 KM 278 S/N',
      email: 'ventas@cremigal.com.ar',
      phone: '3444-481000',
      contacts: [{ name: 'Cecilia Vázquez', role: 'Preventa', phone: '3444-15445566' }],
    };

    expect(matchesProviderSearchQuery(prov, 'cremigal')).toBe(true);
    expect(matchesProviderSearchQuery(prov, 'lacteos galarza')).toBe(true);
    expect(matchesProviderSearchQuery(prov, '30555386997')).toBe(true);
    expect(matchesProviderSearchQuery(prov, '30-55538699-7')).toBe(true);
    expect(matchesProviderSearchQuery(prov, 'basques sesilia')).toBe(true);
    expect(matchesProviderSearchQuery(prov, '15445566')).toBe(true);
    expect(matchesProviderSearchQuery(prov, 'inexistente')).toBe(false);
  });

  it('computeProviderPayableSummary y buildProviderLedgerStatement muestran deuda positiva sin signos $- negativos ni mezcla en doble rol', () => {
    expect(computeProviderPayableSummary({ outstandingBalance: '-150000' })).toMatchObject({
      payableCents: 15000000,
      favorCents: 0,
      payableAmount: 150000,
    });

    const dualProvider = { isClient: true, outstandingBalance: '388108' };
    expect(computeProviderPayableSummary(dualProvider)).toMatchObject({
      payableCents: 0,
      favorCents: 0,
    });

    const statement = buildProviderLedgerStatement(
      [
        {
          id: 'order-1',
          type: 'DEBIT',
          sourceType: 'ORDER_INVOICE',
          reference: 'Factura Venta #1',
          description: 'Pedido cliente',
          amount: 388108,
        },
        {
          id: 'supplier-invoice-2',
          type: 'CREDIT',
          sourceType: 'SUPPLIER_INVOICE',
          reference: 'Factura Nro 0001-00000099',
          description: 'Compra - Factura A',
          amount: 80000,
        },
        {
          id: 'transaction-3',
          type: 'DEBIT',
          sourceType: 'SUPPLIER_PAYMENT',
          reference: 'Pago #3',
          description: 'Transferencia',
          amount: 30000,
        },
      ],
      dualProvider,
    );

    expect(statement.rows).toHaveLength(2);
    expect(statement.finalPayableAmount).toBe(50000);
    expect(statement.rows[0].kindLabel).toBe('Factura');
    expect(statement.rows[1].kindLabel).toBe('Pago');
    expect(statement.rows[1].runningPayable).toBe(50000);
  });

  it('Todos los archivos de Proveedores cumplen <= 300 líneas, cero palabras de relleno, cero emojis y ARCA limpio', () => {
    const comprasFiles = fs
      .readdirSync(COMPRAS_DIR)
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts'));

    for (const file of comprasFiles) {
      const content = readComprasFile(file);
      const lineCount = content.split(/\r?\n/).length;
      expect(lineCount, `${file} supera 300 líneas (${lineCount})`).toBeLessThanOrEqual(300);
      expect(content, `${file} contiene emoji o glifo prohibido`).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[✕✖▼]/u);
    }

    const dashSrc = fs.readFileSync(path.join(COMPONENTS_DIR, 'ComprasDashboard.tsx'), 'utf8');
    expect(dashSrc.split(/\r?\n/).length).toBeLessThanOrEqual(300);
    expect(dashSrc).toContain("label: 'Padrón'");

    const tabSrc = readComprasFile('ComprasProveedoresTab.tsx');
    expect(tabSrc).not.toContain('Sin especificar');
    expect(tabSrc).not.toContain('Sin contacto');
    expect(tabSrc).not.toContain('Sin domicilio');
    expect(tabSrc).not.toContain('Sin CUIT');
    expect(tabSrc).toContain('table-container--sticky');

    const modalsSrc = readComprasFile('ComprasProviderModals.tsx');
    expect(modalsSrc).toContain('<NativeModalDialog');
    expect(modalsSrc).toContain('getPersonaFromAFIP');
    expect(modalsSrc).toContain('Abrir ficha existente');
    expect(modalsSrc).not.toMatch(/\u26A1/);
  });
});
