import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getSalesInvoices,
  getSupplierInvoices,
  createSupplierInvoice,
  deleteSupplierInvoice,
  getTaxWithholdings,
  createTaxWithholding,
} from '../controllers/billing.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createSupplierInvoiceSchema,
  createTaxWithholdingSchema,
  supplierInvoiceIdParamSchema,
} from '../validators/billing.validator';

const router = Router();

router.use(authenticateJWT);

router.get('/sales', requireRole([Role.ADMIN, Role.FACTURACION]), getSalesInvoices);
router.get('/purchases', requireRole([Role.ADMIN, Role.FACTURACION]), getSupplierInvoices);
router.post(
  '/purchases',
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(createSupplierInvoiceSchema),
  createSupplierInvoice,
);
router.delete(
  '/purchases/:id',
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(supplierInvoiceIdParamSchema),
  deleteSupplierInvoice,
);

router.get('/tax-withholdings', requireRole([Role.ADMIN, Role.FACTURACION]), getTaxWithholdings);
router.post(
  '/tax-withholdings',
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(createTaxWithholdingSchema),
  createTaxWithholding,
);

export default router;
