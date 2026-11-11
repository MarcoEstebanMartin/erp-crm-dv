import fs from 'fs/promises';
import fsSync from 'fs';

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
