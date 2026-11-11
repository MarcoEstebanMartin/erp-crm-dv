import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import prisma from '../../utils/prisma';
import {
  encryptAndCompressBackup,
  decryptAndDecompressBackup,
  pruneOldEncryptedBackups,
} from '../../utils/encrypted-backup.util';

export interface RunEncryptedBackupOptions {
  passphrase?: string;
  backupDir?: string;
  retentionCount?: number;
  verifyRoundTrip?: boolean;
}

export interface EncryptedBackupReport {
  filePath: string;
  fileName: string;
  sha256Hex: string;
  plainBytes: number;
  compressedBytes: number;
  encryptedBytes: number;
  includedPgDumpSql: boolean;
  prunedFiles: string[];
  counts: Record<string, number>;
}

function tryCapturePgDumpSql(databaseUrl?: string): string | null {
  if (!databaseUrl) return null;
  try {
    // execFileSync evita inyección de shell sobre DATABASE_URL
    const out = execFileSync('pg_dump', [databaseUrl], {
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out && out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

export async function runEncryptedDatabaseBackup(
  options: RunEncryptedBackupOptions = {},
): Promise<EncryptedBackupReport> {
  const passphrase = (options.passphrase || process.env.BACKUP_ENCRYPTION_KEY || '').trim();
  const backupDir =
    options.backupDir || path.resolve(__dirname, '../../../backups');
  const retentionCount = Number(
    options.retentionCount ?? process.env.BACKUP_RETENTION_COUNT ?? 14,
  );

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const [
    users,
    rubros,
    discountRules,
    products,
    productLots,
    stockMovements,
    personas,
    accountLedger,
    orders,
    purchaseOrders,
    transactions,
    bankAccounts,
    cashDrawers,
    expenses,
    supplierInvoices,
    creditNotes,
    saleRoutes,
    employees,
    payrolls,
    crmConversations,
    auditLogs,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.rubro.findMany(),
    prisma.discountRule.findMany(),
    prisma.product.findMany(),
    prisma.productLot.findMany(),
    prisma.stockMovement.findMany({ orderBy: { id: 'asc' } }),
    prisma.persona.findMany(),
    prisma.accountLedger.findMany({ orderBy: { id: 'asc' } }),
    prisma.order.findMany({ include: { items: true } }),
    prisma.purchaseOrder.findMany({ include: { items: true } }),
    prisma.transaction.findMany(),
    prisma.bankAccount.findMany(),
    prisma.cashDrawer.findMany(),
    prisma.expense.findMany(),
    prisma.supplierInvoice.findMany(),
    prisma.creditNote.findMany({ include: { items: true } }),
    prisma.saleRoute.findMany(),
    prisma.employee.findMany(),
    prisma.payroll.findMany(),
    prisma.crmConversation.findMany({ include: { messages: true } }),
    prisma.auditLog.findMany({ take: 1_000, orderBy: { createdAt: 'desc' } }),
  ]);

  const pgDumpSql = tryCapturePgDumpSql(process.env.DATABASE_URL);
  if (!pgDumpSql) {
    console.warn(
      '⚠️ [Backup] pg_dump no disponible en PATH o sin conexión directa; se resguardó snapshot JSON estructurado completo.',
    );
  }

  const counts = {
    users: users.length,
    rubros: rubros.length,
    discountRules: discountRules.length,
    products: products.length,
    productLots: productLots.length,
    stockMovements: stockMovements.length,
    personas: personas.length,
    accountLedger: accountLedger.length,
    orders: orders.length,
    purchaseOrders: purchaseOrders.length,
    transactions: transactions.length,
    bankAccounts: bankAccounts.length,
    cashDrawers: cashDrawers.length,
    expenses: expenses.length,
    supplierInvoices: supplierInvoices.length,
    creditNotes: creditNotes.length,
    saleRoutes: saleRoutes.length,
    employees: employees.length,
    payrolls: payrolls.length,
    crmConversations: crmConversations.length,
    auditLogs: auditLogs.length,
  };

  const payloadJson = JSON.stringify({
    meta: {
      schemaVersion: '2.1-aes256gcm',
      createdAt: new Date().toISOString(),
      includedPgDumpSql: Boolean(pgDumpSql),
      counts,
    },
    pgDumpSql,
    data: {
      users,
      rubros,
      discountRules,
      products,
      productLots,
      stockMovements,
      personas,
      accountLedger,
      orders,
      purchaseOrders,
      transactions,
      bankAccounts,
      cashDrawers,
      expenses,
      supplierInvoices,
      creditNotes,
      saleRoutes,
      employees,
      payrolls,
      crmConversations,
      auditLogs,
    },
  });

  const encrypted = encryptAndCompressBackup(payloadJson, passphrase);

  if (options.verifyRoundTrip !== false) {
    const verified = decryptAndDecompressBackup(encrypted.encryptedBuffer, passphrase);
    if (verified.length !== encrypted.plainBytes) {
      throw new Error('Fallo en auto-verificación de integridad post-cifrado.');
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `backup_ERP_${stamp}.dvbackup.enc`;
  const filePath = path.join(backupDir, fileName);

  fs.writeFileSync(filePath, encrypted.encryptedBuffer, { mode: 0o600 });

  const prunedFiles = pruneOldEncryptedBackups(backupDir, retentionCount);

  const adminUser = await prisma.user.findFirst({ where: { isActive: true } });
  if (adminUser) {
    await prisma.auditLog
      .create({
        data: {
          userId: adminUser.id,
          action: 'ENCRYPTED_DATABASE_BACKUP',
          entityType: 'DATABASE',
          entityId: 0,
          newValues: {
            fileName,
            sha256Hex: encrypted.sha256Hex,
            plainBytes: encrypted.plainBytes,
            encryptedBytes: encrypted.encryptedBytes,
            includedPgDumpSql: Boolean(pgDumpSql),
            prunedCount: prunedFiles.length,
            counts,
          },
          status: 'SUCCESS',
        },
      })
      .catch(() => undefined);
  }

  return {
    filePath,
    fileName,
    sha256Hex: encrypted.sha256Hex,
    plainBytes: encrypted.plainBytes,
    compressedBytes: encrypted.compressedBytes,
    encryptedBytes: encrypted.encryptedBytes,
    includedPgDumpSql: Boolean(pgDumpSql),
    prunedFiles,
    counts,
  };
}

let nightlyTimer: NodeJS.Timeout | null = null;

export function startNightlyBackupSchedulerIfEnabled(): void {
  if (process.env.ENABLE_NIGHTLY_BACKUP !== 'true') return;
  if (!process.env.BACKUP_ENCRYPTION_KEY || process.env.BACKUP_ENCRYPTION_KEY.trim().length < 16) {
    console.warn(
      '⚠️ ENABLE_NIGHTLY_BACKUP=true pero falta BACKUP_ENCRYPTION_KEY (>=16 caracteres). Programador omitido.',
    );
    return;
  }
  if (nightlyTimer) return;

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1_000;
  nightlyTimer = setInterval(() => {
    runEncryptedDatabaseBackup()
      .then((rep) =>
        console.log(
          `🔒 Backup nocturno cifrado generado: ${rep.fileName} (${rep.encryptedBytes} bytes, SHA-256 ${rep.sha256Hex.slice(0, 12)}...)`,
        ),
      )
      .catch((err) =>
        console.error('❌ Error en backup nocturno cifrado:', err?.message || err),
      );
  }, TWENTY_FOUR_HOURS_MS);

  if (typeof nightlyTimer.unref === 'function') {
    nightlyTimer.unref();
  }
}
