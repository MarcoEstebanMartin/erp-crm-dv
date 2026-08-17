const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  const excelItems = JSON.parse(fs.readFileSync(path.join(__dirname, 'excel_items.json'), 'utf8'));
  const dbProducts = await prisma.product.findMany();
  
  let matchedCount = 0;
  let itemsToInsert = [];

  for (const item of excelItems) {
    const rawUpper = item.raw_text.toUpperCase();
    
    // Clean text
    const cleanText = rawUpper
      .replace(/\(.*\)/g, '')
      .replace(/OFERTON/g, '')
      .replace(/PRECIO POR CAJA/g, '')
      .replace(/CADA \d+ (BOTELLAS|CAJAS|PACK|BOLSON)[^$]+/g, '')
      .trim();

    const tokens = cleanText.split(/[\s,x-]+/).filter(t => t.length > 1 && !['POR', 'CON', 'LOS', 'DEL', 'X', 'KG', 'GR', 'CC', 'ML', 'LT', 'LTS'].includes(t));

    let bestMatch = null;
    let bestScore = 0;

    for (const p of dbProducts) {
      const pUpper = p.name.toUpperCase();
      let matchCount = 0;
      for (const token of tokens) {
        if (pUpper.includes(token)) {
          matchCount++;
        }
      }

      const score = tokens.length > 0 ? matchCount / tokens.length : 0;
      if (score > bestScore && matchCount >= 1) {
        bestScore = score;
        bestMatch = p;
      }
    }

    if (bestMatch && (bestScore >= 0.25 || tokens.length <= 2)) {
      matchedCount++;
      let tag = null;
      if (rawUpper.includes('OFERTON')) tag = '💥 OFERTÓN';
      
      const bulkMatch = rawUpper.match(/CADA \d+ (BOTELLAS|CAJAS|PACK|BOLSON|PACKS)[^$]*QUEDA A \$?\d+/i) || rawUpper.match(/\( ?C\/U \$?\d+ ?\)/i);
      if (bulkMatch) {
        tag = bulkMatch[0].replace(/[()]/g, '').trim();
      }

      itemsToInsert.push({
        campaignId: 100,
        productId: bestMatch.id,
        offerPrice: item.price > 0 ? item.price : Number(bestMatch.listPrice),
        previousPrice: Number(bestMatch.listPrice),
        specialTag: tag,
        campaignGroup: item.group
      });
    } else {
      console.log(`Unmatched: "${item.raw_text}"`);
    }
  }

  console.log(`Successfully matched ${matchedCount} / ${excelItems.length} items.`);

  await prisma.offerCampaignItem.deleteMany({ where: { campaignId: 100 } });

  for (const item of itemsToInsert) {
    try {
      await prisma.offerCampaignItem.create({ data: item });
    } catch (e) {
      // duplicate check
    }
  }

  const finalCount = await prisma.offerCampaignItem.count({ where: { campaignId: 100 } });
  console.log(`Campaign 100 seeded with ${finalCount} items!`);
  process.exit(0);
}

main().catch(console.error);
