const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

async function main() {
  const prods = await prisma.product.findMany({ 
    select: { id: true, sku: true, name: true, profitMargin: true, costPrice: true, listPrice: true, rubro: { select: { name: true } } } 
  });
  console.log('Total DB products:', prods.length);

  const marginStats = {
    nullMargin: 0,
    multiplierStyle: 0, // e.g. 1.25, 1.30
    percentageStyle: 0  // e.g. 25.00, 30.00
  };

  prods.forEach(p => {
    if (p.profitMargin === null) {
      marginStats.nullMargin++;
    } else {
      const val = Number(p.profitMargin);
      if (val > 0 && val < 5) {
        marginStats.multiplierStyle++;
      } else {
        marginStats.percentageStyle++;
      }
    }
  });

  console.log('Margin stats in DB:', marginStats);
  console.log('Sample 10 DB products:', prods.slice(0, 10));

  // Let's check fuzzy matching between unmatched Excel items and DB products
  const report = JSON.parse(fs.readFileSync(path.join(__dirname, 'analysis_report.json'), 'utf8'));
  const unmatched = report.unmatchedItems;
  
  // Find which DB products were NOT matched by any Excel row
  const matchedDbIds = new Set(report.matchedItems.map(m => m.dbProduct.id));
  const unmatchedDbProducts = prods.filter(p => !matchedDbIds.has(p.id));

  console.log(`DB Products matched: ${matchedDbIds.size} / ${prods.length}`);
  console.log(`DB Products unmatched: ${unmatchedDbProducts.length} / ${prods.length}`);

  // Fuzzy matching try: e.g. string similarity / contains
  function cleanStr(s) {
    return (s || '').toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  let fuzzyMatches = [];
  unmatched.forEach(uItem => {
    const uClean = cleanStr(uItem.cleanedName);
    if (uClean.length < 4) return;

    let bestMatch = null;
    let bestScore = 0;

    unmatchedDbProducts.forEach(dbP => {
      const dbClean = cleanStr(dbP.name);
      
      // Calculate token overlap Jaccard
      const uTokens = new Set(uClean.split(' '));
      const dbTokens = new Set(dbClean.split(' '));
      
      let intersection = 0;
      uTokens.forEach(t => { if (dbTokens.has(t)) intersection++; });

      const union = new Set([...uTokens, ...dbTokens]).size;
      const score = intersection / union;

      if (score > 0.5 && score > bestScore) {
        bestScore = score;
        bestMatch = dbP;
      }
    });

    if (bestMatch) {
      fuzzyMatches.push({
        excelRow: uItem,
        candidateDbProduct: {
          id: bestMatch.id,
          sku: bestMatch.sku,
          name: bestMatch.name,
          costPrice: bestMatch.costPrice,
          listPrice: bestMatch.listPrice
        },
        score: bestScore.toFixed(2)
      });
    }
  });

  console.log(`\nPotential Fuzzy Matches found: ${fuzzyMatches.length}`);
  console.log('Sample Fuzzy Matches (first 15):', JSON.stringify(fuzzyMatches.slice(0, 15), null, 2));

}

main().catch(console.error).finally(() => prisma.$disconnect());
