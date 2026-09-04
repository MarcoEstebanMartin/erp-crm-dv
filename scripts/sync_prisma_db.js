const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const openpyxl = require('child_process');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando sincronización de Base de Datos PostgreSQL con Maestro.xlsx actualizado...');

  const excelPath = path.resolve(__dirname, '../Maestro.xlsx');
  
  const pyDumpScript = `
import openpyxl, json

wb = openpyxl.load_workbook(r'${excelPath}', data_only=True, read_only=True)
ws = wb['Productos']

prods = []
for r in list(ws.iter_rows(values_only=True))[1:]:
    if not r or not r[0] or not r[1]:
        continue
    sku = str(r[0]).strip().zfill(4)
    name = str(r[1]).strip()
    if name == 'PRODUCTO': continue
    
    costo = float(r[16]) if len(r)>16 and r[16] is not None and str(r[16]).replace('.','',1).isdigit() else 0.0
    precio_final = float(r[19]) if len(r)>19 and r[19] is not None and str(r[19]).replace('.','',1).isdigit() else 0.0
    pesable = str(r[11]).strip().upper() == 'SI' if len(r)>11 and r[11] else False
    units_box = int(r[4]) if len(r)>4 and r[4] is not None and str(r[4]).isdigit() else 1
    rubro = str(r[13]).strip() if len(r)>13 and r[13] else 'ALMACEN'
    estado = str(r[21]).strip().upper() if len(r)>21 and r[21] else 'ACTIVO'

    prods.append({
        'sku': sku,
        'name': name,
        'costPrice': costo,
        'listPrice': precio_final,
        'isPesable': pesable,
        'unitsPerBox': units_box,
        'rubro': rubro,
        'isActive': estado == 'ACTIVO'
    })

print(json.dumps(prods))
  `;

  const tmpScript = path.resolve(__dirname, 'dump_products_temp.py');
  fs.writeFileSync(tmpScript, pyDumpScript, 'utf8');

  const pyOutput = openpyxl.execSync(`python "${tmpScript}"`).toString();
  if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);

  const excelProducts = JSON.parse(pyOutput);
  console.log(`📑 Cargados ${excelProducts.length} productos desde Maestro.xlsx`);

  let updatedCount = 0;
  let createdCount = 0;
  let inactivatedCount = 0;

  for (const item of excelProducts) {
    // 1. Buscar por SKU exacto
    let existing = await prisma.product.findUnique({
      where: { sku: item.sku }
    });

    // 2. Si no existe por SKU, buscar por nombre exacto
    if (!existing) {
      existing = await prisma.product.findFirst({
        where: { name: item.name }
      });
    }

    if (existing) {
      // Actualizar sin violar el unique constraint de SKU
      const updateData = {
        name: item.name,
        costPrice: item.costPrice,
        listPrice: item.listPrice,
        isPesable: item.isPesable,
        unitsPerBox: item.unitsPerBox,
        isActive: item.isActive
      };

      await prisma.product.update({
        where: { id: existing.id },
        data: updateData
      });

      if (!item.isActive) {
        inactivatedCount++;
      } else {
        updatedCount++;
      }
    } else {
      // Crear producto nuevo
      await prisma.product.create({
        data: {
          sku: item.sku,
          name: item.name,
          costPrice: item.costPrice,
          listPrice: item.listPrice,
          isPesable: item.isPesable,
          unitsPerBox: item.unitsPerBox,
          isActive: item.isActive
        }
      });
      createdCount++;
    }
  }

  console.log(`\n🎉 Sincronización con PostgreSQL completada exitosamente:`);
  console.log(` - ${updatedCount} productos vigentes actualizados con nuevos precios`);
  console.log(` - ${createdCount} productos nuevos creados en la base de datos`);
  console.log(` - ${inactivatedCount} productos pasados a estado INACTIVO (preservando historial)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
