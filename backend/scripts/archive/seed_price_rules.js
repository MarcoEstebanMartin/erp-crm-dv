const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando la siembra de reglas de precios y descuentos...');

  // 1. Limpiar reglas anteriores
  await prisma.discountRule.deleteMany({});
  await prisma.splitBillingConfig.deleteMany({});
  console.log('🧹 Reglas de precios anteriores eliminadas.');

  // 2. Obtener el rubro REMOTTI (que incluye Remotti y Melincué)
  const rubroRemotti = await prisma.rubro.findUnique({
    where: { name: 'REMOTTI' }
  });

  if (!rubroRemotti) {
    console.error('❌ Error: No se encontró el rubro "REMOTTI" en la base de datos. Ejecutá el seed principal primero.');
    return;
  }
  console.log(`🧀 Rubro REMOTTI encontrado con ID: ${rubroRemotti.id}`);

  // 3. Crear reglas para la lista especial de quesos (3% de descuento en rubro REMOTTI)
  // Cualquier cliente con priceList = "ESPECIAL_QUESOS" recibirá este beneficio
  await prisma.discountRule.create({
    data: {
      name: 'Descuento 3% Quesos Lista Especial',
      priceList: 'ESPECIAL_QUESOS',
      rubroId: rubroRemotti.id,
      discount: 3.00
    }
  });
  console.log('✅ Regla creada: 3% de descuento en Quesos (rubro REMOTTI) para la lista "ESPECIAL_QUESOS".');

  // 4. Buscar cliente FANBERLIAN
  const fanberlian = await prisma.persona.findFirst({
    where: {
      name: { contains: 'FANBERLIAN', mode: 'insensitive' },
      isClient: true
    }
  });

  if (fanberlian) {
    console.log(`🏢 Cliente FANBERLIAN encontrado con ID: ${fanberlian.id}`);

    // Regla 1: Descuento del 4% en toda la lista general (Sucursal A - OFFICIAL)
    // Se aplica a todos los productos excepto donde haya reglas más específicas
    await prisma.discountRule.create({
      data: {
        name: 'Descuento 4% General FANBERLIAN',
        personaId: fanberlian.id,
        discount: 4.00,
        billingType: 'OFFICIAL' // Aplica en la facturación de Sucursal A
      }
    });

    // Regla 2: Descuento del 3% en quesos (rubro REMOTTI) para FANBERLIAN
    // Aplica tanto en Sucursal A (OFFICIAL) como en Sucursal X (INTERNAL)
    await prisma.discountRule.create({
      data: {
        name: 'Descuento 3% Quesos FANBERLIAN',
        personaId: fanberlian.id,
        rubroId: rubroRemotti.id,
        discount: 3.00
      }
    });

    // Regla 3: Configuración de división de facturación (Split Billing)
    // 50% en sucursal A (Oficial) y 50% en sucursal X (Interno) para el rubro REMOTTI
    await prisma.splitBillingConfig.create({
      data: {
        personaId: fanberlian.id,
        rubroId: rubroRemotti.id,
        percentageOfficial: 50.00,
        percentageInternal: 50.00
      }
    });

    // Ajustar el descuento por defecto del cliente a 0 para que no interfiera
    // y asegurarnos de que use la lista de precios estándar
    await prisma.persona.update({
      where: { id: fanberlian.id },
      data: {
        discount: 0.00,
        priceList: 'A'
      }
    });

    console.log('✅ Reglas y configuraciones comerciales para FANBERLIAN creadas con éxito.');
  } else {
    console.log('⚠️ Advertencia: No se encontró al cliente "FANBERLIAN" en la base de datos.');
  }

  console.log('✨ Proceso de siembra de reglas de precios finalizado.');
}

main()
  .catch((e) => {
    console.error('❌ Error sembrando reglas de precios:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
