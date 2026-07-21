const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const name = '20260720102300_add_product_isactive';
  console.log(`Borrando registro de migración corrupta: ${name}...`);
  await prisma.$executeRawUnsafe(`DELETE FROM _prisma_migrations WHERE migration_name = '${name}'`);
  console.log('Registro eliminado exitosamente. Ahora se puede volver a resolver.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
