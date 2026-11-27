const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');
const Decimal = require('decimal.js');

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = {
    file: path.resolve(__dirname, '../../4.xls'),
    apply: false,
    createMissing: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--apply') args.apply = true;
    else if (token === '--create-missing') args.createMissing = true;
    else if (token === '--file' && argv[i + 1]) {
      args.file = path.resolve(process.cwd(), argv[++i]);
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

function decodeXml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseArDateNoon(ddmmyyyy) {
  const m = String(ddmmyyyy || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return new Date(`${yyyy}-${mm}-${dd}T12:00:00-03:00`);
}

function parseSpreadsheetML(xml) {
  const wsMatch = xml.match(/<Worksheet[^>]*>([\s\S]*?)<\/Worksheet>/);
  const body = wsMatch ? wsMatch[1] : xml;
  const rows = [];
  const rowRe = /<Row[^>]*>([\s\S]*?)<\/Row>/g;
  let rm;
  while ((rm = rowRe.exec(body)) !== null) {
    const cells = [];
    const cellRe = /<Cell([^>]*)>([\s\S]*?)<\/Cell>/g;
    let cm;
    let colIdx = 0;
    while ((cm = cellRe.exec(rm[1])) !== null) {
      const idxM = cm[1].match(/ss:Index=['"](\d+)['"]/);
      if (idxM) colIdx = parseInt(idxM[1], 10) - 1;
      const dataM = cm[2].match(/<Data[^>]*>([\s\S]*?)<\/Data>/);
      cells[colIdx] = dataM ? decodeXml(dataM[1]).trim() : '';
      colIdx++;
    }
    rows.push(cells);
  }
  return rows;
}

async function readRowsFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró el archivo de compras: ${filePath}`);
  }
  const head = fs.readFileSync(filePath).slice(0, 64).toString('utf8').trim();
  if (head.startsWith('<?xml') || head.startsWith('<Workbook')) {
    const xml = fs.readFileSync(filePath, 'utf8');
    return parseSpreadsheetML(xml);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  const rows = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const cells = [];
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell, colNumber) => {
      let v = cell.value;
      if (v && typeof v === 'object' && v.result !== undefined) v = v.result;
      if (v && typeof v === 'object' && v.text !== undefined) v = v.text;
      cells[colNumber - 1] = v == null ? '' : String(v).trim();
    });
    rows.push(cells);
  }
  return rows;
}

function mapInvoiceType(kindRaw, letterRaw) {
  const kind = normText(kindRaw);
  const letter = (letterRaw || 'A').toUpperCase();
  if (kind.includes('CREDITO')) {
    if (letter === 'B') return 'NOTA_CREDITO_B';
    if (letter === 'C') return 'NOTA_CREDITO_C';
    return 'NOTA_CREDITO_A';
  }
  if (kind.includes('DEBITO')) {
    if (letter === 'B') return 'NOTA_DEBITO_B';
    if (letter === 'C') return 'NOTA_DEBITO_C';
    return 'NOTA_DEBITO_A';
  }
  if (letter === 'B') return 'FACTURA_B';
  if (letter === 'C') return 'FACTURA_C';
  return 'FACTURA_A';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log('============================================================');
  console.log(`IMPORTADOR COMPRAS IDUO -> KILATE (${args.apply ? 'MODO GRABACION' : 'MODO SIMULACION'})`);
  console.log(`Archivo  : ${args.file}`);
  console.log('Garantia : NO toca Cuenta Corriente, NO toca Stock, NO toca Caja');
  console.log('============================================================\n');

  const [rows, personas] = await Promise.all([
    readRowsFromFile(args.file),
    prisma.persona.findMany({ select: { id: true, name: true, cuit: true, isProvider: true } }),
  ]);

  const byCuit = new Map();
  const byName = new Map();
  for (const p of personas) {
    const c = normDigits(p.cuit);
    if (c && c.length >= 7) byCuit.set(c, p);
    byName.set(normText(p.name), p);
  }

  // Detectar índices de columnas desde la fila de cabecera ("Fecha" | "Comprobante" | ...)
  const headerIdx = rows.findIndex(r => normText(r[0]) === 'FECHA' && normText(r[1]).includes('COMPROBANTE'));
  const colMap = { fecha: 0, tipo: 1, numero: 2, persona: 3, cuit: 4, neto: 5, exento: 6, iva: 7, percep: 8, ret: 9, total: 10 };
  if (headerIdx >= 0) {
    rows[headerIdx].forEach((h, i) => {
      const n = normText(h);
      if (n === 'FECHA') colMap.fecha = i;
      else if (n === 'COMPROBANTE') colMap.tipo = i;
      else if (n === 'NUMERO') colMap.numero = i;
      else if (n === 'PERSONA') colMap.persona = i;
      else if (n === 'CUIT') colMap.cuit = i;
      else if (n.includes('NETO')) colMap.neto = i;
      else if (n.includes('EXENTO')) colMap.exento = i;
      else if (n === 'IVA') colMap.iva = i;
      else if (n.includes('PERCEP')) colMap.percep = i;
      else if (n.includes('RETEN')) colMap.ret = i;
      else if (n === 'TOTAL') colMap.total = i;
    });
  }

  const parsed = [];
  const missingProviders = new Map();
  let sumNeto = new Decimal(0);
  let sumIva = new Decimal(0);
  let sumPercep = new Decimal(0);
  let sumTotal = new Decimal(0);
  let facturasCount = 0;
  let ncCount = 0;

  for (let i = Math.max(0, headerIdx + 1); i < rows.length; i++) {
    const r = rows[i];
    const fecha = parseArDateNoon(r[colMap.fecha]);
    if (!fecha) continue;

    const kindRaw = String(r[colMap.tipo] || '').trim();
    const numRaw = String(r[colMap.numero] || '').trim();
    const personaRaw = String(r[colMap.persona] || '').trim();
    const cuit = normDigits(r[colMap.cuit]);

    const m = numRaw.match(/^([ABC])\s+(\d+)-(\d+)$/i);
    const letter = m ? m[1].toUpperCase() : 'A';
    const formattedNumber = m ? `${m[2].padStart(5, '0')}-${m[3].padStart(8, '0')}` : numRaw;
    const invoiceType = mapInvoiceType(kindRaw, letter);

    const neto = new Decimal(r[colMap.neto] || 0);
    const iva = new Decimal(r[colMap.iva] || 0);
    const percep = new Decimal(r[colMap.percep] || 0);
    const total = new Decimal(r[colMap.total] || 0);

    sumNeto = sumNeto.plus(neto);
    sumIva = sumIva.plus(iva);
    sumPercep = sumPercep.plus(percep);
    sumTotal = sumTotal.plus(total);

    if (invoiceType.includes('CREDITO')) ncCount++;
    else facturasCount++;

    const dbProvider = (cuit && byCuit.get(cuit)) || byName.get(normText(personaRaw)) || null;
    if (!dbProvider) {
      const pk = cuit || normText(personaRaw);
      if (!missingProviders.has(pk)) missingProviders.set(pk, { name: personaRaw, cuit, count: 0 });
      missingProviders.get(pk).count++;
    }

    parsed.push({
      fecha,
      invoiceType,
      invoiceNumber: formattedNumber,
      personaRaw,
      cuit,
      provider: dbProvider,
      netAmount: neto.abs().toDecimalPlaces(2),
      taxAmount: iva.abs().toDecimalPlaces(2),
      percepcionAmount: percep.abs().toDecimalPlaces(2),
      totalAmount: total.abs().toDecimalPlaces(2),
    });
  }

  console.log('--- RESUMEN DE COMPROBANTES ---');
  console.log(`Facturas           : ${facturasCount}`);
  console.log(`Notas de Credito   : ${ncCount}`);
  console.log(`Total comprobantes : ${parsed.length}`);
  console.log('');
  console.log('--- CONTROL SUBDIARIO IVA COMPRAS ---');
  console.log(`Neto Gravado       : $${sumNeto.toFixed(2)}`);
  console.log(`IVA Credito Fiscal : $${sumIva.toFixed(2)}`);
  console.log(`Percepciones       : $${sumPercep.toFixed(2)}`);
  console.log(`TOTAL COMPRAS      : $${sumTotal.toFixed(2)}`);
  console.log('');
  console.log('--- DIAGNOSTICO DE PROVEEDORES ---');
  console.log(`Proveedores faltantes: ${missingProviders.size}`);
  for (const mp of missingProviders.values()) {
    console.log(`  [PROVEEDOR FALTANTE] "${mp.name}" (CUIT:${mp.cuit || '-'} comps:${mp.count})`);
  }

  if (!args.apply) {
    console.log('\n[SIMULACION COMPLETADA] No se modifico ningun dato en la base.');
    return;
  }

  if (missingProviders.size > 0 && !args.createMissing) {
    throw new Error('Hay proveedores faltantes. Crealos o ejecuta con --apply --create-missing.');
  }

  if (args.createMissing) {
    for (const mp of missingProviders.values()) {
      const created = await prisma.persona.create({
        data: {
          name: mp.name.replace(/\s+/g, ' ').trim(),
          cuit: mp.cuit || null,
          isClient: false,
          isProvider: true,
          taxCondition: 'RESPONSABLE_INSCRIPTO',
        },
      });
      if (mp.cuit) byCuit.set(mp.cuit, created);
      byName.set(normText(mp.name), created);
      console.log(`+ Proveedor creado: [${created.id}] ${created.name}`);
    }
  }

  let inserted = 0;
  let skipped = 0;
  for (const item of parsed) {
    const provider = item.provider || (item.cuit && byCuit.get(item.cuit)) || byName.get(normText(item.personaRaw));
    const exists = await prisma.supplierInvoice.findFirst({
      where: {
        personaId: provider.id,
        invoiceType: item.invoiceType,
        invoiceNumber: item.invoiceNumber,
      },
      select: { id: true },
    });
    if (exists) { skipped++; continue; }

    await prisma.supplierInvoice.create({
      data: {
        personaId: provider.id,
        invoiceNumber: item.invoiceNumber,
        invoiceType: item.invoiceType,
        issueDate: item.fecha,
        status: 'PAID',
        paidAmount: item.totalAmount,
        netAmount: item.netAmount,
        taxAmount: item.taxAmount,
        percepcionAmount: item.percepcionAmount,
        percepcionIvaAmount: new Decimal(0),
        impuestosInternos: new Decimal(0),
        totalAmount: item.totalAmount,
        billingType: 'OFFICIAL',
        receptionStatus: 'RECEIVED',
        receivedAt: item.fecha,
      },
    });
    inserted++;
  }

  console.log('\n=== GRABACION COMPLETADA ===');
  console.log(`Comprobantes de compra insertados: ${inserted} (omitidos ya existentes: ${skipped})`);
}

main()
  .catch((err) => {
    console.error('ERROR:', err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
