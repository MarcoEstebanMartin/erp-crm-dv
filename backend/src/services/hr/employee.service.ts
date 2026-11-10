import { PaymentMethod } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { NumericInput, roundToTwoDecimals } from '../../core/money';

export const SAFE_EMPLOYEE_USER_SELECT = {
  id: true,
  username: true,
  role: true,
  isActive: true,
} as const;

export interface EmployeeFilters {
  department?: string;
  position?: string;
  active?: string;
  search?: string;
}

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  dni: string;
  cuil?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  position: string;
  department?: string | null;
  hireDate: string | Date;
  baseSalary: NumericInput;
  paymentMethod?: PaymentMethod | string | null;
  cbuAlias?: string | null;
  bankName?: string | null;
  birthDate?: string | Date | null;
  emergencyContact?: string | null;
  notes?: string | null;
  userId?: number | string | null;
}

export const employeeService = {
  async getEmployees(filters: EmployeeFilters) {
    const where: Record<string, unknown> = {};

    if (filters.active !== undefined && filters.active !== '') {
      where.isActive = filters.active === 'true';
    }
    if (filters.department) {
      where.department = filters.department;
    }
    if (filters.position) {
      where.position = filters.position;
    }
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { dni: { contains: filters.search, mode: 'insensitive' } },
        { position: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return prisma.employee.findMany({
      where,
      include: {
        user: { select: SAFE_EMPLOYEE_USER_SELECT },
        advances: {
          where: { status: 'PENDING' },
          orderBy: { date: 'desc' },
        },
        vacations: {
          orderBy: { startDate: 'desc' },
          take: 5,
        },
        documents: {
          orderBy: { expirationDate: 'asc' },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  },

  async getEmployeeById(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID de empleado inválido', 400);
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: { select: SAFE_EMPLOYEE_USER_SELECT },
        advances: { orderBy: { date: 'desc' } },
        payrolls: { orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }] },
        vacations: { orderBy: { startDate: 'desc' } },
        documents: { orderBy: { expirationDate: 'asc' } },
      },
    });

    if (!employee) {
      throw new AppError('Empleado no encontrado', 404);
    }

    return employee;
  },

  async createEmployee(input: CreateEmployeeInput, actorUserId?: number) {
    const {
      firstName,
      lastName,
      dni,
      position,
      hireDate,
      baseSalary,
    } = input;

    if (!firstName || !lastName || !dni || !position || !hireDate || baseSalary === undefined) {
      throw new AppError(
        'Nombre, Apellido, DNI, Puesto, Fecha de ingreso y Sueldo básico son requeridos',
        400,
      );
    }

    const existing = await prisma.employee.findUnique({ where: { dni } });
    if (existing) {
      throw new AppError('Ya existe un empleado registrado con ese DNI', 400);
    }

    const normalizedBaseSalary = roundToTwoDecimals(baseSalary);
    if (normalizedBaseSalary.lt(0)) {
      throw new AppError('El sueldo básico no puede ser negativo', 400);
    }

    const parsedUserId =
      input.userId !== undefined && input.userId !== null && input.userId !== ''
        ? Number(input.userId)
        : null;

    const employee = await prisma.employee.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dni: dni.trim(),
        cuil: input.cuil || null,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        position: position.trim(),
        department: input.department || 'OPERACIONES',
        hireDate: new Date(hireDate),
        baseSalary: normalizedBaseSalary.toNumber(),
        paymentMethod: (input.paymentMethod as PaymentMethod) || PaymentMethod.BANK_TRANSFER,
        cbuAlias: input.cbuAlias || null,
        bankName: input.bankName || null,
        birthDate: input.birthDate ? new Date(input.birthDate) : null,
        emergencyContact: input.emergencyContact || null,
        notes: input.notes || null,
        userId: parsedUserId,
      },
      include: {
        user: { select: SAFE_EMPLOYEE_USER_SELECT },
      },
    });

    if (actorUserId) {
      await logAudit({
        userId: actorUserId,
        action: 'CREATE_EMPLOYEE',
        entityType: 'Employee',
        entityId: employee.id,
        newValues: employee,
        status: 'SUCCESS',
      });
    }

    return employee;
  },

  async updateEmployee(id: number, rawData: Record<string, any>, actorUserId?: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID de empleado inválido', 400);
    }

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Empleado no encontrado', 404);
    }

    const data: Record<string, any> = { ...rawData };
    if (data.hireDate) data.hireDate = new Date(data.hireDate);
    if (data.birthDate) data.birthDate = new Date(data.birthDate);
    else if (data.birthDate === '') data.birthDate = null;

    if (data.baseSalary !== undefined) {
      const salaryDec = roundToTwoDecimals(data.baseSalary);
      if (salaryDec.lt(0)) {
        throw new AppError('El sueldo básico no puede ser negativo', 400);
      }
      data.baseSalary = salaryDec.toNumber();
    }

    if (data.userId !== undefined) {
      data.userId = data.userId ? Number(data.userId) : null;
    }

    const updated = await prisma.employee.update({
      where: { id },
      data,
      include: {
        user: { select: SAFE_EMPLOYEE_USER_SELECT },
      },
    });

    if (actorUserId) {
      await logAudit({
        userId: actorUserId,
        action: 'UPDATE_EMPLOYEE',
        entityType: 'Employee',
        entityId: id,
        oldValues: existing,
        newValues: updated,
        status: 'SUCCESS',
      });
    }

    return updated;
  },

  async deleteEmployee(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID inválido', 400);
    }

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Empleado no encontrado', 404);
    }

    return prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
