import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';
import { appCache } from '../../utils/cache';
import { resolveMasterArchiveExtension } from '../../engines/catalog-sync.engine';
import { writeImageSafelyProtectingMaster } from './production-catalog-sync.service';
import { productionOutboundBridgeService } from './production-outbound-bridge.service';

function resolveMimeTypeFromExt(ext: string, fallbackMime?: string): string {
  if (fallbackMime && fallbackMime.startsWith('image/')) return fallbackMime;
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function getMasterPhotosDirectory(): string {
  return process.env.ARCHIVOS_PATH
    ? path.join(process.env.ARCHIVOS_PATH, 'fotos/Productos')
    : path.join(__dirname, '../../../../ARCHIVOS/fotos/Productos');
}

export class ProductImageSubService {
  /**
   * Subir imagen de un producto individual protegiendo ARCHIVOS/fotos/Productos/
   * y replicando automáticamente al Banco Único en `chatbot-dv.product_images`.
   */
  async uploadSingleProductImage(
    productId: number,
    file: Express.Multer.File,
    userId?: number,
  ) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error('Producto no encontrado.');

    const ext = resolveMasterArchiveExtension(file.originalname, file.mimetype);
    const uploadDir = path.join(__dirname, '../../../uploads/products');
    const masterDir = getMasterPhotosDirectory();

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

    const existingMasterStems = new Set<string>(
      fs.existsSync(masterDir)
        ? fs.readdirSync(masterDir).map((f) => path.basename(f, path.extname(f)).trim())
        : [],
    );

    const cleanSku = product.sku.trim();
    const filename = `${cleanSku}_${Math.floor(Date.now() / 1000)}${ext}`;
    writeImageSafelyProtectingMaster(
      cleanSku,
      filename,
      ext,
      file.buffer,
      uploadDir,
      masterDir,
      existingMasterStems,
    );

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
    productionOutboundBridgeService.enqueueProductImageSync({
      productId: updatedProduct.id,
      sku: cleanSku,
      filename,
      imageBuffer: file.buffer,
      mimeType: resolveMimeTypeFromExt(ext, file.mimetype),
    });

    return updatedProduct;
  }

  /**
   * Importar imágenes en lote desde archivo ZIP replicando al Banco Único de Producción.
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
    const masterDir = getMasterPhotosDirectory();
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const existingMasterStems = new Set<string>(
      fs.existsSync(masterDir)
        ? fs.readdirSync(masterDir).map((f) => path.basename(f, path.extname(f)).trim())
        : [],
    );

    const allProducts = await prisma.product.findMany({
      select: { id: true, sku: true, name: true, imageUrl: true },
    });

    const normalizeStr = (str: string) =>
      str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

    const epochSec = Math.floor(Date.now() / 1000);
    let totalProcessed = 0;
    let totalSkipped = 0;
    const skippedFiles: string[] = [];

    for (const entry of validEntries) {
      const rawExt = path.extname(entry.name).toLowerCase();
      const rawName = path.basename(entry.name, rawExt).trim();
      const paddedRawSku = /^\d+$/.test(rawName) ? rawName.padStart(4, '0') : rawName;
      const normalizedRaw = normalizeStr(rawName);

      const product =
        allProducts.find((p) => p.sku.trim() === rawName || p.sku.trim() === paddedRawSku) ||
        allProducts.find(
          (p) =>
            p.name.trim().toLowerCase() === rawName.toLowerCase() ||
            normalizeStr(p.name) === normalizedRaw,
        );

      if (product) {
        const cleanSku = product.sku.trim();
        const ext = resolveMasterArchiveExtension(entry.name, null);
        const filename = `${cleanSku}_${epochSec}${ext}`;
        const imgBuf = entry.getData();

        writeImageSafelyProtectingMaster(
          cleanSku,
          filename,
          ext,
          imgBuf,
          uploadDir,
          masterDir,
          existingMasterStems,
        );

        const imageUrl = `/uploads/products/${filename}`;
        await prisma.product.update({ where: { id: product.id }, data: { imageUrl } });

        productionOutboundBridgeService.enqueueProductImageSync({
          productId: product.id,
          sku: cleanSku,
          filename,
          imageBuffer: imgBuf,
          mimeType: resolveMimeTypeFromExt(ext),
        });

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
