import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';

export interface VacationFilters {
  employeeId?: string;
  year?: string;
  status?: string;
}

export interface CreateVacationInput {
  employeeId: number | string;
  year?: number | string;
  tramo?: number | string;
  type?: string | null;
  startDate: string | Date;
  endDate: string | Date;
  daysCount?: number | string;
  comments?: string | null;
}

export interface CreateDocumentInput {
  employeeId: number | string;
  type: string;
  description: string;
  expirationDate: string | Date;
}

const MS_PER_DAY = 1000 * 3600 * 24;

export const hrLeaveDocService = {
  async getVacations(filters: VacationFilters) {
    const where: Record<string, unknown> = {};
    if (filters.employeeId) where.employeeId = Number(filters.employeeId);
    if (filters.year) where.year = Number(filters.year);
    if (filters.status) where.status = filters.status;

    return prisma.employeeVacation.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            department: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  },

  async createVacation(input: CreateVacationInput) {
    if (!input.employeeId || !input.startDate || !input.endDate) {
      throw new AppError('Empleado, fecha de inicio y fecha de fin son requeridos', 400);
    }

    const empId = Number(input.employeeId);
    const employee = await prisma.employee.findUnique({ where: { id: empId } });
    if (!employee) {
      throw new AppError('Empleado no encontrado', 404);
    }
    if (employee.employmentType === 'MONOTRIBUTISTA') {
      throw new AppError('Los empleados monotributistas no tienen vacaciones registradas.', 400);
    }

    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (end.getTime() < start.getTime()) {
      throw new AppError('La fecha de fin no puede ser anterior a la fecha de inicio', 400);
    }

    const calculatedDays = input.daysCount
      ? Number(input.daysCount)
      : Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;

    const tramo = Number(input.tramo) === 2 ? 2 : 1;

    return prisma.employeeVacation.create({
      data: {
        employeeId: empId,
        year: input.year ? Number(input.year) : start.getFullYear() - 1,
        tramo,
        type: (input.type as any) || 'VACATION',
        startDate: start,
        endDate: end,
        daysCount: calculatedDays,
        comments: input.comments || null,
        status: 'APPROVED',
      },
      include: {
        employee: true,
      },
    });
  },

  async updateVacationStatus(id: number, status: string) {
    if (!Number.isInteger(id) || id <= 0 || !status) {
      throw new AppError('ID y estado son requeridos', 400);
    }

    return prisma.employeeVacation.update({
      where: { id },
      data: { status: status as any },
    });
  },

  async deleteVacation(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID de vacación inválido', 400);
    }
    const existing = await prisma.employeeVacation.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Registro de vacaciones no encontrado', 404);
    }
    await prisma.employeeVacation.delete({ where: { id } });
    return { id };
  },

  async getDocuments(employeeId?: string) {
    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = Number(employeeId);

    return prisma.employeeDocument.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, position: true },
        },
      },
      orderBy: { expirationDate: 'asc' },
    });
  },

  async createDocument(input: CreateDocumentInput) {
    if (!input.employeeId || !input.type || !input.description || !input.expirationDate) {
      throw new AppError('Todos los campos son obligatorios', 400);
    }

    return prisma.employeeDocument.create({
      data: {
        employeeId: Number(input.employeeId),
        type: input.type,
        description: input.description,
        expirationDate: new Date(input.expirationDate),
      },
    });
  },
};
