import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getAdvances,
  createAdvance,
  calculatePayroll,
  createPayroll,
  getPayrolls,
  getVacations,
  createVacation,
  updateVacationStatus,
  getDocuments,
  createDocument,
} from '../controllers/hr.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  employeeIdParamSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  createAdvanceSchema,
  calculatePayrollQuerySchema,
  createPayrollSchema,
  createVacationSchema,
  updateVacationStatusSchema,
  createDocumentSchema,
} from '../validators/hr.validator';

const router = Router();
const canManageHr = requireRole([Role.ADMIN, Role.FACTURACION]);

// Empleados
router.get('/employees', authenticateJWT, canManageHr, getEmployees);
router.get('/employees/:id', authenticateJWT, canManageHr, validateRequest(employeeIdParamSchema), getEmployeeById);
router.post('/employees', authenticateJWT, canManageHr, validateRequest(createEmployeeSchema), createEmployee);
router.put('/employees/:id', authenticateJWT, canManageHr, validateRequest(updateEmployeeSchema), updateEmployee);
router.delete('/employees/:id', authenticateJWT, requireRole([Role.ADMIN]), validateRequest(employeeIdParamSchema), deleteEmployee);

// Adelantos
router.get('/advances', authenticateJWT, canManageHr, getAdvances);
router.post('/advances', authenticateJWT, canManageHr, validateRequest(createAdvanceSchema), createAdvance);

// Liquidaciones de Sueldo (Payroll)
router.get('/payrolls', authenticateJWT, canManageHr, getPayrolls);
router.get('/payrolls/calculate', authenticateJWT, canManageHr, validateRequest(calculatePayrollQuerySchema), calculatePayroll);
router.post('/payrolls', authenticateJWT, canManageHr, validateRequest(createPayrollSchema), createPayroll);

// Vacaciones y Licencias
router.get('/vacations', authenticateJWT, canManageHr, getVacations);
router.post('/vacations', authenticateJWT, canManageHr, validateRequest(createVacationSchema), createVacation);
router.put('/vacations/:id/status', authenticateJWT, canManageHr, validateRequest(updateVacationStatusSchema), updateVacationStatus);

// Documentos y Vencimientos
router.get('/documents', authenticateJWT, canManageHr, getDocuments);
router.post('/documents', authenticateJWT, canManageHr, validateRequest(createDocumentSchema), createDocument);

export default router;
