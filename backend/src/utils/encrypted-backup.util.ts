import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const MAGIC_HEADER = Buffer.from('DVENCBK1', 'ascii'); // 8 bytes
const SALT_BYTES = 16;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const MIN_HEADER_LENGTH = MAGIC_HEADER.length + SALT_BYTES + IV_BYTES + AUTH_TAG_BYTES;
const MIN_PASSPHRASE_LENGTH = 16;
const MAX_DECOMPRESSED_BYTES = 256 * 1024 * 1024; // 256 MB anti-zip-bomb

export interface EncryptedBackupEnvelopeResult {
  encryptedBuffer: Buffer;
  sha256Hex: string;
  plainBytes: number;
  compressedBytes: number;
  encryptedBytes: number;
}

function assertStrongPassphrase(passphrase: string): string {
  const trimmed = (passphrase || '').trim();
  if (trimmed.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(
      `Seguridad de Backup: BACKUP_ENCRYPTION_KEY debe tener al menos ${MIN_PASSPHRASE_LENGTH} caracteres.`,
    );
  }
  return trimmed;
}

function deriveAes256Key(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 });
}

/**
 * Comprime con Gzip (nivel 9) y cifra con AES-256-GCM autenticado + clave derivada por scrypt.
 * Formato binario: [DVENCBK1 (8B)][Salt (16B)][IV (12B)][AuthTag (16B)][Ciphertext].
 */
export function encryptAndCompressBackup(
  plainInput: Buffer | string,
  passphrase: string,
): EncryptedBackupEnvelopeResult {
  const secret = assertStrongPassphrase(passphrase);
  const plainBuffer = Buffer.isBuffer(plainInput)
    ? plainInput
    : Buffer.from(plainInput, 'utf8');

  const compressed = zlib.gzipSync(plainBuffer, { level: 9 });
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = deriveAes256Key(secret, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(MAGIC_HEADER);
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const encryptedBuffer = Buffer.concat([
    MAGIC_HEADER,
    salt,
    iv,
    authTag,
    ciphertext,
  ]);

  const sha256Hex = crypto.createHash('sha256').update(encryptedBuffer).digest('hex');

  return {
    encryptedBuffer,
    sha256Hex,
    plainBytes: plainBuffer.length,
    compressedBytes: compressed.length,
    encryptedBytes: encryptedBuffer.length,
  };
}

/**
 * Verifica autenticidad GCM (detecta cualquier alteración de 1 bit o clave errónea),
 * descifra y descomprime el respaldo devolviendo el Buffer original.
 */
export function decryptAndDecompressBackup(
  encryptedEnvelope: Buffer,
  passphrase: string,
): Buffer {
  const secret = assertStrongPassphrase(passphrase);

  if (!Buffer.isBuffer(encryptedEnvelope) || encryptedEnvelope.length <= MIN_HEADER_LENGTH) {
    throw new Error('Archivo de backup cifrado inválido o truncado.');
  }

  const magic = encryptedEnvelope.subarray(0, MAGIC_HEADER.length);
  if (!magic.equals(MAGIC_HEADER)) {
    throw new Error('Cabecera de formato desconocida (se esperaba DVENCBK1).');
  }

  let offset = MAGIC_HEADER.length;
  const salt = encryptedEnvelope.subarray(offset, offset + SALT_BYTES);
  offset += SALT_BYTES;
  const iv = encryptedEnvelope.subarray(offset, offset + IV_BYTES);
  offset += IV_BYTES;
  const authTag = encryptedEnvelope.subarray(offset, offset + AUTH_TAG_BYTES);
  offset += AUTH_TAG_BYTES;
  const ciphertext = encryptedEnvelope.subarray(offset);

  const key = deriveAes256Key(secret, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(MAGIC_HEADER);
  decipher.setAuthTag(authTag);

  let compressed: Buffer;
  try {
    compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error(
      'Fallo de verificación criptográfica AES-256-GCM: clave incorrecta o archivo adulterado.',
    );
  }

  return zlib.gunzipSync(compressed, { maxOutputLength: MAX_DECOMPRESSED_BYTES });
}

/**
 * Mantiene únicamente los últimos `retentionCount` archivos `.dvbackup.enc` en el directorio.
 */
export function pruneOldEncryptedBackups(
  backupDir: string,
  retentionCount = 14,
): string[] {
  if (!fs.existsSync(backupDir) || retentionCount < 1) return [];

  const entries = fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith('.dvbackup.enc'))
    .map((name) => {
      const fullPath = path.join(backupDir, name);
      const stat = fs.statSync(fullPath);
      return { name, fullPath, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const removed: string[] = [];
  for (const stale of entries.slice(retentionCount)) {
    try {
      fs.unlinkSync(stale.fullPath);
      removed.push(stale.name);
    } catch {
      // Ignorar si un archivo fue removido concurrentemente
    }
  }
  return removed;
}
