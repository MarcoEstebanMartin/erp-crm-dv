import prisma from '../../utils/prisma';
import { readExcelSheetObjects } from '../../utils/excel-reader.util';
import {
  RowValidationResult,
  sanitizeText,
  ValidationReport,
} from './excel-parser.helpers';

/**
 * Validador de Excel de Clientes (Maestro de Personas / Clientes) sobre motor seguro ExcelJS.
 */
export async function validateClientsExcel(fileBuffer: Buffer): Promise<ValidationReport> {
  const rawRows = await readExcelSheetObjects(fileBuffer);

  const existingClients = await prisma.persona.findMany({
    where: { isClient: true },
    select: { id: true, name: true, cuit: true, address: true, city: true, phone: true },
  });

  const dbCuitMap = new Map<string, (typeof existingClients)[0]>();
  const dbNameMap = new Map<string, (typeof existingClients)[0]>();
  existingClients.forEach((c) => {
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

    const name = sanitizeText(
      raw.RAZON_SOCIAL ?? raw.RazonSocial ?? raw.Nombre ?? raw.NOMBRE ?? raw.CLIENTE ?? raw.Cliente,
    );
    const rawCuit = sanitizeText(raw.CUIT ?? raw.Cuit ?? raw.cuit);
    const cleanCuit = rawCuit.replace(/\D/g, '');
    const address = sanitizeText(raw.DIRECCION ?? raw.Direccion ?? raw.Domicilio);
    const city = sanitizeText(raw.LOCALIDAD ?? raw.Localidad ?? raw.Ciudad);
    const phone = sanitizeText(raw.TELEFONO ?? raw.Telefono ?? raw.Celular);
    const email = sanitizeText(raw.EMAIL ?? raw.Email ?? raw.Correo);
    const route = sanitizeText(raw.RUTA ?? raw.Ruta ?? raw.REPARTO);

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

    const matchedClient =
      (cleanCuit ? dbCuitMap.get(cleanCuit) : undefined) ||
      (name ? dbNameMap.get(name.toLowerCase()) : undefined);

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
        route,
      },
      messages,
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
      actionUpdateCount,
    },
    rows: reportRows,
  };
}
