const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const archivosDir = path.join(__dirname, '../../ARCHIVOS');

function inspectExcel(filename) {
  const filePath = path.join(archivosDir, filename);
  if (!fs.existsSync(filePath)) return;
  console.log(`\n--- Inspecting ${filename} ---`);
  const wb = xlsx.readFile(filePath);
  wb.SheetNames.forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(sheet);
    console.log(`Sheet '${sheetName}' has ${json.length} rows`);
    if (json.length > 0) {
      console.log('Sample row:', json[0]);
    }
  });
}

inspectExcel('OFERTAS.xlsx');
inspectExcel('GastosDistribuidora.xlsx');
