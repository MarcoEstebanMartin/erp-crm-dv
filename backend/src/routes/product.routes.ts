import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  adjustStock,
  adjustStockBatch,
  getProductByBarcode,
  importPrices,
  bulkUpdatePrices,
  getProductMovements,
  getGlobalStockMovements,
  getExpiringLots,
  uploadProductImage,
  importProductsZip,
  auditStockDrift,
  reconcileStockDrift,
  clearWmsLocation,
  assignWmsLocation,
  revertPrices,
} from '../controllers/product.controller';
import {
  updateLot,
  deleteLot,
  transferLotStock,
} from '../controllers/lot.controller';
import {
  getCatalogBridgeStatus,
  getLivePriceList,
  pullCatalogFromProduction,
} from '../controllers/catalog-sync.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { Role } from '@prisma/client';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createProductSchema,
  updateProductSchema,
  adjustStockSchema,
  adjustStockBatchSchema,
  assignWmsLocationSchema,
  clearWmsLocationSchema,
  importPricesSchema,
  bulkUpdatePricesSchema,
} from '../validators/product.validator';
import {
  updateLotSchema,
  deleteLotSchema,
  transferLotStockSchema,
} from '../validators/lot.validator';
import { uploadSingleImage, uploadZipFile } from '../middlewares/upload';

const router = Router();

// Rutas accesibles por cualquier usuario autenticado (Vendedor, Depósito, Admin)
router.get('/', authenticateJWT, getProducts);
router.get('/price-list-catalog', authenticateJWT, getLivePriceList);
router.get('/stock/movements', authenticateJWT, getGlobalStockMovements);
router.get('/stock/expiring-lots', authenticateJWT, getExpiringLots);
router.get('/barcode/:barcode', authenticateJWT, getProductByBarcode);

// Puente Unificado de Catálogo e Imágenes ERP <-> donvenancio.com.ar (Solo ADMIN)
router.get('/bridge/status', authenticateJWT, requireRole([Role.ADMIN]), getCatalogBridgeStatus);
router.post(
  '/bridge/pull-from-production',
  authenticateJWT,
  requireRole([Role.ADMIN]),
  idempotencyGuard,
  pullCatalogFromProduction,
);

router.get('/:id', authenticateJWT, getProductById);
router.get('/:id/movements', authenticateJWT, getProductMovements);

// Rutas protegidas para administración de catálogo (Solo ADMIN)
router.post('/', authenticateJWT, requireRole([Role.ADMIN]), validateRequest(createProductSchema), createProduct);
router.post('/import-prices', authenticateJWT, requireRole([Role.ADMIN]), validateRequest(importPricesSchema), importPrices);
router.post('/revert-prices', authenticateJWT, requireRole([Role.ADMIN]), revertPrices);
router.post('/bulk-update-prices', authenticateJWT, requireRole([Role.ADMIN]), validateRequest(bulkUpdatePricesSchema), bulkUpdatePrices);
router.put('/:id', authenticateJWT, requireRole([Role.ADMIN]), validateRequest(updateProductSchema), updateProduct);

// Rutas para imágenes de productos (Solo ADMIN)
router.post('/:id/image', authenticateJWT, requireRole([Role.ADMIN]), uploadSingleImage, uploadProductImage);
router.post('/import-images-zip', authenticateJWT, requireRole([Role.ADMIN]), uploadZipFile, importProductsZip);

// Ajuste de stock individual y masivo atómico (ADMIN y DEPOSITO + Idempotency-Key)
router.post(
  '/adjust-stock-batch',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.DEPOSITO]),
  idempotencyGuard,
  validateRequest(adjustStockBatchSchema),
  adjustStockBatch,
);
router.post(
  '/:id/adjust-stock',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.DEPOSITO]),
  idempotencyGuard,
  validateRequest(adjustStockSchema),
  adjustStock,
);

// Administración de Lotes (ADMIN y DEPOSITO)
router.put('/lots/:lotId', authenticateJWT, requireRole([Role.ADMIN, Role.DEPOSITO]), validateRequest(updateLotSchema), updateLot);
router.delete('/lots/:lotId', authenticateJWT, requireRole([Role.ADMIN]), validateRequest(deleteLotSchema), deleteLot);
router.post(
  '/:productId/lots/transfer',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.DEPOSITO]),
  idempotencyGuard,
  validateRequest(transferLotStockSchema),
  transferLotStock,
);

// Conciliación y Auditoría de Stock (ADMIN y FACTURACION)
router.get('/stock/reconcile-audit', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), auditStockDrift);
router.post('/stock/reconcile', authenticateJWT, requireRole([Role.ADMIN]), idempotencyGuard, reconcileStockDrift);

// Operaciones WMS Seguras Mapa de Depósito (ADMIN, DEPOSITO, FACTURACION)
router.post(
  '/wms/clear-location',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.DEPOSITO, Role.FACTURACION]),
  idempotencyGuard,
  validateRequest(clearWmsLocationSchema),
  clearWmsLocation,
);
router.post(
  '/wms/assign-location',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.DEPOSITO, Role.FACTURACION]),
  idempotencyGuard,
  validateRequest(assignWmsLocationSchema),
  assignWmsLocation,
);

export default router;
