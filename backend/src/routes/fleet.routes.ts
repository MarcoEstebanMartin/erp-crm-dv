import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  createMaintenance,
  createExpiry,
  updateExpiry,
  deleteMaintenance,
  deleteExpiry,
} from '../controllers/fleet.controller';
import {
  getFuelLogs,
  createFuelLog,
  deleteFuelLog,
  getFuelAnalytics,
} from '../controllers/fuel.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();

router.use(authenticateJWT);

const canOperateFleet = requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO]);
const canAdminFleet = requireRole([Role.ADMIN, Role.FACTURACION]);

// Vehículos
router.get('/', getVehicles);
router.post('/', canAdminFleet, createVehicle);
router.put('/:id', canAdminFleet, updateVehicle);
router.delete('/:id', canAdminFleet, deleteVehicle);

// Combustible
router.get('/fuel', getFuelLogs);
router.get('/fuel/analytics', getFuelAnalytics);
router.post('/fuel', canOperateFleet, createFuelLog);
router.delete('/fuel/:id', canAdminFleet, deleteFuelLog);

// Mantenimientos
router.post('/:id/maintenances', canOperateFleet, createMaintenance);
router.delete('/maintenances/:id', canAdminFleet, deleteMaintenance);

// Vencimientos de documentación
router.post('/:id/expirations', canOperateFleet, createExpiry);
router.put('/expirations/:id', canOperateFleet, updateExpiry);
router.delete('/expirations/:id', canAdminFleet, deleteExpiry);

export default router;
