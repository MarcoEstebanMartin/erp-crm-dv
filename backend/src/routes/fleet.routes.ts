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
import { validateRequest } from '../middlewares/validateRequest';
import {
  createExpirySchema,
  createMaintenanceSchema,
  createVehicleSchema,
  fleetIdParamSchema,
  updateExpirySchema,
  updateVehicleSchema,
} from '../validators/fleet.validator';

const router = Router();

router.use(authenticateJWT);

const canOperateFleet = requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO]);
const canAdminFleet = requireRole([Role.ADMIN, Role.FACTURACION]);

// Vehículos
router.get('/', getVehicles);
router.post('/', canAdminFleet, validateRequest(createVehicleSchema), createVehicle);
router.put('/:id', canAdminFleet, validateRequest(updateVehicleSchema), updateVehicle);
router.delete('/:id', canAdminFleet, validateRequest(fleetIdParamSchema), deleteVehicle);

// Combustible
router.get('/fuel', getFuelLogs);
router.get('/fuel/analytics', getFuelAnalytics);
router.post('/fuel', canOperateFleet, createFuelLog);
router.delete('/fuel/:id', canAdminFleet, deleteFuelLog);

// Mantenimientos
router.post(
  '/:id/maintenances',
  canOperateFleet,
  validateRequest(createMaintenanceSchema),
  createMaintenance,
);
router.delete(
  '/maintenances/:id',
  canAdminFleet,
  validateRequest(fleetIdParamSchema),
  deleteMaintenance,
);

// Vencimientos de documentación
router.post(
  '/:id/expirations',
  canOperateFleet,
  validateRequest(createExpirySchema),
  createExpiry,
);
router.put(
  '/expirations/:id',
  canOperateFleet,
  validateRequest(updateExpirySchema),
  updateExpiry,
);
router.delete(
  '/expirations/:id',
  canAdminFleet,
  validateRequest(fleetIdParamSchema),
  deleteExpiry,
);

export default router;
