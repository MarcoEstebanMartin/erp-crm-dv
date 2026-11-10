import ExcelJS from 'exceljs';
import { Readable } from 'stream';

export const MAX_EXCEL_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_EXCEL_ROWS = 15_000;
export const MAX_EXCEL_COLS = 100;

const DANGEROUS_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface ReadExcelOptions {
  sheetName?: string;
  defval?: any;
}

/**
 * Desenvuelve valores complejos de ExcelJS (fórmulas, RichText, hipervínculos, fechas)
 * a valores primitivos limpios compatibles con validadores financieros.
 */
export function unwrapExcelCellValue(raw: ExcelJS.CellValue): any {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return raw;
  }
  if (raw instanceof Date) {
    const dd = String(raw.getUTCDate()).padStart(2, '0');
    const mm = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = raw.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  if (typeof raw === 'object') {
    if ('result' in raw && raw.result !== undefined) {
      if (typeof raw.result === 'object' && raw.result !== null && 'error' in raw.result) {
        return '';
      }
      return unwrapExcelCellValue(raw.result as ExcelJS.CellValue);
    }
    if ('richText' in raw && Array.isArray(raw.richText)) {
      return raw.richText.map((part) => part.text || '').join('');
    }
    if ('text' in raw && typeof raw.text === 'string') {
      return raw.text;
    }
  }
  return String(raw);
}

async function loadSafeWorkbook(fileBuffer: Buffer): Promise<ExcelJS.Workbook> {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new Error('El archivo Excel está vacío o es inválido.');
  }
  if (fileBuffer.length > MAX_EXCEL_FILE_BYTES) {
    throw new Error('El archivo supera el límite máximo permitido de 15 MB.');
  }

  // Rechazar formato binario legado BIFF8 (.xls 97-2003) vulnerable a exploits de memoria
  if (fileBuffer.length >= 2 && fileBuffer[0] === 0xd0 && fileBuffer[1] === 0xcf) {
    throw new Error(
      'El formato antiguo .xls (Excel 97-2003) está deshabilitado por seguridad. Por favor guardá el archivo como .xlsx o .csv.',
    );
  }

  const workbook = new ExcelJS.Workbook();
  const isZipXlsx = fileBuffer.length >= 4 && fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4b;

  if (isZipXlsx) {
    await workbook.xlsx.load(fileBuffer as any);
  } else {
    const sample = fileBuffer.subarray(0, 2048).toString('utf8');
    const firstLine = sample.split(/\r?\n/)[0] || '';
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';
    await workbook.csv.read(Readable.from(fileBuffer), {
      parserOptions: { delimiter },
    });
  }

  if (workbook.worksheets.length === 0) {
    throw new Error('La planilla no contiene ninguna hoja de datos legible.');
  }
  return workbook;
}

function selectWorksheet(workbook: ExcelJS.Workbook, sheetName?: string): ExcelJS.Worksheet {
  if (sheetName) {
    const found = workbook.getWorksheet(sheetName);
    if (found) return found;
  }
  return workbook.worksheets[0];
}

/**
 * Lee una hoja de Excel/CSV y devuelve objetos clave-valor usando la fila 1 como cabeceras.
 * Protegido contra Prototype Pollution, límites anti-DoS y compatible con columnas sin título (__EMPTY, __EMPTY_1...).
 */
export async function readExcelSheetObjects(
  fileBuffer: Buffer,
  options: ReadExcelOptions = {},
): Promise<Record<string, any>[]> {
  const workbook = await loadSafeWorkbook(fileBuffer);
  const worksheet = selectWorksheet(workbook, options.sheetName);

  const rowCount = Math.min(worksheet.rowCount, MAX_EXCEL_ROWS + 1);
  if (worksheet.rowCount > MAX_EXCEL_ROWS + 1) {
    throw new Error(
      `La planilla supera el máximo de seguridad de ${MAX_EXCEL_ROWS.toLocaleString('es-AR')} filas por lote.`,
    );
  }
  if (rowCount < 2) return [];

  const maxCol = Math.min(Math.max(worksheet.columnCount, 1), MAX_EXCEL_COLS);
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  let emptyCounter = 0;

  for (let col = 1; col <= maxCol; col++) {
    const rawHeader = unwrapExcelCellValue(headerRow.getCell(col).value);
    const trimmed = rawHeader !== null && rawHeader !== undefined ? String(rawHeader).trim() : '';

    if (!trimmed) {
      const emptyKey = emptyCounter === 0 ? '__EMPTY' : `__EMPTY_${emptyCounter}`;
      emptyCounter++;
      headers.push(emptyKey);
    } else if (DANGEROUS_PROTO_KEYS.has(trimmed)) {
      headers.push(`safe_${trimmed}`);
    } else {
      headers.push(trimmed);
    }
  }

  const hasDefval = Object.prototype.hasOwnProperty.call(options, 'defval');
  const rows: Record<string, any>[] = [];

  for (let r = 2; r <= rowCount; r++) {
    const row = worksheet.getRow(r);
    const record: Record<string, any> = Object.create(null);
    let hasAnyValue = false;

    for (let col = 1; col <= maxCol; col++) {
      const key = headers[col - 1];
      const cellVal = unwrapExcelCellValue(row.getCell(col).value);
      const isEmpty = cellVal === null || cellVal === undefined || cellVal === '';

      if (!isEmpty) {
        hasAnyValue = true;
        record[key] = cellVal;
      } else if (hasDefval) {
        record[key] = options.defval;
      }
    }

    if (hasAnyValue) {
      rows.push({ ...record });
    }
  }

  return rows;
}
