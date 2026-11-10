import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import prisma from '../src/utils/prisma';
import { resolveCustomerCoordinates } from '../src/core/geo';
import { calculateProductPriceLists } from '../src/engines/pricing.engine';
import { resolvePickingZone } from '../src/engines/orders.engine';

interface RawClientSeed {
  id: string;
  legacyId: number;
  name: string;
  cuit: string | null;
  address: string | null;
  city: string | null;
  route: string | null;
  sellerName: string;
  priceList: 'LISTA_4' | 'ESPECIAL_1' | 'ESPECIAL_2';
  iibbPerceptionPct: number;
  phone: string | null;
  hasCreditAccount: boolean;
  active: boolean;
}

interface RawProductSeed {
  sku: string;
  name: string;
  supplierName: string;
  commercialCategory: string;
  rubro: string;
  subrubro: string;
  storageZone: string;
  isWeighable: boolean;
  approxWeightKg: number | null;
  minSaleQty: number;
  unitsPerBox: number;
  minStockAlert: number;
  ivaRatePct: number;
  costPrice: number;
  rawPriceList4: number;
  boxPrice: number | null;
  barcode: string | null;
  photoFile: string | null;
  hasPhoto: boolean;
  active: boolean;
}

function mapSellerId(sellerName: string, sellerMap: Map<string, number>, defaultId: number): number {
  const s = (sellerName || '').toUpperCase().trim();
  if (s.includes('DIEGO')) return sellerMap.get('diego') ?? defaultId;
  if (s.includes('FABIAN')) return sellerMap.get('fabian') ?? defaultId;
  if (s.includes('NORBERTO')) return sellerMap.get('norberto') ?? defaultId;
  if (s.includes('MARIA') || s.includes('VIDELA')) return sellerMap.get('maria_jose') ?? defaultId;
  if (s.includes('MIGUEL')) return sellerMap.get('miguel') ?? defaultId;
  return sellerMap.get('oficina') ?? defaultId;
}

async function runInBatches<T>(items: T[], batchSize: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    await Promise.all(chunk.map(fn));
  }
}

async function runSync() {
  console.log('=== INICIANDO SANEAMIENTO Y SINCRONIZACIÓN MAESTRA (PASO 2) ===');

  const users = await prisma.user.findMany();
  const sellerMap = new Map<string, number>();
  for (const u of users) {
    sellerMap.set(u.username.toLowerCase(), u.id);
  }
  const defaultSellerId = sellerMap.get('oficina') ?? users[0]?.id ?? 1;

  // 1. Sincronizar los 84 Proveedores desde Maestro1.xlsx (pestaña Proveedores)
  const maestroPath = path.resolve(__dirname, '../../Maestro1.xlsx');
  const wb = xlsx.readFile(maestroPath);
  const provRows: any[] = wb.Sheets['Proveedores']
    ? xlsx.utils.sheet_to_json(wb.Sheets['Proveedores'])
    : [];

  const existingPersonas = await prisma.persona.findMany();
  const personaByName = new Map<string, typeof existingPersonas[0]>();
  for (const p of existingPersonas) {
    personaByName.set(p.name.trim().toUpperCase(), p);
  }

  const onlyProducts = process.argv.includes('--products-only');
  let providersSynced = 0;
  if (!onlyProducts) {
    await runInBatches(provRows, 10, async (row) => {
    const name = String(row['RAZON SOCIAL / PROVEEDOR'] || '').trim();
    if (!name) return;
    const key = name.toUpperCase();
    const cuit = String(row['CUIT'] || '').trim() || null;
    const address = String(row['DIRECCION'] || '').trim() || null;
    const city = String(row['LOCALIDAD'] || '').trim() || null;
    const province = String(row['PROVINCIA'] || '').trim() || null;
    const phone = String(row['TELEFONO'] || '').replace(/[^\d]/g, '') || null;

    const existing = personaByName.get(key);
    if (existing) {
      await prisma.persona.update({
        where: { id: existing.id },
        data: { isProvider: true, isClient: false, cuit: cuit ?? existing.cuit, address, city, province, phone },
      });
    } else {
      const created = await prisma.persona.create({
        data: { name, cuit, address, city, province, phone, isProvider: true, isClient: false },
      });
        personaByName.set(key, created);
    }
    providersSynced++;
  });
  console.log(`✅ Proveedores separados y sincronizados: ${providersSynced}`);

  // 2. Sincronizar los 1.626 Clientes Saneados desde raw-don-venancio-clients.json
  const clientsJsonPath = path.resolve(__dirname, '../prisma/data/raw-don-venancio-clients.json');
  const rawClients: RawClientSeed[] = JSON.parse(fs.readFileSync(clientsJsonPath, 'utf8'));

  let clientsCreated = 0;
  let clientsUpdated = 0;

  await runInBatches(rawClients, 15, async (c) => {
    const cleanName = c.name.trim();
    const key = cleanName.toUpperCase();
    const sellerId = mapSellerId(c.sellerName, sellerMap, defaultSellerId);
    const priceList = c.priceList === 'ESPECIAL_2' ? 'C' : c.priceList === 'ESPECIAL_1' ? 'B' : 'A';
    const cleanPhone = c.phone ? c.phone.replace(/[^\d]/g, '') || null : null;
    const cleanAddr = c.address
      ? c.address.replace(/^Dir\.\s*Com\.:\s*/i, '').trim() || null
      : null;
    const cleanCity = (c.city || 'GENERAL VILLEGAS').trim().toUpperCase();

    const existing = personaByName.get(key);
    const coords = resolveCustomerCoordinates({
      legacyId: c.legacyId || existing?.id || 1,
      city: cleanCity,
      address: cleanAddr,
      lat: existing?.latitude ?? null,
      lng: existing?.longitude ?? null,
    });

    const dataPayload = {
      name: cleanName,
      cuit: c.cuit || existing?.cuit || null,
      address: cleanAddr,
      city: cleanCity,
      route: c.route || 'OFICINA',
      sellerId,
      priceList,
      iibbAliquot: c.iibbPerceptionPct || 0,
      phone: cleanPhone,
      isClient: true,
      isProvider: false,
      isActive: c.active !== false,
      latitude: coords.lat,
      longitude: coords.lng,
    };

    if (existing) {
      await prisma.persona.update({ where: { id: existing.id }, data: dataPayload });
      clientsUpdated++;
    } else {
      const created = await prisma.persona.create({ data: dataPayload });
        personaByName.set(key, created);
      clientsCreated++;
    }
  });
  console.log(`✅ Clientes saneados: ${rawClients.length} (${clientsUpdated} actualizados, ${clientsCreated} nuevos)`);

  // 3. Limpiar cualquier basura residual ('Tel. Com.: |' o 'Dir. Com.:') en Persona
  await prisma.$executeRaw`
    UPDATE "Persona"
    SET "phone" = NULL
    WHERE "phone" LIKE '%Tel. Com.%' OR "phone" = '|' OR TRIM("phone") = '';
  `;
  await prisma.$executeRaw`
    UPDATE "Persona"
    SET "address" = TRIM(REGEXP_REPLACE("address", '^Dir\.\s*Com\.:\s*', '', 'i'))
    WHERE "address" ILIKE 'Dir.%Com.%';
  `;
  }

  // 4. Sincronizar los Productos Saneados con PricingEngine (Pesos Enteros en Origen)
  const productsJsonPath = path.resolve(__dirname, '../prisma/data/raw-don-venancio-seed.json');
  const rawProducts: RawProductSeed[] = JSON.parse(fs.readFileSync(productsJsonPath, 'utf8'));
  const masterPhotosDir = path.resolve(__dirname, '../../ARCHIVOS/fotos/Productos');
  const photoFiles = fs.existsSync(masterPhotosDir) ? new Set(fs.readdirSync(masterPhotosDir)) : new Set<string>();

  const existingRubros = await prisma.rubro.findMany();
  const rubroMap = new Map<string, number>(existingRubros.map((r) => [r.name.toUpperCase(), r.id]));

  for (const prod of rawProducts) {
    const rubroName = (prod.rubro || 'GENERAL').trim().toUpperCase();
    if (!rubroMap.has(rubroName)) {
      const createdRubro = await prisma.rubro.create({ data: { name: rubroName } });
      rubroMap.set(rubroName, createdRubro.id);
    }
  }

  let productsSynced = 0;
  await runInBatches(rawProducts, 15, async (prod) => {
    const rubroName = (prod.rubro || 'GENERAL').trim().toUpperCase();
    const rubroId = rubroMap.get(rubroName)!;
    const provider = personaByName.get((prod.supplierName || '').trim().toUpperCase());

    const pricing = calculateProductPriceLists({
      costPrice: prod.costPrice || 0,
      manualPriceList4: prod.rawPriceList4 > 0 ? prod.rawPriceList4 : undefined,
      marginList4Pct: 25,
      ivaRatePct: prod.ivaRatePct || 21,
      boxPrice: prod.boxPrice,
      subrubro: prod.subrubro,
      rubro: prod.rubro,
      commercialCategory: prod.commercialCategory,
    });

    const safeMargin = Math.min(999.99, Math.max(-999.99, pricing.marginList4Pct.toNumber()));
    const pickingZone = resolvePickingZone(prod.rubro, prod.isWeighable);
    const photoCandidate = `${prod.sku}.jpg`;
    const imageUrl = photoFiles.has(photoCandidate) ? `/uploads/products/${photoCandidate}` : undefined;

    await prisma.product.upsert({
      where: { sku: prod.sku },
      update: {
        name: prod.name,
        costPrice: pricing.costPrice.toNumber(),
        listPrice: pricing.priceList4.toNumber(),
        listPriceB: (pricing.boxPrice ?? pricing.priceSpecial1).toNumber(),
        listPriceC: pricing.priceSpecial2.toNumber(),
        profitMargin: safeMargin,
        isPesable: prod.isWeighable,
        approximateWeight: prod.approxWeightKg ?? (prod.isWeighable ? 4 : null),
        unitsPerBox: prod.unitsPerBox || 1,
        minOrderQuantity: prod.minSaleQty || 1,
        commercialCategory: prod.commercialCategory || 'General',
        pickingZone,
        rubroId,
        ...(provider ? { providerId: provider.id } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      },
      create: {
        sku: prod.sku,
        name: prod.name,
        costPrice: pricing.costPrice.toNumber(),
        listPrice: pricing.priceList4.toNumber(),
        listPriceB: (pricing.boxPrice ?? pricing.priceSpecial1).toNumber(),
        listPriceC: pricing.priceSpecial2.toNumber(),
        profitMargin: safeMargin,
        isPesable: prod.isWeighable,
        approximateWeight: prod.approxWeightKg ?? (prod.isWeighable ? 4 : null),
        unitsPerBox: prod.unitsPerBox || 1,
        minOrderQuantity: prod.minSaleQty || 1,
        commercialCategory: prod.commercialCategory || 'General',
        pickingZone,
        rubroId,
        providerId: provider?.id ?? null,
        imageUrl: imageUrl ?? null,
        isActive: prod.active !== false,
      },
    });
    productsSynced++;
  });
  console.log(`✅ Productos sincronizados con Pesos Enteros en Origen: ${productsSynced}`);
  await prisma.$disconnect();
}

runSync().catch((err) => {
  console.error('❌ Error en sincronización maestra:', err);
  process.exit(1);
});
