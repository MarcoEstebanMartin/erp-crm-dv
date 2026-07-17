const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Iniciando actualización de SKUs en la base de datos...');
  
  const products = await prisma.product.findMany();
  console.log(`🔍 Se encontraron ${products.length} productos en total.`);

  let updatedCount = 0;

  for (const product of products) {
    if (product.sku && product.sku.startsWith('PROD-')) {
      const newSku = product.sku.replace(/^PROD-/, '');
      
      // Validar si ya existe otro producto con el nuevo SKU para evitar colisiones
      const existing = await prisma.product.findUnique({
        where: { sku: newSku }
      });

      if (existing) {
        console.warn(`⚠️ Advertencia: No se pudo actualizar el SKU del producto "${product.name}" (${product.sku}) porque el nuevo SKU "${newSku}" ya está en uso por otro producto.`);
        continue;
      }

      await prisma.product.update({
        where: { id: product.id },
        data: { sku: newSku }
      });
      
      console.log(`✅ Actualizado: "${product.name}" | ${product.sku} ➡️ ${newSku}`);
      updatedCount++;
    }
  }

  console.log(`\n🎉 Proceso finalizado. Se actualizaron ${updatedCount} productos.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
