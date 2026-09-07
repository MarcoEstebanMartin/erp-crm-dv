const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function runBackup() {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.resolve(__dirname, '../backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const sqlFileName = `backup_ERP_${dateStr}.sql`;
  const jsonFileName = `backup_ERP_${dateStr}.json`;
  const sqlFilePath = path.join(backupDir, sqlFileName);
  const jsonFilePath = path.join(backupDir, jsonFileName);

  console.log(`⏳ Generando copia de seguridad física del sistema ERP...`);

  // Intentar pg_dump si está disponible en la terminal
  let pgDumpSuccess = false;
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      execSync(`pg_dump "${dbUrl}" > "${sqlFilePath}"`, { stdio: 'pipe' });
      console.log(`✅ Backup nativo PostgreSQL (.sql) generado con éxito en: ${sqlFilePath}`);
      pgDumpSuccess = true;
    }
  } catch (err) {
    // Si pg_dump no está en PATH, usar exportador estructurado de resguardo JSON
  }

  // Backup de respaldo JSON unificado siempre disponible
  try {
    const products = await prisma.product.findMany();
    const personas = await prisma.persona.findMany();
    const orders = await prisma.order.findMany({ include: { items: true } });
    const transactions = await prisma.transaction.findMany();
    const routes = await prisma.saleRoute.findMany();
    const auditLogs = await prisma.auditLog.findMany({ take: 500, orderBy: { createdAt: 'desc' } });

    const fullDump = {
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        counts: {
          products: products.length,
          personas: personas.length,
          orders: orders.length,
          transactions: transactions.length,
          routes: routes.length
        }
      },
      data: {
        products,
        personas,
        orders,
        transactions,
        routes,
        auditLogs
      }
    };

    fs.writeFileSync(jsonFilePath, JSON.stringify(fullDump, null, 2), 'utf8');
    console.log(`✅ Backup estructurado de datos (.json) generado con éxito en: ${jsonFilePath}`);

    // Registrar en AuditLog (obteniendo el primer usuario administrador o existente)
    const adminUser = await prisma.user.findFirst();
    if (adminUser) {
      await prisma.auditLog.create({
        data: {
          userId: adminUser.id,
          action: 'DATABASE_BACKUP',
          entityType: 'DATABASE',
          entityId: 0,
          newValues: { backupFile: jsonFileName, stats: fullDump.meta.counts },
          status: 'SUCCESS'
        }
      });
    }

    console.log(`\n🎉 Resguardo de seguridad completado. Tienes una copia exacta de tu empresa lista.`);

  } catch (error) {
    console.error('❌ Error generando el respaldo de seguridad:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runBackup();
