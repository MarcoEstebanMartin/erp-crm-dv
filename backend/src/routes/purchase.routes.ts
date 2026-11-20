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
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { validateRequest } from '../middlewares/validateRequest';
import {
  confirmDocumentSchema,
  createPurchaseOrderSchema,
  receivePurchaseOrderSchema,
} from '../validators/purchase.validator';

const ALLOWED_OCR_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_OCR_MIMES.has(file.mimetype)) {
      cb(new Error('Tipo de archivo no permitido. Solo se aceptan PDF, JPG, PNG o WEBP.'));
      return;
    }
    cb(null, true);
  },
});

router.use(authenticateJWT);

const adminOrBilling = requireRole([Role.ADMIN, Role.FACTURACION]);
const warehouseOrAdmin = requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO]);

router.get('/', warehouseOrAdmin, getPurchaseOrders);
router.post('/', adminOrBilling, validateRequest(createPurchaseOrderSchema), idempotencyGuard, createPurchaseOrder);
router.post(
  '/:id/receive',
  warehouseOrAdmin,
  validateRequest(receivePurchaseOrderSchema),
  idempotencyGuard,
  receivePurchaseOrder,
);

// IA OCR de facturas de proveedores
router.post('/upload-document', adminOrBilling, upload.single('file'), uploadDocument);
router.post(
  '/confirm-document',
  adminOrBilling,
  validateRequest(confirmDocumentSchema),
  idempotencyGuard,
  confirmDocument,
);

export default router;
