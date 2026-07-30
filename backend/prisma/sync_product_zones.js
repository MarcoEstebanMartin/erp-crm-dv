const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(__dirname, 'excel_products.json');
  const excelProducts = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  console.log('1. Actualizando Rubro BEBIDAS a TABLA...');
  await prisma.rubro.updateMany({
    where: { name: { contains: 'BEBIDAS', mode: 'insensitive' } },
    data: { pickingZone: 'TABLA' }
  });

  console.log('2. Construyendo listas de SKUs...');
  const tablaSkus = [];
  const frioSkus = [];
  const cajasSkus = [];

  excelProducts.forEach(ep => {
    const epSku = String(ep.sku).replace(/^0+/, '');
    if (ep.pickingZone === 'TABLA') tablaSkus.push(epSku, ep.sku);
    else if (ep.pickingZone === 'FRIO') frioSkus.push(epSku, ep.sku);
    else if (ep.pickingZone === 'CAJAS') cajasSkus.push(epSku, ep.sku);
  });

  console.log('3. Ejecutando actualizaciones en lote por SQL...');

  // Actualizar por SKU
  if (tablaSkus.length > 0) {
    await prisma.$executeRawUnsafe(`
      UPDATE "Product" 
      SET "pickingZone" = 'TABLA', "defaultLocation" = 'SECTOR-TABLA'
      WHERE REGEXP_REPLACE(sku, '^0+', '') IN (${tablaSkus.map(s => `'${s}'`).join(',')});
    `);
  }

  if (frioSkus.length > 0) {
    await prisma.$executeRawUnsafe(`
      UPDATE "Product" 
      SET "pickingZone" = 'FRIO', "defaultLocation" = 'CAMARA-FRIO'
      WHERE REGEXP_REPLACE(sku, '^0+', '') IN (${frioSkus.map(s => `'${s}'`).join(',')});
    `);
  }

  if (cajasSkus.length > 0) {
    await prisma.$executeRawUnsafe(`
      UPDATE "Product" 
      SET "pickingZone" = 'CAJAS', "defaultLocation" = 'DEP2-RACK-AZUL'
      WHERE REGEXP_REPLACE(sku, '^0+', '') IN (${cajasSkus.map(s => `'${s}'`).join(',')});
    `);
  }

  // Reglas adicionales por palabras clave en nombre de producto
  console.log('4. Aplicando reglas por palabras clave (Gancia, Borghetti, Vinos, Quesos)...');
  await prisma.$executeRawUnsafe(`
    UPDATE "Product"
    SET "pickingZone" = 'TABLA', "defaultLocation" = 'SECTOR-TABLA'
    WHERE UPPER(name) ~ '(GANCIA|BORGHETTI|ALMA MORA|MALBEC|CABERNET|VINO|FERNET|CHARDONNAY|CAMPARI|APEROL|WHISKY|GIN|CERVEZA|LICOR|CHAMPAGNE|ANANA FIZZ|PRONTO SHAKE|DR LEMON|BODEGA|SYRAH|SAUVIGNON|MERLOT|TINTO|BLANCO|ESPUMANTE)';
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "Product"
    SET "pickingZone" = 'FRIO', "defaultLocation" = 'CAMARA-FRIO'
    WHERE UPPER(name) ~ '(QUESO|MOZZARELLA|MANTECA|CREMA|YOGURT|TYBO|CHEDDAR|GOUDA|SALAME|JAMON|BONDOLA|FIAMBRE|REFRIGERADO|POR SALUT)';
  `);

  console.log('✅ Actualización masiva completada en milisegundos.');

  // Verificar estado de OrderItems
  const finalItems = await prisma.orderItem.findMany({ include: { product: true } });
  const zoneBreakdown = {};
  finalItems.forEach(i => {
    const z = i.product?.pickingZone || 'CAJAS';
    zoneBreakdown[z] = (zoneBreakdown[z] || 0) + 1;
  });
  console.log('📊 Desglose Final de Ítems por Zona en BD:', zoneBreakdown);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
