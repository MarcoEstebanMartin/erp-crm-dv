import prisma from '../utils/prisma';
import { Persona, Product, BillingType } from '@prisma/client';

export class PricingService {
  /**
   * Calcula el precio unitario final para un producto y cliente,
   * aplicando el descuento más específico que corresponda.
   */
  static async calculatePriceAndDiscount(
    productId: number,
    personaId: number,
    billingType?: BillingType
  ): Promise<{ basePrice: number; discount: number; finalPrice: number; ruleName: string | null }> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { rubro: true }
    });

    const persona = await prisma.persona.findUnique({
      where: { id: personaId }
    });

    if (!product || !persona) {
      throw new Error('Producto o Cliente no encontrado para calcular precio.');
    }

    // 1. Determinar el precio base según la lista del cliente (A, B, C o custom que herede de A)
    let basePrice = Number(product.listPrice);
    if (persona.priceList === 'B') {
      basePrice = Number(product.listPriceB) > 0 ? Number(product.listPriceB) : Number(product.listPrice);
    } else if (persona.priceList === 'C') {
      basePrice = Number(product.listPriceC) > 0 ? Number(product.listPriceC) : Number(product.listPrice);
    }

    // 2. Buscar las reglas de descuento aplicables ordenadas por especificidad
    // Buscamos todas las reglas del cliente o de la lista de precios del cliente
    const rules = await prisma.discountRule.findMany({
      where: {
        OR: [
          { personaId: persona.id },
          { priceList: persona.priceList }
        ]
      }
    });

    let discount = Number(persona.discount || 0);
    let ruleName: string | null = null;
    let maxSpecificity = -1;

    // Evaluamos la especificidad de cada regla y si cumple las condiciones
    for (const rule of rules) {
      // Verificar si hay restricción de billingType y no coincide
      if (rule.billingType && billingType && rule.billingType !== billingType) {
        continue;
      }

      let specificity = 0;

      // Condición de Producto
      if (rule.productId) {
        if (rule.productId !== product.id) continue;
        specificity += 100;
      }

      // Condición de Rubro
      if (rule.rubroId) {
        if (rule.rubroId !== product.rubroId) continue;
        specificity += 50;
      }

      // Condición de Cliente Directo vs Lista de Precios
      if (rule.personaId) {
        specificity += 10;
      } else if (rule.priceList) {
        specificity += 5;
      }

      // Si tiene billingType específico sumamos especificidad
      if (rule.billingType) {
        specificity += 2;
      }

      // Nos quedamos con la regla más específica
      if (specificity > maxSpecificity) {
        maxSpecificity = specificity;
        discount = Number(rule.discount);
        ruleName = rule.name;
      }
    }

    const finalPrice = Math.round(basePrice * (1 - discount / 100));

    return {
      basePrice,
      discount,
      finalPrice,
      ruleName
    };
  }

  /**
   * Obtiene la regla de división de facturación si existe para un cliente y producto.
   */
  static async getSplitBillingConfig(
    personaId: number,
    productId: number
  ): Promise<{ percentageOfficial: number; percentageInternal: number } | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || !product.rubroId) return null;

    const config = await prisma.splitBillingConfig.findFirst({
      where: {
        personaId,
        rubroId: product.rubroId
      }
    });

    if (!config) return null;

    return {
      percentageOfficial: Number(config.percentageOfficial),
      percentageInternal: Number(config.percentageInternal)
    };
  }

  /**
   * Calcula el precio unitario final en memoria para un producto, cliente y reglas precargadas,
   * sin realizar consultas a la base de datos (evita N+1 queries).
   */
  static calculatePriceAndDiscountInMemory(
    product: any,
    persona: Persona,
    rules: any[],
    billingType?: BillingType
  ): { basePrice: number; discount: number; finalPrice: number; ruleName: string | null } {
    let basePrice = Number(product.listPrice);
    if (persona.priceList === 'B') {
      basePrice = Number(product.listPriceB) > 0 ? Number(product.listPriceB) : Number(product.listPrice);
    } else if (persona.priceList === 'C') {
      basePrice = Number(product.listPriceC) > 0 ? Number(product.listPriceC) : Number(product.listPrice);
    }

    let discount = Number(persona.discount || 0);
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
        discount = Number(rule.discount);
        ruleName = rule.name;
      }
    }

    // Mantener la precisión de 2 decimales para evitar pérdidas por redondeos unitarios prematuros
    const finalPrice = Number((basePrice * (1 - discount / 100)).toFixed(2));

    return {
      basePrice,
      discount,
      finalPrice,
      ruleName
    };
  }
}
