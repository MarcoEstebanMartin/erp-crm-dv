import ExcelJS from 'exceljs';
import prisma from '../../utils/prisma';
import { readExcelSheetObjects } from '../../utils/excel-reader.util';
import { extractBaseLotNumber, normalizeWmsLocationCode } from '../../engines/stock.engine';
import {
  validateRequestedWmsLocationFormat,
  validateSlotAllowsStockAssignment,
} from '../../engines/warehouse-layout.engine';
import {
  getBaseWarehouseCell,
  listBaseWarehouseCells,
  type BaseWarehouseCellRule,
} from '../../utils/warehouse-base-layout.util';
import { isLotExpired } from '../orders/order-lot-picking.helper';
import {
  normalizeSku,
  parseExcelDateToUtcIso,
  parseExcelNumber,
  sanitizeText,
  type RowValidationResult,
  type ValidationReport,
} from './excel-parser.helpers';

function extractFlexibleField(raw: Record<string, any>, aliases: string[]): any {
  const normalizedEntries = Object.entries(raw || {}).map(([k, v]) => {
    const cleanKey = k
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim()
      .replace(/[\s-]+/g, '_');
    return [cleanKey, v] as const;
  });

  for (const alias of aliases) {
    const hit = normalizedEntries.find(([k]) => k === alias);
    if (hit !== undefined) return hit[1];
  }
  return undefined;
}

/**
 * Validador "Dry-Run" de planillas Excel/CSV de Stock Inicial (SKU + Ubicación WMS + Lote + Vencimiento).
 */
export async function validateStockInicialExcel(fileBuffer: Buffer): Promise<ValidationReport> {
  const rawRows = await readExcelSheetObjects(fileBuffer);

  const existingProducts = await prisma.product.findMany({
    select: {
      id: true,
      sku: true,
      name: true,
      defaultLocation: true,
      lots: {
        select: { id: true, lotNumber: true, location: true, stock: true, expirationDate: true },
      },
    },
  });

  const dbProductMap = new Map<string, (typeof existingProducts)[0]>();
  for (const p of existingProducts) {
    const rawKey = String(p.sku || '').trim().toUpperCase();
    const normKey = normalizeSku(p.sku).toUpperCase();
    if (rawKey) dbProductMap.set(rawKey, p);
    if (normKey) dbProductMap.set(normKey, p);
  }

  const overrideMap = new Map<string, any>();
  if (typeof (prisma as any).warehouseCell?.findMany === 'function') {
    const overrides = await prisma.warehouseCell.findMany();
    for (const c of overrides || []) {
      overrideMap.set(String(c.code || '').trim().toUpperCase(), c);
    }
  }

  const reportRows: RowValidationResult[] = [];
  const seenCombos = new Map<
    string,
    { firstLine: number; expIso: string; isSentinel: boolean }
  >();

  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let actionNewCount = 0;
  let actionUpdateCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const excelLine = i + 2;
    const messages: string[] = [];
    let status: 'VALID' | 'WARNING' | 'ERROR' = 'VALID';
    let action: 'CREATE' | 'UPDATE' | 'NONE' = 'NONE';

    const rawSku = extractFlexibleField(raw, ['SKU', 'CODIGO', 'ARTICULO', 'COD', 'COD_SKU']);
    const rawQty = extractFlexibleField(raw, [
      'CANTIDAD',
      'CANT',
      'STOCK',
      'UNIDADES',
      'STOCK_FISICO',
    ]);
    const rawLoc = extractFlexibleField(raw, [
      'UBICACION_WMS',
      'UBICACION',
      'SLOT',
      'POSICION',
      'RACK',
    ]);
    const rawLot = extractFlexibleField(raw, ['LOTE', 'CODIGO_LOTE', 'NRO_LOTE']);
    const rawExp = extractFlexibleField(raw, [
      'VENCIMIENTO',
      'VTO',
      'FECHA_VENCIMIENTO',
      'FECHA_VTO',
    ]);
    const rawName = extractFlexibleField(raw, [
      'PRODUCTO_REF',
      'PRODUCTO',
      'DESCRIPCION',
      'NOMBRE',
    ]);

    const rawSkuTrimmed = sanitizeText(rawSku).toUpperCase();
    const sku = normalizeSku(rawSku);
    const dbProduct =
      (sku ? dbProductMap.get(sku.toUpperCase()) : undefined) ||
      (rawSkuTrimmed ? dbProductMap.get(rawSkuTrimmed) : undefined);

    if (!sku) {
      status = 'ERROR';
      messages.push('SKU ausente o inválido.');
    } else if (!dbProduct) {
      status = 'ERROR';
      messages.push(`El SKU '${sku}' no existe en el catálogo maestro.`);
    }

    const parsedQty = parseExcelNumber(rawQty);
    let qty: number | null = parsedQty;
    if (rawQty === undefined || rawQty === null || String(rawQty).trim() === '') {
      status = 'ERROR';
      qty = null;
      messages.push('La cantidad física es obligatoria.');
    } else if (parsedQty === 0) {
      if (status !== 'ERROR') status = 'WARNING';
      action = 'NONE';
      messages.push('Cantidad en 0: fila omitida.');
    } else if (parsedQty === null || parsedQty < 0 || !Number.isInteger(parsedQty)) {
      status = 'ERROR';
      messages.push('La cantidad debe ser un número entero mayor a 0.');
    }

    const location = normalizeWmsLocationCode(sanitizeText(rawLoc) || 'S/U');
    if (location !== 'S/U') {
      const fmt = validateRequestedWmsLocationFormat(location);
      if (!fmt.allowed) {
        status = 'ERROR';
        messages.push(fmt.reason || `Ubicación '${location}' inválida.`);
      } else if (fmt.isSlotLike && fmt.baseSlotCode) {
        const rule =
          overrideMap.get(fmt.baseSlotCode) || getBaseWarehouseCell(fmt.baseSlotCode);
        if (!rule) {
          status = 'ERROR';
          messages.push(`La ubicación ${fmt.baseSlotCode} no existe en el plano del depósito.`);
        } else {
          const check = validateSlotAllowsStockAssignment(rule, location);
          if (!check.allowed) {
            status = 'ERROR';
            messages.push(check.reason || `La ubicación ${location} no admite mercadería.`);
          }
        }
      }
    }

    const lotText = sanitizeText(rawLot);
    const lotNumber =
      !lotText || lotText.toUpperCase() === 'S/L' ? 'S/L' : extractBaseLotNumber(lotText);

    const parsedExp = parseExcelDateToUtcIso(rawExp);
    if (parsedExp.invalid) {
      status = 'ERROR';
      messages.push('Fecha de vencimiento inválida (usar DD/MM/AAAA o AAAA-MM-DD).');
    } else if (!parsedExp.isSentinel && parsedExp.iso && isLotExpired(parsedExp.iso)) {
      if (status !== 'ERROR') status = 'WARNING';
      messages.push('Fecha vencida: revisá si hubo error de tipeo; el FEFO bloqueará este lote.');
    }

    if (dbProduct && qty !== null && qty > 0 && !parsedExp.invalid && parsedExp.iso) {
      const comboKey = `${dbProduct.id}::${lotNumber}::${location}`;
      const prev = seenCombos.get(comboKey);
      if (prev) {
        if ((prev.isSentinel && parsedExp.isSentinel) || prev.expIso === parsedExp.iso) {
          if (status !== 'ERROR') status = 'WARNING';
          messages.push(`Se acumulará con la fila #${prev.firstLine} del mismo archivo.`);
        } else {
          status = 'ERROR';
          messages.push(
            `Conflicto de fecha de vencimiento con la fila #${prev.firstLine} para el mismo SKU, lote y ubicación.`,
          );
        }
      } else {
        seenCombos.set(comboKey, {
          firstLine: excelLine,
          expIso: parsedExp.iso,
          isSentinel: parsedExp.isSentinel,
        });
      }
    }

    let existingLotStock = 0;
    if (dbProduct && status !== 'ERROR' && qty !== null && qty > 0) {
      const existingLot = (dbProduct.lots || []).find(
        (l) =>
          extractBaseLotNumber(l.lotNumber) === lotNumber &&
          normalizeWmsLocationCode(l.location) === location,
      );
      existingLotStock = existingLot ? Number(existingLot.stock || 0) : 0;
      if (existingLot) {
        action = 'UPDATE';
        actionUpdateCount++;
      } else {
        action = 'CREATE';
        actionNewCount++;
      }
    }

    if (status === 'ERROR') errorCount++;
    else if (status === 'WARNING') warningCount++;
    else validCount++;

    reportRows.push({
      rowIndex: excelLine,
      status,
      action,
      data: {
        productId: dbProduct?.id || null,
        sku: dbProduct?.sku || sku,
        name: dbProduct?.name || sanitizeText(rawName) || 'Desconocido',
        location,
        lotNumber,
        expirationDate: parsedExp.iso,
        isSentinelExpiration: parsedExp.isSentinel,
        quantity: qty ?? 0,
        existingLotStock,
      },
      messages,
    });
  }

  return {
    domain: 'STOCK_INICIAL',
    summary: {
      totalRows: rawRows.length,
      validCount,
      warningCount,
      errorCount,
      actionNewCount,
      actionUpdateCount,
    },
    rows: reportRows,
  };
}

/**
 * Genera la plantilla Excel descargable (.xlsx) con cabecera limpia y hoja de referencia de Slots válidos.
 */
export async function generateStockInicialTemplateBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Stock_Inicial', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'UBICACION_WMS', key: 'location', width: 20 },
    { header: 'SKU', key: 'sku', width: 14 },
    { header: 'PRODUCTO_REF', key: 'product', width: 36 },
    { header: 'CANTIDAD', key: 'quantity', width: 14 },
    { header: 'VENCIMIENTO', key: 'expiration', width: 16 },
    { header: 'LOTE', key: 'lot', width: 18 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  sheet.getColumn('sku').numFmt = '@';
  sheet.getColumn('expiration').numFmt = 'DD/MM/YYYY';

  const slotsSheet = wb.addWorksheet('Slots_Validos', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  slotsSheet.columns = [
    { header: 'Slot', key: 'code', width: 16 },
    { header: 'Depósito', key: 'depId', width: 12 },
    { header: 'Sector', key: 'chamber', width: 18 },
    { header: 'Niveles', key: 'levels', width: 16 },
    { header: 'Ejemplo_Posicion', key: 'examplePos', width: 22 },
    { header: 'Etiqueta', key: 'label', width: 24 },
  ];

  const slotsHeader = slotsSheet.getRow(1);
  slotsHeader.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  const cellByCode = new Map<string, BaseWarehouseCellRule>();
  for (const c of listBaseWarehouseCells()) {
    cellByCode.set(c.code, c);
  }
  if (typeof (prisma as any).warehouseCell?.findMany === 'function') {
    const overrides = await prisma.warehouseCell.findMany();
    for (const ov of overrides || []) {
      const code = String(ov.code || '').toUpperCase();
      cellByCode.set(code, {
        code,
        depId: ov.depId,
        row: ov.row,
        col: ov.col,
        isStorage: Boolean(ov.isStorage),
        isBlocked: Boolean(ov.isBlocked),
        levels: ov.isStorage ? String(ov.levels || 'A').toUpperCase() : '',
        chamber: String(ov.chamber || 'GENERAL').toUpperCase(),
        label: ov.label || null,
      });
    }
  }

  const validSlots = Array.from(cellByCode.values())
    .filter((c) => c.isStorage && !c.isBlocked && c.chamber !== 'BANO')
    .sort((a, b) => a.depId.localeCompare(b.depId) || a.row - b.row || a.col - b.col);

  for (const slot of validSlots) {
    slotsSheet.addRow({
      code: slot.code,
      depId: slot.depId,
      chamber: slot.chamber,
      levels: slot.levels,
      examplePos: `${slot.code}-A`,
      label: slot.label || '',
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
