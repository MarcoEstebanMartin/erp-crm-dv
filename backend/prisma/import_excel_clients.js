const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(__dirname, 'excel_clients.json');
  const clients = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  console.log(`Starting optimized import of ${clients.length} clients/sellers into Database...`);

  // 1. Fetch users
  const users = await prisma.user.findMany();
  const userMap = new Map();
  users.forEach(u => userMap.set(u.username.toLowerCase(), u.id));

  // 2. Fetch existing Personas
  const existingPersonas = await prisma.persona.findMany({
    select: { id: true, name: true, cuit: true }
  });

  const cuitMap = new Map();
  const nameMap = new Map();
  existingPersonas.forEach(p => {
    if (p.cuit) cuitMap.set(p.cuit.trim(), p.id);
    if (p.name) nameMap.set(p.name.trim().toLowerCase(), p.id);
  });

  const toCreate = [];
  const toUpdate = [];

  for (const c of clients) {
    let sellerId = null;
    if (c.sellerName) {
      const sKey = c.sellerName.trim().toLowerCase();
      sellerId = userMap.get(sKey) || null;
    }

    const payload = {
      name: c.name,
      cuit: c.cuit,
      address: c.address,
      city: c.city,
      province: c.province || 'BUENOS AIRES',
      phone: c.phone,
      email: c.email,
      isClient: c.isClient ?? true,
      isSeller: c.isSeller ?? false,
      isProvider: c.isProvider ?? false,
      priceList: c.priceList || 'A',
      maxUnpaidInvoices: c.maxUnpaidInvoices || 1,
      route: c.route,
      routeSequence: c.routeSequence,
      sellerId: sellerId,
      isActive: true
    };

    const existingId = (c.cuit && cuitMap.get(c.cuit.trim())) || nameMap.get(c.name.trim().toLowerCase());

    if (existingId) {
      toUpdate.push({ id: existingId, ...payload });
    } else {
      toCreate.push(payload);
    }
  }

  // 3. Create new
  if (toCreate.length > 0) {
    const res = await prisma.persona.createMany({
      data: toCreate,
      skipDuplicates: true
    });
    console.log(`Successfully created ${res.count} new clients.`);
  }

  // 4. Update in chunks of 50 concurrently
  if (toUpdate.length > 0) {
    console.log(`Updating ${toUpdate.length} clients in parallel batches...`);
    const CHUNK_SIZE = 50;
    for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
      const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(item => {
          const { id, ...data } = item;
          return prisma.persona.update({ where: { id }, data });
        })
      );
    }
  }

  console.log('--- Client & Seller Import Completed Successfully ---');
}

main()
  .catch(e => {
    console.error('Import error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
