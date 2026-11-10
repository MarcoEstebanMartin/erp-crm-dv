import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import prisma from '../src/utils/prisma';
import { decryptAndDecompressBackup } from '../src/utils/encrypted-backup.util';
import { runEncryptedDatabaseBackup } from '../src/services/resilience/database-backup.service';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const mode = process.argv[2] || 'create';

  try {
    if (mode === 'verify') {
      const targetFile = process.argv[3];
      if (!targetFile) {
        throw new Error('Uso: npm run db:backup-encrypted -- verify <ruta-archivo.dvbackup.enc>');
      }
      const passphrase = (process.env.BACKUP_ENCRYPTION_KEY || '').trim();
      const raw = fs.readFileSync(path.resolve(targetFile));
      const plain = decryptAndDecompressBackup(raw, passphrase);
      const parsed = JSON.parse(plain.toString('utf8'));
      console.log('✅ Integridad AES-256-GCM verificada con éxito:', parsed.meta);
      return;
    }

    console.log('⏳ Generando backup comprimido y cifrado (AES-256-GCM)...');
    const report = await runEncryptedDatabaseBackup();
    const ratio =
      report.plainBytes > 0
        ? ((1 - report.encryptedBytes / report.plainBytes) * 100).toFixed(1)
        : '0.0';
    console.log(`✅ Archivo cifrado: ${report.filePath}`);
    console.log(`🔒 SHA-256: ${report.sha256Hex}`);
    console.log(
      `📦 Tamaño: ${report.plainBytes} B -> ${report.encryptedBytes} B (-${ratio}% con Gzip + AES-256-GCM)`,
    );
    console.log('📊 Tablas respaldadas:', report.counts);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Error en CLI de Backup Cifrado:', err?.message || err);
  process.exit(1);
});
