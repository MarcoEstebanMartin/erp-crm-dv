import { Router } from 'express';
import multer from 'multer';
import { Role } from '@prisma/client';
import {
  getPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
  uploadDocument,
  confirmDocument,
} from '../controllers/purchase.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import {
  confirmDocumentSchema,
  createPurchaseOrderSchema,
  receivePurchaseOrderSchema,
} from '../validators/purchase.validator';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.use(authenticateJWT);

const adminOrBilling = requireRole([Role.ADMIN, Role.FACTURACION]);
const warehouseOrAdmin = requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO]);

router.get('/', warehouseOrAdmin, getPurchaseOrders);
router.post('/', adminOrBilling, validateRequest(createPurchaseOrderSchema), createPurchaseOrder);
router.post(
  '/:id/receive',
  warehouseOrAdmin,
  validateRequest(receivePurchaseOrderSchema),
  receivePurchaseOrder,
);

// IA OCR de facturas de proveedores
router.post('/upload-document', adminOrBilling, upload.single('file'), uploadDocument);
router.post(
  '/confirm-document',
  adminOrBilling,
  validateRequest(confirmDocumentSchema),
  confirmDocument,
);

export default router;
