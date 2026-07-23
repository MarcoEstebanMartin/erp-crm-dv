import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { logAudit } from '../utils/audit';
import { BillingType, PaymentMethod, TransactionType } from '@prisma/client';

/**
 * Obtener todos los empleados con filtros opcionales
 */
export async function getEmployees(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { department, position, active, search } = req.query;

    const where: any = {};

    if (active !== undefined && active !== '') {
      where.isActive = active === 'true';
    }

    if (department && typeof department === 'string') {
      where.department = department;
    }

    if (position && typeof position === 'string') {
      where.position = position;
    }

    if (search && typeof search === 'string') {
      const searchStr = search as string;
      where.OR = [
        { firstName: { contains: searchStr, mode: 'insensitive' } },
        { lastName: { contains: searchStr, mode: 'insensitive' } },
        { dni: { contains: searchStr, mode: 'insensitive' } },
        { position: { contains: searchStr, mode: 'insensitive' } },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, role: true } },
        advances: {
          where: { status: 'PENDING' },
          orderBy: { date: 'desc' }
        },
        vacations: {
          orderBy: { startDate: 'desc' },
          take: 5
        },
        documents: {
          orderBy: { expirationDate: 'asc' }
        }
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });

    res.json({ status: 'success', data: employees });
  } catch (error: any) {
    console.error('Error al obtener empleados:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener la lista de empleados' });
  }
}

/**
 * Obtener un empleado por ID con todo su historial
 */
export async function getEmployeeById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ status: 'error', message: 'ID de empleado inválido' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, role: true } },
        advances: { orderBy: { date: 'desc' } },
        payrolls: { orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }] },
        vacations: { orderBy: { startDate: 'desc' } },
        documents: { orderBy: { expirationDate: 'asc' } }
      }
    });

    if (!employee) {
      res.status(404).json({ status: 'error', message: 'Empleado no encontrado' });
      return;
    }

    res.json({ status: 'success', data: employee });
  } catch (error: any) {
    console.error('Error al obtener empleado:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener datos del empleado' });
  }
}

/**
 * Crear un nuevo empleado (Legajo)
 */
export async function createEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const {
      firstName,
      lastName,
      dni,
      cuil,
      email,
      phone,
      address,
      position,
      department,
      hireDate,
      baseSalary,
      paymentMethod,
      cbuAlias,
      bankName,
      birthDate,
      emergencyContact,
      notes,
      userId
    } = req.body;

    if (!firstName || !lastName || !dni || !position || !hireDate || baseSalary === undefined) {
      res.status(400).json({ status: 'error', message: 'Nombre, Apellido, DNI, Puesto, Fecha de ingreso y Sueldo básico son requeridos' });
      return;
    }

    const existing = await prisma.employee.findUnique({ where: { dni } });
    if (existing) {
      res.status(400).json({ status: 'error', message: 'Ya existe un empleado registrado con ese DNI' });
      return;
    }

    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        dni,
        cuil: cuil || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        position,
        department: department || 'OPERACIONES',
        hireDate: new Date(hireDate),
        baseSalary: parseFloat(baseSalary),
        paymentMethod: paymentMethod || 'BANK_TRANSFER',
        cbuAlias: cbuAlias || null,
        bankName: bankName || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        emergencyContact: emergencyContact || null,
        notes: notes || null,
        userId: userId ? parseInt(userId) : null
      }
    });

    if (req.user) {
      await logAudit({
        userId: req.user.id,
        action: 'CREATE_EMPLOYEE',
        entityType: 'Employee',
        entityId: employee.id,
        newValues: employee,
        status: 'SUCCESS'
      });
    }

    res.status(201).json({ status: 'success', data: employee });
  } catch (error: any) {
    console.error('Error al crear empleado:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Error al registrar el empleado' });
  }
}

/**
 * Actualizar datos de un empleado
 */
export async function updateEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ status: 'error', message: 'ID de empleado inválido' });
      return;
    }

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ status: 'error', message: 'Empleado no encontrado' });
      return;
    }

    const data = { ...req.body };
    if (data.hireDate) data.hireDate = new Date(data.hireDate);
    if (data.birthDate) data.birthDate = new Date(data.birthDate);
    if (data.baseSalary !== undefined) data.baseSalary = parseFloat(data.baseSalary);
    if (data.userId !== undefined) data.userId = data.userId ? parseInt(data.userId) : null;

    const updated = await prisma.employee.update({
      where: { id },
      data
    });

    if (req.user) {
      await logAudit({
        userId: req.user.id,
        action: 'UPDATE_EMPLOYEE',
        entityType: 'Employee',
        entityId: id,
        oldValues: existing,
        newValues: updated,
        status: 'SUCCESS'
      });
    }

    res.json({ status: 'success', data: updated });
  } catch (error: any) {
    console.error('Error al actualizar empleado:', error);
    res.status(500).json({ status: 'error', message: 'Error al actualizar datos del empleado' });
  }
}

/**
 * Eliminar / Desactivar empleado
 */
export async function deleteEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ status: 'error', message: 'ID inválido' });
      return;
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ status: 'success', data: employee, message: 'Empleado desactivado correctamente' });
  } catch (error: any) {
    console.error('Error al desactivar empleado:', error);
    res.status(500).json({ status: 'error', message: 'Error al desactivar el empleado' });
  }
}

/**
 * Listar Adelantos de Sueldo
 */
export async function getAdvances(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employeeId, status } = req.query;

    const where: any = {};
    if (employeeId && typeof employeeId === 'string') where.employeeId = parseInt(employeeId);
    if (status && typeof status === 'string') where.status = status;

    const advances = await prisma.salaryAdvance.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, dni: true, position: true }
        },
        cashDrawer: { select: { id: true, branch: true, openedAt: true } },
        bankAccount: { select: { id: true, name: true } },
        transaction: { select: { id: true, receiptNumber: true, amount: true } }
      },
      orderBy: { date: 'desc' }
    });

    res.json({ status: 'success', data: advances });
  } catch (error: any) {
    console.error('Error al obtener adelantos:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener adelantos de sueldo' });
  }
}

/**
 * Crear un Adelanto de Sueldo
 */
export async function createAdvance(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const {
      employeeId,
      amount,
      reason,
      paymentMethod,
      cashDrawerId,
      bankAccountId
    } = req.body;

    if (!employeeId || !amount || parseFloat(amount) <= 0) {
      res.status(400).json({ status: 'error', message: 'Empleado y monto válido son requeridos' });
      return;
    }

    const empId = parseInt(employeeId);
    const advanceAmount = parseFloat(amount);

    const employee = await prisma.employee.findUnique({ where: { id: empId } });
    if (!employee) {
      res.status(404).json({ status: 'error', message: 'Empleado no encontrado' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      let transactionId: number | null = null;

      if (cashDrawerId || bankAccountId) {
        let category = await tx.expenseCategory.findUnique({ where: { name: 'Sueldos' } });
        if (!category) {
          category = await tx.expenseCategory.create({
            data: { name: 'Sueldos', description: 'Sueldos de personal, adelantos y comisiones' }
          });
        }

        const financialTx = await tx.transaction.create({
          data: {
            userId: req.user?.id || 1,
            billingType: BillingType.INTERNAL,
            type: TransactionType.OUTCOME,
            paymentMethod: paymentMethod || PaymentMethod.CASH,
            amount: advanceAmount,
            description: `Adelanto de Sueldo: ${employee.lastName}, ${employee.firstName} - ${reason || 'Adelanto'}`,
            cashDrawerId: cashDrawerId ? parseInt(cashDrawerId) : null,
            bankAccountId: bankAccountId ? parseInt(bankAccountId) : null,
            verified: true
          }
        });

        transactionId = financialTx.id;

        if (bankAccountId) {
          await tx.bankAccount.update({
            where: { id: parseInt(bankAccountId) },
            data: { balance: { decrement: advanceAmount } }
          });
        }

        await tx.expense.create({
          data: {
            amount: advanceAmount,
            description: `Adelanto de Sueldo: ${employee.lastName}, ${employee.firstName}`,
            categoryId: category.id,
            userId: req.user?.id || 1,
            paymentMethod: paymentMethod || PaymentMethod.CASH,
            cashDrawerId: cashDrawerId ? parseInt(cashDrawerId) : null,
            bankAccountId: bankAccountId ? parseInt(bankAccountId) : null,
            transactionId: financialTx.id
          }
        });
      }

      const advance = await tx.salaryAdvance.create({
        data: {
          employeeId: empId,
          amount: advanceAmount,
          reason: reason || 'Adelanto de sueldo',
          paymentMethod: paymentMethod || PaymentMethod.CASH,
          cashDrawerId: cashDrawerId ? parseInt(cashDrawerId) : null,
          bankAccountId: bankAccountId ? parseInt(bankAccountId) : null,
          transactionId
        },
        include: {
          employee: true
        }
      });

      return advance;
    });

    res.status(201).json({ status: 'success', data: result });
  } catch (error: any) {
    console.error('Error al crear adelanto de sueldo:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Error al registrar el adelanto de sueldo' });
  }
}

/**
 * Previsualización / Cálculo de Liquidación de Sueldo
 */
export async function calculatePayroll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employeeId, periodMonth, periodYear } = req.query;

    if (!employeeId || !periodMonth || !periodYear) {
      res.status(400).json({ status: 'error', message: 'employeeId, periodMonth y periodYear son requeridos' });
      return;
    }

    const empId = parseInt(employeeId as string);
    const month = parseInt(periodMonth as string);
    const year = parseInt(periodYear as string);

    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      include: { user: true }
    });

    if (!employee) {
      res.status(404).json({ status: 'error', message: 'Empleado no encontrado' });
      return;
    }

    const pendingAdvances = await prisma.salaryAdvance.findMany({
      where: {
        employeeId: empId,
        status: 'PENDING'
      }
    });

    const totalAdvances = pendingAdvances.reduce((acc, curr) => acc + Number(curr.amount), 0);

    let suggestedCommissions = 0;
    if (employee.userId) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const salesSummary = await prisma.order.aggregate({
        where: {
          sellerId: employee.userId,
          createdAt: { gte: startDate, lte: endDate },
          status: { in: ['PREPARED', 'DELIVERED'] }
        },
        _sum: { totalAmount: true }
      });

      const totalSales = Number(salesSummary._sum.totalAmount || 0);
      if (employee.position.toLowerCase().includes('vendedor')) {
        suggestedCommissions = Math.round(totalSales * 0.015);
      }
    }

    const baseSalary = Number(employee.baseSalary);
    const grossSalary = baseSalary + suggestedCommissions;
    const netSalary = grossSalary - totalAdvances;

    res.json({
      status: 'success',
      data: {
        employee,
        periodMonth: month,
        periodYear: year,
        baseSalary,
        suggestedCommissions,
        pendingAdvances,
        totalAdvances,
        grossSalary,
        netSalary
      }
    });
  } catch (error: any) {
    console.error('Error al calcular liquidación:', error);
    res.status(500).json({ status: 'error', message: 'Error al calcular la liquidación de sueldo' });
  }
}

/**
 * Guardar y Procesar Liquidación de Sueldos (Payroll)
 */
export async function createPayroll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const {
      employeeId,
      periodMonth,
      periodYear,
      baseSalary,
      commissions,
      overtimeAmount,
      bonuses,
      advancesDeduction,
      otherDeductions,
      paymentMethod,
      cashDrawerId,
      bankAccountId,
      notes
    } = req.body;

    if (!employeeId || !periodMonth || !periodYear || baseSalary === undefined) {
      res.status(400).json({ status: 'error', message: 'Empleado, Período (Mes/Año) y Sueldo Básico son requeridos' });
      return;
    }

    const empId = parseInt(employeeId);
    const month = parseInt(periodMonth);
    const year = parseInt(periodYear);

    const base = parseFloat(baseSalary);
    const comms = parseFloat(commissions || 0);
    const overtime = parseFloat(overtimeAmount || 0);
    const bonus = parseFloat(bonuses || 0);
    const advDeduction = parseFloat(advancesDeduction || 0);
    const otherDeducts = parseFloat(otherDeductions || 0);

    const grossSalary = base + comms + overtime + bonus;
    const netSalary = grossSalary - advDeduction - otherDeducts;

    const employee = await prisma.employee.findUnique({ where: { id: empId } });
    if (!employee) {
      res.status(404).json({ status: 'error', message: 'Empleado no encontrado' });
      return;
    }

    const existing = await prisma.payroll.findUnique({
      where: {
        employeeId_periodMonth_periodYear: {
          employeeId: empId,
          periodMonth: month,
          periodYear: year
        }
      }
    });

    if (existing) {
      res.status(400).json({ status: 'error', message: `Ya existe una liquidación para este empleado en el período ${month}/${year}` });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      let transactionId: number | null = null;

      if (cashDrawerId || bankAccountId) {
        let category = await tx.expenseCategory.findUnique({ where: { name: 'Sueldos' } });
        if (!category) {
          category = await tx.expenseCategory.create({
            data: { name: 'Sueldos', description: 'Sueldos de personal y operarios' }
          });
        }

        const financialTx = await tx.transaction.create({
          data: {
            userId: req.user?.id || 1,
            billingType: BillingType.INTERNAL,
            type: TransactionType.OUTCOME,
            paymentMethod: paymentMethod || PaymentMethod.BANK_TRANSFER,
            amount: netSalary,
            description: `Pago Sueldo ${month}/${year}: ${employee.lastName}, ${employee.firstName}`,
            cashDrawerId: cashDrawerId ? parseInt(cashDrawerId) : null,
            bankAccountId: bankAccountId ? parseInt(bankAccountId) : null,
            verified: true
          }
        });

        transactionId = financialTx.id;

        if (bankAccountId) {
          await tx.bankAccount.update({
            where: { id: parseInt(bankAccountId) },
            data: { balance: { decrement: netSalary } }
          });
        }

        await tx.expense.create({
          data: {
            amount: netSalary,
            description: `Sueldo ${month}/${year}: ${employee.lastName}, ${employee.firstName}`,
            categoryId: category.id,
            userId: req.user?.id || 1,
            paymentMethod: paymentMethod || PaymentMethod.BANK_TRANSFER,
            cashDrawerId: cashDrawerId ? parseInt(cashDrawerId) : null,
            bankAccountId: bankAccountId ? parseInt(bankAccountId) : null,
            transactionId: financialTx.id
          }
        });
      }

      const payroll = await tx.payroll.create({
        data: {
          employeeId: empId,
          periodMonth: month,
          periodYear: year,
          baseSalary: base,
          commissions: comms,
          overtimeAmount: overtime,
          bonuses: bonus,
          grossSalary,
          advancesDeduction: advDeduction,
          otherDeductions: otherDeducts,
          netSalary,
          status: (cashDrawerId || bankAccountId) ? 'PAID' : 'APPROVED',
          paymentDate: (cashDrawerId || bankAccountId) ? new Date() : null,
          paymentMethod: paymentMethod || PaymentMethod.BANK_TRANSFER,
          cashDrawerId: cashDrawerId ? parseInt(cashDrawerId) : null,
          bankAccountId: bankAccountId ? parseInt(bankAccountId) : null,
          transactionId,
          notes: notes || null
        }
      });

      if (advDeduction > 0) {
        const pendingAdvances = await tx.salaryAdvance.findMany({
          where: { employeeId: empId, status: 'PENDING' },
          orderBy: { date: 'asc' }
        });

        let remainingToDeduct = advDeduction;
        for (const adv of pendingAdvances) {
          if (remainingToDeduct <= 0) break;
          const currentAdvAmount = Number(adv.amount);
          await tx.salaryAdvance.update({
            where: { id: adv.id },
            data: {
              status: 'DEDUCTED',
              payrollId: payroll.id
            }
          });
          remainingToDeduct -= currentAdvAmount;
        }
      }

      return payroll;
    });

    res.status(201).json({ status: 'success', data: result });
  } catch (error: any) {
    console.error('Error al crear liquidación de sueldo:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Error al procesar la liquidación' });
  }
}

/**
 * Listar Liquidaciones de Sueldo (Payroll)
 */
export async function getPayrolls(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { periodMonth, periodYear, employeeId } = req.query;

    const where: any = {};
    if (periodMonth && typeof periodMonth === 'string') where.periodMonth = parseInt(periodMonth);
    if (periodYear && typeof periodYear === 'string') where.periodYear = parseInt(periodYear);
    if (employeeId && typeof employeeId === 'string') where.employeeId = parseInt(employeeId);

    const payrolls = await prisma.payroll.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, dni: true, position: true, cbuAlias: true, bankName: true }
        },
        advances: true,
        transaction: { select: { id: true, receiptNumber: true } }
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }]
    });

    res.json({ status: 'success', data: payrolls });
  } catch (error: any) {
    console.error('Error al obtener liquidaciones:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar historial de liquidaciones' });
  }
}

/**
 * Listar Vacaciones y Licencias
 */
export async function getVacations(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employeeId, year, status } = req.query;

    const where: any = {};
    if (employeeId && typeof employeeId === 'string') where.employeeId = parseInt(employeeId);
    if (year && typeof year === 'string') where.year = parseInt(year);
    if (status && typeof status === 'string') where.status = status;

    const vacations = await prisma.employeeVacation.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, position: true, department: true }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    res.json({ status: 'success', data: vacations });
  } catch (error: any) {
    console.error('Error al obtener vacaciones:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener registro de vacaciones y licencias' });
  }
}

/**
 * Crear Vacación o Licencia
 */
export async function createVacation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employeeId, year, type, startDate, endDate, daysCount, comments } = req.body;

    if (!employeeId || !startDate || !endDate) {
      res.status(400).json({ status: 'error', message: 'Empleado, fecha de inicio y fecha de fin son requeridos' });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const calculatedDays = daysCount
      ? parseInt(daysCount)
      : Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

    const vacation = await prisma.employeeVacation.create({
      data: {
        employeeId: parseInt(employeeId),
        year: year ? parseInt(year) : start.getFullYear(),
        type: type || 'VACATION',
        startDate: start,
        endDate: end,
        daysCount: calculatedDays,
        comments: comments || null,
        status: 'APPROVED'
      },
      include: {
        employee: true
      }
    });

    res.status(201).json({ status: 'success', data: vacation });
  } catch (error: any) {
    console.error('Error al registrar vacación:', error);
    res.status(500).json({ status: 'error', message: 'Error al registrar vacación o licencia' });
  }
}

/**
 * Actualizar Estado de Vacación
 */
export async function updateVacationStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(String(req.params.id));
    const { status } = req.body;

    if (isNaN(id) || !status) {
      res.status(400).json({ status: 'error', message: 'ID y estado son requeridos' });
      return;
    }

    const updated = await prisma.employeeVacation.update({
      where: { id },
      data: { status }
    });

    res.json({ status: 'success', data: updated });
  } catch (error: any) {
    console.error('Error al actualizar estado de vacación:', error);
    res.status(500).json({ status: 'error', message: 'Error al actualizar el estado de la vacación' });
  }
}

/**
 * Listar / Crear Documentos y Vencimientos
 */
export async function getDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employeeId } = req.query;
    const where: any = {};
    if (employeeId && typeof employeeId === 'string') where.employeeId = parseInt(employeeId);

    const documents = await prisma.employeeDocument.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, position: true } }
      },
      orderBy: { expirationDate: 'asc' }
    });

    res.json({ status: 'success', data: documents });
  } catch (error: any) {
    console.error('Error al obtener documentos:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener documentos del personal' });
  }
}

export async function createDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { employeeId, type, description, expirationDate } = req.body;

    if (!employeeId || !type || !description || !expirationDate) {
      res.status(400).json({ status: 'error', message: 'Todos los campos son obligatorios' });
      return;
    }

    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId: parseInt(employeeId),
        type,
        description,
        expirationDate: new Date(expirationDate)
      }
    });

    res.status(201).json({ status: 'success', data: doc });
  } catch (error: any) {
    console.error('Error al crear documento:', error);
    res.status(500).json({ status: 'error', message: 'Error al registrar el documento' });
  }
}
