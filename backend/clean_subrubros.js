const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({ select: { id: true, description: true } });
  
  let updatedCount = 0;
  for (const p of products) {
    if (!p.description) continue;
    
    // We want to remove patterns like "2.6 - ", "2 - ", "VINOS FINOS  - "
    // The user said: "Los numeros tipo 2.6 - , no han desaparecido de todos los rubros, algunos se eliminaron y otros no."
    
    let newDesc = p.description.trim();
    
    // Strip leading numbers and dashes (e.g. "2.6 - AZUCAR" -> "AZUCAR")
    newDesc = newDesc.replace(/^[\d\.\s-]+/, '');
    
    // If there's still a hyphen separated prefix like "VINOS FINOS - BODEGAS", 
    // Wait, the user ONLY mentioned "numeros tipo 2.6 -".
    // I should only strip leading numbers, dots, and hyphens.
    
    if (newDesc !== p.description.trim()) {
      console.log(`Will change: "${p.description}" -> "${newDesc}"`);
      await prisma.product.update({
        where: { id: p.id },
        data: { description: newDesc }
      });
      updatedCount++;
    }
  }
  
  console.log(`Updated ${updatedCount} products.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
