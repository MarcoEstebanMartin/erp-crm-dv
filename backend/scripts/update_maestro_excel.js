const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

function normalizeTokens(str) {
  if (!str) return [];
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 0 && t !== 'x');
}

async function updateMaestroExcel() {
  const maestroPath = path.join(__dirname, '..', '..', 'Maestro.xlsx');
  const backupPath = path.join(__dirname, '..', '..', 'Maestro.xlsx.bak');

  // Asegurar backup antes de modificar
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(maestroPath, backupPath);
    console.log('Copia de seguridad realizada: Maestro.xlsx.bak');
  }

  // Cargar productos desde DB con sus rentabilidades actualizadas
  const dbProducts = await prisma.product.findMany({
    select: {
      id: true,
      sku: true,
      name: true,
      profitMargin: true,
      rubro: { select: { name: true } }
    }
  });

  const dbBySkuPadded = new Map();
  const dbByNameLower = new Map();

  dbProducts.forEach(p => {
    const paddedSku = String(p.sku).padStart(4, '0');
    dbBySkuPadded.set(paddedSku, p);
    if (p.name) dbByNameLower.set(p.name.trim().toLowerCase(), p);
  });

  // Leer Workbook Maestro
  const wb = xlsx.readFile(maestroPath, { cellStyles: true, cellFormulas: true });
  const sheetName = 'Productos';
  const sheet = wb.Sheets[sheetName];

  if (!sheet) {
    throw new Error('No se encontró la pestaña Productos en Maestro.xlsx');
  }

  const range = xlsx.utils.decode_range(sheet['!ref']);
  
  // Buscar índice de la columna RENTABILIDAD
  let rentColIndex = -1;
  let skuColIndex = 0;
  let nameColIndex = 1;

  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellAddress = xlsx.utils.encode_cell({ r: 0, c: C });
    const cell = sheet[cellAddress];
    if (cell && String(cell.v).trim().toUpperCase() === 'RENTABILIDAD') {
      rentColIndex = C;
      break;
    }
  }

  if (rentColIndex === -1) {
    rentColIndex = 17; // Columna R por defecto
  }

  console.log(`Columna RENTABILIDAD identificada en posición ${rentColIndex + 1} (Columna ${xlsx.utils.encode_col(rentColIndex)})`);

  let updatedRowsCount = 0;

  for (let R = 1; R <= range.e.r; ++R) {
    const skuCell = sheet[xlsx.utils.encode_cell({ r: R, c: skuColIndex })];
    const nameCell = sheet[xlsx.utils.encode_cell({ r: R, c: nameColIndex })];

    if (!skuCell && !nameCell) continue;

    const rawSku = skuCell ? String(skuCell.v).trim() : '';
    const paddedSku = /^\d+$/.test(rawSku) ? rawSku.padStart(4, '0') : rawSku;
    const rawName = nameCell ? String(nameCell.v).trim() : '';

    let matchedProd = dbBySkuPadded.get(paddedSku) || dbByNameLower.get(rawName.toLowerCase());

    if (!matchedProd && rawName) {
      // Intento por tokens
      const rowTokens = normalizeTokens(rawName).sort().join(' ');
      matchedProd = dbProducts.find(p => normalizeTokens(p.name).sort().join(' ') === rowTokens);
    }

    if (matchedProd && matchedProd.profitMargin !== null) {
      const targetCellAddress = xlsx.utils.encode_cell({ r: R, c: rentColIndex });
      const marginVal = Number(matchedProd.profitMargin); // e.g. 35, 30, 25, 28.82

      // Escribir el valor en la celda
      sheet[targetCellAddress] = {
        t: 'n',
        v: marginVal,
        w: `${marginVal}%`
      };
      updatedRowsCount++;
    }
  }

  // Escribir archivo actualizado
  xlsx.writeFile(wb, maestroPath);

  console.log(`\n✅ ¡ÉXITO! Se actualizaron ${updatedRowsCount} filas en la columna RENTABILIDAD de la pestaña 'Productos' en Maestro.xlsx.`);
}

updateMaestroExcel().catch(console.error).finally(() => prisma.$disconnect());
