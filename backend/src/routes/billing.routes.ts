import { Router } from 'express';
import {
  getSalesInvoices,
  getSupplierInvoices,
  createSupplierInvoice,
  deleteSupplierInvoice,
  getTaxWithholdings,
  createTaxWithholding,
} from '../controllers/billing.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Todas las rutas de facturación requieren autenticación JWT
router.use(authenticateJWT);

// Rutas impositivas accesibles por ADMIN y personal de FACTURACION
router.get('/sales', requireRole([Role.ADMIN, Role.FACTURACION]), getSalesInvoices);
router.get('/purchases', requireRole([Role.ADMIN, Role.FACTURACION]), getSupplierInvoices);
router.post('/purchases', requireRole([Role.ADMIN, Role.FACTURACION]), createSupplierInvoice);
router.delete('/purchases/:id', requireRole([Role.ADMIN, Role.FACTURACION]), deleteSupplierInvoice);

router.get('/tax-withholdings', requireRole([Role.ADMIN, Role.FACTURACION]), getTaxWithholdings);
router.post('/tax-withholdings', requireRole([Role.ADMIN, Role.FACTURACION]), createTaxWithholding);

export default router;
