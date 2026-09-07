const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '../../ARCHIVOS/Planillas_Maestras');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 1. Plantilla Productos Catálogo
const prodData = [
  { SKU: '0001', DESCRIPCION: 'QUESO CREMOSO CREMIGAL X KG', RUBRO: 'LÁCTEOS', COSTO: 4500.00, PRECIO_LISTA: 6200.00, BULTO: 1 },
  { SKU: '0002', DESCRIPCION: 'SALAME MILAN TANDIL X KG', RUBRO: 'FIAMBRES', COSTO: 8900.00, PRECIO_LISTA: 12500.00, BULTO: 1 }
];
const wbProd = XLSX.utils.book_new();
const wsProd = XLSX.utils.json_to_sheet(prodData);
XLSX.utils.book_append_sheet(wbProd, wsProd, 'Productos');
XLSX.writeFile(wbProd, path.join(targetDir, '01_PRODUCTOS_CATALOGO.xlsx'));

// 2. Plantilla Lista de Precios
const priceData = [
  { SKU: '0001', COSTO: 4500.00, LISTA_A: 6200.00, LISTA_B: 5800.00, LISTA_C: 5500.00 },
  { SKU: '0002', COSTO: 8900.00, LISTA_A: 12500.00, LISTA_B: 11800.00, LISTA_C: 11200.00 }
];
const wbPrice = XLSX.utils.book_new();
const wsPrice = XLSX.utils.json_to_sheet(priceData);
XLSX.utils.book_append_sheet(wbPrice, wsPrice, 'Precios');
XLSX.writeFile(wbPrice, path.join(targetDir, '02_LISTA_PRECIOS.xlsx'));

// 3. Plantilla Clientes Maestro
const clientData = [
  { CUIT: '30-71234567-8', RAZON_SOCIAL: 'AUTOSERVICIO EL SOL', DIRECCION: 'AV. SAN MARTIN 123', LOCALIDAD: 'GENERAL VILLEGAS', TELEFONO: '2355123456', EMAIL: 'contacto@elsol.com', RUTA: 'VILLEGAS NORTE' },
  { CUIT: '20-30987654-3', RAZON_SOCIAL: 'ALMACEN DON PEDRO', DIRECCION: 'CALLE 9 DE JULIO 456', LOCALIDAD: 'BUNGE', TELEFONO: '2355987654', EMAIL: '', RUTA: 'BUNGE Y BUCHARDO' }
];
const wbClient = XLSX.utils.book_new();
const wsClient = XLSX.utils.json_to_sheet(clientData);
XLSX.utils.book_append_sheet(wbClient, wsClient, 'Clientes');
XLSX.writeFile(wbClient, path.join(targetDir, '03_CLIENTES_MAESTRO.xlsx'));

console.log('✅ Plantillas Excel maestras creadas en:', targetDir);
