import prisma from '../../utils/prisma';
import { geminiService } from '../gemini.service';

/**
 * Interpreta un texto o pedido de cliente en WhatsApp mediante IA (Gemini)
 * con fallback determinista local y genera un Borrador de Pedido en CRM.
 */
export async function parseWhatsAppOrderDraft(
  conversationId: number,
  rawText: string,
): Promise<any> {
  const conversation = await prisma.crmConversation.findUnique({
    where: { id: conversationId },
    include: {
      persona: true,
      drafts: {
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!conversation) {
    throw new Error('Conversación CRM no encontrada.');
  }

  const existingDraft = conversation.drafts?.[0];
  if (existingDraft && existingDraft.itemsJson) {
    try {
      const parsedItems = JSON.parse(existingDraft.itemsJson);
      if (Array.isArray(parsedItems) && parsedItems.length > 0) {
        return existingDraft;
      }
    } catch {
      // Continuar si el JSON previo no era válido
    }
  }

  const recentInboundMsgs = await prisma.crmMessage.findMany({
    where: { conversationId, direction: 'INBOUND' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const inboundTexts = recentInboundMsgs.map((m) => m.body).reverse();
  let fullContextText = rawText;
  if (inboundTexts.length > 0) {
    const concatenated = inboundTexts.join('\n');
    if (!fullContextText || concatenated.toLowerCase().includes(fullContextText.toLowerCase())) {
      fullContextText = concatenated;
    } else {
      fullContextText = `${concatenated}\n${fullContextText}`;
    }
  }

  const activeProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      sku: true,
      name: true,
      listPrice: true,
      costPrice: true,
      unitsPerBox: true,
      commercialCategory: true,
    },
    take: 500,
  });

  const catalog = activeProducts.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    listPrice: Number(p.listPrice) > 0 ? Number(p.listPrice) : Number(p.costPrice),
    costPrice: Number(p.costPrice),
    unitsPerBox: p.unitsPerBox || 1,
    commercialCategory: p.commercialCategory,
  }));

  const matchedItems: any[] = [];
  let totalEstimated = 0;

  let geminiResult: Array<{ productId: number; quantity: number; note?: string }> = [];
  try {
    geminiResult = await geminiService.parseOrderMessage(fullContextText, catalog);
  } catch (err: any) {
    console.warn('⚡ Fallback a Matcher Algorítmico Local:', err.message);
  }

  if (geminiResult && geminiResult.length > 0) {
    for (const item of geminiResult) {
      const prod = catalog.find((p) => p.id === item.productId);
      if (prod) {
        const qty = Math.max(1, item.quantity || 1);
        const price = prod.listPrice;
        const subtotal = price * qty;
        matchedItems.push({
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          quantity: qty,
          unitPrice: price,
          subtotal,
        });
        totalEstimated += subtotal;
      }
    }
  } else {
    const clauses = fullContextText
      .split(/,|\n|\by\b/i)
      .map((c) => c.trim())
      .filter((c) => c.length > 2);
    const containerWords = [
      'caja', 'cajas', 'cajon', 'cajones', 'pack', 'packs',
      'botella', 'botellas', 'kilo', 'kilos', 'kg', 'u', 'unid', 'unidades',
    ];
    const stopWords = [
      'hola', 'mandame', 'mándame', 'quiero', 'por', 'favor', 'necesito', 'de', 'un', 'una', 'el', 'la', 'los', 'las',
      'pago', 'contrareembolso', 'contra', 'reembolso', 'efectivo', 'transferencia', 'gracias', 'buenisimo', 'buenísimo',
      'ok', 'dale', 'envio', 'envío', 'entrega', 'cbu', 'alias', 'mercado', 'mercadopago',
    ];

    const addedProductIds = new Set<number>();

    for (const clause of clauses) {
      const numberMatch = clause.match(/\b(\d+)\b/);
      const qty = numberMatch ? parseInt(numberMatch[1], 10) : 1;
      const isBox = containerWords.some(
        (w) =>
          ['caja', 'cajas', 'cajon', 'cajones', 'pack', 'packs'].includes(w) &&
          clause.toLowerCase().includes(w),
      );

      const clauseTokens = clause
        .toLowerCase()
        .replace(/[^\w\s]/gi, '')
        .split(/\s+/)
        .filter(
          (w) => !containerWords.includes(w) && !stopWords.includes(w) && !/^\d+$/.test(w) && w.length > 1,
        );

      if (clauseTokens.length === 0) continue;

      let bestProd: (typeof catalog)[0] | null = null;
      let bestScore = 0;

      for (const prod of catalog) {
        if (addedProductIds.has(prod.id)) continue;
        const prodNameLower = prod.name.toLowerCase();
        const prodTokens = prodNameLower.split(/\s+/);
        let score = 0;

        for (const token of clauseTokens) {
          const tokenStem = token.replace(/(s|es)$/i, '');
          for (const prodWord of prodTokens) {
            const prodStem = prodWord.replace(/(s|es)$/i, '');
            if (prodWord === token || (prodStem === tokenStem && tokenStem.length >= 3)) {
              score += 4;
            } else if (
              (prodWord.includes(tokenStem) || tokenStem.includes(prodStem)) &&
              tokenStem.length >= 3
            ) {
              score += 3;
            }
          }
        }

        if (prodNameLower.includes('caja') && !clause.toLowerCase().includes('yerba')) {
          score -= 2;
        }

        if (score > bestScore) {
          bestScore = score;
          bestProd = prod;
        }
      }

      if (bestProd && bestScore >= 4) {
        addedProductIds.add(bestProd.id);
        const finalQty = isBox ? (bestProd.unitsPerBox > 1 ? bestProd.unitsPerBox * qty : 12 * qty) : qty;
        const price = bestProd.listPrice;
        const subtotal = price * finalQty;

        matchedItems.push({
          productId: bestProd.id,
          productName: bestProd.name,
          sku: bestProd.sku,
          quantity: finalQty,
          unitPrice: price,
          subtotal,
        });
        totalEstimated += subtotal;
      }
    }
  }

  return prisma.crmOrderDraft.create({
    data: {
      conversationId,
      personaId: conversation.personaId,
      rawText: fullContextText || rawText,
      itemsJson: JSON.stringify(matchedItems),
      totalEstimated,
      status: 'PENDING',
    },
  });
}
