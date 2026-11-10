import prisma from '../utils/prisma';
import { Persona, BillingType } from '@prisma/client';
import { roundToTwoDecimals, toDecimal } from '../core/money';

export class PricingService {
  /**
   * Calcula el precio unitario final para un producto y cliente usando Decimal.js,
   * aplicando el descuento más específico que corresponda.
   */
  static async calculatePriceAndDiscount(
    productId: number,
    personaId: number,
    billingType?: BillingType,
  ): Promise<{ basePrice: number; discount: number; finalPrice: number; ruleName: string | null }> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { rubro: true },
    });

    const persona = await prisma.persona.findUnique({
      where: { id: personaId },
    });

    if (!product || !persona) {
      throw new Error('Producto o Cliente no encontrado para calcular precio.');
    }

    const rules = await prisma.discountRule.findMany({
      where: {
        OR: [{ personaId: persona.id }, { priceList: persona.priceList }],
      },
    });

    return this.calculatePriceAndDiscountInMemory(product, persona, rules, billingType);
  }

  /**
   * Obtiene la regla de división de facturación si existe para un cliente y producto.
   */
  static async getSplitBillingConfig(
    personaId: number,
    productId: number,
  ): Promise<{ percentageOfficial: number; percentageInternal: number } | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || !product.rubroId) return null;

    const config = await prisma.splitBillingConfig.findFirst({
      where: { personaId, rubroId: product.rubroId },
    });

    if (!config) return null;

    return {
      percentageOfficial: Number(config.percentageOfficial),
      percentageInternal: Number(config.percentageInternal),
    };
  }

  /**
   * Calcula el precio unitario final en memoria usando Decimal.js (cero errores de punto flotante).
   */
  static calculatePriceAndDiscountInMemory(
    product: any,
    persona: Persona,
    rules: any[],
    billingType?: BillingType,
  ): { basePrice: number; discount: number; finalPrice: number; ruleName: string | null } {
    let basePriceDec = toDecimal(product.listPrice ?? 0);
    if (persona.priceList === 'B' && Number(product.listPriceB) > 0) {
      basePriceDec = toDecimal(product.listPriceB);
    } else if (persona.priceList === 'C' && Number(product.listPriceC) > 0) {
      basePriceDec = toDecimal(product.listPriceC);
    }

    let discountDec = toDecimal(persona.discount ? persona.discount.toString() : 0);
    let ruleName: string | null = null;
    let maxSpecificity = -1;

    for (const rule of rules) {
      if (rule.billingType && billingType && rule.billingType !== billingType) {
        continue;
      }

      let specificity = 0;
      if (rule.productId) {
        if (rule.productId !== product.id) continue;
        specificity += 100;
      }
      if (rule.rubroId) {
        if (rule.rubroId !== product.rubroId) continue;
        specificity += 50;
      }
      if (rule.personaId) {
        specificity += 10;
      } else if (rule.priceList) {
        specificity += 5;
      }
      if (rule.billingType) {
        specificity += 2;
      }

      if (specificity > maxSpecificity) {
        maxSpecificity = specificity;
        discountDec = toDecimal(rule.discount);
        ruleName = rule.name;
      }
    }

    const discountFactor = toDecimal(1).minus(discountDec.dividedBy(100));
    const finalPriceDec = roundToTwoDecimals(basePriceDec.times(discountFactor));

    return {
      basePrice: basePriceDec.toNumber(),
      discount: discountDec.toNumber(),
      finalPrice: finalPriceDec.toNumber(),
      ruleName,
    };
  }
}
