const http = require('http');
const jwt = require('../backend/node_modules/jsonwebtoken');

const JWT_SECRET = 'seguridad-erp-distribuidora-2026-key-local-development';
const token = jwt.sign({ id: 8, username: 'admin', role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1h' });

console.log("Generated test JWT token for admin:", token);

const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const prod = await prisma.product.findFirst({
    where: { lots: { some: { stock: { gt: 0 } } } },
    include: { lots: true }
  });

  if (!prod) {
    console.log("No product found.");
    return;
  }

  const lot = prod.lots.find(l => l.stock > 0);
  console.log("Testing POST adjust-stock for product:", prod.id, prod.name, "Lot:", lot);

  const postBody = JSON.stringify({
    quantityChange: -lot.stock,
    reason: 'Eliminación completa desde WMS (Test)',
    lotNumber: lot.lotNumber,
    expirationDate: lot.expirationDate,
    location: lot.location
  });

  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/products/${prod.id}/adjust-stock`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postBody),
      'Authorization': `Bearer ${token}`
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log("HTTP Status Code:", res.statusCode);
      console.log("HTTP Response Body:", data);
    });
  });

  req.write(postBody);
  req.end();
}

run().finally(() => prisma.$disconnect());
