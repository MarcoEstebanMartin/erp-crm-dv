const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../prisma/products_data.json'), 'utf8'));

console.log('Total items in products_data.json:', data.length);

const baggioIdx = data.findIndex(p => p.sku === '0028' || p.name.includes('BAGGIO LATTE CHOCOLATADA x 200ml'));
const naturaIdx = data.findIndex(p => p.sku === '0176' || p.name.includes('NATURA ACEITE PVCx1500CC'));

console.log(`Baggio index: ${baggioIdx}, SKU: ${data[baggioIdx]?.sku}, Name: ${data[baggioIdx]?.name}`);
console.log(`Natura index: ${naturaIdx}, SKU: ${data[naturaIdx]?.sku}, Name: ${data[naturaIdx]?.name}`);

if (baggioIdx !== -1 && naturaIdx !== -1) {
  const range = data.slice(baggioIdx, naturaIdx + 1);
  console.log(`Items in products_data.json range: ${range.length}`);
  range.forEach((p, i) => {
    if (i < 5 || i > range.length - 6) {
      console.log(`Page ${i + 1} -> SKU: '${p.sku}', Name: '${p.name}'`);
    }
  });
}
