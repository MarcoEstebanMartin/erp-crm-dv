const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Limpiando migración fallida en _prisma_migrations...');
  try {
      const deletedCount = await prisma.$executeRawUnsafe(
        `DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260715124927_add_fleet_management'`
      );
      console.log('Migración eliminada del historial. Registros afectados:', deletedCount);
  } catch (e) {
      console.error('Error al limpiar migración:', e);
  } finally {
      await prisma.$disconnect();
  }
}
main();
