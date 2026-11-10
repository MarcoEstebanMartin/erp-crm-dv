import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import prisma from '../../utils/prisma';
import { readExcelSheetObjects } from '../../utils/excel-reader.util';
import {
  normalizeSku,
  parseExcelNumber,
  validateProductsExcel,
} from '../excel_validator.service';

describe('Paso S3 — Motor Seguro ExcelJS (Anti-Prototype-Pollution, CSV Argentino y Validación)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Lee archivos .xlsx reales con fórmulas, columnas vacías (__EMPTY*) y neutraliza Prototype Pollution', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Gastos');

    // Fila 1 con columnas sin nombre (convención usada por GastosDistribuidora.xlsx) y cabecera peligrosa __proto__
    ws.addRow(['08/05/2026', '', '', '', '', '__proto__']);
    ws.addRow([
      'Luz Cooperativa',
      { formula: '1000+500', result: 1500 },
      '',
      '',
      'Juan Perez',
      'intento_polucion',
    ]);

    const arrayBuffer = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const rows = await readExcelSheetObjects(buffer, { defval: '' });

    expect(rows).toHaveLength(1);
    expect(rows[0]['08/05/2026']).toBe('Luz Cooperativa');
    expect(rows[0]['__EMPTY']).toBe(1500);
    expect(rows[0]['__EMPTY_3']).toBe('Juan Perez');
    expect(rows[0]['safe___proto__']).toBe('intento_polucion');
    expect(({} as any).intento_polucion).toBeUndefined();
  });

  it('Rechaza archivos binarios legados .xls (BIFF8 0xD0CF) vulnerables a corrupción de memoria', async () => {
    const fakeBiff8Buffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

    await expect(readExcelSheetObjects(fakeBiff8Buffer)).rejects.toThrow(
      /formato antiguo \.xls/i,
    );
  });

  it('Valida CSV con separador ";" argentino y precios con formato "$ 1.250,50" en validateProductsExcel', async () => {
    vi.spyOn(prisma.product, 'findMany').mockResolvedValue([
      { id: 1, sku: '0045', name: 'Queso Cremoso', costPrice: 1000, listPrice: 1200, rubroId: 1 },
    ] as any);
    vi.spyOn(prisma.rubro, 'findMany').mockResolvedValue([
      { id: 1, name: 'Lácteos', description: 'Lácteos' },
    ] as any);

    const csvContent = [
      'SKU;DESCRIPCION;RUBRO;COSTO;PRECIO;BULTO',
      '45;Queso Cremoso Horma;Lácteos;"$ 1.250,50";"$ 1.600,00";4',
      '109;Salame Milan Nuevo;Fiambres;2500;3200;1',
    ].join('\n');

    const report = await validateProductsExcel(Buffer.from(csvContent, 'utf8'));

    expect(normalizeSku(45)).toBe('0045');
    expect(parseExcelNumber('$ 1.250,50')).toBe(1250.5);
    expect(report.summary.totalRows).toBe(2);
    expect(report.summary.errorCount).toBe(0);
    expect(report.summary.actionUpdateCount).toBe(1);
    expect(report.summary.actionNewCount).toBe(1);
    expect(report.rows[0].data.sku).toBe('0045');
    expect(report.rows[0].data.costPrice).toBe(1250.5);
    expect(report.rows[1].status).toBe('WARNING'); // Rubro 'Fiambres' nuevo -> WARNING informativo
  });
});
