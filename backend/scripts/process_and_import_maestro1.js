const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function parseExcelNum(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = val.toString().trim().replace(/[\$\s]/g, '');
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

function normalizeSku(raw) {
  if (!raw) return '';
  const s = raw.toString().trim();
  if (/^\d+$/.test(s)) return s.padStart(4, '0');
  return s;
}

function cleanText(raw) {
  if (raw === undefined || raw === null) return '';
  return raw.toString().trim();
}

function cleanCuit(raw) {
  if (!raw) return null;
  const c = raw.toString().replace(/\D/g, '');
  return c.length > 0 ? c : null;
}

async function run() {
  console.log('🚀 Iniciando procesamiento e importación profesional de Maestro1.xlsx...');
  const maestroPath = path.resolve(__dirname, '../../Maestro1.xlsx');
  
  if (!fs.existsSync(maestroPath)) {
    console.error('❌ No se encontró Maestro1.xlsx en la raíz.');
    process.exit(1);
  }

  const wb = XLSX.readFile(maestroPath);
  const targetPlanillasDir = path.resolve(__dirname, '../../ARCHIVOS/Planillas_Maestras');
  if (!fs.existsSync(targetPlanillasDir)) {
    fs.mkdirSync(targetPlanillasDir, { recursive: true });
  }

  // ==========================================
  // 1. PROCESAR RUTAS
  // ==========================================
  const rutasSheet = wb.Sheets['Rutas'];
  let createdRoutesCount = 0;
  if (rutasSheet) {
    const rawRutas = XLSX.utils.sheet_to_json(rutasSheet);
    console.log(`📦 Procesando ${rawRutas.length} Rutas de Venta...`);
    for (const r of rawRutas) {
      const rName = cleanText(r.RUTA || r.LOCALIDAD);
      if (rName) {
        const existing = await prisma.saleRoute.findFirst({
          where: { name: { equals: rName, mode: 'insensitive' } }
        });
        if (!existing) {
          await prisma.saleRoute.create({
            data: {
              name: rName,
              description: cleanText(r.OBSERVACIONES) || `Ruta ${rName}`,
              saleDay: cleanText(r.DIA_VENTA),
              deliveryDay: cleanText(r.DIA_REPARTO)
            }
          });
          createdRoutesCount++;
        }
      }
    }
    console.log(`✅ Rutas procesadas. ${createdRoutesCount} creadas.`);
  }

  // Map de Rutas existentes
  const dbRoutes = await prisma.saleRoute.findMany();
  const routeMap = new Map();
  dbRoutes.forEach(r => routeMap.set(r.name.toLowerCase().trim(), r.id));

  // Map de Vendedores existentes
  const dbSellers = await prisma.user.findMany({ where: { role: 'VENDEDOR' } });
  const sellerMap = new Map();
  dbSellers.forEach(s => sellerMap.set(s.username.toLowerCase().trim(), s.id));

  // ==========================================
  // 2. PROCESAR RUBROS Y PRODUCTOS
  // ==========================================
  const prodSheet = wb.Sheets['Productos'];
  const cleanProdRows = [];
  const cleanPriceRows = [];
  let createdProds = 0;
  let updatedProds = 0;

  if (prodSheet) {
    const rawProds = XLSX.utils.sheet_to_json(prodSheet);
    console.log(`📦 Procesando ${rawProds.length} Productos...`);

    // Asegurar Rubros
    const rubrosNames = [...new Set(rawProds.map(p => cleanText(p.RUBRO)).filter(Boolean))];
    for (const rName of rubrosNames) {
      const existing = await prisma.rubro.findFirst({
        where: { name: { equals: rName, mode: 'insensitive' } }
      });
      if (!existing) {
        await prisma.rubro.create({ data: { name: rName, description: `Rubro ${rName}` } });
      }
    }
    const dbRubros = await prisma.rubro.findMany();
    const rubroMap = new Map();
    dbRubros.forEach(r => rubroMap.set(r.name.toLowerCase().trim(), r.id));

    for (const p of rawProds) {
      const sku = normalizeSku(p.SKU);
      const name = cleanText(p.PRODUCTO);
      if (!sku || !name) continue;

      const rubroName = cleanText(p.RUBRO);
      const rubroId = rubroName ? rubroMap.get(rubroName.toLowerCase()) : null;
      const costPrice = parseExcelNum(p.COSTO);
      const listPrice = parseExcelNum(p.PRECIO_FINAL || p['PRECIO SIN IVA'] || p.COSTO);
      const unitsPerBox = parseExcelNum(p['UNIDADES POR CAJA']) || 1;
      const minStock = parseExcelNum(p['STOCK MINIMO']) || 0;
      const isPesable = (cleanText(p.PESABLE)).toUpperCase() === 'SI';
      const approxWeight = parseExcelNum(p['PESO APROXIMADO']);
      const commercialCat = cleanText(p['CATEGORÍA COMERCIAL']);
      const active = (cleanText(p.ESTADO)).toUpperCase() !== 'INACTIVO';

      cleanProdRows.push({
        SKU: sku,
        DESCRIPCION: name,
        RUBRO: rubroName,
        COSTO: costPrice,
        PRECIO_LISTA: listPrice,
        UNIDADES_CAJA: unitsPerBox,
        ESTADO: active ? 'ACTIVO' : 'INACTIVO'
      });

      cleanPriceRows.push({
        SKU: sku,
        PRODUCTO: name,
        COSTO: costPrice,
        LISTA_A: listPrice,
        LISTA_B: Math.round(listPrice * 0.95),
        LISTA_C: Math.round(listPrice * 0.90)
      });

      const existingProd = await prisma.product.findUnique({ where: { sku } });
      if (existingProd) {
        await prisma.product.update({
          where: { sku },
          data: {
            name,
            costPrice,
            listPrice,
            unitsPerBox,
            minStock,
            isPesable,
            approximateWeight: approxWeight || null,
            commercialCategory: commercialCat || null,
            rubroId: rubroId || null,
            isActive: active
          }
        });
        updatedProds++;
      } else {
        await prisma.product.create({
          data: {
            sku,
            name,
            costPrice,
            listPrice,
            unitsPerBox,
            minStock,
            isPesable,
            approximateWeight: approxWeight || null,
            commercialCategory: commercialCat || null,
            rubroId: rubroId || null,
            isActive: active
          }
        });
        createdProds++;
      }
    }
  }

  // Escribir 01_PRODUCTOS_CATALOGO.xlsx y 02_LISTA_PRECIOS.xlsx
  const wbCat = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbCat, XLSX.utils.json_to_sheet(cleanProdRows), 'Productos');
  XLSX.writeFile(wbCat, path.join(targetPlanillasDir, '01_PRODUCTOS_CATALOGO.xlsx'));

  const wbPrices = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbPrices, XLSX.utils.json_to_sheet(cleanPriceRows), 'Precios');
  XLSX.writeFile(wbPrices, path.join(targetPlanillasDir, '02_LISTA_PRECIOS.xlsx'));

  console.log(`✅ Productos importados a BD: ${createdProds} creados, ${updatedProds} actualizados.`);

  // ==========================================
  // 3. PROCESAR CLIENTES
  // ==========================================
  const clientsSheet = wb.Sheets['Clientes'];
  const cleanClientRows = [];
  let createdClients = 0;
  let updatedClients = 0;

  if (clientsSheet) {
    const rawClients = XLSX.utils.sheet_to_json(clientsSheet);
    console.log(`📦 Procesando ${rawClients.length} Clientes...`);

    for (const c of rawClients) {
      const name = cleanText(c['NOMBRE Y APELLIDO']);
      if (!name) continue;

      const rawCuitVal = cleanText(c.CUIT);
      const cuit = cleanCuit(rawCuitVal);
      const address = cleanText(c.DIRECCION);
      const city = cleanText(c['LOCALIDAD / PUEBLO']);
      const province = cleanText(c.PROVINCIA);
      const routeName = cleanText(c['RUTAS DE VENTA']);
      const routeId = routeName ? routeMap.get(routeName.toLowerCase()) : null;
      const priceListStr = cleanText(c['LISTA DE PRECIOS']) || 'A';
      const maxPending = parseExcelNum(c['MAXIMO FACTURAS PENDIENTES']) || 0;
      const sellerName = cleanText(c.VENDEDOR);

      let sellerId = null;
      if (sellerName) {
        const lowerS = sellerName.toLowerCase();
        for (const [sUser, sId] of sellerMap.entries()) {
          if (lowerS.includes(sUser)) {
            sellerId = sId;
            break;
          }
        }
      }

      cleanClientRows.push({
        CUIT: cuit || rawCuitVal,
        RAZON_SOCIAL: name,
        DIRECCION: address,
        LOCALIDAD: city,
        PROVINCIA: province,
        RUTA: routeName,
        VENDEDOR: sellerName,
        LISTA_PRECIOS: priceListStr
      });

      let existingClient = null;
      if (cuit) {
        existingClient = await prisma.persona.findFirst({ where: { cuit } });
      }
      if (!existingClient) {
        existingClient = await prisma.persona.findFirst({
          where: { name: { equals: name, mode: 'insensitive' } }
        });
      }

      if (existingClient) {
        await prisma.persona.update({
          where: { id: existingClient.id },
          data: {
            name,
            cuit: cuit || existingClient.cuit,
            address: address || existingClient.address,
            city: city || existingClient.city,
            province: province || existingClient.province,
            route: routeName || existingClient.route,
            saleRouteId: routeId || existingClient.saleRouteId,
            sellerId: sellerId || existingClient.sellerId,
            priceList: priceListStr || existingClient.priceList,
            maxUnpaidInvoices: maxPending,
            isClient: true
          }
        });
        updatedClients++;
      } else {
        await prisma.persona.create({
          data: {
            name,
            cuit,
            address,
            city,
            province,
            route: routeName,
            saleRouteId: routeId,
            sellerId,
            priceList: priceListStr,
            maxUnpaidInvoices: maxPending,
            isClient: true
          }
        });
        createdClients++;
      }
    }
  }

  // Escribir 03_CLIENTES_MAESTRO.xlsx
  const wbClients = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbClients, XLSX.utils.json_to_sheet(cleanClientRows), 'Clientes');
  XLSX.writeFile(wbClients, path.join(targetPlanillasDir, '03_CLIENTES_MAESTRO.xlsx'));

  console.log(`✅ Clientes importados a BD: ${createdClients} creados, ${updatedClients} actualizados.`);

  // ==========================================
  // 4. BANCOS
  // ==========================================
  const bancosSheet = wb.Sheets['Bancos'];
  if (bancosSheet) {
    const rawBancos = XLSX.utils.sheet_to_json(bancosSheet);
    for (const b of rawBancos) {
      const bName = cleanText(b.BANCO);
      const accNum = cleanText(b['Nº CUENTA'] || b.CUENTA);
      if (bName) {
        const existing = await prisma.bankAccount.findFirst({
          where: { name: { equals: bName, mode: 'insensitive' } }
        });
        if (!existing) {
          await prisma.bankAccount.create({
            data: { name: bName, accountNumber: accNum || null }
          });
        }
      }
    }
  }

  console.log('🎉 Sincronización e importación maestro completada impecablemente.');
}

run().catch(e => {
  console.error('❌ Error en importación:', e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
