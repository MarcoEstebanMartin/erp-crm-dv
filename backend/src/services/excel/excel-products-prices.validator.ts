import prisma from '../../utils/prisma';
import { readExcelSheetObjects } from '../../utils/excel-reader.util';
import {
  normalizeSku,
  parseExcelNumber,
  RowValidationResult,
  sanitizeText,
  ValidationReport,
} from './excel-parser.helpers';

/**
 * Validador de Excel de Productos / Catálogo (sobre motor seguro ExcelJS).
 */
export async function validateProductsExcel(fileBuffer: Buffer): Promise<ValidationReport> {
  const rawRows = await readExcelSheetObjects(fileBuffer);

  const existingProducts = await prisma.product.findMany({
    select: { id: true, sku: true, name: true, costPrice: true, listPrice: true, rubroId: true },
  });
  const dbProductMap = new Map<string, (typeof existingProducts)[0]>();
  existingProducts.forEach((p) => dbProductMap.set(p.sku, p));

  const existingRubros = await prisma.rubro.findMany();
  const dbRubroSet = new Set(existingRubros.map((r) => r.name.toLowerCase().trim()));

  const reportRows: RowValidationResult[] = [];
  const excelSkuSeen = new Map<string, number>();

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

    const rawSku = raw.SKU ?? raw.Sku ?? raw.sku ?? raw.Codigo ?? raw['Código'] ?? raw.ARTICULO;
    const sku = normalizeSku(rawSku);

    const name = sanitizeText(
      raw.DESCRIPCION ?? raw.Descripcion ?? raw.descripcion ?? raw.Nombre ?? raw.PRODUCTO,
    );
    const rubroName = sanitizeText(raw.RUBRO ?? raw.Rubro ?? raw.rubro ?? raw.Categoria);
    const costPrice = parseExcelNumber(
      raw.COSTO ?? raw.Costo ?? raw.costo ?? raw.PRECIO_COSTO ?? 0,
    );
    const listPrice = parseExcelNumber(
      raw.PRECIO ?? raw.Precio ?? raw.precio ?? raw.PRECIO_LISTA ?? raw.LISTA ?? 0,
    );
    const unitsPerBox = parseExcelNumber(raw.BULTO ?? raw.Bulto ?? raw.UNIDADES_CAJA ?? 1) || 1;

    if (!sku) {
      status = 'ERROR';
      messages.push('SKU ausente o inválido.');
    } else if (excelSkuSeen.has(sku)) {
      status = 'ERROR';
      messages.push(`SKU '${sku}' duplicado en la misma planilla (fila ${excelSkuSeen.get(sku)}).`);
    } else {
      excelSkuSeen.set(sku, excelLine);
    }

    if (!name) {
      status = 'ERROR';
      messages.push('La descripción o nombre del producto es obligatoria.');
    }

    if (costPrice === null || costPrice < 0) {
      status = 'ERROR';
      messages.push('El precio de costo es inválido.');
    }
    if (listPrice === null || listPrice < 0) {
      status = 'ERROR';
      messages.push('El precio de lista es inválido.');
    }

    if (rubroName && !dbRubroSet.has(rubroName.toLowerCase())) {
      if (status !== 'ERROR') status = 'WARNING';
      messages.push(`El rubro '${rubroName}' no existe y se creará automáticamente.`);
    }

    if (sku && status !== 'ERROR') {
      if (dbProductMap.has(sku)) {
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
        sku,
        name,
        rubro: rubroName,
        costPrice: costPrice ?? 0,
        listPrice: listPrice ?? 0,
        unitsPerBox,
      },
      messages,
    });
  }

  return {
    domain: 'PRODUCTS',
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
 * Validador de Excel de Listas de Precios (sobre motor seguro ExcelJS).
 */
export async function validatePricesExcel(fileBuffer: Buffer): Promise<ValidationReport> {
  const rawRows = await readExcelSheetObjects(fileBuffer);

  const existingProducts = await prisma.product.findMany({
    select: { sku: true, name: true, costPrice: true, listPrice: true },
  });
  const dbProductMap = new Map<string, (typeof existingProducts)[0]>();
  existingProducts.forEach((p) => dbProductMap.set(p.sku, p));

  const reportRows: RowValidationResult[] = [];
  const excelSkuSeen = new Set<string>();

  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  const actionNewCount = 0;
  let actionUpdateCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const excelLine = i + 2;
    const messages: string[] = [];
    let status: 'VALID' | 'WARNING' | 'ERROR' = 'VALID';
    let action: 'CREATE' | 'UPDATE' | 'NONE' = 'NONE';

    const rawSku = raw.SKU ?? raw.Sku ?? raw.sku ?? raw.Codigo;
    const sku = normalizeSku(rawSku);

    const costPrice = parseExcelNumber(raw.COSTO ?? raw.Costo ?? raw.PRECIO_COSTO);
    const listPrice = parseExcelNumber(
      raw.LISTA_A ?? raw.PRECIO_LISTA ?? raw.LISTA ?? raw.PRECIO,
    );
    const listPriceB = parseExcelNumber(raw.LISTA_B ?? raw.MAYORISTA);
    const listPriceC = parseExcelNumber(raw.LISTA_C ?? raw.ESPECIAL);

    if (!sku) {
      status = 'ERROR';
      messages.push('SKU ausente.');
    } else if (!dbProductMap.has(sku)) {
      status = 'ERROR';
      messages.push(`El SKU '${sku}' no existe en el catálogo de productos.`);
    } else if (excelSkuSeen.has(sku)) {
      status = 'ERROR';
      messages.push(`SKU '${sku}' duplicado en la planilla.`);
    } else {
      excelSkuSeen.add(sku);
      action = 'UPDATE';
      actionUpdateCount++;
    }

    if (costPrice !== null && costPrice < 0) {
      status = 'ERROR';
      messages.push('El precio de costo no puede ser negativo.');
    }
    if (listPrice !== null && listPrice < 0) {
      status = 'ERROR';
      messages.push('El precio de lista no puede ser negativo.');
    }

    const currentProd = dbProductMap.get(sku);

    if ((status as string) === 'ERROR') errorCount++;
    else if ((status as string) === 'WARNING') warningCount++;
    else validCount++;

    reportRows.push({
      rowIndex: excelLine,
      status,
      action,
      data: {
        sku,
        name: currentProd?.name || '---',
        costPrice: costPrice ?? (currentProd?.costPrice ? Number(currentProd.costPrice) : 0),
        listPrice: listPrice ?? (currentProd?.listPrice ? Number(currentProd.listPrice) : 0),
        listPriceB: listPriceB ?? 0,
        listPriceC: listPriceC ?? 0,
      },
      messages,
    });
  }

  return {
    domain: 'PRICES',
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
