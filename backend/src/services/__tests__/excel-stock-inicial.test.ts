import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../utils/prisma';
import {
  generateStockInicialTemplateBuffer,
  validateStockInicialExcel,
} from '../excel/excel-stock-inicial.validator';
import { commitStockInicialRowsInTx } from '../excel/excel-stock-inicial-commit.helper';
import { parseExcelDateToUtcIso } from '../excel/excel-parser.helpers';

async function buildXlsxBuffer(rows: Record<string, any>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Stock_Inicial');
  ws.columns = [
    { header: 'UBICACION_WMS', key: 'location' },
    { header: 'SKU', key: 'sku' },
    { header: 'PRODUCTO_REF', key: 'product' },
    { header: 'CANTIDAD', key: 'quantity' },
    { header: 'VENCIMIENTO', key: 'expiration' },
    { header: 'LOTE', key: 'lot' },
  ];
  for (const r of rows) {
    ws.addRow(r);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('Paso 4 — Importador Excel STOCK_INICIAL con Dry-Run y Plantilla WMS', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parseExcelDateToUtcIso soporta DD/MM/AAAA, AAAA-MM-DD, centinela y rechaza calendario inválido', () => {
    expect(parseExcelDateToUtcIso('')).toEqual({
      iso: '2036-12-31T00:00:00.000Z',
      isSentinel: true,
      invalid: false,
    });
    expect(parseExcelDateToUtcIso('15/12/2026')).toEqual({
      iso: '2026-12-15T00:00:00.000Z',
      isSentinel: false,
      invalid: false,
    });
    expect(parseExcelDateToUtcIso('2027-03-08')).toEqual({
      iso: '2027-03-08T00:00:00.000Z',
      isSentinel: false,
      invalid: false,
    });
    expect(parseExcelDateToUtcIso('31/02/2026').invalid).toBe(true);
    expect(parseExcelDateToUtcIso('01/01/2018').invalid).toBe(true);
  });

  it('generateStockInicialTemplateBuffer genera .xlsx con hoja Stock_Inicial y Slots_Validos sin baño ni pasillos', async () => {
    vi.spyOn(prisma.warehouseCell, 'findMany').mockResolvedValueOnce([]);
    const buf = await generateStockInicialTemplateBuffer();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const sheet1 = wb.getWorksheet('Stock_Inicial');
    const sheet2 = wb.getWorksheet('Slots_Validos');

    expect(sheet1).toBeDefined();
    expect(sheet2).toBeDefined();
    expect(sheet1?.getRow(1).values).toEqual([
      undefined,
      'UBICACION_WMS',
      'SKU',
      'PRODUCTO_REF',
      'CANTIDAD',
      'VENCIMIENTO',
      'LOTE',
    ]);

    const slotCodes: string[] = [];
    sheet2?.eachRow((row, idx) => {
      if (idx > 1) slotCodes.push(String(row.getCell(1).value || ''));
    });
    expect(slotCodes).toContain('D1-R01-C04');
    expect(slotCodes).toContain('D1-R07-C06');
    expect(slotCodes).not.toContain('D1-R05-C17');
    expect(slotCodes).not.toContain('D1-R01-C01');
  });

  it('validateStockInicialExcel ejecuta Dry-Run con multi-ubicación, errores estructurales y advertencias', async () => {
    vi.spyOn(prisma.product, 'findMany').mockResolvedValueOnce([
      {
        id: 1,
        sku: '0001',
        name: 'Queso Tybo Barra',
        defaultLocation: null,
        lots: [
          {
            id: 50,
            lotNumber: 'L-100',
            location: 'D1-R01-C04-A',
            stock: 4,
            expirationDate: new Date('2027-02-01T00:00:00Z'),
          },
        ],
      },
      {
        id: 2,
        sku: '0002',
        name: 'Fideos 308',
        defaultLocation: null,
        lots: [],
      },
    ] as any);
    vi.spyOn(prisma.warehouseCell, 'findMany').mockResolvedValueOnce([]);

    const buffer = await buildXlsxBuffer([
      // Fila 2: UPDATE existente
      { location: 'D1-R01-C04-A', sku: '1', product: 'Tybo', quantity: 10, expiration: '01/02/2027', lot: 'L-100' },
      // Fila 3: mismo SKU en D2 con otro lote/fecha y YYYY-MM-DD
      { location: 'D2-R09-C01-A', sku: '0001', product: 'Tybo', quantity: 8, expiration: '2027-06-15', lot: 'L-200' },
      // Fila 4: sin ubicación ni lote -> S/U + S/L + centinela 2036
      { location: '', sku: '0002', product: 'Fideos', quantity: 25, expiration: '', lot: '' },
      // Fila 5: SKU desconocido -> ERROR
      { location: 'D1-R01-C04-A', sku: '9999', product: 'Inexistente', quantity: 5, expiration: '', lot: '' },
      // Fila 6: pasillo -> ERROR
      { location: 'D1-R01-C01-A', sku: '0002', product: 'Fideos', quantity: 5, expiration: '', lot: '' },
      // Fila 7: baño -> ERROR
      { location: 'D1-R05-C17-A', sku: '0002', product: 'Fideos', quantity: 5, expiration: '', lot: '' },
      // Fila 8: nivel B en slot solo A -> ERROR
      { location: 'D1-R01-C11-B', sku: '0001', product: 'Tybo', quantity: 5, expiration: '2027-05-01', lot: 'L-3' },
      // Fila 9: decimal / negativo -> ERROR
      { location: 'S/U', sku: '0002', product: 'Fideos', quantity: 2.5, expiration: '', lot: '' },
      // Fila 10: conflicto de fecha contra fila 2 -> ERROR
      { location: 'D1-R01-C04-A', sku: '0001', product: 'Tybo', quantity: 3, expiration: '10/03/2027', lot: 'L-100' },
      // Fila 11: ya vencido -> WARNING
      { location: 'D1-R07-C06-A', sku: '0001', product: 'Tybo', quantity: 2, expiration: '01/01/2024', lot: 'L-VENC' },
      // Fila 12: cantidad 0 -> WARNING action NONE
      { location: 'S/U', sku: '0002', product: 'Fideos', quantity: 0, expiration: '', lot: '' },
    ]);

    const report = await validateStockInicialExcel(buffer);
    expect(report.domain).toBe('STOCK_INICIAL');
    expect(report.summary.totalRows).toBe(11);
    expect(report.summary.errorCount).toBe(6);
    expect(report.summary.warningCount).toBe(2);
    expect(report.summary.validCount).toBe(3);

    expect(report.rows[0].action).toBe('UPDATE');
    expect(report.rows[1].action).toBe('CREATE');
    expect(report.rows[2].data).toMatchObject({
      location: 'S/U',
      lotNumber: 'S/L',
      isSentinelExpiration: true,
      quantity: 25,
    });
    expect(report.rows[9].status).toBe('WARNING');
    expect(report.rows[10]).toMatchObject({ status: 'WARNING', action: 'NONE' });
  });

  it('commitStockInicialRowsInTx crea/incrementa lotes bajo FOR UPDATE, registra Kardex INV-INICIAL y descuenta reservas en Product.stock', async () => {
    const queryRawCalls: number[] = [];
    const movements: any[] = [];
    const productUpdates: any[] = [];
    const createdLots: any[] = [];

    const existingLot = {
      id: 50,
      productId: 1,
      lotNumber: 'L-100',
      location: 'D1-R01-C04-A',
      stock: 4,
      expirationDate: new Date('2027-02-01T00:00:00.000Z'),
    };
    const newLot = {
      id: 51,
      productId: 1,
      lotNumber: 'L-200',
      location: 'D2-R09-C01-A',
      stock: 8,
      expirationDate: new Date('2027-06-15T00:00:00.000Z'),
    };

    const txMock = {
      $queryRaw: vi.fn().mockImplementation(async () => {
        queryRawCalls.push(1);
        return [{ id: 1 }];
      }),
      warehouseCell: { findUnique: vi.fn().mockResolvedValue(null) },
      orderItem: {
        groupBy: vi.fn().mockResolvedValue([{ productId: 1, _sum: { quantity: 3 } }]),
      },
      productLot: {
        findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
          const k = where?.productId_lotNumber_location;
          if (k?.productId === 1 && k?.lotNumber === 'L-100' && k?.location === 'D1-R01-C04-A') {
            return { ...existingLot };
          }
          return null;
        }),
        update: vi.fn().mockImplementation(async ({ where, data }: any) => ({
          ...existingLot,
          id: where.id,
          stock: existingLot.stock + Number(data.stock.increment),
        })),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const created = { ...newLot, ...data, id: 51 };
          createdLots.push(created);
          return created;
        }),
        findMany: vi.fn().mockResolvedValue([{ stock: 14 }, { stock: 8 }]),
      },
      stockMovement: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          movements.push(data);
          return { id: movements.length, ...data };
        }),
      },
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, sku: '0001', defaultLocation: null }),
        update: vi.fn().mockImplementation(async (args: any) => {
          productUpdates.push(args);
          return args.data;
        }),
      },
    };

    const res = await commitStockInicialRowsInTx(
      txMock,
      [
        {
          status: 'VALID',
          action: 'UPDATE',
          data: {
            productId: 1,
            sku: '0001',
            lotNumber: 'L-100',
            location: 'D1-R01-C04-A',
            expirationDate: '2027-02-01T00:00:00.000Z',
            isSentinelExpiration: false,
            quantity: 10,
          },
        },
        {
          status: 'VALID',
          action: 'CREATE',
          data: {
            productId: 1,
            sku: '0001',
            lotNumber: 'L-200',
            location: 'D2-R09-C01-A',
            expirationDate: '2027-06-15T00:00:00.000Z',
            isSentinelExpiration: false,
            quantity: 8,
          },
        },
      ],
      9,
    );

    expect(queryRawCalls.length).toBe(1);
    expect(res).toEqual({
      createdCount: 1,
      updatedCount: 1,
      totalUnitsAdded: 18,
      touchedSkus: ['0001'],
    });
    expect(createdLots).toHaveLength(1);
    expect(movements).toHaveLength(2);
    expect(movements[0]).toMatchObject({ type: 'IN', referenceId: 'INV-INICIAL', productLotId: 50 });
    expect(movements[1]).toMatchObject({ type: 'IN', referenceId: 'INV-INICIAL', productLotId: 51 });
    // Σlotes (14 + 8 = 22) - 3 reservadas = 19; defaultLocation inicializado
    expect(productUpdates).toEqual([
      {
        where: { id: 1 },
        data: { stock: 19, defaultLocation: 'D1-R01-C04-A' },
      },
    ]);
  });
});
