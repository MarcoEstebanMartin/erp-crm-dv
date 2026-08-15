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

async function runRefinedMatching() {
  const dbProducts = await prisma.product.findMany({
    select: {
      id: true,
      sku: true,
      name: true,
      profitMargin: true,
      costPrice: true,
      listPrice: true,
      rubro: { select: { name: true } },
      provider: { select: { name: true } }
    }
  });

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
  const usedDbIds = new Set();

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

    // 3. Token set equality (same tokens regardless of order)
    if (!bestMatch) {
      const itemTokensSorted = [...item.tokens].sort().join(' ');
      const tokenMatch = dbProductIndexed.find(p => [...p.tokens].sort().join(' ') === itemTokensSorted);
      if (tokenMatch) {
        bestMatch = tokenMatch;
        matchType = 'TOKEN_SET_EXACT';
        matchScore = 0.98;
      }
    }

    // 4. Token overlap score (high threshold)
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

    if (bestMatch) {
      usedDbIds.add(bestMatch.id);
      matchedResults.push({
        excelItem: {
          rowIndex: item.rowIndex,
          category: item.category,
          rawProduct: item.rawProduct,
          oldCode: item.oldCode,
          cleanedName: item.cleanedName,
          margin: item.margin
        },
        dbProduct: {
          id: bestMatch.id,
          sku: bestMatch.sku,
          name: bestMatch.name,
          currentMargin: Number(bestMatch.profitMargin),
          costPrice: Number(bestMatch.costPrice),
          listPrice: Number(bestMatch.listPrice)
        },
        matchType,
        matchScore: Number(matchScore.toFixed(2))
      });
    }
  }

  const matchedDbIds = new Set(matchedResults.map(r => r.dbProduct.id));
  const unmatchedDbProducts = dbProducts.filter(p => !matchedDbIds.has(p.id));
  const matchedExcelRowIndexes = new Set(matchedResults.map(r => r.excelItem.rowIndex));
  const unmatchedExcelItems = parsedExcelItems.filter(item => !matchedExcelRowIndexes.has(item.rowIndex));

  console.log('=== REFINED MATCHING SUMMARY ===');
  console.log(`Excel Products Total: ${parsedExcelItems.length}`);
  console.log(`Matched Excel Products: ${matchedResults.length} (${((matchedResults.length / parsedExcelItems.length)*100).toFixed(1)}%)`);
  console.log(`Unmatched Excel Products: ${unmatchedExcelItems.length}`);
  console.log(`---------------------------------`);
  console.log(`DB Products Total: ${dbProducts.length}`);
  console.log(`DB Products Matched: ${matchedDbIds.size} (${((matchedDbIds.size / dbProducts.length)*100).toFixed(1)}%)`);
  console.log(`DB Products Unmatched: ${unmatchedDbProducts.length}`);

  const byType = {};
  matchedResults.forEach(r => {
    byType[r.matchType] = (byType[r.matchType] || 0) + 1;
  });
  console.log('\nMatches Breakdown by Type:', byType);

  fs.writeFileSync(path.join(__dirname, 'refined_matching.json'), JSON.stringify({
    summary: {
      totalExcel: parsedExcelItems.length,
      matchedExcel: matchedResults.length,
      unmatchedExcel: unmatchedExcelItems.length,
      totalDb: dbProducts.length,
      matchedDb: matchedDbIds.size,
      unmatchedDb: unmatchedDbProducts.length,
      byType
    },
    matchedResults,
    unmatchedExcelItems,
    unmatchedDbProducts
  }, null, 2));

  console.log('\nRefined matching saved to backend/scripts/refined_matching.json');
}

runRefinedMatching().catch(console.error).finally(() => prisma.$disconnect());
