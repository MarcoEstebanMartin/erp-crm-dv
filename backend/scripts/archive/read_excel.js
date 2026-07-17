const xlsx = require('xlsx');
const workbook = xlsx.readFile('C:/Users/Usuario/Desktop/ERP-CRM DV/IDUO/Productos.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
console.log('Headers:', data[0]);
if (data[1]) console.log('Row 1:', data[1]);
if (data[2]) console.log('Row 2:', data[2]);
