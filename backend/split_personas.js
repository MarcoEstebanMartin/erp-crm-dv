const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function splitPersonas() {
  console.log('Buscando personas que sean Cliente y Proveedor simultáneamente...');
  
  // Buscar las personas con YAPAI en el nombre
  const dualPersonas = await prisma.persona.findMany({
    where: {
      name: { contains: 'YAPAI' }
    }
  });

  console.log(`Se encontraron ${dualPersonas.length} registros para dividir.`);

  for (const p of dualPersonas) {
    const originalName = p.name;
    const clientName = `${originalName} (CLIENTE)`.substring(0, 255); // avoid length issues
    const providerName = `${originalName} (PROVEEDOR)`.substring(0, 255);

    // 1. Modificar el registro original para que sea solo cliente
    await prisma.persona.update({
      where: { id: p.id },
      data: {
        name: clientName,
        isProvider: false
      }
    });

    // 2. Crear el nuevo registro que será solo proveedor
    await prisma.persona.create({
      data: {
        name: providerName,
        cuit: p.cuit,
        address: p.address,
        city: p.city,
        phone: p.phone,
        email: p.email,
        isClient: false,
        isProvider: true,
        isSeller: p.isSeller,
        isCommissionAgent: p.isCommissionAgent,
        creditLimit: p.creditLimit,
        priceList: p.priceList,
        discount: p.discount,
        outstandingBalance: 0.00, // New provider account starts at 0
        iibbAliquot: p.iibbAliquot
      }
    });

    console.log(`Dividido: ${originalName} -> ${clientName} / ${providerName}`);
  }

  console.log('Proceso completado exitosamente.');
  await prisma.$disconnect();
}

splitPersonas().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
