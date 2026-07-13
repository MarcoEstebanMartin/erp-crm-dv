const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('⏳ Iniciando respaldo de datos maestros (Clientes, Proveedores y Productos)...');

  try {
    // 1. Respaldo de Personas (Clientes/Proveedores)
    console.log('👤 Obteniendo personas de la base de datos...');
    const personas = await prisma.persona.findMany({
      include: { seller: true }
    });

    const mappedPersonas = personas.map(p => {
      let sellerName = null;
      if (p.seller) {
        // Mapear nombres de vendedores idéntico a seed.js
        if (p.seller.username === 'diego') sellerName = 'Diego';
        else if (p.seller.username === 'fabian') sellerName = 'Fabian';
        else if (p.seller.username === 'norberto') sellerName = 'Norberto';
        else if (p.seller.username === 'maria_jose') sellerName = 'Maria Jose';
        else if (p.seller.username === 'OFICINA') sellerName = 'OFICINA';
      }

      return {
        id: p.id,
        name: p.name,
        cuit: p.cuit,
        address: p.address,
        city: p.city,
        province: p.province,
        zipCode: p.zipCode,
        phone: p.phone,
        email: p.email,
        priceList: p.priceList,
        discount: Number(p.discount || 0),
        creditLimit: Number(p.creditLimit || 0),
        outstandingBalance: Number(p.outstandingBalance || 0),
        isClient: p.isClient,
        isProvider: p.isProvider,
        isSeller: p.isSeller,
        isCommissionAgent: p.isCommissionAgent,
        route: p.route,
        latitude: p.latitude,
        longitude: p.longitude,
        iibbAliquot: Number(p.iibbAliquot || 0),
        sellerName: sellerName
      };
    });

    const backendClientsPath = path.join(__dirname, '..', 'prisma', 'clients_data.json');
    const frontendClientsPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'clients_data.json');

    fs.writeFileSync(backendClientsPath, JSON.stringify(mappedPersonas, null, 2), 'utf8');
    console.log(`💾 Guardadas ${mappedPersonas.length} personas en ${backendClientsPath}`);

    if (fs.existsSync(path.dirname(frontendClientsPath))) {
      fs.writeFileSync(frontendClientsPath, JSON.stringify(mappedPersonas, null, 2), 'utf8');
      console.log(`💾 Guardadas ${mappedPersonas.length} personas en ${frontendClientsPath}`);
    }

    // 2. Respaldo de Productos
    console.log('📦 Obteniendo productos de la base de datos...');
    const products = await prisma.product.findMany({
      include: { rubro: true }
    });

    const mappedProducts = products.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      barcode: p.barcode,
      costPrice: Number(p.costPrice || 0),
      listPrice: Number(p.listPrice || 0),
      listPriceB: Number(p.listPriceB || 0),
      listPriceC: Number(p.listPriceC || 0),
      stock: p.stock,
      minStock: p.minStock,
      isPesable: p.isPesable,
      approximateWeight: p.approximateWeight ? Number(p.approximateWeight) : null,
      category: p.rubro ? p.rubro.name : "OTROS"
    }));

    const backendProductsPath = path.join(__dirname, '..', 'prisma', 'products_data.json');
    const frontendProductsPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'products_data.json');

    fs.writeFileSync(backendProductsPath, JSON.stringify(mappedProducts, null, 2), 'utf8');
    console.log(`💾 Guardados ${mappedProducts.length} productos en ${backendProductsPath}`);

    if (fs.existsSync(path.dirname(frontendProductsPath))) {
      fs.writeFileSync(frontendProductsPath, JSON.stringify(mappedProducts, null, 2), 'utf8');
      console.log(`💾 Guardados ${mappedProducts.length} productos en ${frontendProductsPath}`);
    }

    console.log('✨ ¡Respaldo de datos maestros completado con éxito!');
  } catch (error) {
    console.error('❌ Error durante el respaldo:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
