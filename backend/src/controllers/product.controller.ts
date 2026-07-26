import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { productService } from '../services/product.service';
import prisma from '../utils/prisma';
import { logAudit } from '../utils/audit';
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
  
  try {
    const products = await productService.getProducts(search as string, includeInactive);
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

    // Limpiar archivos anteriores de este SKU para evitar huérfanos y problemas de caché
    if (fs.existsSync(uploadDir)) {
      const existingFiles = fs.readdirSync(uploadDir).filter(f => f.startsWith(`${product.sku}.`) || f.startsWith(`${product.sku}_`));
      for (const f of existingFiles) {
        try { fs.unlinkSync(path.join(uploadDir, f)); } catch (e) {}
      }
    } else {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Nombre único con timestamp para forzar actualización en caché de navegadores
    const filename = `${product.sku}_${Date.now()}${ext}`;
    const uploadPath = path.join(uploadDir, filename);

    // Escribir el buffer a disco
    fs.writeFileSync(uploadPath, req.file.buffer);

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

    res.status(200).json({ status: 'success', data: { product: updatedProduct } });
  } catch (error: any) {
    console.error('Error al subir imagen de producto:', error);
    res.status(500).json({ status: 'error', message: 'Error al subir la imagen del producto.' });
  }
}

/**
 * Importar imágenes en lote a partir de un archivo comprimido ZIP.
 * Asocia las imágenes basándose en que el nombre del archivo coincida con el SKU.
 */
export async function importProductsZip(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ status: 'error', message: 'No se ha subido ningún archivo ZIP.' });
      return;
    }

    const zip = new AdmZip(req.file.buffer);
    const zipEntries = zip.getEntries();

    let processedCount = 0;
    let skippedCount = 0;
    const skippedEntries: string[] = [];

    const uploadDir = path.join(__dirname, '../../uploads/products');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Cargar todos los productos de la BD para hacer matcheo flexible por SKU o Nombre
    const allProducts = await prisma.product.findMany({
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

    // Comprobar si las imágenes son un lote secuencial de Canva (ej: "1.jpg", "2.jpg", "Page 1.jpg", "Página 1.jpg")
    const isSequentialCanvaZip = validEntries.every(entry => {
      const base = path.basename(entry.name, path.extname(entry.name)).trim();
      return /^\d{1,3}$/.test(base) || /^(page|pagina|página|diseño|diseno)[_ -]?\d+$/i.test(base);
    });

    if (isSequentialCanvaZip) {
      // Extraer el número de página para ordenar (1, 2, 3... 50)
      const extractNum = (name: string) => {
        const match = name.match(/\d+/);
        return match ? parseInt(match[0], 10) : 999999;
      };

      const sortedEntries = [...validEntries].sort((a, b) => {
        const numA = extractNum(a.name);
        const numB = extractNum(b.name);
        if (numA !== numB) return numA - numB;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });

      // Obtener los productos activos sin imagen ordenados por SKU (mismo orden que el CSV exportado para Canva)
      const prodsWithoutImage = await prisma.product.findMany({
        where: {
          OR: [{ imageUrl: null }, { imageUrl: '' }],
          isActive: true,
        },
        select: { id: true, sku: true, name: true, imageUrl: true },
        orderBy: { sku: 'asc' },
      });

      const countToProcess = Math.min(sortedEntries.length, prodsWithoutImage.length);

      for (let i = 0; i < countToProcess; i++) {
        const entry = sortedEntries[i];
        const product = prodsWithoutImage[i];
        const fileExt = path.extname(entry.name).toLowerCase();
        const filename = `${product.sku}${fileExt}`;
        const destPath = path.join(uploadDir, filename);

        fs.writeFileSync(destPath, entry.getData());
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
      }

      if (sortedEntries.length > countToProcess) {
        for (let i = countToProcess; i < sortedEntries.length; i++) {
          skippedCount++;
          skippedEntries.push(sortedEntries[i].name);
        }
      }
    } else {
      // Matcheo directo por SKU o Nombre exacto/normalizado
      for (const entry of validEntries) {
        const fileExt = path.extname(entry.name).toLowerCase();
        const rawName = path.basename(entry.name, fileExt).trim();
        const normalizedRaw = normalizeStr(rawName);

        // 1. SKU exacto (ej: "0575")
        let product = allProducts.find(p => p.sku === rawName);

        // 2. Nombre exacto o normalizado
        if (!product) {
          product = allProducts.find(p => p.name === rawName || normalizeStr(p.name) === normalizedRaw);
        }

        // 3. Coincidencia parcial de nombre
        if (!product) {
          product = allProducts.find(p => {
            const normPName = normalizeStr(p.name);
            return (normPName.length > 5 && normalizedRaw.length > 5) && (normPName.includes(normalizedRaw) || normalizedRaw.includes(normPName));
          });
        }

        if (product) {
          const filename = `${product.sku}${fileExt}`;
          const destPath = path.join(uploadDir, filename);

          fs.writeFileSync(destPath, entry.getData());
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

