import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { productService } from '../services/product.service';

/**
 * Obtener todos los productos (Buscador inteligente por SKU o Nombre).
 */
export async function getProducts(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { search } = req.query;
  try {
    const products = await productService.getProducts(search as string);
    res.status(200).json({ status: 'success', data: { products } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener los productos.' });
  }
}

/**
 * Obtener un producto por ID.
 */
export async function getProductById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const product = await productService.getProductById(Number(id));
    if (!product) {
      res.status(404).json({ status: 'error', message: 'Producto no encontrado.' });
      return;
    }
    res.status(200).json({ status: 'success', data: { product } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener el producto.' });
  }
}

/**
 * Crear un nuevo producto (Solo ADMIN).
 */
export async function createProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  try {
    const product = await productService.createProduct(req.body, userId);
    res.status(201).json({ status: 'success', data: { product } });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || 'Error al crear el producto.' });
  }
}

/**
 * Actualizar datos de producto (Solo ADMIN).
 */
export async function updateProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  try {
    const product = await productService.updateProduct(Number(id), req.body, userId);
    res.status(200).json({ status: 'success', data: { product } });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || 'Error al actualizar el producto.' });
  }
}

/**
 * Ajustar stock físicamente (ADMIN y DEPOSITO).
 */
export async function adjustStock(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  try {
    const result = await productService.adjustStock(Number(id), req.body, userId);
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || 'Error al ajustar el stock del producto.' });
  }
}

/**
 * Obtener un producto por código de barras.
 */
export async function getProductByBarcode(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { barcode } = req.params;
  try {
    const product = await productService.getProductByBarcode(barcode as string);
    if (!product) {
      res.status(404).json({ status: 'error', message: 'Producto no encontrado por código de barras.' });
      return;
    }
    res.status(200).json({ status: 'success', data: { product } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener el producto por código de barras.' });
  }
}

/**
 * Importar precios masivamente desde un listado.
 */
export async function importPrices(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { products } = req.body;
  const userId = req.user?.id;
  try {
    const result = await productService.importPrices(products, userId);
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Error al procesar la importación masiva.' });
  }
}

/**
 * Actualizar precios masivamente por Rubro y/o Proveedor (Solo ADMIN).
 */
export async function bulkUpdatePrices(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  try {
    const result = await productService.bulkUpdatePrices(req.body, userId);
    if (result.updatedCount === 0) {
      res.status(200).json({ status: 'success', message: 'No se encontraron productos.', data: result });
      return;
    }
    res.status(200).json({ status: 'success', message: `Actualizados ${result.updatedCount} productos.`, data: result });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Error al actualizar precios masivamente.' });
  }
}
