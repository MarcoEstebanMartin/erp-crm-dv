const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

async function analyze() {
  const dbProducts = await prisma.product.findMany({
    select: {
      id: true,
      sku: true,
      name: true,
      profitMargin: true,
      costPrice: true,
      listPrice: true,
      rubroId: true,
      rubro: { select: { id: true, name: true } },
      providerId: true,
      provider: { select: { id: true, name: true } }
    }
  });
  console.log(`Total products in DB: ${dbProducts.length}`);

  const excelPath = path.join(__dirname, '..', '..', 'rentabilidad.xlsx');
  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  console.log(`Total rows in Excel: ${rows.length}`);

  let parsedExcelItems = [];
  let currentCategory = '';
  let currentSubcategory = '';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Header row
    if (String(row[0]).trim() === 'Producto' && String(row[1]).trim().includes('%')) continue;

    // Category header row (only 1 column or second column empty)
    if (row.length === 1 || row[1] === undefined || row[1] === null || String(row[1]).trim() === '') {
      const catText = String(row[0]).trim();
      if (catText) {
        currentCategory = catText;
      }
      continue;
    }

    const rawProd = String(row[0]).trim();
    const marginVal = parseFloat(row[1]);

    if (!rawProd || isNaN(marginVal)) continue;

    // Match code prefix e.g. "2104 - COCINERO..." or "02 - ALGO..."
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
      margin: marginVal
    });
  }

  console.log(`Parsed Excel Product Rows: ${parsedExcelItems.length}`);

  function normalize(str) {
    if (!str) return '';
    return str.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  const dbBySku = new Map();
  const dbByNameLower = new Map();
  const dbByNormName = new Map();

  dbProducts.forEach(p => {
    if (p.sku) dbBySku.set(String(p.sku).trim(), p);
    if (p.name) {
      dbByNameLower.set(p.name.trim().toLowerCase(), p);
      dbByNormName.set(normalize(p.name), p);
    }
  });

  let matchedBySkuCount = 0;
  let matchedByNameExactCount = 0;
  let matchedByNameNormCount = 0;
  let matchedByRawNormCount = 0;
  let matchedFuzzyCount = 0;

  let matchedItems = [];
  let unmatchedItems = [];

  for (const item of parsedExcelItems) {
    let match = null;
    let matchMethod = null;

    // Try matching by SKU (if SKU in DB matches oldCode)
    if (item.oldCode && dbBySku.has(item.oldCode)) {
      match = dbBySku.get(item.oldCode);
      matchMethod = 'SKU (oldCode)';
      matchedBySkuCount++;
    } 
    // Try exact cleaned name (case insensitive)
    else if (dbByNameLower.has(item.cleanedName.toLowerCase())) {
      match = dbByNameLower.get(item.cleanedName.toLowerCase());
      matchMethod = 'Exact Cleaned Name';
      matchedByNameExactCount++;
    } 
    // Try exact raw name (case insensitive)
    else if (dbByNameLower.has(item.rawProduct.toLowerCase())) {
      match = dbByNameLower.get(item.rawProduct.toLowerCase());
      matchMethod = 'Exact Raw Name';
      matchedByNameExactCount++;
    } 
    // Try normalized cleaned name
    else if (dbByNormName.has(normalize(item.cleanedName))) {
      match = dbByNormName.get(normalize(item.cleanedName));
      matchMethod = 'Normalized Cleaned Name';
      matchedByNameNormCount++;
    } 
    // Try normalized raw name
    else if (dbByNormName.has(normalize(item.rawProduct))) {
      match = dbByNormName.get(normalize(item.rawProduct));
      matchMethod = 'Normalized Raw Name';
      matchedByRawNormCount++;
    }

    if (match) {
      matchedItems.push({
        excelRow: item,
        dbProduct: {
          id: match.id,
          sku: match.sku,
          name: match.name,
          currentMargin: match.profitMargin,
          costPrice: match.costPrice,
          listPrice: match.listPrice
        },
        matchMethod
      });
    } else {
      unmatchedItems.push(item);
    }
  }

  console.log('\n--- MATCHING RESULTS ---');
  console.log(`Matched by SKU (oldCode): ${matchedBySkuCount}`);
  console.log(`Matched by Exact Name: ${matchedByNameExactCount}`);
  console.log(`Matched by Normalized Name (Cleaned): ${matchedByNameNormCount}`);
  console.log(`Matched by Normalized Name (Raw): ${matchedByRawNormCount}`);
  console.log(`Total Matched: ${matchedItems.length} / ${parsedExcelItems.length} (${((matchedItems.length / parsedExcelItems.length)*100).toFixed(1)}%)`);
  console.log(`Total Unmatched: ${unmatchedItems.length} / ${parsedExcelItems.length} (${((unmatchedItems.length / parsedExcelItems.length)*100).toFixed(1)}%)`);

  // Inspect sample matches
  console.log('\nSample Matched Items (first 5):');
  console.log(JSON.stringify(matchedItems.slice(0, 5), null, 2));

  // Inspect sample unmatched items
  console.log('\nSample Unmatched Items (first 20):');
  console.log(JSON.stringify(unmatchedItems.slice(0, 20), null, 2));

  // Save report to JSON file for further inspection
  fs.writeFileSync(path.join(__dirname, 'analysis_report.json'), JSON.stringify({
    stats: {
      dbProductsCount: dbProducts.length,
      excelRowsCount: rows.length,
      parsedExcelItemsCount: parsedExcelItems.length,
      matchedCount: matchedItems.length,
      unmatchedCount: unmatchedItems.length,
    },
    matchedItems,
    unmatchedItems,
    categories: Array.from(new Set(parsedExcelItems.map(i => i.category)))
  }, null, 2));

  console.log('\nFull analysis report written to backend/scripts/analysis_report.json');
}

analyze().catch(console.error).finally(() => prisma.$disconnect());
