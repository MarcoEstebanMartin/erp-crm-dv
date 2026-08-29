const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

async function processInChunks(items, chunkSize, fn) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(chunk.map(fn));
  }
}

async function main() {
  const isUndoMode = process.argv.includes('--undo-prices');

  if (isUndoMode) {
    console.log('↩️ MODO REVERSIÓN DE PRECIOS (UNDO)');
    console.log('==================================');
    const productsWithHistory = await prisma.product.findMany({
      where: {
        previousCostPrice: { not: null },
        previousListPrice: { not: null }
      }
    });

    if (productsWithHistory.length === 0) {
      console.log('⚠️ No hay historial de precios anteriores para restaurar.');
      return;
    }

    let revertedCount = 0;
    await processInChunks(productsWithHistory, 5, async (p) => {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          costPrice: p.previousCostPrice,
          listPrice: p.previousListPrice,
          previousCostPrice: null,
          previousListPrice: null,
          lastPriceUpdateAt: new Date()
        }
      });
      revertedCount++;
    });

    console.log(`✅ Se restauraron exitosamente ${revertedCount} productos a sus precios anteriores.`);
    return;
  }

  console.log('🚀 Sincronizador Maestro <-> Base de Datos PostgreSQL (Modo Ultra-Rápido & Parroquia)');
  console.log('=================================================================================');

  const excelPath = path.resolve(__dirname, '../Maestro.xlsx');
  if (!fs.existsSync(excelPath)) {
    console.error('❌ Archivo Maestro.xlsx no encontrado.');
    return;
  }

  const pyDumpScript = `
import openpyxl, json

excel_path = r'${excelPath}'
wb = openpyxl.load_workbook(excel_path, data_only=True)

data = {}

# 1. PRODUCTOS
if 'Productos' in wb.sheetnames:
    ws = wb['Productos']
    prods = []
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) > 1:
        for r in rows[1:]:
            if not r or not r[0] or not r[1]: continue
            sku = str(r[0]).strip().zfill(4)
            name = str(r[1]).strip()
            if name == 'PRODUCTO' or name == '': continue
            costo = float(r[16]) if len(r)>16 and r[16] is not None and str(r[16]).replace('.','',1).isdigit() else 0.0
            precio_final = float(r[19]) if len(r)>19 and r[19] is not None and str(r[19]).replace('.','',1).isdigit() else 0.0
            pesable = str(r[11]).strip().upper() == 'SI' if len(r)>11 and r[11] else False
            units_box = int(r[4]) if len(r)>4 and r[4] is not None and str(r[4]).isdigit() else 1
            rubro = str(r[13]).strip() if len(r)>13 and r[13] else 'ALMACEN'
            barcode = str(r[20]).strip() if len(r)>20 and r[20] else None

            prods.append({
                'sku': sku,
                'name': name,
                'costPrice': costo,
                'listPrice': precio_final,
                'isPesable': pesable,
                'unitsPerBox': units_box,
                'rubro': rubro,
                'barcode': barcode
            })
    data['products'] = prods

# 2. CLIENTES
if 'Clientes y Vendedores' in wb.sheetnames:
    ws = wb['Clientes y Vendedores']
    clients = []
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) > 1:
        for r in rows[1:]:
            if not r or not r[1]: continue
            nombre = str(r[1]).strip()
            if nombre in ['NOMBRE Y APELLIDO', '']: continue
            cuit = str(r[11]).strip().replace('-','').replace('.','') if len(r)>11 and r[11] else None
            direccion = str(r[10]).strip() if len(r)>10 and r[10] else ''
            localidad = str(r[7]).strip() if len(r)>7 and r[7] else ''
            telefono = str(r[9]).strip() if len(r)>9 and r[9] else ''
            email = str(r[15]).strip() if len(r)>15 and r[15] else ''

            clients.append({
                'name': nombre,
                'cuit': cuit,
                'address': direccion,
                'city': localidad,
                'phone': telefono,
                'email': email
            })
    data['clients'] = clients

# 3. PROVEEDORES
if 'Proveedores' in wb.sheetnames:
    ws = wb['Proveedores']
    suppliers = []
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) > 1:
        for r in rows[1:]:
            if not r or not r[0]: continue
            nombre = str(r[0]).strip()
            if nombre in ['PROVEEDORES', '']: continue
            cuit = str(r[7]).strip().replace('-','').replace('.','') if len(r)>7 and r[7] else None
            direccion = str(r[6]).strip() if len(r)>6 and r[6] else ''
            
            suppliers.append({
                'name': nombre,
                'cuit': cuit,
                'address': direccion
            })
    data['suppliers'] = suppliers

# 4. RUTAS
if 'Rutas' in wb.sheetnames:
    ws = wb['Rutas']
    routes = []
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) > 1:
        for r in rows[1:]:
            if not r or not r[0]: continue
            localidad = str(r[0]).strip()
            if localidad in ['LOCALIDAD', '']: continue
            nombre_ruta = str(r[1]).strip() if len(r)>1 and r[1] else localidad
            ciclo = str(r[2]).strip() if len(r)>2 and r[2] else 'AMBAS'
            dia_venta = str(r[3]).strip() if len(r)>3 and r[3] else 'LUNES'

            freq = 'SEMANAL'
            if '1' in ciclo or 'A' in ciclo.upper(): freq = 'QUINCENAL_A'
            elif '2' in ciclo or 'B' in ciclo.upper(): freq = 'QUINCENAL_B'

            routes.append({
                'name': nombre_ruta,
                'city': localidad,
                'dayOfWeek': dia_venta,
                'frequency': freq
            })
    data['routes'] = routes

print(json.dumps(data, ensure_ascii=False))
  `;

  const tmpScript = path.resolve(__dirname, 'dump_maestro_temp.py');
  fs.writeFileSync(tmpScript, pyDumpScript, 'utf8');

  try {
    const pyOutput = execSync(`python "${tmpScript}"`).toString();
    if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);

    const maestroData = JSON.parse(pyOutput);

    // 1. Sincronizar Productos (con respaldo de precios anteriores)
    if (maestroData.products) {
      console.log(`📦 Procesando ${maestroData.products.length} Productos...`);
      const existingProducts = await prisma.product.findMany();
      const skuMap = new Map(existingProducts.map(p => [p.sku.trim(), p]));
      const nameMap = new Map(existingProducts.map(p => [p.name.trim().toLowerCase(), p]));

      let prodUpdated = 0, prodCreated = 0, priceBackedUp = 0;
      await processInChunks(maestroData.products, 5, async (item) => {
        const existing = skuMap.get(item.sku) || nameMap.get(item.name.toLowerCase());
        if (existing) {
          const costHasChanged = item.costPrice > 0 && Number(existing.costPrice) !== item.costPrice;
          const listHasChanged = item.listPrice > 0 && Number(existing.listPrice) !== item.listPrice;

          const updateData = {
            name: item.name,
            costPrice: item.costPrice > 0 ? item.costPrice : existing.costPrice,
            listPrice: item.listPrice > 0 ? item.listPrice : existing.listPrice,
            isPesable: item.isPesable,
            unitsPerBox: item.unitsPerBox,
            barcode: item.barcode || existing.barcode
          };

          if (costHasChanged || listHasChanged) {
            updateData.previousCostPrice = existing.costPrice;
            updateData.previousListPrice = existing.listPrice;
            updateData.lastPriceUpdateAt = new Date();
            priceBackedUp++;
          }

          await prisma.product.update({
            where: { id: existing.id },
            data: updateData
          });
          prodUpdated++;
        } else {
          await prisma.product.create({
            data: {
              sku: item.sku,
              name: item.name,
              costPrice: item.costPrice,
              listPrice: item.listPrice,
              isPesable: item.isPesable,
              unitsPerBox: item.unitsPerBox,
              barcode: item.barcode
            }
          });
          prodCreated++;
        }
      });
      console.log(`   └─ ✅ Productos: ${prodUpdated} actualizados (${priceBackedUp} con respaldo de precio anterior), ${prodCreated} creados.`);
    }

    // 2. Sincronizar Clientes
    if (maestroData.clients) {
      console.log(`👥 Procesando ${maestroData.clients.length} Clientes...`);
      const existingPersonas = await prisma.persona.findMany({ where: { isClient: true } });
      const cuitMap = new Map(existingPersonas.filter(p => p.cuit).map(p => [p.cuit.trim(), p]));
      const personaNameMap = new Map(existingPersonas.map(p => [p.name.trim().toLowerCase(), p]));

      let clientUpdated = 0, clientCreated = 0;
      await processInChunks(maestroData.clients, 5, async (item) => {
        if (!item.name) return;
        const existing = (item.cuit ? cuitMap.get(item.cuit) : null) || personaNameMap.get(item.name.toLowerCase());

        if (existing) {
          await prisma.persona.update({
            where: { id: existing.id },
            data: {
              address: item.address || existing.address,
              city: item.city || existing.city,
              phone: item.phone || existing.phone,
              email: item.email || existing.email
            }
          });
          clientUpdated++;
        } else {
          await prisma.persona.create({
            data: {
              isClient: true,
              name: item.name,
              cuit: item.cuit,
              address: item.address,
              city: item.city,
              phone: item.phone,
              email: item.email
            }
          });
          clientCreated++;
        }
      });
      console.log(`   └─ ✅ Clientes: ${clientUpdated} actualizados, ${clientCreated} creados.`);
    }

    // 3. Sincronizar Proveedores
    if (maestroData.suppliers) {
      console.log(`🏭 Procesando ${maestroData.suppliers.length} Proveedores...`);
      const existingSuppliers = await prisma.persona.findMany({ where: { isProvider: true } });
      const suppCuitMap = new Map(existingSuppliers.filter(p => p.cuit).map(p => [p.cuit.trim(), p]));
      const suppNameMap = new Map(existingSuppliers.map(p => [p.name.trim().toLowerCase(), p]));

      let suppUpdated = 0, suppCreated = 0;
      await processInChunks(maestroData.suppliers, 5, async (item) => {
        if (!item.name) return;
        const existing = (item.cuit ? suppCuitMap.get(item.cuit) : null) || suppNameMap.get(item.name.toLowerCase());

        if (existing) {
          await prisma.persona.update({
            where: { id: existing.id },
            data: {
              address: item.address || existing.address
            }
          });
          suppUpdated++;
        } else {
          await prisma.persona.create({
            data: {
              isProvider: true,
              name: item.name,
              cuit: item.cuit,
              address: item.address
            }
          });
          suppCreated++;
        }
      });
      console.log(`   └─ ✅ Proveedores: ${suppUpdated} actualizados, ${suppCreated} creados.`);
    }

    // 4. Sincronizar Rutas con Frecuencia Quincenal
    if (maestroData.routes) {
      console.log(`🗺️ Procesando ${maestroData.routes.length} Rutas y Frecuencias Quincenales...`);
      const existingRoutes = await prisma.saleRoute.findMany();
      const routeNameMap = new Map(existingRoutes.map(r => [r.name.trim().toLowerCase(), r]));

      let routeUpdated = 0, routeCreated = 0;
      await processInChunks(maestroData.routes, 5, async (item) => {
        const existing = routeNameMap.get(item.name.toLowerCase());
        if (existing) {
          await prisma.saleRoute.update({
            where: { id: existing.id },
            data: {
              dayOfWeek: item.dayOfWeek || existing.dayOfWeek,
              frequency: item.frequency || existing.frequency
            }
          });
          routeUpdated++;
        } else {
          await prisma.saleRoute.create({
            data: {
              name: item.name,
              dayOfWeek: item.dayOfWeek,
              frequency: item.frequency
            }
          });
          routeCreated++;
        }
      });
      console.log(`   └─ ✅ Rutas: ${routeUpdated} actualizadas, ${routeCreated} creadas.`);
    }

    console.log('\n🎉 Sincronización completa finalizada exitosamente.');
  } catch (err) {
    if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);
    console.error('❌ Error durante la sincronización:', err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
