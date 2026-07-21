const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  const sql = fs.readFileSync('prisma/migrations/20260721103659_add_previous_price/migration.sql', 'utf8');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');
  await prisma.$executeRawUnsafe(`UPDATE "_prisma_migrations" SET checksum = $1 WHERE migration_name = '20260721103659_add_previous_price'`, checksum);
  console.log('Checksum fixed to ' + checksum);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
