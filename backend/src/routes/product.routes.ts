import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  adjustStock,
  getProductByBarcode,
  importPrices,
  bulkUpdatePrices,
  getProductMovements,
  getGlobalStockMovements,
  getExpiringLots,
} from '../controllers/product.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';
import { validateRequest } from '../middlewares/validateRequest';
import { 
  createProductSchema, 
  updateProductSchema, 
  adjustStockSchema, 
  importPricesSchema, 
  bulkUpdatePricesSchema 
} from '../validators/product.validator';

const router = Router();

// Rutas accesibles por cualquier usuario autenticado (Vendedor, Depósito, Admin)
router.get('/', authenticateJWT, getProducts);
router.get('/stock/movements', authenticateJWT, getGlobalStockMovements);
router.get('/stock/expiring-lots', authenticateJWT, getExpiringLots);
router.get('/barcode/:barcode', authenticateJWT, getProductByBarcode);
router.get('/:id', authenticateJWT, getProductById);
router.get('/:id/movements', authenticateJWT, getProductMovements);

// Rutas protegidas para administración de catálogo (Solo ADMIN)
router.post('/', authenticateJWT, requireRole([Role.ADMIN]), validateRequest(createProductSchema), createProduct);
router.post('/import-prices', authenticateJWT, requireRole([Role.ADMIN]), validateRequest(importPricesSchema), importPrices);
router.post('/bulk-update-prices', authenticateJWT, requireRole([Role.ADMIN]), validateRequest(bulkUpdatePricesSchema), bulkUpdatePrices);
router.put('/:id', authenticateJWT, requireRole([Role.ADMIN]), validateRequest(updateProductSchema), updateProduct);

// Ajuste de stock (ADMIN y DEPOSITO)
router.post('/:id/adjust-stock', authenticateJWT, requireRole([Role.ADMIN, Role.DEPOSITO]), validateRequest(adjustStockSchema), adjustStock);

export default router;
