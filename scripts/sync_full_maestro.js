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

  const excelPath1 = path.resolve(__dirname, '../Maestro1.xlsx');
  const excelPath0 = path.resolve(__dirname, '../Maestro.xlsx');
  const excelPath = fs.existsSync(excelPath1) ? excelPath1 : excelPath0;

  if (!fs.existsSync(excelPath)) {
    console.error('❌ Archivo Maestro1.xlsx / Maestro.xlsx no encontrado.');
    return;
  }

  const tmpJsonPath = path.resolve(__dirname, 'dump_maestro_temp.json');
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
            raw_name = str(r[1]).strip()
            if raw_name == 'PRODUCTO' or raw_name == '': continue
            
            # Sanitize encoding
            name = raw_name
            
            min_order = int(r[3]) if len(r)>3 and r[3] is not None and str(r[3]).isdigit() else 1
            units_box = int(r[4]) if len(r)>4 and r[4] is not None and str(r[4]).isdigit() else 1
            picking_zone = str(r[5]).strip() if len(r)>5 and r[5] else None
            min_stock = int(r[6]) if len(r)>6 and r[6] is not None and str(r[6]).isdigit() else 0
            def_loc = str(r[7]).strip() if len(r)>7 and r[7] else None
            
            cat_comercial = str(r[9]).strip() if len(r)>9 and r[9] else None
                
            pesable = str(r[10]).strip().upper() == 'SI' if len(r)>10 and r[10] else False
            rubro = str(r[12]).strip() if len(r)>12 and r[12] else 'ALMACÉN'
            
            subrubro = str(r[13]).strip() if len(r)>13 and r[13] else None
            provider = str(r[14]).strip() if len(r)>14 and r[14] else None
            
            costo = float(r[15]) if len(r)>15 and r[15] is not None and str(r[15]).replace('.','',1).isdigit() else 0.0
            profit_margin = float(r[16]) if len(r)>16 and r[16] is not None and str(r[16]).replace('.','',1).isdigit() else 35.0
            precio_final = float(r[18]) if len(r)>18 and r[18] is not None and str(r[18]).replace('.','',1).isdigit() else 0.0
            barcode = str(r[19]).strip() if len(r)>19 and r[19] else None
            estado = str(r[20]).strip().upper() if len(r)>20 and r[20] else 'ACTIVO'

            prods.append({
                'sku': sku,
                'name': name,
                'costPrice': costo,
                'listPrice': precio_final,
                'isPesable': pesable,
                'unitsPerBox': units_box,
                'minOrderQuantity': min_order,
                'minStock': min_stock,
                'pickingZone': picking_zone,
                'defaultLocation': def_loc,
                'commercialCategory': cat_comercial,
                'rubro': rubro,
                'subrubro': subrubro,
                'provider': provider,
                'profitMargin': profit_margin,
                'barcode': barcode,
                'isActive': estado == 'ACTIVO'
            })
    data['products'] = prods

# 2. CLIENTES
client_sheet = 'Clientes' if 'Clientes' in wb.sheetnames else ('Clientes y Vendedores' if 'Clientes y Vendedores' in wb.sheetnames else None)
if client_sheet:
    ws = wb[client_sheet]
    clients = []
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) > 1:
        for r in rows[1:]:
            if not r or not r[1]: continue
            nombre = str(r[1]).strip()
            if nombre in ['NOMBRE Y APELLIDO', '']: continue
            
            # Sanitizar cuentas internas que no son clientes
            if nombre.upper() in ['AJUSTE DE STOCK', 'MOVIMIENTOS DE AJUSTE', 'RECAUDACION', 'DIFERENCIA DE CAJA', 'OFICINA', 'EJEMPLO NO USAR']:
                continue

            price_list = str(r[2]).strip() if len(r)>2 and r[2] is not None else 'A'
            max_invoices = float(r[3]) if len(r)>3 and r[3] is not None and str(r[3]).replace('.','',1).isdigit() else 1.0
            route_val = str(r[4]).strip() if len(r)>4 and r[4] else None
            localidad = str(r[5]).strip() if len(r)>5 and r[5] else ''
            provincia = str(r[6]).strip() if len(r)>6 and r[6] else 'BUENOS AIRES'
            telefono = str(r[7]).strip() if len(r)>7 and r[7] else ''
            direccion = str(r[8]).strip() if len(r)>8 and r[8] else ''
            
            raw_cuit = str(r[9]).strip().replace('-','').replace('.','') if len(r)>9 and r[9] else None
            cuit = raw_cuit if raw_cuit and raw_cuit.isdigit() and len(raw_cuit) >= 10 else None
            
            vendedor = str(r[11]).strip() if len(r)>11 and r[11] else None
            email = str(r[13]).strip() if len(r)>13 and r[13] else ''

            clients.append({
                'name': nombre,
                'cuit': cuit,
                'priceList': price_list,
                'maxUnpaidInvoices': max_invoices,
                'route': route_val,
                'address': direccion,
                'city': localidad,
                'province': provincia,
                'phone': telefono,
                'vendedor': vendedor,
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

# 5. BANCOS
if 'Bancos' in wb.sheetnames:
    ws = wb['Bancos']
    bancos = []
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) > 1:
        for r in rows[1:]:
            if not r or not r[0]: continue
            banco = str(r[0]).strip()
            if banco in ['BANCO', '']: continue
            cuenta_tipo = str(r[1]).strip() if len(r)>1 and r[1] else ''
            nro_cuenta = str(r[2]).strip() if len(r)>2 and r[2] else ''
            cbu_cvu = str(r[4]).strip() if len(r)>4 and r[4] else ''
            alias = str(r[5]).strip() if len(r)>5 and r[5] else ''

            nombre_completo = f"{banco} - {cuenta_tipo}" if cuenta_tipo else banco
            detalles = []
            if nro_cuenta and nro_cuenta != 'None': detalles.append(f"Nº: {nro_cuenta}")
            if cbu_cvu and cbu_cvu != 'None': detalles.append(f"CBU/CVU: {cbu_cvu}")
            if alias and alias != 'None': detalles.append(f"Alias: {alias}")

            bancos.append({
                'name': nombre_completo,
                'accountNumber': ' | '.join(detalles)
            })
    data['bancos'] = bancos

with open(r'${tmpJsonPath}', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)
`;

  const tmpScript = path.resolve(__dirname, 'dump_maestro_temp.py');
  fs.writeFileSync(tmpScript, pyDumpScript, 'utf8');

  try {
    execSync(`python "${tmpScript}"`);
    const pyOutput = fs.readFileSync(tmpJsonPath, 'utf8');
    if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);
    if (fs.existsSync(tmpJsonPath)) fs.unlinkSync(tmpJsonPath);

    const maestroData = JSON.parse(pyOutput);

    // 1. Sincronizar Productos (con respaldo de precios anteriores y mapeo de Rubro/Categoría)
    if (maestroData.products) {
      console.log(`📦 Procesando ${maestroData.products.length} Productos...`);
      const existingProducts = await prisma.product.findMany();
      const skuMap = new Map(existingProducts.map(p => [p.sku.trim(), p]));
      const nameMap = new Map(existingProducts.map(p => [p.name.trim().toLowerCase(), p]));

      // Cache Rubros
      const existingRubros = await prisma.rubro.findMany();
      const rubroNameMap = new Map(existingRubros.map(r => [r.name.trim().toLowerCase(), r]));

      async function getOrCreateRubro(rubroName) {
        if (!rubroName) return null;
        const norm = rubroName.trim().toLowerCase();
        if (rubroNameMap.has(norm)) return rubroNameMap.get(norm).id;

        const uppercaseName = rubroName.trim().toUpperCase();
        try {
          const newRubro = await prisma.rubro.upsert({
            where: { name: uppercaseName },
            update: {},
            create: { name: uppercaseName }
          });
          rubroNameMap.set(norm, newRubro);
          return newRubro.id;
        } catch (e) {
          const found = await prisma.rubro.findFirst({ where: { name: uppercaseName } });
          if (found) {
            rubroNameMap.set(norm, found);
            return found.id;
          }
          throw e;
        }
      }

      // Cache Proveedores
      const existingProviders = await prisma.persona.findMany({ where: { isProvider: true } });
      const providerNameMap = new Map(existingProviders.map(p => [p.name.trim().toLowerCase(), p]));

      async function getOrCreateProvider(providerName) {
        if (!providerName) return null;
        const norm = providerName.trim().toLowerCase();
        if (providerNameMap.has(norm)) return providerNameMap.get(norm).id;

        const uppercaseName = providerName.trim().toUpperCase();
        const existing = await prisma.persona.findFirst({ where: { name: uppercaseName, isProvider: true } });
        if (existing) {
          providerNameMap.set(norm, existing);
          return existing.id;
        }
        try {
          const newProvider = await prisma.persona.create({
            data: {
              name: uppercaseName,
              isProvider: true
            }
          });
          providerNameMap.set(norm, newProvider);
          return newProvider.id;
        } catch (e) {
          const found = await prisma.persona.findFirst({ where: { name: uppercaseName, isProvider: true } });
          if (found) {
            providerNameMap.set(norm, found);
            return found.id;
          }
          throw e;
        }
      }

      let prodUpdated = 0, prodCreated = 0, priceBackedUp = 0;
      await processInChunks(maestroData.products, 5, async (item) => {
        const existing = skuMap.get(item.sku) || nameMap.get(item.name.toLowerCase());
        const rubroId = await getOrCreateRubro(item.rubro);
        const providerId = await getOrCreateProvider(item.provider);

        const productData = {
          sku: item.sku,
          name: item.name,
          description: null,
          costPrice: item.costPrice > 0 ? item.costPrice : (existing ? existing.costPrice : 0),
          listPrice: item.listPrice > 0 ? item.listPrice : (existing ? existing.listPrice : 0),
          isPesable: item.isPesable,
          unitsPerBox: item.unitsPerBox,
          minOrderQuantity: item.minOrderQuantity,
          minStock: item.minStock,
          pickingZone: item.pickingZone,
          defaultLocation: item.defaultLocation,
          commercialCategory: item.commercialCategory,
          rubroId: rubroId || (existing ? existing.rubroId : null),
          providerId: providerId || (existing ? existing.providerId : null),
          profitMargin: item.profitMargin,
          isActive: item.isActive,
          barcode: item.barcode || (existing ? existing.barcode : null)
        };

        if (existing) {
          const costHasChanged = item.costPrice > 0 && Number(existing.costPrice) !== item.costPrice;
          const listHasChanged = item.listPrice > 0 && Number(existing.listPrice) !== item.listPrice;

          if (costHasChanged || listHasChanged) {
            productData.previousCostPrice = existing.costPrice;
            productData.previousListPrice = existing.listPrice;
            productData.lastPriceUpdateAt = new Date();
            priceBackedUp++;
          }

          await prisma.product.update({
            where: { id: existing.id },
            data: productData
          });
          prodUpdated++;
        } else {
          await prisma.product.create({
            data: productData
          });
          prodCreated++;
        }
      });

      // Inactivar en DB cualquier producto cuyo SKU no pertenezca a Maestro1.xlsx
      const maestroSkus = new Set(maestroData.products.map(p => p.sku));
      const orphanedInactivations = await prisma.product.updateMany({
        where: {
          sku: { notIn: Array.from(maestroSkus) },
          isActive: true
        },
        data: { isActive: false }
      });

      console.log(`   └─ ✅ Productos: ${prodUpdated} actualizados (${priceBackedUp} con respaldo de precio anterior), ${prodCreated} creados, ${orphanedInactivations.count} inactivados por no estar en Maestro1.`);
    }

    // 2. Sincronizar Clientes
    if (maestroData.clients) {
      console.log(`👥 Procesando ${maestroData.clients.length} Clientes...`);
      const existingPersonas = await prisma.persona.findMany({ where: { isClient: true } });
      const cuitMap = new Map(existingPersonas.filter(p => p.cuit).map(p => [p.cuit.trim(), p]));
      const personaNameMap = new Map(existingPersonas.map(p => [p.name.trim().toLowerCase(), p]));

      // Mapeo de Rutas a IDs de SaleRoute
      const allRoutes = await prisma.saleRoute.findMany();
      const routeMap = new Map();
      allRoutes.forEach(r => routeMap.set(r.name.trim().toUpperCase(), r.id));

      const mapRouteToId = (rName) => {
        if (!rName) return null;
        const upper = rName.toUpperCase().trim();
        if (routeMap.has(upper)) return routeMap.get(upper);
        for (const [k, id] of routeMap.entries()) {
          if (upper.includes(k) || k.includes(upper)) return id;
        }
        return null;
      };

      // Mapeo de Vendedores a IDs de User
      const sellers = await prisma.user.findMany({ where: { role: 'VENDEDOR' } });
      const sellerMap = new Map();
      sellers.forEach(s => sellerMap.set(s.username.toLowerCase(), s.id));

      const mapSellerNameToId = (v) => {
        if (!v) return null;
        const upper = v.toUpperCase().trim();
        if (upper.includes('DIEGO') || upper.includes('LEJARZA')) return sellerMap.get('diego');
        if (upper.includes('FABIAN') || upper.includes('MAYA')) return sellerMap.get('fabian');
        if (upper.includes('NORBERTO')) return sellerMap.get('norberto');
        if (upper.includes('MARIA') || upper.includes('VIDELA')) return sellerMap.get('maria_jose');
        return null;
      };

      let clientUpdated = 0, clientCreated = 0;
      await processInChunks(maestroData.clients, 5, async (item) => {
        if (!item.name) return;
        const existing = (item.cuit ? cuitMap.get(item.cuit) : null) || personaNameMap.get(item.name.toLowerCase());
        const saleRouteId = mapRouteToId(item.route);
        const sellerId = mapSellerNameToId(item.vendedor);

        const updateData = {
          name: item.name,
          cuit: item.cuit || existing?.cuit,
          address: item.address || existing?.address,
          city: item.city || existing?.city,
          province: item.province || existing?.province || 'BUENOS AIRES',
          phone: item.phone || existing?.phone,
          email: item.email || existing?.email,
          route: item.route || existing?.route,
          saleRouteId: saleRouteId || existing?.saleRouteId,
          sellerId: sellerId !== null ? sellerId : existing?.sellerId,
          priceList: item.priceList || existing?.priceList || 'A',
          isClient: true
        };

        if (existing) {
          await prisma.persona.update({
            where: { id: existing.id },
            data: updateData
          });
          clientUpdated++;
        } else {
          await prisma.persona.create({
            data: {
              ...updateData,
              name: item.name,
              cuit: item.cuit,
              isClient: true,
              isProvider: false,
              isSeller: false
            }
          });
          clientCreated++;
        }
      });
      console.log(`   └─ ✅ Clientes: ${clientUpdated} actualizados, ${clientCreated} creados.`);
    }

    // 3. Sincronizar Proveedores (Garantizar isClient: false)
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
              address: item.address || existing.address,
              isClient: false,
              isProvider: true
            }
          });
          suppUpdated++;
        } else {
          await prisma.persona.create({
            data: {
              isProvider: true,
              isClient: false,
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

    // 4. Sincronizar Rutas con Frecuencia Quincenal y Nombres Estandarizados
    if (maestroData.routes) {
      console.log(`🗺️ Procesando ${maestroData.routes.length} Rutas y Frecuencias Quincenales...`);
      const existingRoutes = await prisma.saleRoute.findMany();
      
      function cleanRouteName(name) {
        if (!name) return '';
        let norm = String(name).replace(/\s+/g, ' ').trim().toUpperCase();
        if (norm.includes('BANDERALO') && (norm.includes('LARROUDE') || norm.includes('LARROUD'))) return 'BANDERALO Y LARROUDÉ';
        if (norm.includes('VILLEGAS') && norm.includes('FABIAN')) return 'VILLEGAS FABIAN';
        if (norm.includes('BUNGE') && norm.includes('CHARLONE')) return 'BUNGE Y CHARLONE';
        if (norm.includes('BUNGE') && norm.includes('BUCHARDO')) return 'BUNGE Y BUCHARDO';
        if (norm.includes('AMEGHINO') && norm.includes('BLAQUIER')) return 'AMEGHINO Y BLAQUIER';
        if (norm.includes('AMERICA') || norm.includes('FORTIN')) return 'AMERICA Y FORTIN';
        if (norm.includes('SAUCE') || norm.includes('SAUZE') || norm.includes('SANSINENA')) return 'SAUCE Y SANSINENA';
        return norm;
      }

      const routeNameMap = new Map(existingRoutes.map(r => [cleanRouteName(r.name), r]));

      let routeUpdated = 0, routeCreated = 0;
      await processInChunks(maestroData.routes, 5, async (item) => {
        const stdName = cleanRouteName(item.name);
        if (!stdName) return;
        const existing = routeNameMap.get(stdName);
        if (existing) {
          await prisma.saleRoute.update({
            where: { id: existing.id },
            data: {
              name: stdName,
              dayOfWeek: item.dayOfWeek || existing.dayOfWeek,
              frequency: item.frequency || existing.frequency
            }
          });
          routeUpdated++;
        } else {
          await prisma.saleRoute.create({
            data: {
              name: stdName,
              dayOfWeek: item.dayOfWeek,
              frequency: item.frequency
            }
          });
          routeCreated++;
        }
      });
      console.log(`   └─ ✅ Rutas: ${routeUpdated} actualizadas, ${routeCreated} creadas.`);
    }

    // 5. Sincronizar Cuentas Bancarias
    if (maestroData.bancos && maestroData.bancos.length > 0) {
      console.log(`🏦 Procesando ${maestroData.bancos.length} Cuentas Bancarias...`);
      for (const b of maestroData.bancos) {
        const existing = await prisma.bankAccount.findFirst({
          where: { name: { equals: b.name, mode: 'insensitive' } }
        });
        if (existing) {
          await prisma.bankAccount.update({
            where: { id: existing.id },
            data: { accountNumber: b.accountNumber }
          });
        } else {
          await prisma.bankAccount.create({
            data: {
              name: b.name,
              accountNumber: b.accountNumber,
              balance: 0.00
            }
          });
        }
      }
      console.log('   └─ ✅ Cuentas bancarias sincronizadas exitosamente.');
    }

    console.log('\n🎉 Sincronización completa finalizada exitosamente.');
  } catch (err) {
    if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);
    console.error('❌ Error durante la sincronización:', err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
