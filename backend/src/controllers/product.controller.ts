import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { productService } from '../services/product.service';
import prisma from '../utils/prisma';
import { logAudit } from '../utils/audit';
import { appCache } from '../utils/cache';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

/**
 * Obtener todos los productos (Buscador inteligente por SKU o Nombre).
 */
export async function getProducts(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { search, all } = req.query;
  const userRole = req.user?.role;
  
  // Si no es ADMIN, o si no se solicita explicitamente 'all', solo mostramos activos
  const includeInactive = (userRole === 'ADMIN' && all === 'true');
  const cacheKey = `products_${search || ''}_${includeInactive}`;

  const cached = appCache.get<any>(cacheKey);
  if (cached) {
    res.status(200).json({ status: 'success', data: { products: cached } });
    return;
  }
  
  try {
    const products = await productService.getProducts(search as string, includeInactive);
    appCache.set(cacheKey, products, 60); // 60 segundos TTL
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
    appCache.invalidateProductCatalog();
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
    appCache.invalidateProductCatalog();
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
    appCache.invalidateProductCatalog();
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

/**
 * Obtener el historial de movimientos de un producto.
 */
export async function getProductMovements(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const movements = await productService.getProductMovements(Number(id));
    res.status(200).json({ status: 'success', data: { movements } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener los movimientos del producto.' });
  }
}

/**
 * Obtener los movimientos de stock globales recientes (últimos 50).
 */
export async function getGlobalStockMovements(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const movements = await productService.getGlobalStockMovements();
    res.status(200).json({ status: 'success', data: { movements } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener los movimientos globales de stock.' });
  }
}

/**
 * Obtener lotes próximos a vencer (vencimiento <= hoy + 30 días) que tengan stock.
 */
export async function getExpiringLots(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const lots = await productService.getExpiringLots();
    res.status(200).json({ status: 'success', data: { lots } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener los lotes próximos a vencer.' });
  }
}

/**
 * Subir la imagen de un producto individual.
 */
export async function uploadProductImage(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    if (!req.file) {
      res.status(400).json({ status: 'error', message: 'No se ha subido ningún archivo de imagen.' });
      return;
    }

    const productId = Number(id);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      res.status(404).json({ status: 'error', message: 'Producto no encontrado.' });
      return;
    }

    // Normalizar extensión del archivo original
    const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
    const uploadDir = path.join(__dirname, '../../uploads/products');
    const masterDir = process.env.ARCHIVOS_PATH 
      ? path.join(process.env.ARCHIVOS_PATH, 'fotos/Productos')
      : path.join(__dirname, '../../../ARCHIVOS/fotos/Productos');

    // Limpiar archivos anteriores de este SKU para evitar huérfanos y problemas de caché
    if (fs.existsSync(uploadDir)) {
      const existingFiles = fs.readdirSync(uploadDir).filter(f => f.startsWith(`${product.sku}.`) || f.startsWith(`${product.sku}_`));
      for (const f of existingFiles) {
        try { fs.unlinkSync(path.join(uploadDir, f)); } catch (e) {}
      }
    } else {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    if (!fs.existsSync(masterDir)) {
      try { fs.mkdirSync(masterDir, { recursive: true }); } catch (e) {}
    }

    // Nombre único con timestamp para forzar actualización en caché de navegadores
    const filename = `${product.sku}_${Date.now()}${ext}`;
    const uploadPath = path.join(uploadDir, filename);

    // Escribir el buffer a disco (Uploads y Maestro)
    fs.writeFileSync(uploadPath, req.file.buffer);
    if (fs.existsSync(masterDir)) {
      try {
        const masterPath = path.join(masterDir, `${product.sku}${ext}`);
        fs.writeFileSync(masterPath, req.file.buffer);
      } catch (e) {}
    }

    // Ruta URL relativa que sirve Express estático
    const imageUrl = `/uploads/products/${filename}`;

    // Actualizar base de datos
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: { imageUrl },
    });

    // Registrar auditoría si tenemos el usuario autenticado
    if (req.user?.id) {
      await logAudit({
        userId: req.user.id,
        action: 'UPDATE_PRODUCT_IMAGE',
        entityType: 'Product',
        entityId: productId,
        oldValues: { imageUrl: product.imageUrl },
        newValues: { imageUrl },
      });
    }

    // Invalidad caché en memoria de productos para que se actualice al instante
    appCache.invalidateProductCatalog();

    res.status(200).json({ status: 'success', data: { product: updatedProduct } });
  } catch (error: any) {
    console.error('Error al subir imagen de producto:', error);
    res.status(500).json({ status: 'error', message: 'Error al subir la imagen del producto.' });
  }
}

/**
 * Importar imágenes en lote a partir de un archivo comprimido ZIP.
 * Asocia las imágenes basándose en que el nombre del archivo coincida con el SKU o Nombre exacto.
 */
export async function importProductsZip(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ status: 'error', message: 'No se ha subido ningún archivo ZIP.' });
      return;
    }

    const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB
    if (req.file.size > MAX_ZIP_SIZE) {
      res.status(400).json({ status: 'error', message: 'El archivo ZIP supera el límite máximo permitido de 50MB.' });
      return;
    }

    const zip = new AdmZip(req.file.buffer);
    const zipEntries = zip.getEntries();

    let processedCount = 0;
    let skippedCount = 0;
    const skippedEntries: string[] = [];

    const uploadDir = path.join(__dirname, '../../uploads/products');
    const masterDir = process.env.ARCHIVOS_PATH 
      ? path.join(process.env.ARCHIVOS_PATH, 'fotos/Productos')
      : path.join(__dirname, '../../../ARCHIVOS/fotos/Productos');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Cargar únicamente productos activos o relevantes con SKU / Nombre
    const allProducts = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, name: true, imageUrl: true }
    });

    const normalizeStr = (str: string) => 
      str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

    // Filtrar entradas válidas de imagen
    const validEntries = zipEntries.filter(entry => {
      if (entry.isDirectory || entry.entryName.startsWith('__MACOSX/') || entry.entryName.includes('.DS_Store')) {
        return false;
      }
      const fileExt = path.extname(entry.name).toLowerCase();
      return ['.png', '.jpg', '.jpeg', '.webp'].includes(fileExt);
    });

    if (validEntries.length === 0) {
      res.status(400).json({ status: 'error', message: 'El archivo ZIP no contiene imágenes válidas.' });
      return;
    }

    // Matcheo directo y seguro por SKU o Nombre exacto/normalizado
    for (const entry of validEntries) {
      const fileExt = path.extname(entry.name).toLowerCase();
      const rawName = path.basename(entry.name, fileExt).trim();
      const paddedRawSku = /^\d+$/.test(rawName) ? rawName.padStart(4, '0') : rawName;
      const normalizedRaw = normalizeStr(rawName);

      // 1. SKU exacto o paddeado (ej: "0575" o "575")
      let product = allProducts.find(p => p.sku === rawName || p.sku === paddedRawSku);

      // 2. Nombre exacto o normalizado (Evitar coincidencia parcial difusa para impedir descalces)
      if (!product) {
        product = allProducts.find(p => p.name.trim().toLowerCase() === rawName.toLowerCase() || normalizeStr(p.name) === normalizedRaw);
      }

      if (product) {
        const filename = `${product.sku}${fileExt}`;
        const destPath = path.join(uploadDir, filename);

        const imgData = entry.getData();
        fs.writeFileSync(destPath, imgData);
        if (fs.existsSync(masterDir)) {
          try { fs.writeFileSync(path.join(masterDir, filename), imgData); } catch (e) {}
        }

        const imageUrl = `/uploads/products/${filename}`;

        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl },
        });

        if (req.user?.id) {
          await logAudit({
            userId: req.user.id,
            action: 'IMPORT_PRODUCT_IMAGE_ZIP',
            entityType: 'Product',
            entityId: product.id,
            oldValues: { imageUrl: product.imageUrl },
            newValues: { imageUrl },
          });
        }
        processedCount++;
      } else {
        skippedCount++;
        skippedEntries.push(entry.name);
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        totalProcessed: processedCount,
        totalSkipped: skippedCount,
        skippedFiles: skippedEntries,
      },
    });
  } catch (error: any) {
    console.error('Error al procesar archivo ZIP de imágenes:', error);
    res.status(500).json({ status: 'error', message: 'Error al procesar el archivo ZIP de imágenes.' });
  }
}

/**
 * Obtener descalces de stock entre el producto y sus lotes (Auditoría).
 */
export async function auditStockDrift(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const driftProducts = await productService.reconcileStockAudit();
    res.status(200).json({
      status: 'success',
      data: {
        count: driftProducts.length,
        products: driftProducts
      }
    });
  } catch (error: any) {
    console.error('Error al realizar la auditoría de stock:', error);
    res.status(500).json({ status: 'error', message: 'Error al realizar la auditoría de stock.' });
  }
}

/**
 * Corregir descalces de stock reconciliando contra el lote 'S/L' (Solo ADMIN).
 */
export async function reconcileStockDrift(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  try {
    const result = await productService.executeStockReconciliation(userId);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error: any) {
    console.error('Error al conciliar descalces de stock:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Error al conciliar descalces de stock.' });
  }
}

/**
 * Vaciar limpiamente una ubicación/slot del mapa WMS.
 */
export async function clearWmsLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id || 1;
  const { locationCode } = req.body;
  try {
    const result = await productService.clearWmsLocation(locationCode, userId);
    appCache.invalidateProductCatalog();
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || 'Error al vaciar la ubicación WMS.' });
  }
}

/**
 * Asignar limpiamente un producto a una ubicación/slot del mapa WMS.
 */
export async function assignWmsLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id || 1;
  try {
    const result = await productService.assignWmsLocation(req.body, userId);
    appCache.invalidateProductCatalog();
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || 'Error al asignar la ubicación WMS.' });
  }
}

