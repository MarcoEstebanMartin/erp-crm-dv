export interface BrowserParsedWorkbook {
  sheetNames: string[];
  sheetToObjects: (sheetName: string) => Record<string, any>[];
  sheetToMatrix: (sheetName: string) => any[][];
}

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function unwrapBrowserCell(raw: any): any {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return raw;
  if (raw instanceof Date) {
    const dd = String(raw.getUTCDate()).padStart(2, '0');
    const mm = String(raw.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${raw.getUTCFullYear()}`;
  }
  if (typeof raw === 'object') {
    if ('result' in raw && raw.result !== undefined) {
      if (typeof raw.result === 'object' && raw.result !== null && 'error' in raw.result) return '';
      return unwrapBrowserCell(raw.result);
    }
    if ('richText' in raw && Array.isArray(raw.richText)) {
      return raw.richText.map((p: any) => p.text || '').join('');
    }
    if ('text' in raw && typeof raw.text === 'string') {
      return raw.text;
    }
  }
  return String(raw);
}

/**
 * Carga en el navegador un archivo .xlsx de forma perezosa (lazy chunk) mediante ExcelJS,
 * eliminando la dependencia vulnerable SheetJS (xlsx) y sumando 0 KB al bundle inicial.
 */
export async function parseExcelFileInBrowser(file: File): Promise<BrowserParsedWorkbook> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xls')) {
    throw new Error('Por seguridad, guardá la planilla antigua .xls como .xlsx antes de subirla.');
  }

  const buffer = await file.arrayBuffer();
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheetNames: string[] = workbook.worksheets.map((ws: any) => ws.name);

  return {
    sheetNames,
    sheetToObjects(sheetName: string): Record<string, any>[] {
      const ws = workbook.getWorksheet(sheetName);
      if (!ws || ws.rowCount < 2) return [];

      const maxCol = Math.min(Math.max(ws.columnCount, 1), 100);
      const headerRow = ws.getRow(1);
      const headers: string[] = [];
      let emptyCount = 0;

      for (let c = 1; c <= maxCol; c++) {
        const val = String(unwrapBrowserCell(headerRow.getCell(c).value) ?? '').trim();
        if (!val) {
          headers.push(emptyCount === 0 ? '__EMPTY' : `__EMPTY_${emptyCount}`);
          emptyCount++;
        } else if (DANGEROUS_KEYS.has(val)) {
          headers.push(`safe_${val}`);
        } else {
          headers.push(val);
        }
      }

      const out: Record<string, any>[] = [];
      const maxRow = Math.min(ws.rowCount, 15_000);
      for (let r = 2; r <= maxRow; r++) {
        const row = ws.getRow(r);
        const obj: Record<string, any> = Object.create(null);
        let hasData = false;
        for (let c = 1; c <= maxCol; c++) {
          const cellVal = unwrapBrowserCell(row.getCell(c).value);
          if (cellVal !== '' && cellVal !== null && cellVal !== undefined) {
            hasData = true;
            obj[headers[c - 1]] = cellVal;
          }
        }
        if (hasData) out.push({ ...obj });
      }
      return out;
    },
    sheetToMatrix(sheetName: string): any[][] {
      const ws = workbook.getWorksheet(sheetName);
      if (!ws) return [];
      const matrix: any[][] = [];
      const maxRow = Math.min(ws.rowCount, 15_000);
      const maxCol = Math.min(Math.max(ws.columnCount, 1), 100);
      for (let r = 1; r <= maxRow; r++) {
        const row = ws.getRow(r);
        const arr: any[] = [];
        for (let c = 1; c <= maxCol; c++) {
          arr.push(unwrapBrowserCell(row.getCell(c).value));
        }
        matrix.push(arr);
      }
      return matrix;
    },
  };
}
