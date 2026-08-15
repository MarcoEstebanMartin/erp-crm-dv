import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

/**
 * Garantiza la existencia de directorios requeridos de forma asincrónica.
 */
export async function ensureDirectoriesExist(directories: string[]): Promise<void> {
  for (const dir of directories) {
    if (!fsSync.existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

/**
 * Sincroniza asincrónicamente las imágenes maestras de productos al backend sin bloquear el Event Loop.
 */
export async function syncMasterProductImages(masterDir: string, targetDir: string): Promise<void> {
  if (!fsSync.existsSync(masterDir)) return;

  try {
    const files = await fs.readdir(masterDir);
    const syncTasks = files.map(async (file) => {
      const srcFile = path.join(masterDir, file);
      const dstFile = path.join(targetDir, file);

      try {
        const [srcStat, dstStat] = await Promise.all([
          fs.stat(srcFile),
          fs.stat(dstFile).catch(() => null),
        ]);

        if (!dstStat || srcStat.size !== dstStat.size) {
          await fs.copyFile(srcFile, dstFile);
        }
      } catch (copyErr) {
        console.error(`⚠️ Fallo al sincronizar imagen individual [${file}]:`, copyErr);
      }
    });

    await Promise.all(syncTasks);
  } catch (err) {
    console.error('⚠️ Error al auto-sincronizar imágenes maestras:', err);
  }
}
