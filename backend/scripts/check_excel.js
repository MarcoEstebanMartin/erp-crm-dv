const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'IDUO', 'Productos.xlsx');
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

console.log('Total rows:', data.length);
console.log('First 15 rows:', data.slice(0, 15));
