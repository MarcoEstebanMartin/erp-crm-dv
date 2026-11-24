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
  deleteAdvance,
  calculatePayroll,
  createPayroll,
  getPayrolls,
  getVacations,
  createVacation,
  updateVacationStatus,
  deleteVacation,
  getDocuments,
  createDocument,
} from '../controllers/hr.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
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
const onlyAdmin = requireRole([Role.ADMIN]);

// Empleados (exclusivo ADMIN)
router.get('/employees', authenticateJWT, onlyAdmin, getEmployees);
router.get('/employees/:id', authenticateJWT, onlyAdmin, validateRequest(employeeIdParamSchema), getEmployeeById);
router.post('/employees', authenticateJWT, onlyAdmin, validateRequest(createEmployeeSchema), createEmployee);
router.put('/employees/:id', authenticateJWT, onlyAdmin, validateRequest(updateEmployeeSchema), updateEmployee);
router.delete('/employees/:id', authenticateJWT, onlyAdmin, validateRequest(employeeIdParamSchema), deleteEmployee);

// Retiros / Adelantos (exclusivo ADMIN)
router.get('/advances', authenticateJWT, onlyAdmin, getAdvances);
router.post('/advances', authenticateJWT, onlyAdmin, validateRequest(createAdvanceSchema), idempotencyGuard, createAdvance);
router.delete('/advances/:id', authenticateJWT, onlyAdmin, validateRequest(employeeIdParamSchema), deleteAdvance);

// Liquidaciones de Sueldo (Payroll - exclusivo ADMIN)
router.get('/payrolls', authenticateJWT, onlyAdmin, getPayrolls);
router.get('/payrolls/calculate', authenticateJWT, onlyAdmin, validateRequest(calculatePayrollQuerySchema), calculatePayroll);
router.post('/payrolls', authenticateJWT, onlyAdmin, validateRequest(createPayrollSchema), idempotencyGuard, createPayroll);

// Vacaciones y Licencias (exclusivo ADMIN)
router.get('/vacations', authenticateJWT, onlyAdmin, getVacations);
router.post('/vacations', authenticateJWT, onlyAdmin, validateRequest(createVacationSchema), createVacation);
router.put('/vacations/:id/status', authenticateJWT, onlyAdmin, validateRequest(updateVacationStatusSchema), updateVacationStatus);
router.delete('/vacations/:id', authenticateJWT, onlyAdmin, validateRequest(employeeIdParamSchema), deleteVacation);

// Documentos y Vencimientos (exclusivo ADMIN)
router.get('/documents', authenticateJWT, onlyAdmin, getDocuments);
router.post('/documents', authenticateJWT, onlyAdmin, validateRequest(createDocumentSchema), createDocument);

export default router;
