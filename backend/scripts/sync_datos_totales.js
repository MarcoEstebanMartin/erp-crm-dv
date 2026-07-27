const { PrismaClient, Role } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const rootPath = path.join(__dirname, '../..');
  const datosPath = path.join(rootPath, 'Datos-Totales.xlsx');

  console.log(`🚀 Iniciando Sincronización Maestra Ultrarrápida desde: ${datosPath}`);
  const workbook = XLSX.readFile(datosPath);

  // 1. SINCRONIZACIÓN DE CLIENTES Y VENDEDORES (Solapa: 'Clientes y Vendedores')
  const clientSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('cliente'));
  if (clientSheetName) {
    console.log(`👥 Cargando datos de "${clientSheetName}"...`);
    const clientRows = XLSX.utils.sheet_to_json(workbook.Sheets[clientSheetName]);

    // Cargar mapas en memoria para evitar consultas lentas de 1 en 1
    const [existingSellers, existingRoutes, existingPersonas] = await Promise.all([
      prisma.user.findMany({ where: { role: Role.VENDEDOR } }),
      prisma.saleRoute.findMany(),
      prisma.persona.findMany()
    ]);

    const sellerMap = new Map();
    existingSellers.forEach(s => sellerMap.set(s.username.toLowerCase().trim(), s.id));

    const routeMap = new Map();
    existingRoutes.forEach(r => routeMap.set(r.name.toLowerCase().trim(), r.id));

    const cuitMap = new Map();
    const nameMap = new Map();
    existingPersonas.forEach(p => {
      if (p.cuit) cuitMap.set(p.cuit.trim(), p);
      nameMap.set(p.name.toLowerCase().trim(), p);
    });

    let clientsSynced = 0;
    let routesCreated = 0;

    for (const row of clientRows) {
      const type = String(row['Tipo de Persona'] || row.TIPO || 'CLIENTE').toUpperCase().trim();
      const name = String(row['Nombre y Apellido'] || row.NOMBRE || row.CLIENTE || '').trim();
      if (!name) continue;

      const cuit = row.CUIT ? String(row.CUIT).trim() : null;
      const city = row['Localidad / Pueblo'] ? String(row['Localidad / Pueblo']).trim() : (row.LOCALIDAD ? String(row.LOCALIDAD).trim() : null);
      const province = row.Provincia ? String(row.Provincia).trim() : (row.PROVINCIA ? String(row.PROVINCIA).trim() : null);
      const phone = row['Teléfono'] ? String(row['Teléfono']).trim() : (row.TELEFONO ? String(row.TELEFONO).trim() : null);
      const email = row.Email ? String(row.Email).trim() : (row.EMAIL ? String(row.EMAIL).trim() : null);
      const address = row['Dirección'] ? String(row['Dirección']).trim() : (row.DIRECCION ? String(row.DIRECCION).trim() : null);
      
      const rawSellerName = String(row.Vendedor || row.VENDEDOR || '').trim().toLowerCase();
      const sellerId = sellerMap.get(rawSellerName) || null;

      // Asignación de Ruta desde el Excel
      const rawRouteName = String(row.RUTA || row['RUTA PREVENTA'] || row.ZONA || '').trim();
      let saleRouteId = null;

      if (rawRouteName) {
        const cleanRouteName = rawRouteName.toUpperCase();
        if (routeMap.has(cleanRouteName.toLowerCase())) {
          saleRouteId = routeMap.get(cleanRouteName.toLowerCase());
        } else {
          const newRoute = await prisma.saleRoute.create({
            data: {
              name: cleanRouteName,
              sellerId: sellerId,
              isActive: true
            }
          });
          routeMap.set(cleanRouteName.toLowerCase(), newRoute.id);
          saleRouteId = newRoute.id;
          routesCreated++;
          console.log(`✨ Nueva Ruta creada desde Excel: "${cleanRouteName}" (#${newRoute.id})`);
        }
      }

      // Secuencia
      const rawSeq = row['SECUENCIA RUTA'] || row.SECUENCIA || row.ORDEN;
      const routeSequence = rawSeq ? parseInt(rawSeq) : null;

      // Buscar coincidencia en memoria
      let existingClient = cuit ? cuitMap.get(cuit) : null;
      if (!existingClient) {
        existingClient = nameMap.get(name.toLowerCase());
      }

      const personaData = {
        name,
        cuit,
        city,
        province,
        phone,
        email,
        address,
        isClient: type.includes('CLIENTE'),
        isProvider: type.includes('PROVEEDOR'),
        sellerId,
        saleRouteId,
        routeSequence,
        isActive: true
      };

      if (existingClient) {
        await prisma.persona.update({
          where: { id: existingClient.id },
          data: personaData
        });
      } else {
        const created = await prisma.persona.create({ data: personaData });
        if (cuit) cuitMap.set(cuit, created);
        nameMap.set(name.toLowerCase(), created);
      }
      clientsSynced++;
    }

    console.log(`✅ Sincronizados ${clientsSynced} clientes/personas. ${routesCreated} rutas creadas.`);
  }

  // 2. SINCRONIZACIÓN DE PRODUCTOS (Solapa: 'Productos')
  const prodSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('producto'));
  if (prodSheetName) {
    console.log(`\n📦 Sincronizando Solapa: "${prodSheetName}"...`);
    const prodRows = XLSX.utils.sheet_to_json(workbook.Sheets[prodSheetName]);
    const existingProducts = await prisma.product.findMany();
    const prodMap = new Map();
    existingProducts.forEach(p => prodMap.set(p.sku, p));

    let prodSynced = 0;
    for (const row of prodRows) {
      const rawSku = String(row.SKU || '').trim();
      if (!rawSku) continue;
      const sku = /^\d+$/.test(rawSku) ? rawSku.padStart(4, '0') : rawSku;
      const name = String(row.PRODUCTO || row.NOMBRE || '').trim();
      const commercialCategory = String(row.GRUPO_OFERTA || row.CATEGORIA || 'Varios').trim();
      const costPrice = parseFloat(row.COSTO) || 0;
      const listPrice = parseFloat(row['PRECIO FINAL'] || row.PRECIO) || 0;
      const profitMargin = row.RENTABILIDAD ? parseFloat(row.RENTABILIDAD) : null;
      const isPesable = String(row.PESABLE || '').toUpperCase().trim() === 'SI';
      const rawBarcode = String(row['COD.BARRAS'] || row.BARCODE || '').trim();
      const barcode = rawBarcode && rawBarcode !== '0' ? rawBarcode : null;
      const rawMinQty = row['MINIMO VENTA'] || row.MINIMO;
      const minOrderQuantity = rawMinQty ? parseInt(rawMinQty) : 1;

      const existingProd = prodMap.get(sku);

      const prodData = {
        name,
        commercialCategory,
        costPrice,
        listPrice,
        profitMargin,
        isPesable,
        barcode,
        minOrderQuantity,
        isActive: true
      };

      try {
        if (existingProd) {
          await prisma.product.update({
            where: { id: existingProd.id },
            data: prodData
          });
        } else {
          await prisma.product.create({
            data: { sku, ...prodData }
          });
        }
      } catch (err) {
        // Si el código de barras ya existe en otro producto, actualizar ignorando el campo barcode
        const { barcode, ...prodDataWithoutBarcode } = prodData;
        if (existingProd) {
          await prisma.product.update({
            where: { id: existingProd.id },
            data: prodDataWithoutBarcode
          });
        } else {
          await prisma.product.create({
            data: { sku, ...prodDataWithoutBarcode }
          });
        }
      }
      prodSynced++;
    }

    console.log(`✅ Sincronizados ${prodSynced} productos correctamente.`);
  }

  console.log(`\n✨ Sincronización maestra ultrarrápida completada con éxito.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
