import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  adjustStock,
  getProductByBarcode,
  importPrices,
} from '../controllers/product.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Rutas accesibles por cualquier usuario autenticado (Vendedor, Depósito, Admin)
router.get('/', authenticateJWT, getProducts);
router.get('/barcode/:barcode', authenticateJWT, getProductByBarcode);
router.get('/:id', authenticateJWT, getProductById);

// Rutas protegidas para administración de catálogo (Solo ADMIN)
router.post('/', authenticateJWT, requireRole([Role.ADMIN]), createProduct);
router.post('/import-prices', authenticateJWT, requireRole([Role.ADMIN]), importPrices);
router.put('/:id', authenticateJWT, requireRole([Role.ADMIN]), updateProduct);

router.post('/:id/adjust-stock', authenticateJWT, requireRole([Role.ADMIN, Role.DEPOSITO]), adjustStock);

export default router;
