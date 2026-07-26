import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { logAudit } from '../utils/audit';
import { BillingType, PaymentMethod, TransactionType } from '@prisma/client';
import * as XLSX from 'xlsx';

// Categorías por defecto
const DEFAULT_CATEGORIES = [
  { name: 'Sueldos', description: 'Sueldos de personal y operarios' },
  { name: 'Servicios', description: 'Servicios públicos (Luz, Gas, Internet, Teléfono, Flow, Claro)' },
  { name: 'Cargas Patronales', description: 'Cargas sociales e impositivas sobre sueldos' },
  { name: 'Impuestos y Patentes', description: 'Tasas municipales, ARBA, Patentes, IVA, Ganancias, Bienes Personales' },
  { name: 'Combustible', description: 'Gasto de combustible para reparto y preventa' },
  { name: 'Seguros', description: 'Seguros de vehículos, incendios y vida' },
  { name: 'Mantenimiento', description: 'Reparaciones y mantenimiento general' },
  { name: 'Gastos Profesionales', description: 'Honorarios del contador, licencias de software (Iduo), etc.' },
  { name: 'Publicidad y Comunicación', description: 'Pauta en Facebook, Radio, etc.' },
  { name: 'Gastos Bancarios', description: 'Comisiones de Mercado Pago, mantenimiento de cuentas bancarias' },
  { name: 'Otros Gastos', description: 'Papelería, artículos de limpieza, gastos varios menores' }
];

/**
 * Obtener o inicializar categorías de gastos.
 */
export async function getCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    let categories = await prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' }
    });

    if (categories.length === 0) {
      await prisma.expenseCategory.createMany({
        data: DEFAULT_CATEGORIES
      });
      categories = await prisma.expenseCategory.findMany({
        orderBy: { name: 'asc' }
      });
    }

    res.status(200).json({ status: 'success', data: { categories } });
  } catch (error: any) {
    console.error('Error al obtener categorías de gastos:', error);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
  }
}

/**
 * Crear una nueva categoría manualmente.
 */
export async function createCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, description } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  if (!name || !name.trim()) {
    res.status(400).json({ status: 'error', message: 'El nombre de la categoría es obligatorio.' });
    return;
  }

  try {
    const existing = await prisma.expenseCategory.findUnique({
      where: { name: name.trim() }
    });

    if (existing) {
      res.status(400).json({ status: 'error', message: 'La categoría ya existe.' });
      return;
    }

    const category = await prisma.expenseCategory.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null
      }
    });

    res.status(201).json({ status: 'success', data: { category } });
  } catch (error: any) {
    console.error('Error al crear categoría de gasto:', error);
    res.status(500).json({ status: 'error', message: 'Error al crear la categoría.' });
  }
}

/**
 * Obtener listado de gastos con filtros.
 */
export async function getExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { categoryId, year, month, paymentMethod, startDate, endDate } = req.query;

  try {
    const whereClause: any = {};

    if (categoryId) {
      whereClause.categoryId = Number(categoryId);
    }
    if (paymentMethod) {
      whereClause.paymentMethod = paymentMethod as PaymentMethod;
    }

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        whereClause.date.gte = new Date(String(startDate));
      }
      if (endDate) {
        whereClause.date.lte = new Date(String(endDate));
      }
    } else if (year && month) {
      const y = Number(year);
      const m = Number(month); // 1-indexed (1 = Enero, 12 = Diciembre)
      
      const startOfPeriod = new Date(y, m - 1, 1);
      const endOfPeriod = new Date(y, m, 0, 23, 59, 59, 999); // último día del mes

      whereClause.date = {
        gte: startOfPeriod,
        lte: endOfPeriod
      };
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      include: {
        category: true,
        user: { select: { id: true, username: true } },
        vehicle: { select: { id: true, plate: true, brand: true, model: true } },
        transaction: true
      },
      orderBy: { date: 'desc' }
    });

    res.status(200).json({ status: 'success', data: { expenses } });
  } catch (error: any) {
    console.error('Error al listar gastos:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener los gastos.' });
  }
}

/**
 * Registrar un gasto manualmente.
 */
export async function createExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { amount, categoryId, description, date, paymentMethod, cashDrawerId, bankAccountId, vehicleId, billingType } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  const expAmount = Number(amount);
  if (isNaN(expAmount) || expAmount <= 0) {
    res.status(400).json({ status: 'error', message: 'El monto debe ser un número mayor a cero.' });
    return;
  }

  if (!categoryId) {
    res.status(400).json({ status: 'error', message: 'La categoría es obligatoria.' });
    return;
  }

  if (!description || !description.trim()) {
    res.status(400).json({ status: 'error', message: 'La descripción es obligatoria.' });
    return;
  }

  const expenseDate = date ? new Date(date) : new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      let transactionId: number | undefined = undefined;

      // Si afecta caja o banco, creamos la transacción
      if (paymentMethod === PaymentMethod.CASH) {
        let activeDrawerId = cashDrawerId ? Number(cashDrawerId) : null;
        
        if (!activeDrawerId) {
          // Intentar buscar la caja activa del usuario
          const activeDrawer = await tx.cashDrawer.findFirst({
            where: { userId, status: 'OPEN' }
          });
          if (!activeDrawer) {
            throw new Error('Debe abrir una caja antes de registrar un gasto en efectivo.');
          }
          activeDrawerId = activeDrawer.id;
        }

        const activeDrawer = await tx.cashDrawer.findUnique({
          where: { id: activeDrawerId }
        });
        if (!activeDrawer || activeDrawer.status === 'CLOSED') {
          throw new Error('La caja seleccionada no está abierta.');
        }

        // Crear egreso
        const trans = await tx.transaction.create({
          data: {
            userId,
            billingType: billingType as BillingType || (activeDrawer.branch === 'A' ? BillingType.OFFICIAL : BillingType.INTERNAL),
            type: TransactionType.OUTCOME,
            paymentMethod: PaymentMethod.CASH,
            amount: expAmount,
            description: `Gasto: ${description.trim()}`,
            cashDrawerId: activeDrawer.id,
            verified: true
          }
        });
        transactionId = trans.id;

      } else if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
        if (!bankAccountId) {
          throw new Error('Debe seleccionar una cuenta bancaria para pagos por transferencia.');
        }

        const bankAcc = await tx.bankAccount.findUnique({
          where: { id: Number(bankAccountId) }
        });
        if (!bankAcc) {
          throw new Error('Cuenta bancaria no encontrada.');
        }

        // Descontar saldo del banco
        await tx.bankAccount.update({
          where: { id: bankAcc.id },
          data: {
            balance: {
              decrement: expAmount
            }
          }
        });

        // Crear egreso bancario
        const trans = await tx.transaction.create({
          data: {
            userId,
            billingType: billingType as BillingType || BillingType.INTERNAL,
            type: TransactionType.OUTCOME,
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            amount: expAmount,
            description: `Gasto: ${description.trim()}`,
            bankAccountId: bankAcc.id,
            verified: true
          }
        });
        transactionId = trans.id;
      }

      // Crear el registro de gasto
      const expense = await tx.expense.create({
        data: {
          amount: expAmount,
          date: expenseDate,
          description: description.trim(),
          categoryId: Number(categoryId),
          userId,
          paymentMethod: paymentMethod as PaymentMethod,
          cashDrawerId: paymentMethod === PaymentMethod.CASH ? cashDrawerId ? Number(cashDrawerId) : undefined : undefined,
          bankAccountId: paymentMethod === PaymentMethod.BANK_TRANSFER ? Number(bankAccountId) : undefined,
          vehicleId: vehicleId ? Number(vehicleId) : undefined,
          transactionId: transactionId
        },
        include: {
          category: true
        }
      });

      return { expense };
    });

    res.status(201).json({ status: 'success', data: { expense: result.expense } });
  } catch (error: any) {
    console.error('Error al registrar gasto:', error);
    res.status(400).json({ status: 'error', message: error.message || 'Error al guardar el gasto.' });
  }
}

/**
 * Eliminar un gasto y revertir su impacto financiero.
 */
export async function deleteExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  const expenseId = Number(id);
  if (isNaN(expenseId)) {
    res.status(400).json({ status: 'error', message: 'ID inválido.' });
    return;
  }

  try {
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { transaction: true }
    });

    if (!expense) {
      res.status(404).json({ status: 'error', message: 'Gasto no encontrado.' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Revertir transacción si existe
      if (expense.transactionId && expense.transaction) {
        const trans = expense.transaction;

        // Si fue banco, devolver saldo
        if (trans.bankAccountId) {
          await tx.bankAccount.update({
            where: { id: trans.bankAccountId },
            data: {
              balance: {
                increment: Number(trans.amount)
              }
            }
          });
        }

        // Si fue caja chica, simplemente borramos el registro de la transacción
        // (ya no afectará al arqueo total teórico al eliminarse)
        await tx.transaction.delete({
          where: { id: trans.id }
        });
      }

      // Borrar el gasto
      await tx.expense.delete({
        where: { id: expense.id }
      });
    });

    // Auditoría
    await logAudit({
      userId,
      action: 'DELETE_EXPENSE',
      entityType: 'Expense',
      entityId: expenseId,
      oldValues: expense
    });

    res.status(200).json({ status: 'success', message: 'Gasto eliminado y fondos revertidos.' });
  } catch (error: any) {
    console.error('Error al eliminar gasto:', error);
    res.status(500).json({ status: 'error', message: 'Error interno al eliminar el gasto.' });
  }
}

/**
 * Importar gastos desde Excel (GastosDistribuidora.xlsx).
 */
export async function importExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ status: 'error', message: 'No se subió ningún archivo Excel.' });
    return;
  }

  try {
    // 1. Leer el Excel desde buffer
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as any[];

    // Asegurar que las categorías existan
    let dbCategories = await prisma.expenseCategory.findMany();
    if (dbCategories.length === 0) {
      await prisma.expenseCategory.createMany({ data: DEFAULT_CATEGORIES });
      dbCategories = await prisma.expenseCategory.findMany();
    }

    const catMap: { [key: string]: number } = {};
    dbCategories.forEach(c => {
      catMap[c.name.toLowerCase()] = c.id;
    });

    const getCatId = (name: string): number => {
      const lower = name.toLowerCase();
      // Mapear aproximados
      if (lower.includes('sueldo')) return catMap['sueldos'];
      if (lower.includes('claro') || lower.includes('gas') || lower.includes('luz') || lower.includes('flow') || lower.includes('servicio')) return catMap['servicios'];
      if (lower.includes('patente')) return catMap['impuestos y patentes'];
      if (lower.includes('patronal')) return catMap['cargas patronales'];
      if (lower.includes('combustible')) return catMap['combustible'];
      if (lower.includes('seguro')) return catMap['seguros'];
      if (lower.includes('mantenimiento')) return catMap['mantenimiento'];
      if (lower.includes('contador') || lower.includes('iduo') || lower.includes('profesional')) return catMap['gastos profesionales'];
      if (lower.includes('facebook') || lower.includes('publicidad') || lower.includes('radio')) return catMap['publicidad y comunicación'];
      if (lower.includes('banco') || lower.includes('bancario')) return catMap['gastos bancarios'];
      if (lower.includes('impuesto') || lower.includes('iva') || lower.includes('ganancia') || lower.includes('personales') || lower.includes('arba') || lower.includes('municipal') || lower.includes('abl')) return catMap['impuestos y patentes'];
      
      return catMap['otros gastos'];
    };

    // Buscar vehículos en la base de datos para mapeo de patentes
    const vehicles = await prisma.vehicle.findMany();
    const vehicleMap: { [key: string]: number } = {};
    vehicles.forEach(v => {
      vehicleMap[v.plate.replace(/\s+/g, '').toUpperCase()] = v.id;
    });

    const importedExpenses: any[] = [];
    const dateOfMayo = new Date(2026, 4, 8); // 8 de mayo de 2026

    // Recorrer filas del Excel
    // Estructura:
    // Columna B: Gastos generales (e.g. Sueldos, Claro, Gas)
    // Columna C: Importe
    // Columna F: Nombre empleado
    // Columna G: Sueldo importe
    // Columna J: Patente vehículo
    // Columna K: Patente importe
    
    // Analizar filas
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];

      // 1. Desglose de sueldos (Columnas F y G)
      const employeeName = row["__EMPTY_3"]; // Columna F
      const employeeSalary = Number(row["__EMPTY_4"]); // Columna G
      if (employeeName && !isNaN(employeeSalary) && employeeSalary > 0 && employeeName !== "Sueldos") {
        importedExpenses.push({
          amount: employeeSalary,
          description: `Sueldo de empleado: ${employeeName.trim()}`,
          categoryId: catMap['sueldos'],
          paymentMethod: PaymentMethod.BANK_TRANSFER, // Sueldos por defecto
          date: dateOfMayo
        });
      }

      // 2. Desglose de patentes (Columnas J y K)
      const vehicleDesc = row["__EMPTY_7"]; // Columna J
      const patentCost = Number(row["__EMPTY_8"]); // Columna K
      if (vehicleDesc && !isNaN(patentCost) && patentCost > 0 && vehicleDesc !== "Patentes" && !vehicleDesc.includes("Facturacion") && !vehicleDesc.includes("Costo") && !vehicleDesc.includes("Rentabilidad") && !vehicleDesc.includes("Gastos") && !vehicleDesc.includes("TOTAL")) {
        // Tratar de asociar patente a la flota
        const normalizedPlate = vehicleDesc.replace(/\s+/g, '').toUpperCase();
        let matchedVehicleId: number | undefined = undefined;
        
        // Buscar coincidencia parcial o total
        for (const plate in vehicleMap) {
          if (normalizedPlate.includes(plate) || plate.includes(normalizedPlate)) {
            matchedVehicleId = vehicleMap[plate];
            break;
          }
        }

        importedExpenses.push({
          amount: patentCost,
          description: `Patente del vehículo: ${vehicleDesc.trim()}`,
          categoryId: catMap['impuestos y patentes'],
          paymentMethod: PaymentMethod.CASH,
          vehicleId: matchedVehicleId,
          date: dateOfMayo
        });
      }

      // 3. Gastos generales del depósito (Columna B y C)
      const expenseName = row["08/05/2026"]; // Columna B
      const expenseAmount = Number(row["__EMPTY"]); // Columna C
      if (expenseName && !isNaN(expenseAmount) && expenseAmount > 0) {
        const cleanName = expenseName.trim();
        const lowerName = cleanName.toLowerCase();

        // Omitimos totalizadores y los que ya desglosamos
        if (lowerName === 'total =' || lowerName === 'total' || lowerName === 'sueldos' || lowerName === 'patentes') {
          continue;
        }

        importedExpenses.push({
          amount: expenseAmount,
          description: cleanName,
          categoryId: getCatId(cleanName),
          paymentMethod: cleanName.includes('Bancarios') || cleanName.includes('IVA') ? PaymentMethod.BANK_TRANSFER : PaymentMethod.CASH,
          date: dateOfMayo
        });
      }
    }

    if (importedExpenses.length === 0) {
      res.status(400).json({ status: 'error', message: 'No se encontraron gastos procesables en el Excel.' });
      return;
    }

    // Insertar en la base de datos de manera atómica
    const insertedCount = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const exp of importedExpenses) {
        await tx.expense.create({
          data: {
            amount: exp.amount,
            date: exp.date,
            description: exp.description,
            categoryId: exp.categoryId,
            userId,
            paymentMethod: exp.paymentMethod,
            vehicleId: exp.vehicleId
          }
        });
        count++;
      }
      return count;
    });

    // Registrar en auditoría
    await logAudit({
      userId,
      action: 'IMPORT_EXPENSES_EXCEL',
      entityType: 'Expense',
      entityId: 0,
      newValues: { count: insertedCount, month: 'Mayo 2026' }
    });

    res.status(200).json({
      status: 'success',
      message: `Se importaron con éxito ${insertedCount} registros de gastos correspondientes a Mayo de 2026.`,
      data: { count: insertedCount }
    });

  } catch (error: any) {
    console.error('Error al importar gastos desde Excel:', error);
    res.status(500).json({ status: 'error', message: 'Error interno al procesar el archivo Excel.' });
  }
}

/**
 * Registrar un lote (bulk) de gastos clonados o creados masivamente en una sola transacción.
 */
export async function createBulkExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { expenses, targetDate } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  if (!Array.isArray(expenses) || expenses.length === 0) {
    res.status(400).json({ status: 'error', message: 'Debe enviar al menos un gasto para registrar en lote.' });
    return;
  }

  const defaultExpenseDate = targetDate ? new Date(targetDate) : new Date();

  try {
    const insertedExpenses = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of expenses) {
        const expAmount = Number(item.amount);
        if (isNaN(expAmount) || expAmount <= 0) continue;
        if (!item.categoryId || !item.description?.trim()) continue;

        let transactionId: number | undefined = undefined;
        const itemDate = item.date ? new Date(item.date) : defaultExpenseDate;
        const paymentMethod = (item.paymentMethod as PaymentMethod) || PaymentMethod.CASH;

        // Registrar transacción de caja o banco si está especificado el origen de fondos
        if (paymentMethod === PaymentMethod.CASH && item.cashDrawerId) {
          const activeDrawer = await tx.cashDrawer.findUnique({
            where: { id: Number(item.cashDrawerId) }
          });
          if (activeDrawer && activeDrawer.status === 'OPEN') {
            const trans = await tx.transaction.create({
              data: {
                userId,
                billingType: (item.billingType as BillingType) || (activeDrawer.branch === 'A' ? BillingType.OFFICIAL : BillingType.INTERNAL),
                type: TransactionType.OUTCOME,
                paymentMethod: PaymentMethod.CASH,
                amount: expAmount,
                description: `Gasto (Clonado): ${item.description.trim()}`,
                cashDrawerId: activeDrawer.id,
                verified: true
              }
            });
            transactionId = trans.id;
          }
        } else if (paymentMethod === PaymentMethod.BANK_TRANSFER && item.bankAccountId) {
          const bankAcc = await tx.bankAccount.findUnique({
            where: { id: Number(item.bankAccountId) }
          });
          if (bankAcc) {
            await tx.bankAccount.update({
              where: { id: bankAcc.id },
              data: { balance: { decrement: expAmount } }
            });
            const trans = await tx.transaction.create({
              data: {
                userId,
                billingType: (item.billingType as BillingType) || BillingType.INTERNAL,
                type: TransactionType.OUTCOME,
                paymentMethod: PaymentMethod.BANK_TRANSFER,
                amount: expAmount,
                description: `Gasto (Clonado): ${item.description.trim()}`,
                bankAccountId: bankAcc.id,
                verified: true
              }
            });
            transactionId = trans.id;
          }
        }

        const exp = await tx.expense.create({
          data: {
            amount: expAmount,
            date: itemDate,
            description: item.description.trim(),
            categoryId: Number(item.categoryId),
            userId,
            paymentMethod,
            cashDrawerId: item.cashDrawerId ? Number(item.cashDrawerId) : undefined,
            bankAccountId: item.bankAccountId ? Number(item.bankAccountId) : undefined,
            vehicleId: item.vehicleId ? Number(item.vehicleId) : undefined,
            transactionId
          },
          include: { category: true }
        });
        results.push(exp);
      }

      return results;
    });

    await logAudit({
      userId,
      action: 'BULK_CREATE_EXPENSES',
      entityType: 'Expense',
      entityId: 0,
      newValues: { count: insertedExpenses.length, targetDate }
    });

    res.status(201).json({
      status: 'success',
      message: `Se crearon ${insertedExpenses.length} gastos con éxito.`,
      data: { count: insertedExpenses.length, expenses: insertedExpenses }
    });
  } catch (error: any) {
    console.error('Error al registrar lote de gastos:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Error al guardar el lote de gastos.' });
  }
}

