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
      hostname: 'localhost',
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

async function testFlow() {
  const prod = await prisma.product.findFirst();
  if (!prod) {
    console.log("No product found to test.");
    return;
  }

  const slotCode = "TEST-SLOT-01-A";
  console.log(`--- Step 1: Loading 10 units of product ID ${prod.id} into location ${slotCode} ---`);
  
  const loadRes = await makeRequest(`/api/products/${prod.id}/adjust-stock`, {
    quantityChange: 10,
    reason: 'Test Carga WMS',
    lotNumber: `S/L-${slotCode}`,
    expirationDate: '',
    location: slotCode
  });

  console.log("Load response status:", loadRes.status);
  console.log("Product after load:", {
    stock: loadRes.body.data?.product?.stock,
    lots: loadRes.body.data?.product?.lots
  });

  const createdLot = loadRes.body.data?.product?.lots?.find(l => l.location === slotCode);
  if (!createdLot) {
    console.error("FAIL: Lot was not created for location", slotCode);
    return;
  }

  console.log(`--- Step 2: Emptying (subtracting 10 units) from location ${slotCode} (Lot ID ${createdLot.id}) ---`);
  
  const vacateRes = await makeRequest(`/api/products/${prod.id}/adjust-stock`, {
    quantityChange: -10,
    reason: 'Test Vaciar WMS',
    lotNumber: createdLot.lotNumber,
    expirationDate: createdLot.expirationDate,
    location: slotCode,
    lotId: createdLot.id
  });

  console.log("Vacate response status:", vacateRes.status);
  console.log("Product after vacate:", {
    stock: vacateRes.body.data?.product?.stock,
    defaultLocation: vacateRes.body.data?.product?.defaultLocation,
    lots: vacateRes.body.data?.product?.lots
  });

  const remainingLot = vacateRes.body.data?.product?.lots?.find(l => l.location === slotCode);
  if (!remainingLot) {
    console.log("SUCCESS: Lot in location", slotCode, "was completely removed!");
  } else {
    console.error("FAIL: Lot still exists in location", slotCode, remainingLot);
  }
}

testFlow().finally(() => prisma.$disconnect());
