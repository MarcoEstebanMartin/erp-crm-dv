import { Response } from 'express';
import { MovementType } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { productService } from '../services/product.service';
import { appCache } from '../utils/cache';
import {
  sanitizeProductForRole,
  sanitizeProductListForRole,
} from '../utils/product-sanitizer.util';

export async function getProducts(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { search, all } = req.query;
  const userRole = req.user?.role;
  const includeInactive = userRole === 'ADMIN' && all === 'true';
  const cacheKey = `products_${search || ''}_${includeInactive}`;

  const cached = appCache.get<any[]>(cacheKey);
  if (cached) {
    res.status(200).json({
      status: 'success',
      data: { products: sanitizeProductListForRole(cached, userRole) },
    });
    return;
  }

  try {
    const products = await productService.getProducts(search as string, includeInactive);
    appCache.set(cacheKey, products, 60);
    res.status(200).json({
      status: 'success',
      data: { products: sanitizeProductListForRole(products, userRole) },
    });
  } catch {
    res.status(500).json({ status: 'error', message: 'Error al obtener los productos.' });
  }
}

export async function getProductById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const product = await productService.getProductById(Number(req.params.id));
    if (!product) {
      res.status(404).json({ status: 'error', message: 'Producto no encontrado.' });
      return;
    }
    res.status(200).json({
      status: 'success',
      data: { product: sanitizeProductForRole(product, req.user?.role) },
    });
  } catch {
    res.status(500).json({ status: 'error', message: 'Error al obtener el producto.' });
  }
}

export async function createProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const product = await productService.createProduct(req.body, req.user?.id);
    appCache.invalidateProductCatalog();
    res.status(201).json({ status: 'success', data: { product } });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || 'Error al crear el producto.' });
  }
}

export async function updateProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const product = await productService.updateProduct(Number(req.params.id), req.body, req.user?.id);
    appCache.invalidateProductCatalog();
    res.status(200).json({ status: 'success', data: { product } });
  } catch (error: any) {
    res
      .status(400)
      .json({ status: 'error', message: error.message || 'Error al actualizar el producto.' });
  }
}

export async function adjustStock(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  try {
    const result = await productService.adjustStock(Number(req.params.id), req.body, userId);
    appCache.invalidateProductCatalog();
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res
      .status(400)
      .json({ status: 'error', message: error.message || 'Error al ajustar el stock del producto.' });
  }
}

export async function adjustStockBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  try {
    const result = await productService.adjustStockBatch(req.body.items, userId);
    appCache.invalidateProductCatalog();
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al procesar el bloque de ajustes de inventario.',
    });
  }
}

export async function getProductByBarcode(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const product = await productService.getProductByBarcode(req.params.barcode as string);
    if (!product) {
      res.status(404).json({ status: 'error', message: 'Producto no encontrado por código de barras.' });
      return;
    }
    res.status(200).json({
      status: 'success',
      data: { product: sanitizeProductForRole(product, req.user?.role) },
    });
  } catch {
    res
      .status(500)
      .json({ status: 'error', message: 'Error al obtener el producto por código de barras.' });
  }
}

export async function importPrices(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await productService.importPrices(req.body.products, req.user?.id);
    appCache.invalidateProductCatalog();
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res
      .status(500)
      .json({ status: 'error', message: error.message || 'Error al procesar la importación masiva.' });
  }
}

export async function bulkUpdatePrices(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await productService.bulkUpdatePrices(req.body, req.user?.id);
    appCache.invalidateProductCatalog();
    if (result.updatedCount === 0) {
      res
        .status(200)
        .json({ status: 'success', message: 'No se encontraron productos.', data: result });
      return;
    }
    res.status(200).json({
      status: 'success',
      message: `Actualizados ${result.updatedCount} productos.`,
      data: result,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ status: 'error', message: error.message || 'Error al actualizar precios masivamente.' });
  }
}

export async function getProductMovements(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { limit, beforeId, type, startDate, endDate } = req.query;
    const movements = await productService.getProductMovements(Number(req.params.id), {
      limit: limit ? Number(limit) : undefined,
      beforeId: beforeId ? Number(beforeId) : undefined,
      type: type ? (String(type) as MovementType) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
    });
    res.status(200).json({ status: 'success', data: { movements } });
  } catch {
    res
      .status(500)
      .json({ status: 'error', message: 'Error al obtener los movimientos del producto.' });
  }
}

export async function getGlobalStockMovements(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const { limit, beforeId, type } = req.query;
    const movements = await productService.getGlobalStockMovements({
      limit: limit ? Number(limit) : undefined,
      beforeId: beforeId ? Number(beforeId) : undefined,
      type: type ? (String(type) as MovementType) : undefined,
    });
    res.status(200).json({ status: 'success', data: { movements } });
  } catch {
    res
      .status(500)
      .json({ status: 'error', message: 'Error al obtener los movimientos globales de stock.' });
  }
}

export async function getExpiringLots(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const lots = await productService.getExpiringLots();
    res.status(200).json({ status: 'success', data: { lots } });
  } catch {
    res
      .status(500)
      .json({ status: 'error', message: 'Error al obtener los lotes próximos a vencer.' });
  }
}

export async function uploadProductImage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ status: 'error', message: 'No se ha subido ningún archivo de imagen.' });
      return;
    }
    const updatedProduct = await productService.uploadSingleProductImage(
      Number(req.params.id),
      req.file,
      req.user?.id,
    );
    appCache.invalidateProductCatalog();
    res.status(200).json({ status: 'success', data: { product: updatedProduct } });
  } catch (error: any) {
    const status = error.message === 'Producto no encontrado.' ? 404 : 500;
    res
      .status(status)
      .json({ status: 'error', message: error.message || 'Error al subir la imagen del producto.' });
  }
}

export async function importProductsZip(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ status: 'error', message: 'No se ha subido ningún archivo ZIP.' });
      return;
    }
    const MAX_ZIP_SIZE = 50 * 1024 * 1024;
    if (req.file.size > MAX_ZIP_SIZE) {
      res.status(400).json({
        status: 'error',
        message: 'El archivo ZIP supera el límite máximo permitido de 50MB.',
      });
      return;
    }
    const data = await productService.importProductImagesFromZip(req.file.buffer, req.user?.id);
    appCache.invalidateProductCatalog();
    res.status(200).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al procesar el archivo ZIP de imágenes.',
    });
  }
}

export async function auditStockDrift(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const driftProducts = await productService.reconcileStockAudit();
    res.status(200).json({
      status: 'success',
      data: { count: driftProducts.length, products: driftProducts },
    });
  } catch {
    res.status(500).json({ status: 'error', message: 'Error al realizar la auditoría de stock.' });
  }
}

export async function reconcileStockDrift(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  try {
    const result = await productService.executeStockReconciliation(userId);
    appCache.invalidateProductCatalog();
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al conciliar descalces de stock.',
    });
  }
}

export async function clearWmsLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  try {
    const result = await productService.clearWmsLocation(
      { ...req.body, userRole: req.user?.role },
      userId,
    );
    appCache.invalidateProductCatalog();
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res
      .status(400)
      .json({ status: 'error', message: error.message || 'Error al liberar la ubicación WMS.' });
  }
}

export async function assignWmsLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  if (req.body?.mode === 'STOCK_IN' && req.user?.role === 'FACTURACION') {
    res.status(403).json({
      status: 'error',
      message: 'Solo Administración o Depósito pueden ingresar stock físico nuevo.',
    });
    return;
  }
  try {
    const result = await productService.assignWmsLocation(
      { ...req.body, userRole: req.user?.role },
      userId,
    );
    appCache.invalidateProductCatalog();
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res
      .status(400)
      .json({ status: 'error', message: error.message || 'Error al asignar la ubicación WMS.' });
  }
}

export async function revertPrices(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await productService.revertPrices(req.user?.id);
    appCache.invalidateProductCatalog();
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res
      .status(500)
      .json({ status: 'error', message: error.message || 'Error al revertir los precios.' });
  }
}
