const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const rootPath = path.join(__dirname, '../..');
  const datosPath = path.join(rootPath, 'Datos-Totales.xlsx');
  const codigosPath = path.join(rootPath, 'codigos-barra.xlsx');

  console.log(`🚀 Leyendo planillas Excel...`);
  console.log(`📌 Datos Totales: ${datosPath}`);
  console.log(`📌 Códigos de Barras: ${codigosPath}`);

  // 1. Cargar mapa de códigos de barras desde codigos-barra.xlsx
  const wbBar = XLSX.readFile(codigosPath);
  const rowsBar = XLSX.utils.sheet_to_json(wbBar.Sheets[wbBar.SheetNames[0]], { header: 1 });
  const barcodeMap = new Map();

  rowsBar.forEach(r => {
    if (r[0] && r[1]) {
      const name = String(r[0]).trim();
      const val = String(r[1]).trim();
      const eanMatch = val.match(/\b\d{10,14}\b/);
      if (eanMatch) {
        const cleanName = name.toLowerCase().replace(/^(?:\d+|\s+|-)+/, '').trim();
        barcodeMap.set(cleanName, eanMatch[0]);
      }
    }
  });

  console.log(`📦 Códigos EAN extraídos de codigos-barra.xlsx: ${barcodeMap.size}`);

  // 2. Cargar Datos-Totales.xlsx y actualizar la columna COD.BARRAS en la solapa Productos
  const wbTot = XLSX.readFile(datosPath);
  const prodSheetName = 'Productos';
  const prodSheet = wbTot.Sheets[prodSheetName];
  if (!prodSheet) {
    console.error(`❌ No se encontró la solapa "${prodSheetName}" en ${datosPath}`);
    return;
  }

  const prodRows = XLSX.utils.sheet_to_json(prodSheet);
  let eanMatchedInExcel = 0;

  prodRows.forEach(row => {
    const pName = String(row.PRODUCTO || '').trim().toLowerCase();
    if (!row['COD.BARRAS'] || String(row['COD.BARRAS']).trim() === '') {
      for (const [bName, ean] of barcodeMap.entries()) {
        if (pName.includes(bName) || bName.includes(pName) || (bName.length > 6 && pName.replace(/\s+/g, '').includes(bName.replace(/\s+/g, '')))) {
          row['COD.BARRAS'] = ean;
          eanMatchedInExcel++;
          break;
        }
      }
    }
  });

  // Escribir los datos actualizados de vuelta a Datos-Totales.xlsx
  const updatedSheet = XLSX.utils.json_to_sheet(prodRows);
  wbTot.Sheets[prodSheetName] = updatedSheet;
  XLSX.writeFile(wbTot, datosPath);

  console.log(`✨ ${eanMatchedInExcel} productos en "Datos-Totales.xlsx" (solapa Productos) fueron enriquecidos automáticamente con su código de barras.`);

  // 3. Impactar en la Base de Datos PostgreSQL del ERP
  const dbProducts = await prisma.product.findMany();
  let updatedInDb = 0;

  for (const p of dbProducts) {
    const pName = p.name.toLowerCase().trim();
    let foundEan = null;

    for (const [bName, ean] of barcodeMap.entries()) {
      if (pName.includes(bName) || bName.includes(pName) || (bName.length > 6 && pName.replace(/\s+/g, '').includes(bName.replace(/\s+/g, '')))) {
        foundEan = ean;
        break;
      }
    }

    if (foundEan && !p.barcode) {
      try {
        await prisma.product.update({
          where: { id: p.id },
          data: { barcode: foundEan }
        });
        updatedInDb++;
      } catch (err) {
        // Ignorar duplicados
      }
    }
  }

  console.log(`✅ Base de datos actualizada: ${updatedInDb} productos recibieron su código de barras.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
