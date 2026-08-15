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

    // Mapeo automático de SKUs actualizados según changes.json (ej: 0237.jpg -> 0489.jpg)
    const changesPath = path.join(__dirname, '../../changes.json');
    if (fsSync.existsSync(changesPath)) {
      const changesRaw = await fs.readFile(changesPath, 'utf8');
      const changes = JSON.parse(changesRaw);
      for (const item of changes) {
        if (item.old && item.new && item.old !== item.new) {
          const oldFile = `${item.old.padStart(4, '0')}.jpg`;
          const newFile = `${item.new.padStart(4, '0')}.jpg`;
          const srcPath = path.join(masterDir, oldFile);
          const dstPath = path.join(targetDir, newFile);

          if (fsSync.existsSync(srcPath)) {
            await fs.copyFile(srcPath, dstPath).catch(() => null);
          }
        }
      }
    }
  } catch (err) {
    console.error('⚠️ Error al auto-sincronizar imágenes maestras:', err);
  }
}
