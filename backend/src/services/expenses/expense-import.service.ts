import { PaymentMethod } from '@prisma/client';
import * as XLSX from 'xlsx';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { roundToTwoDecimals } from '../../core/money';
import { DEFAULT_EXPENSE_CATEGORIES } from './expense.service';

function resolveCategoryId(name: string, catMap: Record<string, number>): number {
  const lower = name.toLowerCase();
  if (lower.includes('sueldo')) return catMap['sueldos'];
  if (
    lower.includes('claro') ||
    lower.includes('gas') ||
    lower.includes('luz') ||
    lower.includes('flow') ||
    lower.includes('servicio')
  ) {
    return catMap['servicios'];
  }
  if (lower.includes('patente')) return catMap['impuestos y patentes'];
  if (lower.includes('patronal')) return catMap['cargas patronales'];
  if (lower.includes('combustible')) return catMap['combustible'];
  if (lower.includes('seguro')) return catMap['seguros'];
  if (lower.includes('mantenimiento')) return catMap['mantenimiento'];
  if (lower.includes('contador') || lower.includes('iduo') || lower.includes('profesional')) {
    return catMap['gastos profesionales'];
  }
  if (lower.includes('facebook') || lower.includes('publicidad') || lower.includes('radio')) {
    return catMap['publicidad y comunicación'];
  }
  if (lower.includes('banco') || lower.includes('bancario')) return catMap['gastos bancarios'];
  if (
    lower.includes('impuesto') ||
    lower.includes('iva') ||
    lower.includes('ganancia') ||
    lower.includes('personales') ||
    lower.includes('arba') ||
    lower.includes('municipal') ||
    lower.includes('abl')
  ) {
    return catMap['impuestos y patentes'];
  }
  return catMap['otros gastos'];
}

export async function importExpensesFromExcel(params: {
  userId: number;
  fileBuffer: Buffer;
}): Promise<number> {
  const workbook = XLSX.read(params.fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[];

  let dbCategories = await prisma.expenseCategory.findMany();
  if (dbCategories.length === 0) {
    await prisma.expenseCategory.createMany({ data: DEFAULT_EXPENSE_CATEGORIES });
    dbCategories = await prisma.expenseCategory.findMany();
  }

  const catMap: Record<string, number> = {};
  for (const c of dbCategories) {
    catMap[c.name.toLowerCase()] = c.id;
  }

  const vehicles = await prisma.vehicle.findMany();
  const vehicleMap: Record<string, number> = {};
  for (const v of vehicles) {
    vehicleMap[v.plate.replace(/\s+/g, '').toUpperCase()] = v.id;
  }

  const importedExpenses: Array<{
    amount: number;
    description: string;
    categoryId: number;
    paymentMethod: PaymentMethod;
    vehicleId?: number;
    date: Date;
  }> = [];

  const dateOfMayo = new Date(2026, 4, 8);

  for (const row of rawData) {
    const employeeName = String(row['__EMPTY_3'] || '');
    const employeeSalary = Number(row['__EMPTY_4']);
    if (employeeName && !isNaN(employeeSalary) && employeeSalary > 0 && employeeName !== 'Sueldos') {
      importedExpenses.push({
        amount: roundToTwoDecimals(employeeSalary).toNumber(),
        description: `Sueldo de empleado: ${employeeName.trim()}`,
        categoryId: catMap['sueldos'],
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        date: dateOfMayo,
      });
    }

    const vehicleDesc = String(row['__EMPTY_7'] || '');
    const patentCost = Number(row['__EMPTY_8']);
    if (
      vehicleDesc &&
      !isNaN(patentCost) &&
      patentCost > 0 &&
      vehicleDesc !== 'Patentes' &&
      !vehicleDesc.includes('Facturacion') &&
      !vehicleDesc.includes('Costo') &&
      !vehicleDesc.includes('Rentabilidad') &&
      !vehicleDesc.includes('Gastos') &&
      !vehicleDesc.includes('TOTAL')
    ) {
      const normalizedPlate = vehicleDesc.replace(/\s+/g, '').toUpperCase();
      let matchedVehicleId: number | undefined;
      for (const plate of Object.keys(vehicleMap)) {
        if (normalizedPlate.includes(plate) || plate.includes(normalizedPlate)) {
          matchedVehicleId = vehicleMap[plate];
          break;
        }
      }

      importedExpenses.push({
        amount: roundToTwoDecimals(patentCost).toNumber(),
        description: `Patente del vehículo: ${vehicleDesc.trim()}`,
        categoryId: catMap['impuestos y patentes'],
        paymentMethod: PaymentMethod.CASH,
        vehicleId: matchedVehicleId,
        date: dateOfMayo,
      });
    }

    const expenseName = String(row['08/05/2026'] || '');
    const expenseAmount = Number(row['__EMPTY']);
    if (expenseName && !isNaN(expenseAmount) && expenseAmount > 0) {
      const cleanName = expenseName.trim();
      const lowerName = cleanName.toLowerCase();
      if (lowerName === 'total =' || lowerName === 'total' || lowerName === 'sueldos' || lowerName === 'patentes') {
        continue;
      }

      importedExpenses.push({
        amount: roundToTwoDecimals(expenseAmount).toNumber(),
        description: cleanName,
        categoryId: resolveCategoryId(cleanName, catMap),
        paymentMethod:
          cleanName.includes('Bancarios') || cleanName.includes('IVA')
            ? PaymentMethod.BANK_TRANSFER
            : PaymentMethod.CASH,
        date: dateOfMayo,
      });
    }
  }

  if (importedExpenses.length === 0) {
    throw new AppError('No se encontraron gastos procesables en el Excel.', 400);
  }

  const insertedCount = await prisma.$transaction(async (tx) => {
    let count = 0;
    for (const exp of importedExpenses) {
      await tx.expense.create({
        data: {
          amount: exp.amount,
          date: exp.date,
          description: exp.description,
          categoryId: exp.categoryId,
          userId: params.userId,
          paymentMethod: exp.paymentMethod,
          vehicleId: exp.vehicleId,
        },
      });
      count++;
    }
    return count;
  });

  await logAudit({
    userId: params.userId,
    action: 'IMPORT_EXPENSES_EXCEL',
    entityType: 'Expense',
    entityId: 0,
    newValues: { count: insertedCount, month: 'Mayo 2026' },
  });

  return insertedCount;
}
