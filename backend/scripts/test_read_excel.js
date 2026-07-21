const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.resolve(__dirname, '../../ARCHIVOS/IDUO/Productos.xlsx');
if (!fs.existsSync(filePath)) {
  console.log('File not found:', filePath);
  process.exit(1);
}

const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { defval: null });

const mapped = data.map(row => {
    // Buscar la clave de SKU, podría llamarse "SKU" o "sku" o "CODIGO"
    const skuKey = Object.keys(row).find(k => k.toLowerCase().includes('sku') || k.toLowerCase().includes('codigo'));
    const nameKey = Object.keys(row).find(k => k.toLowerCase().includes('producto') || k.toLowerCase().includes('nombre') || k.toLowerCase().includes('descrip'));
    
    return {
        sku: row[skuKey] ? String(row[skuKey]).padStart(4, '0') : null,
        name: row[nameKey]
    };
}).filter(r => r.sku && r.name);

console.log(`Found ${mapped.length} products in Excel.`);
console.log('First 5 mapped:', mapped.slice(0, 5));
