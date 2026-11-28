const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');
const Decimal = require('decimal.js');

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const prisma = new PrismaClient();

// Mapeo explícito de nombres de clientes conocidos con ligera variación entre Iduo y Kilate
const CLIENT_ALIASES = {
  'POLLERIA LA PINY (CICLON)': 'POLLERIA EL PINY (CICLON)',
  'LORENA DIDLAUKIS (CENTRO 2)': 'LORENA DIDLAUKIS',
  'ROJAS AGUSTIN ( HOSPITAL )': 'ROJAS AGUSTIN',
};

// Mapeo explícito de productos conocidos con variación abreviada entre Iduo y Kilate
const PRODUCT_ALIASES = {
  'CUMANA SARDINAS AC. X125GR': 'CUMANA SARDINAS ACEITE Y AGUA X125GR',
};

// Mapeo de vendedores de Iduo a username en Kilate
const VENDOR_USERNAME_MAP = [
  { match: 'LEJARZA', username: 'diego' },
  { match: 'RAMOS', username: 'norberto' },
  { match: 'MAYA', username: 'fabian' },
  { match: 'ALBERCA', username: 'miguel' },
  { match: 'VIDELA', username: 'maria_jose' },
  { match: 'OFICINA', username: 'OFICINA' },
];

// Palabras de sabor/variante que NO deben cruzarse entre sí en match aproximado
const VARIANT_KEYWORDS = [
  'FRUTILLA', 'VAINILLA', 'DURAZNO', 'BANANA', 'CHOCOLATE', 'NATURAL',
  'POMELO', 'NARANJA', 'MANZANA', 'LIMON', 'PERA', 'ANANA', 'MULTIFRUTA',
  'ENTERA', 'DESCREMADA', 'DESC', 'LIGHT', 'CERO', 'ZERO', 'SIN AZUCAR',
  'TINTO', 'BLANCO', 'ROSADO', 'MALBEC', 'CABERNET', 'CHARDONNAY', 'SYRAH',
];

function resolveHistoricalUnitCostSnapshot(pr, billedUnitPrice) {
  const baseCost = new Decimal(pr?.costPrice || 0);
  if (baseCost.lte(0)) return new Decimal(0);

  const listPrice = new Decimal(pr?.listPrice || 0);
  const billed = new Decimal(billedUnitPrice || 0);
  if (listPrice.gt(0) && billed.gt(0)) {
    const ratio = billed.dividedBy(listPrice).toNumber();
    if (ratio >= 2.2) {
      const uBox = Number(pr?.unitsPerBox || 1);
      const factor = uBox > 1 && ratio >= uBox * 0.75 && ratio <= uBox * 1.25
        ? uBox
        : Math.max(2, Math.round(ratio));
      return baseCost.times(factor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
  }

  return baseCost.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function parseArgs(argv) {
  const args = {
    ventas: path.resolve(__dirname, '../../1.xlsx'),
    subdiario: path.resolve(__dirname, '../../2.xlsx'),
    apply: false,
    createMissing: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--apply') args.apply = true;
    else if (token === '--create-missing') args.createMissing = true;
    else if (token === '--ventas' && argv[i + 1]) {
      args.ventas = path.resolve(process.cwd(), argv[++i]);
    } else if (token === '--subdiario' && argv[i + 1]) {
      args.subdiario = path.resolve(process.cwd(), argv[++i]);
    } else if (token === '--no-subdiario') {
      args.subdiario = null;
    }
  }
  return args;
}

function normText(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normDigits(s) {
  return String(s || '').replace(/\D/g, '');
}

function parseArDateNoon(ddmmyyyy) {
  const m = String(ddmmyyyy || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return new Date(`${yyyy}-${mm}-${dd}T12:00:00-03:00`);
}

function tokenizeProduct(s) {
  const clean = normText(s)
    .replace(/(\d)([A-Z])/g, '$1 $2')
    .replace(/([A-Z])(\d)/g, '$1 $2')
    .replace(/\bYOGURT\b/g, 'YOGUR')
    .replace(/\bS\/AZUCAR\b/g, 'SIN AZUCAR')
    .replace(/\bC\/([A-Z])/g, 'CON $1')
    .replace(/\bA\/FACIL\b/g, 'ABRE FACIL')
    .replace(/\bGR(?:\.|\b)/g, 'GR')
    .replace(/\bML(?:\.|\b)/g, 'ML')
    .replace(/\bCC(?:\.|\b)/g, 'ML')
    .replace(/\bLT(?:\.|\b)/g, 'LT')
    .replace(/\bKG(?:\.|\b)/g, 'KG')
    .replace(/[^A-Z0-9.]+/g, ' ')
    .trim();
  const stop = new Set(['X', 'DE', 'EN', 'CON', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'A', 'POR', '1']);
  return clean.split(/\s+/).filter(t => t.length > 0 && !stop.has(t));
}

function extractVariants(s) {
  const n = normText(s).replace(/\bS\/AZUCAR\b/g, 'SIN AZUCAR');
  return new Set(VARIANT_KEYWORDS.filter(v => n.includes(v)));
}

function jaccard(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function resolveSellerId(vendorRaw, userByUsername, fallbackUserId) {
  const norm = normText(vendorRaw);
  if (!norm) return fallbackUserId;
  for (const entry of VENDOR_USERNAME_MAP) {
    if (norm.includes(entry.match)) {
      const u = userByUsername.get(entry.username.toUpperCase());
      if (u) return u.id;
    }
  }
  return fallbackUserId;
}

function parseRetencionKind(kindRaw) {
  const n = normText(kindRaw);
  if (n.includes('GANANCIAS')) return { taxType: 'GANANCIAS', jurisdiction: null };
  if (n.includes('IVA')) return { taxType: 'IVA', jurisdiction: null };
  if (n.includes('IIBB')) {
    let jurisdiction = null;
    if (n.includes('BS AS') || n.includes('BUENOS AIRES')) jurisdiction = 'AR-B';
    else if (n.includes('CABA') || n.includes('CAPITAL')) jurisdiction = 'AR-C';
    else if (n.includes('LA PAMPA')) jurisdiction = 'AR-L';
    return { taxType: 'IIBB', jurisdiction };
  }
  return { taxType: 'IIBB', jurisdiction: null };
}

async function readSubdiario(filePath) {
  const fiscalOverrides = new Map();
  const retenciones = [];
  if (!filePath || !fs.existsSync(filePath)) {
    return { fiscalOverrides, retenciones };
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];

  for (let r = 8; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const fechaStr = String(row.getCell(1).value || '').trim();
    const fecha = parseArDateNoon(fechaStr);
    if (!fecha) continue;

    const kind = String(row.getCell(2).value || '').trim();
    const numRaw = String(row.getCell(3).value || '').trim();
    const personaRaw = String(row.getCell(4).value || '').trim();
    const cuit = normDigits(row.getCell(6).value);
    const neto = new Decimal(row.getCell(7).value || 0);
    const iva = new Decimal(row.getCell(9).value || 0);
    const percep = new Decimal(row.getCell(10).value || 0);
    const ret = new Decimal(row.getCell(11).value || 0);
    const total = new Decimal(row.getCell(12).value || 0);

    const m = numRaw.match(/^([AB])\s+(\d+)-(\d+)$/);
    if (!m) {
      if (!ret.isZero()) {
        const { taxType, jurisdiction } = parseRetencionKind(kind);
        retenciones.push({
          fecha,
          fechaStr,
          kind,
          taxType,
          jurisdiction,
          number: numRaw,
          personaRaw,
          cuit,
          amount: ret.abs().toDecimalPlaces(2),
        });
      }
      continue;
    }

    const [, letter, pv, num] = m;
    const formattedNumber = `${pv.padStart(5, '0')}-${num.padStart(8, '0')}`;
    const key = `${kind}|${letter}|${formattedNumber}`;
    fiscalOverrides.set(key, {
      key,
      fecha,
      kind,
      letter,
      pv: pv.padStart(5, '0'),
      formattedNumber,
      personaRaw,
      cuit,
      neto: neto.toDecimalPlaces(2),
      iva: iva.toDecimalPlaces(2),
      percep: percep.toDecimalPlaces(2),
      total: total.toDecimalPlaces(2),
    });
  }

  return { fiscalOverrides, retenciones };
}

async function readVentas(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró el archivo de ventas: ${filePath}`);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];

  const docs = new Map(); // key -> { ...header, items: [] }
  let totalRows = 0;

  for (let r = 3; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const fechaStr = String(row.getCell(1).value || '').trim();
    const compRaw = String(row.getCell(11).value || '').trim();
    const fecha = parseArDateNoon(fechaStr);
    if (!fecha || !compRaw) continue;

    const m = compRaw.match(/^(Factura|Nota de Credito)\s+([AB])\s+(\d{4})-(\d+)$/);
    if (!m) continue;
    totalRows++;

    const [, kind, letter, pvRaw, numRaw] = m;
    const pv = pvRaw.padStart(5, '0');
    const formattedNumber = `${pv}-${numRaw.padStart(8, '0')}`;
    const isOfficial = pvRaw !== '9999';
    const key = `${kind}|${letter}|${formattedNumber}`;

    if (!docs.has(key)) {
      docs.set(key, {
        key,
        kind,
        letter,
        pv,
        formattedNumber,
        isOfficial,
        fecha,
        fechaStr,
        personaRaw: String(row.getCell(2).value || '').trim(),
        condicionIva: String(row.getCell(3).value || '').trim(),
        cuit: normDigits(row.getCell(5).value),
        dni: normDigits(row.getCell(6).value),
        vendorRaw: String(row.getCell(7).value || '').trim(),
        netoSum: new Decimal(0),
        ivaSum: new Decimal(0),
        totalSum: new Decimal(0),
        items: [],
      });
    }

    const doc = docs.get(key);
    const prodName = String(row.getCell(14).value || '').trim();
    const codeRaw = String(row.getCell(15).value || '').trim();
    const qtyRaw = new Decimal(row.getCell(16).value || 0);
    const unitRaw = String(row.getCell(17).value || '').trim();
    const unitPrice = new Decimal(row.getCell(18).value || 0).abs().toDecimalPlaces(2);
    const discountPct = new Decimal(row.getCell(21).value || 0).abs().toDecimalPlaces(2);
    const neto = new Decimal(row.getCell(22).value || 0);
    const iva = new Decimal(row.getCell(24).value || 0);
    const total = new Decimal(row.getCell(27).value || 0);

    doc.netoSum = doc.netoSum.plus(neto);
    doc.ivaSum = doc.ivaSum.plus(iva);
    doc.totalSum = doc.totalSum.plus(total);

    const isWeight = normText(unitRaw).includes('KG') || !qtyRaw.isInteger();
    const absQty = qtyRaw.abs();
    doc.items.push({
      prodName,
      codeRaw,
      quantity: isWeight ? 1 : Math.max(1, absQty.toDecimalPlaces(0).toNumber()),
      weight: isWeight ? absQty.toDecimalPlaces(3) : null,
      unitPrice,
      discountPct,
      subtotal: kind === 'Nota de Credito' ? total.abs().toDecimalPlaces(2) : total.toDecimalPlaces(2),
    });
  }

  return { docs, totalRows };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log('============================================================');
  console.log(`IMPORTADOR HISTORIAL IDUO -> KILATE (${args.apply ? 'MODO GRABACION' : 'MODO SIMULACION'})`);
  console.log(`Ventas   : ${args.ventas}`);
  console.log(`Subdiario: ${args.subdiario || '(sin subdiario)'}`);
  console.log('Garantia : NO toca Cuenta Corriente, NO toca Stock, NO toca Caja');
  console.log('============================================================\n');

  const [personas, products, users] = await Promise.all([
    prisma.persona.findMany({ where: { isActive: true }, select: { id: true, name: true, cuit: true, isClient: true } }),
    prisma.product.findMany({ select: { id: true, sku: true, name: true, barcode: true, costPrice: true, listPrice: true, unitsPerBox: true } }),
    prisma.user.findMany({ select: { id: true, username: true, role: true, isActive: true } }),
  ]);

  const userByUsername = new Map(users.map(u => [u.username.toUpperCase(), u]));
  const fallbackUser = userByUsername.get('OFICINA') || users.find(u => u.role === 'ADMIN') || users[0];

  const personasByCuit = new Map();
  const personaByName = new Map();
  for (const p of personas) {
    const c = normDigits(p.cuit);
    if (c && c.length >= 7) {
      if (!personasByCuit.has(c)) personasByCuit.set(c, []);
      personasByCuit.get(c).push(p);
    }
    personaByName.set(normText(p.name), p);
  }

  const prodByBarcode = new Map();
  const prodByName = new Map();
  const prodIndex = [];
  for (const pr of products) {
    if (pr.barcode && pr.barcode.trim().length >= 8) {
      prodByBarcode.set(pr.barcode.trim().toUpperCase(), pr);
    }
    prodByName.set(normText(pr.name), pr);
    prodIndex.push({
      pr,
      tokens: tokenizeProduct(pr.name),
      variants: extractVariants(pr.name),
    });
  }

  const BARRIO_SUFFIX_RE = /\s*\((CENTRO\s*[1-4]|C[12]|FONAVI|PARQUE|TROCHA|CICLON|PLAN\s+FEDERAL|FEDERAL|PROVINCIA|CARDAL|CRUCE|PROGRESO|PROGR|HOSPITAL|FERIA|FEDERAL-HOSPITAL)\)\s*$/i;

  function matchClient(personaRaw, cuit, dni) {
    // 1. Nombre exacto o alias primero: evita cruzar sucursales con mismo CUIT (ej. Narpe Enrique 2 vs PROGR)
    const rawClean = String(personaRaw || '').trim().replace(/\s*\*+$/, '').trim();
    const n = normText(rawClean);
    if (n && personaByName.has(n)) return { db: personaByName.get(n), by: 'NAME' };
    if (n && CLIENT_ALIASES[n] && personaByName.has(CLIENT_ALIASES[n])) {
      return { db: personaByName.get(CLIENT_ALIASES[n]), by: 'ALIAS' };
    }
    // 1b. Nombre limpio sin sufijo de barrio (ej. "DUFOURC MARCOS DANIEL (C1)" -> "DUFOURC MARCOS DANIEL")
    const withoutBarrio = normText(rawClean.replace(BARRIO_SUFFIX_RE, '').trim());
    if (withoutBarrio && withoutBarrio !== n && personaByName.has(withoutBarrio)) {
      return { db: personaByName.get(withoutBarrio), by: 'NAME_NO_BARRIO' };
    }
    // 2. CUIT / DNI solo si es único en la base (no compartido por varias sucursales)
    if (cuit && personasByCuit.get(cuit)?.length === 1) {
      return { db: personasByCuit.get(cuit)[0], by: 'CUIT' };
    }
    if (dni && personasByCuit.get(dni)?.length === 1) {
      return { db: personasByCuit.get(dni)[0], by: 'DNI' };
    }
    return null;
  }

  const productMatchCache = new Map();
  function matchProduct(prodName, codeRaw) {
    const cacheKey = `${codeRaw}|${prodName}`;
    if (productMatchCache.has(cacheKey)) return productMatchCache.get(cacheKey);

    // 1. Solo barcodes largos (>= 8 caracteres), NUNCA SKU corto
    const codes = String(codeRaw || '').split(',').map(x => x.trim().toUpperCase()).filter(c => c.length >= 8);
    for (const c of codes) {
      if (prodByBarcode.has(c)) {
        const res = { db: prodByBarcode.get(c), by: 'BARCODE', score: 1 };
        productMatchCache.set(cacheKey, res);
        return res;
      }
    }

    // 2. Nombre normalizado exacto o alias explícito
    const n = normText(prodName);
    if (prodByName.has(n)) {
      const res = { db: prodByName.get(n), by: 'NAME_EXACT', score: 1 };
      productMatchCache.set(cacheKey, res);
      return res;
    }
    if (PRODUCT_ALIASES[n] && prodByName.has(PRODUCT_ALIASES[n])) {
      const res = { db: prodByName.get(PRODUCT_ALIASES[n]), by: 'ALIAS', score: 1 };
      productMatchCache.set(cacheKey, res);
      return res;
    }

    // 3. Match por tokens con protección de sabor/variante
    const tks = tokenizeProduct(prodName);
    const vars = extractVariants(prodName);
    let best = null;
    let bestScore = 0;

    for (const entry of prodIndex) {
      // Si ambos declaran variantes distintas (ej. FRUTILLA vs VAINILLA), descartar
      if (vars.size > 0 && entry.variants.size > 0) {
        let conflict = false;
        for (const v of vars) {
          if (!entry.variants.has(v)) { conflict = true; break; }
        }
        if (conflict) continue;
      }
      const sc = jaccard(tks, entry.tokens);
      if (sc > bestScore) {
        bestScore = sc;
        best = entry.pr;
      }
    }

    if (best && bestScore >= 0.70) {
      const res = { db: best, by: 'NAME_FUZZY', score: bestScore };
      productMatchCache.set(cacheKey, res);
      return res;
    }

    const res = { db: null, by: 'MISSING', score: bestScore, closest: best };
    productMatchCache.set(cacheKey, res);
    return res;
  }

  const [{ docs, totalRows }, { fiscalOverrides, retenciones }] = await Promise.all([
    readVentas(args.ventas),
    readSubdiario(args.subdiario),
  ]);

  const missingClients = new Map();
  const missingProducts = new Map();
  const fuzzyProducts = new Map();

  let ordersCount = 0;
  let cnCount = 0;
  let officialOrders = 0;
  let internalOrders = 0;
  let officialCN = 0;
  let internalCN = 0;

  let fiscalNeto = new Decimal(0);
  let fiscalIva = new Decimal(0);
  let fiscalPercep = new Decimal(0);
  let fiscalRet = new Decimal(0);
  let fiscalTotal = new Decimal(0);
  let internalTotal = new Decimal(0);

  const preparedOrders = [];
  const preparedCNs = [];

  for (const doc of docs.values()) {
    const clientRes = matchClient(doc.personaRaw, doc.cuit, doc.dni);
    if (!clientRes) {
      const k = doc.personaRaw;
      if (!missingClients.has(k)) missingClients.set(k, { name: doc.personaRaw, cuit: doc.cuit, dni: doc.dni, docs: 0 });
      missingClients.get(k).docs++;
    }

    const sellerId = resolveSellerId(doc.vendorRaw, userByUsername, fallbackUser.id);
    const resolvedItems = [];

    for (const it of doc.items) {
      const prRes = matchProduct(it.prodName, it.codeRaw);
      if (!prRes.db) {
        const pk = `${it.codeRaw}|${normText(it.prodName)}`;
        if (!missingProducts.has(pk)) {
          missingProducts.set(pk, {
            prodName: it.prodName,
            codeRaw: it.codeRaw,
            rows: 0,
            closestName: prRes.closest?.name || '-',
            closestScore: Math.round((prRes.score || 0) * 100),
          });
        }
        missingProducts.get(pk).rows++;
      } else if (prRes.by === 'NAME_FUZZY') {
        fuzzyProducts.set(it.prodName, {
          iduo: it.prodName,
          kilate: prRes.db.name,
          score: Math.round(prRes.score * 100),
        });
      }
      resolvedItems.push({ ...it, product: prRes.db });
    }

    const sub = doc.isOfficial ? fiscalOverrides.get(doc.key) : null;
    const isCN = doc.kind === 'Nota de Credito';

    const netVal = sub ? sub.neto : doc.netoSum.toDecimalPlaces(2);
    const ivaVal = sub ? sub.iva : doc.ivaSum.toDecimalPlaces(2);
    const percepVal = sub ? sub.percep : new Decimal(0);
    const totalVal = sub ? sub.total : doc.totalSum.toDecimalPlaces(2);

    if (doc.isOfficial) {
      fiscalNeto = fiscalNeto.plus(netVal);
      fiscalIva = fiscalIva.plus(ivaVal);
      fiscalPercep = fiscalPercep.plus(percepVal);
      fiscalTotal = fiscalTotal.plus(totalVal);
    } else {
      internalTotal = internalTotal.plus(totalVal);
    }

    if (isCN) {
      cnCount++;
      if (doc.isOfficial) officialCN++; else internalCN++;
      preparedCNs.push({
        doc,
        persona: clientRes?.db || null,
        userId: sellerId,
        netAmount: netVal.abs(),
        taxAmount: ivaVal.abs(),
        percepcionIvaAmount: percepVal.abs(),
        totalAmount: totalVal.abs(),
        items: resolvedItems,
      });
    } else {
      ordersCount++;
      if (doc.isOfficial) officialOrders++; else internalOrders++;
      preparedOrders.push({
        doc,
        persona: clientRes?.db || null,
        sellerId,
        netAmount: netVal.abs(),
        taxAmount: ivaVal.abs(),
        percepcionIvaAmount: percepVal.abs(),
        totalAmount: totalVal.abs(),
        items: resolvedItems,
      });
    }
  }

  const preparedRets = [];
  for (const r of retenciones) {
    const clientRes = matchClient(r.personaRaw, r.cuit, '');
    if (!clientRes) {
      if (!missingClients.has(r.personaRaw)) {
        missingClients.set(r.personaRaw, { name: r.personaRaw, cuit: r.cuit, dni: '', docs: 0 });
      }
      missingClients.get(r.personaRaw).docs++;
    }
    fiscalRet = fiscalRet.plus(r.amount);
    fiscalTotal = fiscalTotal.minus(r.amount);
    preparedRets.push({ ...r, persona: clientRes?.db || null });
  }

  console.log('--- RESUMEN DE COMPROBANTES ---');
  console.log(`Renglones leidos   : ${totalRows}`);
  console.log(`Facturas           : ${ordersCount} (Oficiales: ${officialOrders} | Internas X: ${internalOrders})`);
  console.log(`Notas de Credito   : ${cnCount} (Oficiales: ${officialCN} | Internas X: ${internalCN})`);
  console.log(`Retenciones        : ${preparedRets.length}`);
  console.log('');
  console.log('--- CONTROL SUBDIARIO IVA VENTAS (OFICIAL) ---');
  console.log(`Neto Gravado       : $${fiscalNeto.toFixed(2)}`);
  console.log(`IVA 21%            : $${fiscalIva.toFixed(2)}`);
  console.log(`Percepciones 3%    : $${fiscalPercep.toFixed(2)}`);
  console.log(`Retenciones (-)    : -$${fiscalRet.toFixed(2)}`);
  console.log(`TOTAL SUBDIARIO    : $${fiscalTotal.toFixed(2)}`);
  console.log(`TOTAL INTERNO (X)  : $${internalTotal.toFixed(2)}`);
  console.log('');
  console.log('--- DIAGNOSTICO DE COINCIDENCIAS ---');
  console.log(`Clientes faltantes : ${missingClients.size}`);
  for (const c of missingClients.values()) {
    console.log(`  [CLIENTE FALTANTE] "${c.name}" (CUIT:${c.cuit || '-'} DNI:${c.dni || '-'} comps:${c.docs})`);
  }
  console.log(`Productos match aproximado seguro (>=70%): ${fuzzyProducts.size}`);
  console.log(`Productos sin match claro (<70%): ${missingProducts.size}`);
  const sortedMissingProds = [...missingProducts.values()].sort((a, b) => b.rows - a.rows);
  for (const p of sortedMissingProds) {
    console.log(`  [PROD SIN MATCH] (${p.rows} filas) "${p.prodName}" [cod:${p.codeRaw || '-'}] | mas parecido: ${p.closestScore}% "${p.closestName}"`);
  }

  if (!args.apply) {
    console.log('\n[SIMULACION COMPLETADA] No se modifico ningun dato en la base.');
    console.log('Cuando quieras grabar en serio (el fin de semana), ejecuta con --apply (y --create-missing si queres crear los faltantes automaticamente).');
    return;
  }

  if ((missingClients.size > 0 || missingProducts.size > 0) && !args.createMissing) {
    throw new Error('Hay clientes o productos faltantes. Corregilos o ejecuta con --apply --create-missing.');
  }

  // Crear faltantes si --create-missing
  if (args.createMissing) {
    for (const c of missingClients.values()) {
      const created = await prisma.persona.create({
        data: {
          name: c.name.replace(/\*/g, '').replace(/\s+/g, ' ').trim(),
          cuit: c.cuit || c.dni || null,
          isClient: true,
        },
      });
      personaByName.set(normText(c.name), created);
      if (c.cuit) personaByCuit.set(c.cuit, created);
      console.log(`+ Cliente creado: [${created.id}] ${created.name}`);
    }

    let histSeq = products.reduce((max, pr) => {
      const m = String(pr.sku || '').match(/^HIST-(\d+)$/);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0) + 1;
    for (const p of sortedMissingProds) {
      const sku = `HIST-${String(histSeq++).padStart(4, '0')}`;
      const created = await prisma.product.create({
        data: {
          sku,
          name: p.prodName,
          isActive: false, // Inactivo para no ensuciar catálogo activo hasta revisarlo
          costPrice: new Decimal(0),
          listPrice: new Decimal(0),
          listPriceB: new Decimal(0),
          listPriceC: new Decimal(0),
        },
      });
      prodByName.set(normText(p.prodName), created);
      console.log(`+ Producto historico creado (inactivo): [${created.sku}] ${created.name}`);
    }
  }

  // Grabación idempotente en lotes paralelos (SIN AccountLedger, SIN StockMovement, SIN CashDrawer)
  const existingOrders = await prisma.order.findMany({
    where: { clientRequestId: { startsWith: 'IDUO-HIST-' } },
    select: { clientRequestId: true },
  });
  const existingReqSet = new Set(existingOrders.map(o => o.clientRequestId));

  const toInsertOrders = preparedOrders.filter(entry => !existingReqSet.has(`IDUO-HIST-${entry.doc.key}`));
  const skippedOrders = preparedOrders.length - toInsertOrders.length;
  let insertedOrders = 0;

  const CONCURRENCY = 10;
  for (let i = 0; i < toInsertOrders.length; i += CONCURRENCY) {
    const chunk = toInsertOrders.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (entry) => {
      const clientRequestId = `IDUO-HIST-${entry.doc.key}`;
      const persona = entry.persona || matchClient(entry.doc.personaRaw, entry.doc.cuit, entry.doc.dni)?.db;
      const invoiceType = entry.doc.letter === 'A' ? 'FACTURA_A' : 'FACTURA_B';

      await prisma.order.create({
        data: {
          personaId: persona.id,
          sellerId: entry.sellerId,
          billingType: entry.doc.isOfficial ? 'OFFICIAL' : 'INTERNAL',
          invoiceType,
          invoiceNumber: entry.doc.formattedNumber,
          invoicedAt: entry.doc.fecha,
          deliveredAt: entry.doc.fecha,
          cae: entry.doc.isOfficial ? `HIST-IDUO-${entry.doc.formattedNumber}` : null,
          status: 'DELIVERED',
          totalAmount: entry.totalAmount,
          netAmount: entry.netAmount,
          taxAmount: entry.taxAmount,
          percepcionAmount: new Decimal(0),
          percepcionIvaAmount: entry.percepcionIvaAmount,
          salesChannel: entry.doc.vendorRaw ? 'PREVENTA_RUTA' : 'MOSTRADOR',
          notes: 'Importado historial Iduo (sin impacto en Cta. Cte. ni Stock)',
          clientRequestId,
          createdAt: entry.doc.fecha,
          items: {
            create: entry.items.map(it => {
              const pr = it.product || prodByName.get(normText(it.prodName));
              return {
                productId: pr.id,
                quantity: it.quantity,
                weight: it.weight,
                unitPrice: it.unitPrice,
                unitCostSnapshot: resolveHistoricalUnitCostSnapshot(pr, it.unitPrice),
                listPriceSnapshot: it.unitPrice,
                discountPctSnapshot: it.discountPct,
                subtotal: it.subtotal,
              };
            }),
          },
        },
      });
    }));
    insertedOrders += chunk.length;
    if (insertedOrders % 200 === 0 || insertedOrders === toInsertOrders.length) {
      console.log(`  ... Facturas grabadas: ${insertedOrders}/${toInsertOrders.length} (omitidas: ${skippedOrders})`);
    }
  }

  let insertedCNs = 0, skippedCNs = 0;
  for (const entry of preparedCNs) {
    const billingType = entry.doc.isOfficial ? 'OFFICIAL' : 'INTERNAL';
    const exists = await prisma.creditNote.findFirst({
      where: { creditNoteNumber: entry.doc.formattedNumber, billingType },
      select: { id: true },
    });
    if (exists) { skippedCNs++; continue; }

    const persona = entry.persona || matchClient(entry.doc.personaRaw, entry.doc.cuit, entry.doc.dni)?.db;
    const creditNoteType = entry.doc.isOfficial
      ? (entry.doc.letter === 'A' ? 'NOTA_CREDITO_A' : 'NOTA_CREDITO_B')
      : 'NOTA_CREDITO_INTERNA';

    await prisma.creditNote.create({
      data: {
        personaId: persona.id,
        userId: entry.userId,
        status: 'APPROVED',
        billingType,
        creditNoteType,
        creditNoteNumber: entry.doc.formattedNumber,
        cae: entry.doc.isOfficial ? `HIST-IDUO-NC-${entry.doc.formattedNumber}` : null,
        totalAmount: entry.totalAmount,
        netAmount: entry.netAmount,
        taxAmount: entry.taxAmount,
        percepcionAmount: new Decimal(0),
        percepcionIvaAmount: entry.percepcionIvaAmount,
        reason: 'DEVOLUCION',
        comments: 'Importado historial Iduo (sin impacto en Cta. Cte. ni Stock)',
        createdAt: entry.doc.fecha,
        items: {
          create: entry.items.map(it => {
            const pr = it.product || prodByName.get(normText(it.prodName));
            return {
              productId: pr.id,
              quantity: it.quantity,
              weight: it.weight,
              unitPrice: it.unitPrice,
              subtotal: it.subtotal,
            };
          }),
        },
      },
    });
    insertedCNs++;
  }

  let insertedRets = 0, skippedRets = 0;
  for (const r of preparedRets) {
    const persona = r.persona || matchClient(r.personaRaw, r.cuit, '')?.db;
    const exists = await prisma.taxWithholding.findFirst({
      where: { type: 'RETENCION_SUFRIDA', taxType: r.taxType, number: r.number, personaId: persona.id },
      select: { id: true },
    });
    if (exists) { skippedRets++; continue; }

    await prisma.taxWithholding.create({
      data: {
        type: 'RETENCION_SUFRIDA',
        taxType: r.taxType,
        jurisdiction: r.jurisdiction,
        personaId: persona.id,
        number: r.number,
        date: r.fecha,
        amount: r.amount,
      },
    });
    insertedRets++;
  }

  console.log('\n=== GRABACION COMPLETADA ===');
  console.log(`Facturas insertadas    : ${insertedOrders} (omitidas ya existentes: ${skippedOrders})`);
  console.log(`NC insertadas          : ${insertedCNs} (omitidas ya existentes: ${skippedCNs})`);
  console.log(`Retenciones insertadas : ${insertedRets} (omitidas ya existentes: ${skippedRets})`);
}

main()
  .catch((err) => {
    console.error('ERROR:', err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
