const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function runBackup() {
  const envPath = path.join(__dirname, '..', '.env');
  require('dotenv').config({ path: envPath });
  const dbUrl = process.env.DATABASE_URL;

  // Guardar en backups_auditoria/ en la raíz del proyecto para cumplir directivas
  const backupDir = path.join(__dirname, '..', '..', 'backups_auditoria');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sqlBackupPath = path.join(backupDir, `db_backup_${timestamp}.sql`);
  const jsonBackupPath = path.join(backupDir, `db_backup_${timestamp}.json`);

  console.log('⏳ Iniciando copia de seguridad preventiva antes de aplicar migración...');

  // Intentar pg_dump primero si DATABASE_URL está definida
  if (dbUrl) {
    try {
      console.log('🔌 Intentando volcado físico con pg_dump...');
      execSync(`pg_dump "${dbUrl}" -F c -b -v -f "${sqlBackupPath}"`, { stdio: 'ignore' });
      console.log(`✅ pg_dump completado con éxito. Backup físico guardado en: backups_auditoria/${path.basename(sqlBackupPath)}`);
      return;
    } catch (err) {
      console.log('⚠️ La herramienta pg_dump de PostgreSQL no está disponible o falló el volcado físico.');
    }
  }

  // Fallback: Respaldo lógico Prisma a JSON de todas las tablas estructuradas
  try {
    console.log('⚡ Ejecutando fallback de respaldo lógico de Prisma...');
    const backupData = {};
    const models = [
      'user', 'persona', 'rubro', 'product', 'productLot', 'order', 'orderItem', 
      'orderItemLot', 'transaction', 'cashDrawer', 'bankAccount', 
      'supplierInvoice', 'taxWithholding', 'splitBillingConfig', 'discountRule', 
      'perceptionType', 'deliveryRoute', 'auditLog'
    ];

    for (const model of models) {
      if (prisma[model]) {
        console.log(`   Exportando tabla: ${model}...`);
        backupData[model] = await prisma[model].findMany();
      }
    }

    fs.writeFileSync(jsonBackupPath, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`✅ Copia de seguridad lógica (JSON) creada con éxito: backups_auditoria/${path.basename(jsonBackupPath)}`);
  } catch (error) {
    console.error('❌ Error crítico durante la copia de seguridad lógica de base de datos:', error.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

runBackup();
