import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';
import { appCache } from '../../utils/cache';

export class ProductImageSubService {
  /**
   * Subir imagen de un producto individual respetando ARCHIVOS/fotos/Productos/.
   */
  async uploadSingleProductImage(
    productId: number,
    file: Express.Multer.File,
    userId?: number,
  ) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error('Producto no encontrado.');

    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const uploadDir = path.join(__dirname, '../../../uploads/products');
    const masterDir = process.env.ARCHIVOS_PATH
      ? path.join(process.env.ARCHIVOS_PATH, 'fotos/Productos')
      : path.join(__dirname, '../../../../ARCHIVOS/fotos/Productos');

    if (fs.existsSync(uploadDir)) {
      const existingFiles = fs
        .readdirSync(uploadDir)
        .filter((f) => f.startsWith(`${product.sku}.`) || f.startsWith(`${product.sku}_`));
      for (const f of existingFiles) {
        try {
          fs.unlinkSync(path.join(uploadDir, f));
        } catch {}
      }
    } else {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${product.sku}_${Date.now()}${ext}`;
    fs.writeFileSync(path.join(uploadDir, filename), file.buffer);

    if (fs.existsSync(masterDir)) {
      const masterPath = path.join(masterDir, `${product.sku}${ext}`);
      if (!fs.existsSync(masterPath)) {
        try {
          fs.writeFileSync(masterPath, file.buffer);
        } catch {}
      }
    }

    const imageUrl = `/uploads/products/${filename}`;
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: { imageUrl },
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'UPDATE_PRODUCT_IMAGE',
        entityType: 'Product',
        entityId: productId,
        oldValues: { imageUrl: product.imageUrl },
        newValues: { imageUrl },
      });
    }

    appCache.invalidateProductCatalog();
    return updatedProduct;
  }

  /**
   * Importar imágenes en lote desde archivo ZIP.
   */
  async importProductImagesFromZip(fileBuffer: Buffer, userId?: number) {
    const zip = new AdmZip(fileBuffer);
    const validEntries = zip.getEntries().filter((entry) => {
      if (
        entry.isDirectory ||
        entry.entryName.startsWith('__MACOSX/') ||
        entry.entryName.includes('.DS_Store')
      ) {
        return false;
      }
      return ['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(entry.name).toLowerCase());
    });

    if (validEntries.length === 0) {
      throw new Error('El archivo ZIP no contiene imágenes válidas.');
    }

    const uploadDir = path.join(__dirname, '../../../uploads/products');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const allProducts = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, name: true, imageUrl: true },
    });

    const normalizeStr = (str: string) =>
      str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

    let totalProcessed = 0;
    let totalSkipped = 0;
    const skippedFiles: string[] = [];

    for (const entry of validEntries) {
      const fileExt = path.extname(entry.name).toLowerCase();
      const rawName = path.basename(entry.name, fileExt).trim();
      const paddedRawSku = /^\d+$/.test(rawName) ? rawName.padStart(4, '0') : rawName;
      const normalizedRaw = normalizeStr(rawName);

      const product =
        allProducts.find((p) => p.sku === rawName || p.sku === paddedRawSku) ||
        allProducts.find(
          (p) =>
            p.name.trim().toLowerCase() === rawName.toLowerCase() ||
            normalizeStr(p.name) === normalizedRaw,
        );

      if (product) {
        const filename = `${product.sku}${fileExt}`;
        fs.writeFileSync(path.join(uploadDir, filename), entry.getData());
        const imageUrl = `/uploads/products/${filename}`;
        await prisma.product.update({ where: { id: product.id }, data: { imageUrl } });
        if (userId) {
          await logAudit({
            userId,
            action: 'IMPORT_PRODUCT_IMAGE_ZIP',
            entityType: 'Product',
            entityId: product.id,
            oldValues: { imageUrl: product.imageUrl },
            newValues: { imageUrl },
          });
        }
        totalProcessed++;
      } else {
        totalSkipped++;
        skippedFiles.push(entry.name);
      }
    }

    appCache.invalidateProductCatalog();
    return { totalProcessed, totalSkipped, skippedFiles };
  }
}

export const productImageSubService = new ProductImageSubService();
