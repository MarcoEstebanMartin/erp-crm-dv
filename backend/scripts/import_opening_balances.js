const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const Decimal = require('decimal.js');

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = {
    file: path.resolve(__dirname, '../../Clientes1.csv'),
    apply: false,
    createMissing: false,
    keepCents: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--apply') args.apply = true;
    else if (token === '--create-missing') args.createMissing = true;
    else if (token === '--keep-cents') args.keepCents = true;
    else if (token === '--file' && argv[i + 1]) {
      args.file = path.resolve(process.cwd(), argv[i + 1]);
      i++;
    }
  }
  return args;
}

function cleanDisplayName(s) {
  return String(s || '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanAddress(s) {
  const val = String(s || '').replace(/\s+/g, ' ').trim();
  if (!val || val === '#¿NOMBRE?' || val === '#NAME?') return null;
  return val;
}

function normName(s) {
  return cleanDisplayName(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/"+/g, '"')
    .toUpperCase();
}

function normCuit(s) {
  const digits = String(s || '').replace(/\D/g, '');
  if (digits.length !== 11) return '';
  if (/^0+$/.test(digits) || /^9+$/.test(digits)) return '';
  return digits;
}

function formatCuit(digits) {
  if (!digits || digits.length !== 11) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

function parseCsvLine(line) {
  const parts = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === ';' && !inQ) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

function parseArgentineDecimal(rawValue, keepCents) {
  const cleaned = String(rawValue || '0')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.');
  const dec = new Decimal(cleaned);
  return keepCents ? dec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : dec.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`📂 Archivo: ${args.file}`);
  console.log(
    `⚙️ Modo: ${args.apply ? 'APLICAR EN BASE DE DATOS' : 'SIMULACRO (dry-run)'} | Precisión: ${
      args.keepCents ? 'Centavos exactos' : 'Pesos enteros (ROUND_HALF_UP)'
    } | Alta automática faltantes: ${args.createMissing ? 'SÍ' : 'NO'}`,
  );

  if (!fs.existsSync(args.file)) {
    throw new Error(`No se encontró el archivo CSV: ${args.file}`);
  }

  const raw = fs.readFileSync(args.file, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error('El archivo CSV no contiene registros.');

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idxName = header.findIndex((h) => h.includes('denominacion') || h.includes('nombre'));
  const idxAddr = header.findIndex((h) => h.includes('direccion'));
  const idxCuit = header.findIndex((h) => h.includes('cuit'));
  const idxBal = header.findIndex((h) => h.includes('saldo'));

  if (idxName === -1 || idxBal === -1) {
    throw new Error(`Encabezado CSV inválido. Se requieren columnas Denominacion y Saldo. Detectado: ${header.join(', ')}`);
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const rawName = (cols[idxName] || '').trim();
    const rawAddr = idxAddr >= 0 ? cols[idxAddr] : '';
    const cuit = idxCuit >= 0 ? normCuit(cols[idxCuit]) : '';
    const balance = parseArgentineDecimal(cols[idxBal], args.keepCents);
    if (balance.isZero()) continue;
    rows.push({
      line: i + 1,
      rawName,
      cleanName: cleanDisplayName(rawName),
      address: cleanAddress(rawAddr),
      cuit,
      billingType: rawName.includes('*') ? 'INTERNAL' : 'OFFICIAL',
      balance,
    });
  }

  const [personas, existingOpeningCount, adminUser] = await Promise.all([
    prisma.persona.findMany({
      where: { isClient: true },
      select: { id: true, name: true, cuit: true, isActive: true, outstandingBalance: true },
    }),
    prisma.accountLedger.count({ where: { sourceType: 'OPENING_BALANCE' } }),
    prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true }, orderBy: { id: 'asc' } }),
  ]);

  if (args.apply && existingOpeningCount > 0) {
    throw new Error(
      `Bloqueado por seguridad: ya existen ${existingOpeningCount} asientos OPENING_BALANCE en AccountLedger. Evitando doble carga.`,
    );
  }
  if (!adminUser) {
    throw new Error('No se encontró usuario ADMIN activo para auditar los asientos iniciales.');
  }

  const byNorm = new Map();
  const byCuit = new Map();
  for (const p of personas) {
    const n = normName(p.name);
    if (!byNorm.has(n)) byNorm.set(n, []);
    byNorm.get(n).push(p);

    const c = normCuit(p.cuit);
    if (c) {
      if (!byCuit.has(c)) byCuit.set(c, []);
      byCuit.get(c).push(p);
    }
  }

  const matched = [];
  const toCreate = [];
  const usedPersonaIds = new Set();

  for (const r of rows) {
    let target = null;
    let matchMode = '';

    const nList = byNorm.get(normName(r.rawName)) || [];
    if (nList.length === 1) {
      target = nList[0];
      matchMode = 'NAME';
    } else if (r.cuit) {
      const cList = byCuit.get(r.cuit) || [];
      if (cList.length === 1) {
        target = cList[0];
        matchMode = 'CUIT';
      }
    }

    if (target) {
      if (usedPersonaIds.has(target.id)) {
        throw new Error(`Colisión detectada: el cliente ID ${target.id} (${target.name}) aparece dos veces en el CSV.`);
      }
      usedPersonaIds.add(target.id);
      matched.push({ ...r, target, matchMode });
    } else {
      toCreate.push(r);
    }
  }

  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);
  let debitCount = 0;
  let creditCount = 0;

  for (const item of [...matched, ...(args.createMissing ? toCreate : [])]) {
    if (item.balance.gt(0)) {
      debitCount++;
      totalDebit = totalDebit.plus(item.balance);
    } else {
      creditCount++;
      totalCredit = totalCredit.plus(item.balance.abs());
    }
  }

  console.log('\n📊 RESUMEN DE IMPORTACIÓN:');
  console.log(`- Filas con saldo != 0 en CSV: ${rows.length}`);
  console.log(`- Emparejados con clientes existentes: ${matched.length} (${matched.filter((m) => m.matchMode === 'NAME').length} por nombre, ${matched.filter((m) => m.matchMode === 'CUIT').length} por CUIT)`);
  console.log(`- Clientes faltantes en ERP: ${toCreate.length} ${args.createMissing ? '(SE DARÁN DE ALTA)' : '(OMITIDOS)'}`);
  if (toCreate.length > 0) {
    for (const c of toCreate) {
      console.log(`   • ${c.cleanName} | Dir: ${c.address || 'S/D'} | Saldo: $${c.balance.toFixed(args.keepCents ? 2 : 0)}`);
    }
  }
  console.log(`- Deudores (DEBIT): ${debitCount} clientes — Total: $${totalDebit.toFixed(args.keepCents ? 2 : 0)}`);
  console.log(`- Saldos a favor (CREDIT): ${creditCount} clientes — Total: -$${totalCredit.toFixed(args.keepCents ? 2 : 0)}`);
  const allToProcess = [...matched, ...(args.createMissing ? toCreate : [])];
  const countA = allToProcess.filter((x) => x.billingType === 'OFFICIAL').length;
  const countX = allToProcess.filter((x) => x.billingType === 'INTERNAL').length;
  console.log(`- Distribución por sucursal (regla asterisco): Sucursal A (sin *): ${countA} | Sucursal X (con *): ${countX}`);
  console.log(`- Neto total a cargar: $${totalDebit.minus(totalCredit).toFixed(args.keepCents ? 2 : 0)}`);

  if (!args.apply) {
    console.log('\nℹ️ Simulacro finalizado. No se modificó la base de datos. Agregá --apply para confirmar.');
    return;
  }

  const now = new Date();
  let createdClients = 0;
  let reactivatedClients = 0;
  let ledgerCreated = 0;

  await prisma.$transaction(
    async (tx) => {
      const operations = [...matched];

      if (args.createMissing && toCreate.length > 0) {
        for (const c of toCreate) {
          const created = await tx.persona.create({
            data: {
              name: c.cleanName,
              cuit: formatCuit(c.cuit),
              address: c.address,
              isClient: true,
              isActive: true,
              outstandingBalance: 0,
            },
            select: { id: true, name: true, isActive: true, outstandingBalance: true },
          });
          createdClients++;
          operations.push({ ...c, target: created, matchMode: 'CREATED' });
        }
      }

      for (const op of operations) {
        const currentBal = new Decimal(op.target.outstandingBalance || 0);
        const newBal = currentBal.plus(op.balance);
        const isDebit = op.balance.gt(0);

        const updateData = { outstandingBalance: newBal.toNumber() };
        if (!op.target.isActive) {
          updateData.isActive = true;
          reactivatedClients++;
        }

        await tx.persona.update({
          where: { id: op.target.id },
          data: updateData,
        });

        await tx.accountLedger.create({
          data: {
            personaId: op.target.id,
            entryType: isDebit ? 'DEBIT' : 'CREDIT',
            sourceType: 'OPENING_BALANCE',
            billingType: op.billingType,
            amount: op.balance.abs().toNumber(),
            balanceAfter: newBal.toNumber(),
            reference: 'SALDO-INICIAL',
            description: 'Saldo inicial migrado de sistema anterior',
            userId: adminUser.id,
            occurredAt: now,
            metadata: {
              importSource: path.basename(args.file),
              csvLine: op.line,
              csvName: op.rawName,
              matchMode: op.matchMode,
              roundedToInteger: !args.keepCents,
            },
          },
        });
        ledgerCreated++;
      }
    },
    { maxWait: 20000, timeout: 120000 },
  );

  console.log('\n✅ CARGA ATÓMICA COMPLETADA CON ÉXITO:');
  console.log(`- Clientes dados de alta: ${createdClients}`);
  console.log(`- Clientes reactivados por tener saldo: ${reactivatedClients}`);
  console.log(`- Asientos OPENING_BALANCE creados en AccountLedger: ${ledgerCreated}`);
}

run()
  .catch((err) => {
    console.error('❌ Error en import_opening_balances:', err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
