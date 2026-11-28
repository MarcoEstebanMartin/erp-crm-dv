/**
 * Sincroniza precios y estado activo/inactivo del catálogo de Kilate
 * contra la Lista General exportada de Iduo (ej. 3.xlsx).
 *
 * Uso:
 *   node scripts/sync_prices_from_iduo_list.js ../3.xlsx --dry-run
 *   node scripts/sync_prices_from_iduo_list.js ../3.xlsx --apply
 *   node scripts/sync_prices_from_iduo_list.js ../3.xlsx --apply --push-web
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const ExcelJS = require('exceljs');
const Decimal = require('decimal.js');
const { PrismaClient } = require('@prisma/client');

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
const prisma = new PrismaClient();

function roundPeso(val) {
  return new Decimal(val).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

// Mapeos explícitos de filas de 3.xlsx -> SKU real en Kilate cuando la redacción difiere
const EXPLICIT_NAME_TO_SKU = new Map([
  ['MELINCUE P.SALUT LIGHT EQUILIBRIO X KG', '0009'],
  ['MELINCUE REGG.HORMA ENTERA X KG', '0017'],
  ['SANCOR LECHE UAT DESCREMADA SACHET X LT', '0808'],
  ['SANCOR LECHE UAT ENTERA SACHET X LT', '0807'],
  ['CREMIGAL YOGUR C/CEREAL FRUTILLA X 155GR', '0037'],
  ['CREMIGAL YOGUR C/CEREAL VAINILLA X 155GR', '0037-2'],
  ['CREMIGAL YOGUR C/FRUTILLAS X 150GR', '0036'],
  ['CREMIGAL YOGUR NATURAL S/AZUCAR X 170GR', '0044'],
  ['SANCOR CREMA POTE X 200GR', '0806'],
  ['SANCOR CREMA POTE X 360GR', '0805'],
  ['SANCOR DULCE DE LECHE CLASICO X 400 GR', '0804'],
  ['CREMIGAL Q.UNTABLE AZUL X 190GR', '0065-1'],
  ['CREMIGAL Q.UNTABLE CHEDDAR X 190 GR', '0065-2'],
  ['CREMIGAL Q.UNTABLE CLASICO X 190 GR', '0065-3'],
  ['SANCOR RALLADO REGG. X 100GR', '0800'],
  ['BONDIOLA VAC. HORMA X KG', '0098'],
  ['FIAMBRE DE CERDO H. CHICA X KG', '0099'],
  ['FIAMBRE DE CERDO RECTANGULAR X KG', '0100'],
  ['JAMON COCIDO TIPO NATURAL PLATEADO X KG', '0101'],
  ['JAMON CRUDO LA CASONA X KG', '0102'],
  ['SALAME X METRO BASTON P.GRUESO X KG', '0106'],
  ['CUMANA ANANA RODAJAS X 850GR', '0818'],
  ['CUMANA MORRON X 200GR', '0127'],
  ['LA GIOCONDA COCTEL 4 FRUTAS CON A/FACIL X820GR', '0133'],
  ['LA GIOCONDA PERA CON A/FACIL X 820GR', '0154'],
  ['M.ROJO COCTEL FRUTAL X820GR', '0138'],
  ['COCINERO ACEITE GIRASOL X 1.5CC', '0199'],
  ['COCINERO ACEITE MEZCLA X 1.5CC', '0171'],
  ['308 NIDOS ESPINACA NO2 X 500GR', '0350'],
  ['FELPITA PAPEL HIGIENICO BCO 10X4 ( 80 METROS )', '0814'],
  ['FELPITA PAPEL HIGIENICO BCO 12X4 ( 30 MTS )', '0813'],
  ['STA. JULIA MALBEC 1X750 ML ESTUCHE', '0412'],
  ['VIDA AGUA DE MESA 6X1.5LTS', '0423'],
  ['DR. LEMON C/VODKA 1 LT', '0449-1'],
  ['LA FARRUCA DURAZNO FIZZ X 710ML', '0479'],
  ['ELEMENTOS CAB.SAUVIGNON X 750ML', '0615'],
  ['F.L.M FAIR FOR LIFE MALBEC X 750 ML', '0617'],
  ['BALLANTINES X750ML', '0646'],
  ['BLENDERS PRIDE 1LT', '0647'],
  ['J&B RARE X 750ML', '0648'],
  ['WHITE HORSE X750ML', '0651'],
]);

// Definición prolija de los 10 productos nuevos de 3.xlsx (SKU, rubro de referencia, unitsPerBox)
const NEW_PRODUCT_SPECS = new Map([
  ['CREMIGAL YOGUR C/CEREAL VAINILLA X 155GR', { sku: '0037-2', name: 'CREMIGAL YOGURT CON CEREAL VAINILLA X 155 GR', copyFromSku: '0037' }],
  ['CREMIGAL YOGUR SACHET X 900ML DURAZNO', { sku: '0034-3', name: 'CREMIGAL YOGURT SACHET DURAZNO x 900 ml', copyFromSku: '0034-1' }],
  ['CREMIGAL YOGUR SACHET X 900ML MULTIFRUTA', { sku: '0034-4', name: 'CREMIGAL YOGURT SACHET MULTIFRUTA x 900 ml', copyFromSku: '0034-1' }],
  ['NATURA KETCHUP X 500GR', { sku: '0831', name: 'NATURA KETCHUP X 500 GR', copyFromSku: '0188' }],
  ['PUGLISI MERLUZA ACEITE X 380GR', { sku: '0817-1', name: 'PUGLISI MERLUZA EN ACEITE X 380 GR', copyFromSku: '0817' }],
  ['PUGLISI MERLUZA NATURAL X 380GR', { sku: '0817-2', name: 'PUGLISI MERLUZA AL NATURAL X 380 GR', copyFromSku: '0817' }],
  ['308 CODITOS SEMOLA X 500GR', { sku: '0832', name: '308 CODITOS SEMOLA X 500 GR', copyFromSku: '0342' }],
  ['308 MOSTACHOL SEMOLA X 500GR', { sku: '0833', name: '308 MOSTACHOL SEMOLA X 500 GR', copyFromSku: '0342' }],
  ['308 SPAGHETTI SEMOLA X 500GR', { sku: '0834', name: '308 SPAGHETTI SEMOLA X 500 GR', copyFromSku: '0342' }],
  ['308 TIRABUZON SEMOLA X 500GR', { sku: '0835', name: '308 TIRABUZON SEMOLA X 500 GR', copyFromSku: '0342' }],
]);

function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\u00A0/g, ' ')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(?!\d\.\d)\./g, ' ')
    .replace(/([A-Z])\.(\d)/g, '$1 $2')
    .replace(/(\d)\.([A-Z])/g, '$1 $2')
    .replace(/([A-Z])X(\d)/g, '$1 X $2')
    .replace(/([A-Z])X\s+(\d)/g, '$1 X $2')
    .replace(/(\d)X(\d)/g, '$1 X $2')
    .replace(/(\d)X(\d)/g, '$1 X $2')
    .replace(/\bX(\d)/g, 'X $1')
    .replace(/(\d)(ML|CC|LT|LTS|L|GR|GRS|G|KG|KGS|UN|U|CM|MM|C|M|MTS|METROS)\b/g, '$1 $2')
    .replace(/\bLTS\b/g, 'LT').replace(/\bL\b/g, 'LT')
    .replace(/\bGRS\b/g, 'GR').replace(/\bG\b/g, 'GR')
    .replace(/\bKGS\b/g, 'KG')
    .replace(/\bCC\b/g, 'ML').replace(/\bC\b/g, 'ML').replace(/\bM\b/g, 'ML')
    .replace(/\bMTS\b/g, 'METROS')
    .replace(/\bYOGURT\b/g, 'YOGUR')
    .replace(/\bQ\s+UNTABLE\b/g, 'QUESO UNTABLE')
    .replace(/\bLA VIRG\b/g, 'LA VIRGINIA')
    .replace(/\bF L M\b/g, 'FINCA LAS MORAS')
    .replace(/\bF LAS MORAS\b/g, 'FINCA LAS MORAS')
    .replace(/\bBIOACTIVE\b/g, 'BIO ACTIVE')
    .replace(/\bCONAG\b/g, 'CONAC')
    .replace(/\bPART\b/g, 'PARTICULAR')
    .replace(/\bMALB\b/g, 'MALBEC')
    .replace(/\bMDZA\b/g, 'MENDOZA')
    .replace(/\bREGG\b/g, 'REGGIANITO')
    .replace(/\bBCO\b/g, 'BLANCO')
    .replace(/\bTTO\b/g, 'TINTO')
    .replace(/\bEXT\b/g, 'EXTRA')
    .replace(/\bNAT\b/g, 'NATURAL')
    .replace(/\bP SALUT\b/g, 'PORT SALUT')
    .replace(/\bPOR SALUT\b/g, 'PORT SALUT')
    .replace(/\bV DE BALBO\b/g, 'VINA DE BALBO')
    .replace(/\bH ENTERA\b/g, 'HORMA ENTERA')
    .replace(/\bLC\b/g, 'LA CASONA')
    .replace(/\bS BRIONES\b/g, 'SAENZS BRIONES')
    .replace(/\bSTA JULIA\b/g, 'SANTA JULIA')
    .replace(/\bSAVIGNON\b/g, 'SAUVIGNON')
    .replace(/\bNO\s*(\d+)/g, 'N$1')
    .replace(/\bA\s*FACIL\b/g, 'ABRE FACIL')
    .replace(/\bS\s*AZUCAR\b/g, 'SIN AZUCAR')
    .replace(/\bP\s*AMARILLO\b/g, 'POMELO AMARILLO')
    .replace(/\bPOM\s*ROSADO\b/g, 'POMELO ROSADO')
    .replace(/[^A-Z0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s) {
  return norm(s).split(' ').filter(t => t && !['X','DE','EN','AL','CON','C','A','LA','EL','1','Y'].includes(t));
}

function extractPackFactor(name) {
  const m = String(name).toUpperCase().match(/\b(\d+)\s*X\s*\d+/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 2 && n <= 100) return n;
  }
  return null;
}

function resolveUnitPrice(dbProd, excelName, excelRawPrice) {
  const exPrice = roundPeso(excelRawPrice);
  const dbPrice = Number(dbProd.listPrice);
  if (dbPrice <= 0) return { unitPrice: exPrice, factor: 1, mode: 'DIRECT' };
  if (dbPrice === exPrice) return { unitPrice: exPrice, factor: 1, mode: 'SAME' };

  const packFromName = extractPackFactor(excelName) || extractPackFactor(dbProd.name);
  const factors = [...new Set([packFromName, dbProd.unitsPerBox].filter(n => n && n > 1))];

  for (const f of factors) {
    const candidate = roundPeso(new Decimal(excelRawPrice).dividedBy(f));
    const ratio = candidate / dbPrice;
    if (ratio >= 0.75 && ratio <= 1.35) {
      return {
        unitPrice: candidate,
        factor: f,
        mode: candidate === dbPrice ? 'PACK_SAME' : 'PACK_DIVIDED',
      };
    }
  }

  const ratio = exPrice / dbPrice;
  if (ratio >= 0.65 && ratio <= 1.45) {
    return { unitPrice: exPrice, factor: 1, mode: 'DIRECT' };
  }
  return { unitPrice: exPrice, factor: 1, mode: 'ANOMALY', ratio: +ratio.toFixed(2) };
}

function computeListsBC(dbProd, newPriceA) {
  const oldA = new Decimal(dbProd.listPrice || 0);
  const oldB = new Decimal(dbProd.listPriceB || 0);
  const oldC = new Decimal(dbProd.listPriceC || 0);
  const aDec = new Decimal(newPriceA);

  let newB = newPriceA;
  let newC = newPriceA;

  if (oldA.gt(0) && oldB.gt(0) && !oldB.eq(oldA)) {
    const factorB = oldB.dividedBy(oldA);
    newB = roundPeso(aDec.times(factorB));
  }
  if (oldA.gt(0) && oldC.gt(0) && !oldC.eq(oldA)) {
    const factorC = oldC.dividedBy(oldA);
    newC = roundPeso(aDec.times(factorC));
  }
  return { listPriceB: newB, listPriceC: newC };
}

async function main() {
  const args = process.argv.slice(2);
  const excelPath = path.resolve(process.cwd(), args.find(a => !a.startsWith('--')) || '../3.xlsx');
  const apply = args.includes('--apply');
  const pushWeb = args.includes('--push-web');
  const pushWebOnly = args.includes('--push-web-only');

  async function pushIdsToWebInBatches(ids) {
    const prodUrl = (process.env.PRODUCTION_CATALOG_DATABASE_URL || '').trim();
    if (!prodUrl) {
      console.warn('⚠️ PRODUCTION_CATALOG_DATABASE_URL no configurada; se omitió push a Web.');
      return;
    }
    if (ids.length === 0) return;
    console.log(`🌐 Sincronizando ${ids.length} productos hacia la base Web/Chatbot (Supabase) en lotes de 12...`);
    require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
    const { productionOutboundBridgeService } = require('../src/services/catalog/production-outbound-bridge.service');
    let totalSynced = 0;
    let patchedBatches = 0;
    const batchSize = 12;
    for (let i = 0; i < ids.length; i += batchSize) {
      const slice = ids.slice(i, i + batchSize);
      const result = await productionOutboundBridgeService.pushProductsBatchToProductionNow(slice, {
        productionDbUrl: prodUrl,
      });
      totalSynced += result.syncedCount;
      if (result.statePatched) patchedBatches++;
    }
    console.log(`✅ BASE WEB SINCRONIZADA (${totalSynced} productos en ${Math.ceil(ids.length / batchSize)} lotes, metadata patched en ${patchedBatches} lotes).`);
  }

  if (pushWebOnly) {
    // Empuja todos los productos tocados hoy (o inactivos recientes) hacia la Web
    const recent = await prisma.product.findMany({
      where: { NOT: { sku: { startsWith: 'HIST-' } } },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    await pushIdsToWebInBatches(recent.map(r => r.id));
    await prisma.$disconnect();
    return;
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);
  const ws = wb.worksheets[0];

  const excelItems = [];
  let currentCat = '', currentSub = '';
  for (let r = 4; r <= ws.rowCount; r++) {
    const rawName = ws.getRow(r).getCell(1).value;
    const rawPrice = ws.getRow(r).getCell(2).value;
    const name = rawName && typeof rawName === 'object' ? (rawName.result ?? rawName.text ?? String(rawName)) : (rawName ? String(rawName).trim() : '');
    const priceVal = rawPrice && typeof rawPrice === 'object' ? rawPrice.result : rawPrice;
    if (!name) continue;
    if (priceVal === null || priceVal === undefined || priceVal === '') {
      if (/^\d/.test(name)) { currentCat = name; currentSub = ''; }
      else { currentSub = name; }
    } else {
      excelItems.push({
        row: r, name, upper: name.trim().toUpperCase(),
        norm: norm(name), tokens: tokens(name),
        rawPrice: Number(priceVal),
        cat: currentCat, sub: currentSub,
      });
    }
  }

  const allDb = await prisma.product.findMany({
    include: { rubro: true },
    orderBy: { sku: 'asc' },
  });
  const realDb = allDb.filter(p => !p.sku.startsWith('HIST-'));
  const bySku = new Map(realDb.map(p => [p.sku, p]));
  const byNorm = new Map();
  const byTokenKey = new Map();

  for (const p of realDb) {
    p._norm = norm(p.name);
    p._tokens = tokens(p.name);
    p._tokenKey = [...new Set(p._tokens)].sort().join(' ');
    if (!byNorm.has(p._norm)) byNorm.set(p._norm, []);
    byNorm.get(p._norm).push(p);
    if (!byTokenKey.has(p._tokenKey)) byTokenKey.set(p._tokenKey, []);
    byTokenKey.get(p._tokenKey).push(p);
  }

  const updates = [];
  const creates = [];
  const anomalies = [];
  const usedIds = new Set();

  const usedSkus = new Set(allDb.map(p => p.sku));
  let maxNumericSku = allDb
    .map(p => (/^\d+$/.test(p.sku) ? parseInt(p.sku, 10) : 0))
    .reduce((m, n) => Math.max(m, n), 830);

  function pickFreeSku(preferred) {
    if (preferred && !usedSkus.has(preferred)) {
      usedSkus.add(preferred);
      return preferred;
    }
    do {
      maxNumericSku++;
    } while (usedSkus.has(String(maxNumericSku).padStart(4, '0')));
    const next = String(maxNumericSku).padStart(4, '0');
    usedSkus.add(next);
    return next;
  }

  for (const item of excelItems) {
    const explicitSku = EXPLICIT_NAME_TO_SKU.get(item.upper);
    let target = explicitSku ? bySku.get(explicitSku) : null;

    if (!target) {
      const tk = [...new Set(item.tokens)].sort().join(' ');
      const cands = [...(byNorm.get(item.norm) || []), ...(byTokenKey.get(tk) || [])];
      const uniq = [...new Map(cands.map(c => [c.id, c])).values()];
      target = uniq.find(c => c.isActive && !usedIds.has(c.id)) || uniq.find(c => !usedIds.has(c.id)) || null;
    }

    if (target) {
      if (usedIds.has(target.id)) {
        anomalies.push({ row: item.row, excel: item.name, sku: target.sku, reason: 'DUPLICATE_TARGET_COLLISION' });
        continue;
      }
      usedIds.add(target.id);
      const res = resolveUnitPrice(target, item.name, item.rawPrice);
      if (res.mode === 'ANOMALY') {
        anomalies.push({ row: item.row, excel: item.name, sku: target.sku, dbName: target.name, dbPrice: Number(target.listPrice), exPrice: res.unitPrice, ratio: res.ratio });
        continue;
      }
      const { listPriceB, listPriceC } = computeListsBC(target, res.unitPrice);
      const priceChanged = Number(target.listPrice) !== res.unitPrice
        || Number(target.listPriceB) !== listPriceB
        || Number(target.listPriceC) !== listPriceC;
      const reactivate = !target.isActive;
      if (priceChanged || reactivate) {
        updates.push({
          id: target.id,
          sku: target.sku,
          name: target.name,
          oldPrice: Number(target.listPrice),
          newPrice: res.unitPrice,
          listPriceB,
          listPriceC,
          factor: res.factor,
          mode: res.mode,
          priceChanged,
          reactivate,
        });
      }
    } else {
      const spec = NEW_PRODUCT_SPECS.get(item.upper);
      if (!spec) {
        anomalies.push({ row: item.row, excel: item.name, reason: 'NO_SPEC_FOR_NEW_PRODUCT', exPrice: roundPeso(item.rawPrice) });
        continue;
      }
      const refProd = bySku.get(spec.copyFromSku);
      const unitPrice = roundPeso(item.rawPrice);
      const assignedSku = pickFreeSku(spec.sku);
      creates.push({
        sku: assignedSku,
        name: spec.name,
        listPrice: unitPrice,
        listPriceB: unitPrice,
        listPriceC: unitPrice,
        costPrice: 0,
        unitsPerBox: refProd ? refProd.unitsPerBox : 1,
        isPesable: refProd ? refProd.isPesable : false,
        rubroId: refProd ? refProd.rubroId : null,
        providerId: refProd ? refProd.providerId : null,
        commercialCategory: refProd ? refProd.commercialCategory : null,
        rubroName: refProd?.rubro?.name || null,
      });
    }
  }

  const deactivations = realDb
    .filter(p => p.isActive && !usedIds.has(p.id))
    .map(p => ({ id: p.id, sku: p.sku, name: p.name, oldPrice: Number(p.listPrice) }));

  console.log(`\n=== PLAN DE SINCRONIZACIÓN (${apply ? 'APPLY' : 'DRY-RUN'}) ===`);
  console.log(`Archivo: ${excelPath}`);
  console.log(`Total productos en 3.xlsx: ${excelItems.length}`);
  console.log(`Anomalías bloqueantes: ${anomalies.length}`);
  console.log(`Existentes sin cambios (ya al día y activos): ${excelItems.length - updates.length - creates.length - anomalies.length}`);
  console.log(`Existentes a ACTUALIZAR precio: ${updates.filter(u => u.priceChanged).length}`);
  console.log(`  - De ellos, con factor bulto -> unitario: ${updates.filter(u => u.factor > 1).length}`);
  console.log(`Existentes inactivos a REACTIVAR: ${updates.filter(u => u.reactivate).length}`);
  console.log(`Productos NUEVOS a CREAR: ${creates.length}`);
  console.log(`Activos fuera de 3.xlsx a DESACTIVAR: ${deactivations.length}`);
  console.log(`=> Total productos ACTIVOS tras aplicar: ${excelItems.length} (exactamente igual a 3.xlsx)`);

  if (anomalies.length > 0) {
    console.error('\n❌ ANOMALÍAS BLOQUEANTES:', JSON.stringify(anomalies, null, 2));
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  console.log(`\n--- NUEVOS A CREAR (${creates.length}) ---`);
  for (const c of creates) console.log(`  + [${c.sku}] ${c.name} -> $${c.listPrice} (rubro: ${c.rubroName || '-'}, caja: ${c.unitsPerBox})`);

  console.log('\n--- A REACTIVAR ---');
  for (const u of updates.filter(x => x.reactivate)) {
    console.log(`  ^ [${u.sku}] ${u.name}: $${u.oldPrice} -> $${u.newPrice}${u.factor > 1 ? ` (bulto /${u.factor})` : ''}`);
  }

  console.log('\n--- A DESACTIVAR ---');
  for (const d of deactivations) console.log(`  - [${d.sku}] ${d.name} ($${d.oldPrice})`);

  console.log('\n--- MUESTRA DE CAMBIOS DE PRECIO (primeros 25) ---');
  for (const u of updates.filter(x => x.priceChanged).slice(0, 25)) {
    const pct = u.oldPrice > 0 ? (((u.newPrice - u.oldPrice) / u.oldPrice) * 100).toFixed(1) : 'N/A';
    console.log(`  ~ [${u.sku}] ${u.name}: $${u.oldPrice} -> $${u.newPrice} (${pct}%)${u.factor > 1 ? ` [bulto /${u.factor}]` : ''}${u.listPriceB !== u.newPrice ? ` [B:$${u.listPriceB} C:$${u.listPriceC}]` : ''}`);
  }

  if (!apply) {
    console.log('\n(Modo --dry-run: no se modificó la base de datos.)');
    await prisma.$disconnect();
    return;
  }

  const now = new Date();
  const touchedIds = [];

  await prisma.$transaction(async (tx) => {
    for (const u of updates) {
      await tx.product.update({
        where: { id: u.id },
        data: {
          ...(u.priceChanged ? {
            previousListPrice: u.oldPrice,
            listPrice: u.newPrice,
            listPriceB: u.listPriceB,
            listPriceC: u.listPriceC,
            lastPriceUpdateAt: now,
          } : {}),
          ...(u.reactivate ? { isActive: true } : {}),
        },
      });
      touchedIds.push(u.id);
    }

    for (const c of creates) {
      const created = await tx.product.create({
        data: {
          sku: c.sku,
          name: c.name,
          costPrice: c.costPrice,
          listPrice: c.listPrice,
          listPriceB: c.listPriceB,
          listPriceC: c.listPriceC,
          unitsPerBox: c.unitsPerBox,
          isPesable: c.isPesable,
          rubroId: c.rubroId,
          providerId: c.providerId,
          commercialCategory: c.commercialCategory,
          isActive: true,
          catalogVisible: true,
          lastPriceUpdateAt: now,
        },
      });
      touchedIds.push(created.id);
    }

    for (const d of deactivations) {
      await tx.product.update({
        where: { id: d.id },
        data: { isActive: false },
      });
      touchedIds.push(d.id);
    }

    const adminUser = await tx.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
    if (adminUser) {
      await tx.auditLog.create({
        data: {
          userId: adminUser.id,
          action: 'IDUO_PRICE_LIST_SYNC',
          entityType: 'PRODUCT_CATALOG',
          entityId: 0,
          newValues: {
            sourceFile: path.basename(excelPath),
            updatedCount: updates.length,
            priceChangedCount: updates.filter(u => u.priceChanged).length,
            reactivatedCount: updates.filter(u => u.reactivate).length,
            createdCount: creates.length,
            deactivatedCount: deactivations.length,
          },
          status: 'SUCCESS',
        },
      });
    }
  }, { maxWait: 20000, timeout: 120000 });

  console.log(`\n✅ KILATE ACTUALIZADO EN TRANSACCIÓN ATÓMICA (${touchedIds.length} productos tocados).`);

  if (pushWeb) {
    await pushIdsToWebInBatches(touchedIds);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('❌ Error fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
