import prisma from '../../utils/prisma';

const IGNORED_MATCH_WORDS = new Set([
  'CON',
  'DEL',
  'POR',
  'CONTRAS',
  'PARA',
  'GRS',
  'KGS',
  'LTS',
  'X250',
  'X500',
  'X400',
  'X1KG',
  '250GR',
  '500GR',
  '1KG',
]);

function getSearchVariations(word: string): string[] {
  const upper = word.toUpperCase();
  const variations = [upper];

  if (upper === 'QUESO') variations.push('Q.', 'Q ', 'Q-');
  else if (upper === 'DULCE' || upper === 'LECHE') variations.push('DDL', 'D.L.');
  else if (upper === 'MANTECA') variations.push('MANTEC');
  else if (upper === 'YOGUR') variations.push('YOG', 'YOGT');
  else if (upper === 'CLASICO') variations.push('CLAS', 'CLASSIC');

  return variations;
}

export function normalizeCatalogMatchText(text: string): string {
  if (!text) return '';
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bQ\./g, 'QUESO ')
    .replace(/\bQ\b/g, 'QUESO')
    .replace(/\bD\.L\./g, 'DULCE DE LECHE ')
    .replace(/\bD\.L\b/g, 'DULCE DE LECHE')
    .replace(/\bDDL\b/g, 'DULCE DE LECHE')
    .replace(/\bMANTEC\b/g, 'MANTECA')
    .replace(/\bYOG\b|\bYOGT\b/g, 'YOGUR')
    .replace(/\bCLAS\b|\bCLASSIC\b/g, 'CLASICO')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function findMatchedProduct(
  providerId: number | null,
  item: { code: string | null; description: string },
  providerName: string | null,
): Promise<{ matchedProduct: any; matchMethod: string }> {
  if (providerId && item.code) {
    const mapping = await prisma.providerProductMapping.findFirst({
      where: { providerId, providerCode: String(item.code) },
      include: { product: true },
    });
    if (mapping) {
      return { matchedProduct: mapping.product, matchMethod: 'PREVIOUS_MAPPING' };
    }
  }

  if (item.code) {
    const cleanCode = String(item.code).trim();
    const matchedProduct = await prisma.product.findFirst({
      where: { OR: [{ sku: cleanCode }, { barcode: cleanCode }] },
    });
    if (matchedProduct) {
      return { matchedProduct, matchMethod: 'CODE_MATCH' };
    }
  }

  if (!item.description) {
    return { matchedProduct: null, matchMethod: 'NONE' };
  }

  const exactMatch = await prisma.product.findFirst({
    where: { name: { contains: item.description, mode: 'insensitive' } },
  });
  if (exactMatch) {
    return { matchedProduct: exactMatch, matchMethod: 'DESCRIPTION_EXACT' };
  }

  const words = normalizeCatalogMatchText(item.description)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !IGNORED_MATCH_WORDS.has(w));

  if (words.length === 0) {
    return { matchedProduct: null, matchMethod: 'NONE' };
  }

  if (providerId) {
    const providerProducts = await prisma.product.findMany({ where: { providerId } });
    let bestMatch = null;
    let maxMatchesCount = 0;

    for (const prod of providerProducts) {
      const normProdName = normalizeCatalogMatchText(prod.name);
      const matchesCount = words.filter((w) => normProdName.includes(w)).length;
      if (matchesCount > maxMatchesCount) {
        maxMatchesCount = matchesCount;
        bestMatch = prod;
      }
    }

    if (bestMatch && maxMatchesCount >= Math.min(2, words.length)) {
      return { matchedProduct: bestMatch, matchMethod: 'DESCRIPTION_PARTIAL' };
    }
  }

  const cleanProvName = providerName
    ? providerName
        .split(/\s+/)
        .map((w) => w.replace(/[^a-zA-Z]/g, '').toUpperCase())
        .filter((w) => w.length > 2 && !['SRL', 'SA', 'SH', 'LTDA'].includes(w))[0] || ''
    : '';

  const partialQuery = words.slice(0, 2);
  const candidateProducts = await prisma.product.findMany({
    where: {
      AND: partialQuery.map((word) => ({
        OR: getSearchVariations(word).map((variation) => ({
          name: { contains: variation, mode: 'insensitive' },
        })),
      })),
    },
  });

  let bestCandidate = null;
  let maxScore = 0;
  for (const prod of candidateProducts) {
    const normProdName = normalizeCatalogMatchText(prod.name);
    let score = words.filter((w) => normProdName.includes(w)).length;
    if (cleanProvName && normProdName.includes(cleanProvName)) score += 2;

    if (score > maxScore) {
      maxScore = score;
      bestCandidate = prod;
    }
  }

  if (bestCandidate && maxScore >= Math.min(2, words.length)) {
    return { matchedProduct: bestCandidate, matchMethod: 'DESCRIPTION_PARTIAL' };
  }

  return { matchedProduct: null, matchMethod: 'NONE' };
}
