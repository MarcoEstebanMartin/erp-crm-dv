const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

function normalizeTokens(str) {
  if (!str) return [];
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 0 && t !== 'x');
}

async function runImport(isDryRun = true) {
  console.log(`=== INICIANDO ${isDryRun ? 'SIMULACIÓN (DRY-RUN)' : 'APLICACIÓN REAL EN BASE DE DATOS'} ===\n`);

  const dbProducts = await prisma.product.findMany({
    include: {
      rubro: true,
      provider: true
    }
  });
  console.log(`Total de productos en BD Maestra: ${dbProducts.length}`);

  // 1. Leer Excel
  const excelPath = path.join(__dirname, '..', '..', 'rentabilidad.xlsx');
  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  let parsedExcelItems = [];
  let currentCategory = '';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    if (String(row[0]).trim() === 'Producto' && String(row[1]).trim().includes('%')) continue;

    if (row.length === 1 || row[1] === undefined || row[1] === null || String(row[1]).trim() === '') {
      const catText = String(row[0]).trim();
      if (catText) currentCategory = catText;
      continue;
    }

    const rawProd = String(row[0]).trim();
    const marginVal = parseFloat(row[1]);
    if (!rawProd || isNaN(marginVal)) continue;

    const codeMatch = rawProd.match(/^(\d+)\s*-\s*(.+)$/);
    let oldCode = null;
    let cleanedName = rawProd;
    if (codeMatch) {
      oldCode = codeMatch[1];
      cleanedName = codeMatch[2].trim();
    }

    parsedExcelItems.push({
      rowIndex: i + 1,
      category: currentCategory,
      rawProduct: rawProd,
      oldCode: oldCode,
      cleanedName: cleanedName,
      margin: marginVal,
      tokens: normalizeTokens(cleanedName),
      rawTokens: normalizeTokens(rawProd)
    });
  }

  // Pre-index DB products
  const dbProductIndexed = dbProducts.map(p => ({
    ...p,
    normName: p.name.trim().toLowerCase(),
    tokens: normalizeTokens(p.name)
  }));

  const matchedResults = [];
  const matchedDbIds = new Set();

  for (const item of parsedExcelItems) {
    let bestMatch = null;
    let matchType = null;
    let matchScore = 0;

    // 1. Exact cleaned name match
    const exactCleaned = dbProductIndexed.find(p => p.normName === item.cleanedName.toLowerCase());
    if (exactCleaned) {
      bestMatch = exactCleaned;
      matchType = 'EXACT_CLEANED';
      matchScore = 1.0;
    } 

    // 2. Exact raw name match
    if (!bestMatch) {
      const exactRaw = dbProductIndexed.find(p => p.normName === item.rawProduct.toLowerCase());
      if (exactRaw) {
        bestMatch = exactRaw;
        matchType = 'EXACT_RAW';
        matchScore = 1.0;
      }
    }

    // 3. Token set equality
    if (!bestMatch) {
      const itemTokensSorted = [...item.tokens].sort().join(' ');
      const tokenMatch = dbProductIndexed.find(p => [...p.tokens].sort().join(' ') === itemTokensSorted);
      if (tokenMatch) {
        bestMatch = tokenMatch;
        matchType = 'TOKEN_SET_EXACT';
        matchScore = 0.98;
      }
    }

    // 4. Token overlap score
    if (!bestMatch && item.tokens.length >= 2) {
      let maxScore = 0;
      let candidate = null;

      for (const p of dbProductIndexed) {
        const uTokens = new Set(item.tokens);
        const dbTokens = new Set(p.tokens);

        let common = 0;
        uTokens.forEach(t => { if (dbTokens.has(t)) common++; });

        const score = common / Math.max(uTokens.size, dbTokens.size);
        if (score >= 0.75 && score > maxScore) {
          maxScore = score;
          candidate = p;
        }
      }

      if (candidate) {
        bestMatch = candidate;
        matchType = 'TOKEN_OVERLAP';
        matchScore = maxScore;
      }
    }

    if (bestMatch && !matchedDbIds.has(bestMatch.id)) {
      matchedDbIds.add(bestMatch.id);
      matchedResults.push({
        excelItem: item,
        dbProduct: bestMatch,
        assignedMargin: item.margin,
        matchType,
        matchScore: Number(matchScore.toFixed(2)),
        isDefaultRubro: false
      });
    }
  }

  // 2. Calcular rentabilidades promedio / por defecto por Rubro
  const rubroMargins = {}; // rubroId -> array of margins
  matchedResults.forEach(r => {
    const rId = r.dbProduct.rubroId || 0;
    if (!rubroMargins[rId]) rubroMargins[rId] = [];
    rubroMargins[rId].push(r.assignedMargin);
  });

  const rubroDefaultMarginMap = {};
  Object.keys(rubroMargins).forEach(rId => {
    const arr = rubroMargins[rId];
    // Calculate mode or average rounded
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    rubroDefaultMarginMap[rId] = Math.round(avg * 100) / 100;
  });

  // Default general fallback si un rubro no tiene ningun producto vinculado
  const GENERAL_DEFAULT_MARGIN = 30.0;

  // 3. Asignar rentabilidad por defecto a productos no vinculados (70 productos)
  const defaultAssignedResults = [];
  const unmatchedDbProducts = dbProducts.filter(p => !matchedDbIds.has(p.id));

  unmatchedDbProducts.forEach(p => {
    const rId = p.rubroId || 0;
    const defaultMargin = rubroDefaultMarginMap[rId] !== undefined ? rubroDefaultMarginMap[rId] : GENERAL_DEFAULT_MARGIN;
    defaultAssignedResults.push({
      dbProduct: p,
      assignedMargin: defaultMargin,
      matchType: 'DEFAULT_BY_RUBRO',
      matchScore: 0,
      isDefaultRubro: true,
      rubroName: p.rubro?.name || 'Sin Rubro'
    });
  });

  console.log('\n--- RESUMEN DE ASIGNACIÓN ---');
  console.log(`Productos con rentabilidad explícita del Excel: ${matchedResults.length}`);
  console.log(`Productos con rentabilidad por defecto por Rubro: ${defaultAssignedResults.length}`);
  console.log(`Total productos actualizados: ${matchedResults.length + defaultAssignedResults.length} / ${dbProducts.length}`);

  console.log('\n--- MARGEN POR DEFECTO CALCULADO POR RUBRO ---');
  const rubroNamesMap = {};
  dbProducts.forEach(p => {
    if (p.rubroId && p.rubro) rubroNamesMap[p.rubroId] = p.rubro.name;
  });
  Object.keys(rubroDefaultMarginMap).forEach(rId => {
    const rName = rubroNamesMap[rId] || 'Sin Rubro';
    console.log(`Rubro [${rName}] (#${rId}): Margin Promedio = ${rubroDefaultMarginMap[rId]}% (de ${rubroMargins[rId].length} prods)`);
  });

  const allUpdates = [...matchedResults, ...defaultAssignedResults];

  if (!isDryRun) {
    console.log('\n🔄 Aplicando cambios a la Base de Datos...');
    let updatedCount = 0;
    
    // Batch update via transaction
    await prisma.$transaction(
      allUpdates.map(u => 
        prisma.product.update({
          where: { id: u.dbProduct.id },
          data: { profitMargin: u.assignedMargin }
        })
      )
    );

    console.log(`✅ ¡ÉXITO! Se actualizaron ${allUpdates.length} productos en la Base de Datos Maestra.`);
  }

  // Guardar log completo de la ejecución
  const reportPath = path.join(__dirname, `execution_report_${isDryRun ? 'dryrun' : 'applied'}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    isDryRun,
    stats: {
      totalProductsInDb: dbProducts.length,
      matchedFromExcel: matchedResults.length,
      defaultAssignedFromRubro: defaultAssignedResults.length
    },
    rubroDefaults: rubroDefaultMarginMap,
    updates: allUpdates.map(u => ({
      productId: u.dbProduct.id,
      sku: u.dbProduct.sku,
      name: u.dbProduct.name,
      rubro: u.dbProduct.rubro?.name || u.rubroName || 'Sin Rubro',
      assignedProfitMargin: u.assignedMargin,
      isDefaultRubro: u.isDefaultRubro,
      matchType: u.matchType
    }))
  }, null, 2));

  console.log(`📄 Reporte de ejecución guardado en: ${reportPath}`);
}

// Check arguments
const isDryRun = !process.argv.includes('--apply');
runImport(isDryRun).catch(console.error).finally(() => prisma.$disconnect());
