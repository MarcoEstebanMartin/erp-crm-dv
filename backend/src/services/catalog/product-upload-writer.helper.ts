import fs from 'fs';
import path from 'path';

/**
 * Escribe de forma atómica la imagen activa en `uploads/products` y purga versiones viejas
 * del mismo SKU para que jamás queden fotos huérfanas repetidas en disco.
 */
export function writeProductUploadAtomically(
  sku: string,
  resolvedUploadFilename: string,
  imageBuffer: Buffer,
  uploadsDir: string,
): { prunedCount: number } {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const uploadTarget = path.join(uploadsDir, resolvedUploadFilename);
  const tmpPath = `${uploadTarget}.tmp_${process.pid}`;
  fs.writeFileSync(tmpPath, imageBuffer);
  fs.renameSync(tmpPath, uploadTarget);

  const cleanSku = sku.trim();
  let prunedCount = 0;
  for (const file of fs.readdirSync(uploadsDir)) {
    if (file === resolvedUploadFilename || file.includes('.tmp_')) continue;
    if (file.startsWith(`${cleanSku}.`) || file.startsWith(`${cleanSku}_`)) {
      try {
        fs.unlinkSync(path.join(uploadsDir, file));
        prunedCount++;
      } catch {}
    }
  }

  return { prunedCount };
}
