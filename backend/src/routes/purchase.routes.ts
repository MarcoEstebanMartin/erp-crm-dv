import { Router } from 'express';
import { getPurchaseOrders, createPurchaseOrder, receivePurchaseOrder } from '../controllers/purchase.controller';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

// Todas las rutas requieren token activo
router.use(authenticateJWT);

router.get('/', getPurchaseOrders);
router.post('/', createPurchaseOrder);
router.post('/:id/receive', receivePurchaseOrder);

export default router;
