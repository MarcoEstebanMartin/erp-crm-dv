import { Router } from 'express';
import {
  registerCollection,
  getReceipt,
  getPendingCollections,
  getPendingRendiciones,
  verifyRendicion
} from '../controllers/collection.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// --- RUTAS MÓVILES (Vendedores / Repartidores) ---
// Obtener saldos/órdenes pendientes para cobrar
router.get('/pending', authenticateJWT, getPendingCollections);
// Registrar un cobro (emite recibo digital)
router.post('/register', authenticateJWT, registerCollection);
// Obtener detalle de un recibo (para compartir)
router.get('/receipt/:id', getReceipt); // Puede ser público o requerir auth dependiendo del diseño

// --- RUTAS ADMINISTRATIVAS (Cajeros) ---
// Obtener rendiciones pendientes agrupadas por vendedor
router.get('/rendiciones', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), getPendingRendiciones);
// Verificar y cerrar una rendición
router.post('/rendiciones/verify', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), verifyRendicion);

export default router;
