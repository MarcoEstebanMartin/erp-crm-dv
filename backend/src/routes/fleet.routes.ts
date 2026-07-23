import { Router } from 'express';
import { 
  getVehicles, 
  createVehicle, 
  updateVehicle, 
  deleteVehicle, 
  createMaintenance, 
  createExpiry, 
  deleteMaintenance, 
  deleteExpiry 
} from '../controllers/fleet.controller';
import {
  getFuelLogs,
  createFuelLog,
  deleteFuelLog,
  getFuelAnalytics
} from '../controllers/fuel.controller';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

// Todas las rutas de la flota requieren token activo
router.use(authenticateJWT);

// Rutas generales de vehículos
router.get('/', getVehicles);
router.post('/', createVehicle);
router.put('/:id', updateVehicle);
router.delete('/:id', deleteVehicle);

// Rutas para cargas de combustible y analíticas de rendimiento
router.get('/fuel', getFuelLogs);
router.get('/fuel/analytics', getFuelAnalytics);
router.post('/fuel', createFuelLog);
router.delete('/fuel/:id', deleteFuelLog);

// Rutas para mantenimientos y gastos de flota
router.post('/:id/maintenances', createMaintenance);
router.delete('/maintenances/:id', deleteMaintenance);

// Rutas para vencimientos de documentación
router.post('/:id/expirations', createExpiry);
router.delete('/expirations/:id', deleteExpiry);

export default router;
