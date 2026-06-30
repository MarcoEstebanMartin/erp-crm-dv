const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join('C:', 'Users', 'Usuario', 'Desktop', 'ERP-CRM DV', 'IDUO', 'Productos.xlsx');
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

console.log("Headers:");
console.log(data[0]);
console.log("\nFirst 3 rows:");
console.log(data.slice(1, 4));
