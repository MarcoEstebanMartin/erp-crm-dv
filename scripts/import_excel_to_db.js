const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const openpyxl = require('child_process');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando importación y sincronización de Stock Inicial con PostgreSQL...');

  const excelPath = path.resolve(__dirname, '../Maestro.xlsx');
  
  // Ejecutamos script python para leer Excel de forma segura (read_only=True no falla aunque esté abierto en Excel)
  const pyDumpScript = `
import openpyxl, json, datetime

wb = openpyxl.load_workbook(r'${excelPath}', data_only=True, read_only=True)

pos_data = []
if 'POSICIONES' in wb.sheetnames:
    ws = wb['POSICIONES']
    for row in list(ws.iter_rows(values_only=True))[1:]:
        if row and row[0]:
            pos_data.append({
                'code': str(row[0]).strip(),
                'deposito': str(row[1]).strip() if row[1] else '',
                'sector': str(row[2]).strip() if row[2] else '',
                'tipo': str(row[3]).strip() if row[3] else '',
                'nivel': str(row[4]).strip() if row[4] else '',
                'picking': str(row[5]).strip() if row[5] else 'NO',
                'rubro': str(row[6]).strip() if row[6] else '',
                'obs': str(row[7]).strip() if len(row)>7 and row[7] else ''
            })

demo_inv = [
    {'sku': 1, 'name': 'MELINCUE BARRA TYBO x KG', 'location': 'D1-CAM2-P01', 'lot': 'L-240810', 'exp': '2026-12-30', 'boxes': 40, 'loose': 0},
    {'sku': 8, 'name': 'MELINCUE MOZZARELLA BARRA x KG', 'location': 'D1-CAM2-P02', 'lot': 'L-240815', 'exp': '2026-11-25', 'boxes': 30, 'loose': 0},
    {'sku': 3, 'name': 'MELINCUE CREMOSO x KG', 'location': 'D1-CAM2-R01-A', 'lot': 'L-240818', 'exp': '2026-10-15', 'boxes': 15, 'loose': 4},
    {'sku': 14, 'name': 'MELINCUE POR SALUT x KG', 'location': 'D1-CAM1-EST-N1', 'lot': 'L-240822', 'exp': '2026-10-05', 'boxes': 10, 'loose': 8},
    {'sku': 62, 'name': 'CREMIGAL MOZZARELLA CILINDRO x KG', 'location': 'D1-CAM1-P01', 'lot': 'L-240830', 'exp': '2026-11-30', 'boxes': 25, 'loose': 0},
    {'sku': 132, 'name': 'CUMANA TOMATE PERITA ENT. x 400gr', 'location': 'D1-CAM3-R01-A', 'lot': 'L-240701', 'exp': '2027-06-30', 'boxes': 50, 'loose': 0},
    {'sku': 179, 'name': 'NATURA ACEITE PVCx900CC', 'location': 'D2-PISO-ACE-01', 'lot': 'L-240601', 'exp': '2027-05-30', 'boxes': 60, 'loose': 0},
    {'sku': 439, 'name': 'SERNOVA VODKA x700ml', 'location': 'D1-RACK1-M02-A', 'lot': 'L-240510', 'exp': '2028-12-31', 'boxes': 20, 'loose': 6},
    {'sku': 33, 'name': 'LECHE UAT ENTERA SACHET x LT CREMIGAL', 'location': 'D3-PISO-UAT-01', 'lot': 'L-240801', 'exp': '2026-10-30', 'boxes': 80, 'loose': 0}
]

print(json.dumps({'positions': pos_data, 'inventory': demo_inv}))
  `;

  const tmpScript = path.resolve(__dirname, 'dump_demo.py');
  fs.writeFileSync(tmpScript, pyDumpScript, 'utf8');

  const pyOutput = openpyxl.execSync(`python "${tmpScript}"`).toString();
  fs.unlinkSync(tmpScript);

  const data = JSON.parse(pyOutput);
  console.log(`📑 Leídas ${data.positions.length} posiciones y ${data.inventory.length} registros de prueba.`);

  let createdLots = 0;
  for (const item of data.inventory) {
    // Buscar producto por SKU o Nombre
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { sku: String(item.sku) },
          { name: { contains: item.name.substring(0, 15) } }
        ]
      }
    });

    if (!product) {
      console.log(`⚠️ Producto no encontrado para SKU ${item.sku} - ${item.name}`);
      continue;
    }

    const totalStock = (item.boxes * (product.unitsPerBox || 1)) + item.loose;
    const expDate = new Date(item.exp);

    // Upsert ProductLot
    const lot = await prisma.productLot.upsert({
      where: {
        productId_lotNumber: {
          productId: product.id,
          lotNumber: item.lot
        }
      },
      update: {
        stock: totalStock,
        location: item.location,
        expirationDate: expDate
      },
      create: {
        productId: product.id,
        lotNumber: item.lot,
        expirationDate: expDate,
        stock: totalStock,
        location: item.location
      }
    });

    // Actualizar stock total del producto
    const allLots = await prisma.productLot.findMany({
      where: { productId: product.id }
    });
    const sumStock = allLots.reduce((acc, l) => acc + l.stock, 0);

    await prisma.product.update({
      where: { id: product.id },
      data: {
        stock: sumStock,
        defaultLocation: item.location
      }
    });

    console.log(`✅ Lote creado/actualizado: [${product.sku}] ${product.name} | Ubicación: ${item.location} | Lote: ${item.lot} | Stock: ${totalStock} un.`);
    createdLots++;
  }

  console.log(`\n🎉 Sincronización completada con éxito. ${createdLots} lotes cargados en la base PostgreSQL.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
