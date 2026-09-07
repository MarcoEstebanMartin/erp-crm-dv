import * as XLSX from 'xlsx';
import prisma from '../utils/prisma';

export interface RowValidationResult {
  rowIndex: number;
  status: 'VALID' | 'WARNING' | 'ERROR';
  action: 'CREATE' | 'UPDATE' | 'NONE';
  data: Record<string, any>;
  messages: string[];
}

export interface ValidationReport {
  domain: 'PRODUCTS' | 'PRICES' | 'CLIENTS';
  summary: {
    totalRows: number;
    validCount: number;
    warningCount: number;
    errorCount: number;
    actionNewCount: number;
    actionUpdateCount: number;
  };
  rows: RowValidationResult[];
}

/**
 * Parsea un valor numérico/moneda desde Excel.
 * Soporta formatos: 1250, 1250.50, "$ 1.250,50", "1,250.50", etc.
 */
export function parseExcelNumber(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;

  let str = val.toString().trim();
  // Quitar símbolos de moneda y espacios
  str = str.replace(/[\$\s]/g, '');

  // Caso formato argentino: 1.250,50 -> 1250.50
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Punto es miles, coma es decimal (1.250,50)
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Coma es miles, punto es decimal (1,250.50)
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Solo coma (1250,50 -> 1250.50)
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Normaliza un SKU a string de 4+ dígitos conservando ceros a la izquierda si es numérico.
 */
export function normalizeSku(raw: any): string {
  if (raw === undefined || raw === null) return '';
  const str = raw.toString().trim();
  if (!str) return '';
  // Si consta solo de dígitos, aplicar padStart(4, '0')
  if (/^\d+$/.test(str)) {
    return str.padStart(4, '0');
  }
  return str;
}

/**
 * Sanitiza textos (remueve espacios al inicio/final).
 */
export function sanitizeText(raw: any): string {
  if (raw === undefined || raw === null) return '';
  return raw.toString().trim();
}

/**
 * Validador de Excel de Productos / Catálogo
 */
export async function validateProductsExcel(fileBuffer: Buffer): Promise<ValidationReport> {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);

  const existingProducts = await prisma.product.findMany({
    select: { id: true, sku: true, name: true, costPrice: true, listPrice: true, rubroId: true }
  });
  const dbProductMap = new Map<string, typeof existingProducts[0]>();
  existingProducts.forEach(p => dbProductMap.set(p.sku, p));

  const existingRubros = await prisma.rubro.findMany();
  const dbRubroSet = new Set(existingRubros.map(r => r.name.toLowerCase().trim()));

  const reportRows: RowValidationResult[] = [];
  const excelSkuSeen = new Map<string, number>();

  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let actionNewCount = 0;
  let actionUpdateCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const excelLine = i + 2; // Fila en Excel
    const messages: string[] = [];
    let status: 'VALID' | 'WARNING' | 'ERROR' = 'VALID';
    let action: 'CREATE' | 'UPDATE' | 'NONE' = 'NONE';

    // Mapeo flexible de columnas
    const rawSku = raw.SKU ?? raw.Sku ?? raw.sku ?? raw.Codigo ?? raw['Código'] ?? raw.ARTICULO;
    const sku = normalizeSku(rawSku);

    const name = sanitizeText(raw.DESCRIPCION ?? raw.Descripcion ?? raw.descripcion ?? raw.Nombre ?? raw.PRODUCTO);
    const rubroName = sanitizeText(raw.RUBRO ?? raw.Rubro ?? raw.rubro ?? raw.Categoria);
    const costPrice = parseExcelNumber(raw.COSTO ?? raw.Costo ?? raw.costo ?? raw.PRECIO_COSTO ?? 0);
    const listPrice = parseExcelNumber(raw.PRECIO ?? raw.Precio ?? raw.precio ?? raw.PRECIO_LISTA ?? raw.LISTA ?? 0);
    const unitsPerBox = parseExcelNumber(raw.BULTO ?? raw.Bulto ?? raw.UNIDADES_CAJA ?? 1) || 1;

    // Validación de SKU
    if (!sku) {
      status = 'ERROR';
      messages.push('SKU ausente o inválido.');
    } else {
      if (excelSkuSeen.has(sku)) {
        status = 'ERROR';
        messages.push(`SKU '${sku}' duplicado en la misma planilla (fila ${excelSkuSeen.get(sku)}).`);
      } else {
        excelSkuSeen.set(sku, excelLine);
      }
    }

    // Validación de Descripción
    if (!name) {
      status = 'ERROR';
      messages.push('La descripción o nombre del producto es obligatoria.');
    }

    // Validación de Precios
    if (costPrice === null || costPrice < 0) {
      status = 'ERROR';
      messages.push('El precio de costo es inválido.');
    }
    if (listPrice === null || listPrice < 0) {
      status = 'ERROR';
      messages.push('El precio de lista es inválido.');
    }

    // Advertencia de Rubro
    if (rubroName && !dbRubroSet.has(rubroName.toLowerCase())) {
      if (status !== 'ERROR') status = 'WARNING';
      messages.push(`El rubro '${rubroName}' no existe y se creará automáticamente.`);
    }

    // Determinar acción
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
        unitsPerBox
      },
      messages
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
      actionUpdateCount
    },
    rows: reportRows
  };
}

/**
 * Validador de Excel de Listas de Precios
 */
export async function validatePricesExcel(fileBuffer: Buffer): Promise<ValidationReport> {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);

  const existingProducts = await prisma.product.findMany({
    select: { sku: true, name: true, costPrice: true, listPrice: true }
  });
  const dbProductMap = new Map<string, typeof existingProducts[0]>();
  existingProducts.forEach(p => dbProductMap.set(p.sku, p));

  const reportRows: RowValidationResult[] = [];
  const excelSkuSeen = new Set<string>();

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

    const rawSku = raw.SKU ?? raw.Sku ?? raw.sku ?? raw.Codigo;
    const sku = normalizeSku(rawSku);

    const costPrice = parseExcelNumber(raw.COSTO ?? raw.Costo ?? raw.PRECIO_COSTO);
    const listPrice = parseExcelNumber(raw.LISTA_A ?? raw.PRECIO_LISTA ?? raw.LISTA ?? raw.PRECIO);
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
        listPriceC: listPriceC ?? 0
      },
      messages
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
      actionUpdateCount
    },
    rows: reportRows
  };
}

/**
 * Validador de Excel de Clientes (Maestro de Personas / Clientes)
 */
export async function validateClientsExcel(fileBuffer: Buffer): Promise<ValidationReport> {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);

  const existingClients = await prisma.persona.findMany({
    where: { isClient: true },
    select: { id: true, name: true, cuit: true, address: true, city: true, phone: true }
  });

  const dbCuitMap = new Map<string, typeof existingClients[0]>();
  const dbNameMap = new Map<string, typeof existingClients[0]>();
  existingClients.forEach(c => {
    if (c.cuit) {
      const cleanC = c.cuit.replace(/\D/g, '');
      if (cleanC) dbCuitMap.set(cleanC, c);
    }
    if (c.name) {
      dbNameMap.set(c.name.toLowerCase().trim(), c);
    }
  });

  const reportRows: RowValidationResult[] = [];
  const excelCuitSeen = new Set<string>();
  const excelNameSeen = new Set<string>();

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

    const name = sanitizeText(raw.RAZON_SOCIAL ?? raw.RazonSocial ?? raw.Nombre ?? raw.NOMBRE ?? raw.CLIENTE ?? raw.Cliente);
    const rawCuit = sanitizeText(raw.CUIT ?? raw.Cuit ?? raw.cuit);
    const cleanCuit = rawCuit.replace(/\D/g, '');
    const address = sanitizeText(raw.DIRECCION ?? raw.Direccion ?? raw.Domicilio);
    const city = sanitizeText(raw.LOCALIDAD ?? raw.Localidad ?? raw.Ciudad);
    const phone = sanitizeText(raw.TELEFONO ?? raw.Telefono ?? raw.Celular);
    const email = sanitizeText(raw.EMAIL ?? raw.Email ?? raw.Correo);
    const route = sanitizeText(raw.RUTA ?? raw.Ruta ?? raw.REPARTO);

    // Validación de Nombre / Razón Social
    if (!name) {
      status = 'ERROR';
      messages.push('La Razón Social o Nombre del cliente es obligatorio.');
    } else {
      const normName = name.toLowerCase();
      if (excelNameSeen.has(normName)) {
        status = 'WARNING';
        messages.push(`Cliente '${name}' duplicado en la misma planilla.`);
      } else {
        excelNameSeen.add(normName);
      }
    }

    // Validación de CUIT
    if (cleanCuit) {
      if (cleanCuit.length !== 11) {
        if (status !== 'ERROR') status = 'WARNING';
        messages.push(`El CUIT '${rawCuit}' no tiene los 11 dígitos estándar.`);
      }
      if (excelCuitSeen.has(cleanCuit)) {
        status = 'ERROR';
        messages.push(`CUIT '${rawCuit}' duplicado en la planilla.`);
      } else {
        excelCuitSeen.add(cleanCuit);
      }
    }

    // Determinar si es Alta o Actualización
    const matchedClient = (cleanCuit ? dbCuitMap.get(cleanCuit) : undefined) || (name ? dbNameMap.get(name.toLowerCase()) : undefined);


    if (name && status !== 'ERROR') {
      if (matchedClient) {
        action = 'UPDATE';
        actionUpdateCount++;
      } else {
        action = 'CREATE';
        actionNewCount++;
      }
    }

    if ((status as string) === 'ERROR') errorCount++;
    else if ((status as string) === 'WARNING') warningCount++;
    else validCount++;

    reportRows.push({
      rowIndex: excelLine,
      status,
      action,
      data: {
        id: matchedClient?.id,
        name,
        cuit: cleanCuit || rawCuit,
        address,
        city,
        phone,
        email,
        route
      },
      messages
    });
  }

  return {
    domain: 'CLIENTS',
    summary: {
      totalRows: rawRows.length,
      validCount,
      warningCount,
      errorCount,
      actionNewCount,
      actionUpdateCount
    },
    rows: reportRows
  };
}

