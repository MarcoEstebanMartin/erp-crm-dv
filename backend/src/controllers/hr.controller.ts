import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import AppError from '../utils/AppError';
import { employeeService } from '../services/hr/employee.service';
import { salaryAdvanceService } from '../services/hr/salary-advance.service';
import { payrollService } from '../services/hr/payroll.service';
import { hrLeaveDocService } from '../services/hr/hr-leave-doc.service';

function handleHrError(res: Response, error: unknown, fallbackMessage: string): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ status: 'error', message: error.message });
    return;
  }
  console.error(fallbackMessage, error);
  res.status(500).json({ status: 'error', message: fallbackMessage });
}

const strParam = (val: unknown): string | undefined => (typeof val === 'string' ? val : undefined);

export async function getEmployees(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await employeeService.getEmployees({
      department: strParam(req.query.department),
      position: strParam(req.query.position),
      active: strParam(req.query.active),
      search: strParam(req.query.search),
    });
    res.json({ status: 'success', data });
  } catch (error) {
    handleHrError(res, error, 'Error al obtener la lista de empleados');
  }
}

export async function getEmployeeById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await employeeService.getEmployeeById(Number(req.params.id));
    res.json({ status: 'success', data });
  } catch (error) {
    handleHrError(res, error, 'Error al obtener datos del empleado');
  }
}

export async function createEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await employeeService.createEmployee(req.body, req.user?.id);
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    handleHrError(res, error, 'Error al registrar el empleado');
  }
}

export async function updateEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await employeeService.updateEmployee(Number(req.params.id), req.body, req.user?.id);
    res.json({ status: 'success', data });
  } catch (error) {
    handleHrError(res, error, 'Error al actualizar datos del empleado');
  }
}

export async function deleteEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await employeeService.deleteEmployee(Number(req.params.id));
    res.json({ status: 'success', data, message: 'Empleado desactivado correctamente' });
  } catch (error) {
    handleHrError(res, error, 'Error al desactivar el empleado');
  }
}

export async function getAdvances(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await salaryAdvanceService.getAdvances({
      employeeId: strParam(req.query.employeeId),
      status: strParam(req.query.status),
    });
    res.json({ status: 'success', data });
  } catch (error) {
    handleHrError(res, error, 'Error al obtener adelantos de sueldo');
  }
}

export async function createAdvance(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await salaryAdvanceService.createAdvance({ ...req.body, actorUserId: req.user?.id });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    handleHrError(res, error, 'Error al registrar el adelanto de sueldo');
  }
}

export async function calculatePayroll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await payrollService.calculatePayroll({
      employeeId: strParam(req.query.employeeId),
      periodMonth: strParam(req.query.periodMonth),
      periodYear: strParam(req.query.periodYear),
    });
    res.json({ status: 'success', data });
  } catch (error) {
    handleHrError(res, error, 'Error al calcular la liquidación de sueldo');
  }
}

export async function createPayroll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await payrollService.createPayroll({ ...req.body, actorUserId: req.user?.id });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    handleHrError(res, error, 'Error al procesar la liquidación');
  }
}

export async function getPayrolls(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await payrollService.getPayrolls({
      periodMonth: strParam(req.query.periodMonth),
      periodYear: strParam(req.query.periodYear),
      employeeId: strParam(req.query.employeeId),
    });
    res.json({ status: 'success', data });
  } catch (error) {
    handleHrError(res, error, 'Error al consultar historial de liquidaciones');
  }
}

export async function getVacations(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await hrLeaveDocService.getVacations({
      employeeId: strParam(req.query.employeeId),
      year: strParam(req.query.year),
      status: strParam(req.query.status),
    });
    res.json({ status: 'success', data });
  } catch (error) {
    handleHrError(res, error, 'Error al obtener registro de vacaciones y licencias');
  }
}

export async function createVacation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await hrLeaveDocService.createVacation(req.body);
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    handleHrError(res, error, 'Error al registrar vacación o licencia');
  }
}

export async function updateVacationStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await hrLeaveDocService.updateVacationStatus(Number(req.params.id), req.body.status);
    res.json({ status: 'success', data });
  } catch (error) {
    handleHrError(res, error, 'Error al actualizar el estado de la vacación');
  }
}

export async function getDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await hrLeaveDocService.getDocuments(strParam(req.query.employeeId));
    res.json({ status: 'success', data });
  } catch (error) {
    handleHrError(res, error, 'Error al obtener documentos del personal');
  }
}

export async function createDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await hrLeaveDocService.createDocument(req.body);
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    handleHrError(res, error, 'Error al registrar el documento');
  }
}
