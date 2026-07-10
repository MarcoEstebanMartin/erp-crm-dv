const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando la siembra de la base de datos (Seeding)...');

  // 1. Limpiar datos existentes en orden inverso de dependencias
  await prisma.auditLog.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.taxWithholding.deleteMany({});
  await prisma.cashDrawer.deleteMany({});
  await prisma.bankAccount.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.orderItemLot.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.creditNoteItem.deleteMany({});
  await prisma.creditNote.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.deliveryRoute.deleteMany({});
  await prisma.productLot.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.supplierInvoice.deleteMany({});
  await prisma.persona.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.rubro.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.weeklyReport.deleteMany({});
  await prisma.perceptionType.deleteMany({});

  console.log('🧹 Limpieza de tablas completada.');

  // 2. Crear Usuarios con contraseñas encriptadas
  const salt = await bcrypt.genSalt(10);
  const pwhash = async (pw) => await bcrypt.hash(pw, salt);

  // Vendedores
  const uDiego = await prisma.user.create({
    data: { username: 'diego', passwordHash: await pwhash('lejarza!'), role: 'VENDEDOR' }
  });
  const uFabian = await prisma.user.create({
    data: { username: 'fabian', passwordHash: await pwhash('fabian2026-Erp!'), role: 'VENDEDOR' }
  });
  const uNorberto = await prisma.user.create({
    data: { username: 'norberto', passwordHash: await pwhash('norberto2026-Erp!'), role: 'VENDEDOR' }
  });
  const uMariaJose = await prisma.user.create({
    data: { username: 'maria_jose', passwordHash: await pwhash('mariajose2026-Erp!'), role: 'VENDEDOR' }
  });

  // Administración (Dario y Agustin)
  const uDario = await prisma.user.create({
    data: { username: 'dario', passwordHash: await pwhash('dario2026-Erp!'), role: 'ADMIN' }
  });
  const uAgustin = await prisma.user.create({
    data: { username: 'agustin', passwordHash: await pwhash('agustin2026-Erp!'), role: 'ADMIN' }
  });
  
  // Default admin
  const uAdmin = await prisma.user.create({
    data: { username: 'admin', passwordHash: await pwhash('admin!'), role: 'ADMIN' }
  });

  // Repartidores y Armado
  await prisma.user.create({ data: { username: 'miguel', passwordHash: await pwhash('miguel!'), role: 'DEPOSITO' } });
  await prisma.user.create({ data: { username: 'matias', passwordHash: await pwhash('matias2026-Erp!'), role: 'DEPOSITO' } });
  await prisma.user.create({ data: { username: 'thiago', passwordHash: await pwhash('thiago2026-Erp!'), role: 'DEPOSITO' } });
  await prisma.user.create({ data: { username: 'rocio', passwordHash: await pwhash('rocio2026-Erp!'), role: 'DEPOSITO' } });

  console.log('👥 11 Usuarios del equipo creados y listos.');

  // Map of seller name in JSON -> Seller user ID in DB
  const sellerIdMap = {
    'Diego': uDiego.id,
    'Fabian': uFabian.id,
    'Norberto': uNorberto.id,
    'Maria Jose': uMariaJose.id
  };

  // 3. Cargar Clientes desde el JSON importado de Excel
  const jsonPath = path.join(__dirname, 'clients_data.json');
  if (fs.existsSync(jsonPath)) {
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const clientsList = JSON.parse(rawData);
    
    console.log(`📦 Cargando ${clientsList.length} clientes en la base de datos...`);
    
    const personasToInsert = clientsList.map((c) => {
      const sellerId = c.sellerName ? sellerIdMap[c.sellerName] : null;
      return {
        name: c.name,
        cuit: c.cuit,
        address: c.address,
        city: c.city,
        phone: c.phone,
        email: c.email,
        route: c.route,
        priceList: c.priceList,
        discount: c.discount,
        creditLimit: c.creditLimit,
        outstandingBalance: c.outstandingBalance,
        isClient: c.isClient,
        isProvider: c.isProvider,
        isSeller: c.isSeller,
        isCommissionAgent: c.isCommissionAgent,
        sellerId: sellerId
      };
    });

    // Insertar en lotes
    await prisma.persona.createMany({
      data: personasToInsert
    });
    
    console.log('🏢 Todos los clientes importados con éxito.');
  } else {
    console.log('⚠️ No se encontró clients_data.json en prisma folder.');
  }

  // 4. Crear Rubros
  console.log('🌱 Creando rubros...');
  const rubrosData = [
    { name: 'REMOTTI', description: 'Productos de marca Remotti / Melincue' },
    { name: 'LECHES', description: 'Leches líquidas, en polvo, chocolatadas y yogur' },
    { name: 'SANCOR y CREMIGAL', description: 'Cremas, mantecas, dulce de leche y quesos untables' },
    { name: 'QUESOS RALLADOS', description: 'Quesos rallados' },
    { name: 'SODECAR', description: 'Fiambres y chacinados Sodecar' },
    { name: 'CONSERVAS', description: 'Conservas de todo tipo' },
    { name: 'A.G.D Y NIZA', description: 'Aceites, vinagres y aderezos' },
    { name: 'CAFE', description: 'Café, cacao y té' },
    { name: 'ARROZ', description: 'Arroz' },
    { name: 'YERBAS', description: 'Yerbas' },
    { name: 'AZUCAR', description: 'Azúcar' },
    { name: 'EDULCORANTES', description: 'Edulcorantes' },
    { name: 'PESCADERIA', description: 'Conservas de pescado y mariscos' },
    { name: 'PASTAS SECAS', description: 'Fideos y pastas secas' },
    { name: 'PAPELES', description: 'Papel higiénico y rollos de cocina' },
    { name: 'REGALERIA', description: 'Regalería' },
    { name: 'BEBIDAS', description: 'Bebidas con y sin alcohol, gaseosas, aguas, vinos' },
    { name: 'NO COMESTIBLES', description: 'Artículos de limpieza y bazar no comestibles' },
    { name: 'OTROS', description: 'Otros productos no categorizados' }
  ];

  const rubroMap = {};
  for (const r of rubrosData) {
    const created = await prisma.rubro.create({
      data: { name: r.name, description: r.description }
    });
    rubroMap[created.name] = created.id;
  }
  console.log('🌱 Rubros creados con éxito.');

  // 5. Crear Productos desde el JSON importado de Excel
  const productsJsonPath = path.join(__dirname, 'products_data.json');
  if (fs.existsSync(productsJsonPath)) {
    const rawProductsData = fs.readFileSync(productsJsonPath, 'utf8');
    const productsList = JSON.parse(rawProductsData);
    
    console.log(`📦 Cargando ${productsList.length} productos en la base de datos...`);
    
    for (const prod of productsList) {
      const categoryName = prod.category || "OTROS";
      const rubroId = rubroMap[categoryName] || rubroMap["OTROS"] || null;

      const createdProduct = await prisma.product.create({
        data: {
          sku: prod.sku,
          name: prod.name,
          description: prod.description,
          barcode: prod.barcode,
          costPrice: prod.costPrice,
          listPrice: prod.listPrice,
          listPriceB: prod.listPriceB,
          listPriceC: prod.listPriceC,
          stock: prod.stock,
          minStock: prod.minStock,
          isPesable: prod.isPesable !== undefined ? Boolean(prod.isPesable) : false,
          approximateWeight: prod.approximateWeight !== undefined ? prod.approximateWeight : null,
          rubroId: rubroId
        },
      });

      await prisma.stockMovement.create({
        data: {
          productId: createdProduct.id,
          quantity: prod.stock,
          type: 'IN',
          reason: 'Carga de stock inicial (Semilla)',
          userId: uAdmin.id,
        },
      });
    }
    console.log('📦 Productos y movimientos de stock iniciales creados.');
  } else {
    console.log('⚠️ No se encontró products_data.json en prisma folder.');
  }

  // 6. Crear los Tipos de Percepciones por Defecto
  console.log('🌱 Creando tipos de percepciones...');
  const perceptionsData = [
    { code: 'IVA_5329', name: 'Percepción de IVA RG 5329', taxType: 'IVA', aliquot: 3.00, affectsIvaBook: true, jurisdiction: null },
    { code: 'IIBB_MN', name: 'Percepción IIBB Misiones', taxType: 'IIBB', aliquot: 3.31, affectsIvaBook: false, jurisdiction: 'AR-N' },
    { code: 'IIBB_CR', name: 'Percepción IIBB Corrientes', taxType: 'IIBB', aliquot: 2.90, affectsIvaBook: false, jurisdiction: 'AR-W' },
    { code: 'IIBB_BA', name: 'Percepción IIBB Buenos Aires (ARBA)', taxType: 'IIBB', aliquot: 4.00, affectsIvaBook: false, jurisdiction: 'AR-B' }
  ];
  for (const p of perceptionsData) {
    await prisma.perceptionType.create({ data: p });
  }
  console.log('🌱 Tipos de percepciones creados con éxito.');

  console.log('✨ Proceso de siembra finalizado con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error durante la siembra:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
