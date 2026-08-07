const http = require('http');
const jwt = require('../backend/node_modules/jsonwebtoken');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = 'seguridad-erp-distribuidora-2026-key-local-development';
const token = jwt.sign({ id: 8, username: 'admin', role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1h' });

function makeRequest(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testClearPosition() {
  const slotCode = "D1-R04-C07";
  console.log(`--- Testing Vaciar Posición Completa for ${slotCode} ---`);

  // Find all lots in D1-R04-C07
  const lots = await prisma.productLot.findMany({
    where: {
      OR: [
        { location: slotCode },
        { location: { startsWith: `${slotCode}-` } }
      ]
    },
    include: { product: true }
  });

  console.log(`Found ${lots.length} lots in ${slotCode}:`, lots.map(l => ({ id: l.id, prod: l.product.name, stock: l.stock, loc: l.location })));

  for (const item of lots) {
    console.log(`Clearing lot ID ${item.id} (${item.product.name}) from ${item.location}...`);
    const res = await makeRequest(`/api/products/${item.productId}/adjust-stock`, {
      quantityChange: -item.stock,
      reason: 'Vaciamiento completo de posición WMS',
      lotNumber: item.lotNumber,
      expirationDate: item.expirationDate,
      location: item.location,
      lotId: item.id
    });
    console.log("Response:", res.status, res.body.status);
  }

  const remainingLots = await prisma.productLot.findMany({
    where: {
      OR: [
        { location: slotCode },
        { location: { startsWith: `${slotCode}-` } }
      ]
    }
  });

  console.log(`Remaining lots in ${slotCode} after clear:`, remainingLots.length);
  if (remainingLots.length === 0) {
    console.log(`SUCCESS: Position ${slotCode} is now 100% EMPTY in PostgreSQL!`);
  } else {
    console.error("FAIL: Lots still remain in", slotCode, remainingLots);
  }
}

testClearPosition().finally(() => prisma.$disconnect());
