import { Router } from 'express';
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
  createDocument
} from '../controllers/hr.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Empleados
router.get('/employees', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), getEmployees);
router.get('/employees/:id', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), getEmployeeById);
router.post('/employees', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), createEmployee);
router.put('/employees/:id', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), updateEmployee);
router.delete('/employees/:id', authenticateJWT, requireRole([Role.ADMIN]), deleteEmployee);

// Vales y Adelantos
router.get('/advances', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), getAdvances);
router.post('/advances', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), createAdvance);

// Liquidaciones de Sueldo (Payroll)
router.get('/payrolls', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), getPayrolls);
router.get('/payrolls/calculate', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), calculatePayroll);
router.post('/payrolls', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), createPayroll);

// Vacaciones y Licencias
router.get('/vacations', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), getVacations);
router.post('/vacations', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), createVacation);
router.put('/vacations/:id/status', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), updateVacationStatus);

// Documentos y Vencimientos
router.get('/documents', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), getDocuments);
router.post('/documents', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), createDocument);

export default router;
