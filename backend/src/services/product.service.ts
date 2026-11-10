import prisma from '../utils/prisma';
import { logAudit } from '../utils/audit';
import { matchesPhoneticQuery } from '../core/search';
import { roundToIntegerPeso, roundToTwoDecimals } from '../core/money';
import { calculateRealMarginPct, type SupplierCostCalculationInput } from '../engines/pricing.engine';
import { calculateProductStockValuation } from '../engines/stock.engine';
import { productPricingSubService } from './catalog/product-pricing.service';
import { productStockSubService } from './catalog/product-stock.service';
import { productReconciliationSubService } from './catalog/product-reconciliation.service';
import { productWmsSubService } from './catalog/product-wms.service';
import { productImageSubService } from './catalog/product-image.service';

export class ProductService {
  /**
   * Obtener todos los productos con Buscador Fonético Argentino (b/v, s/z/c, y/i, sin tildes).
   */
  async getProducts(search?: string, includeInactive: boolean = false) {
    const whereClause: any = includeInactive ? {} : { isActive: true };
    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        lots: { orderBy: { expirationDate: 'asc' } },
        rubro: true,
        provider: true,
      },
      orderBy: { sku: 'asc' },
    });

    const enriched = products.map((p) => ({
      ...p,
      stockValuation: calculateProductStockValuation({
        physicalUnits: p.stock,
        isWeighable: p.isPesable,
        approxWeightKg: Number(p.approximateWeight || 0),
        costPrice: Number(p.costPrice || 0),
        priceList4: Number(p.listPrice || 0),
        minStockAlert: Number(p.minStock || 0),
      }),
    }));

    if (!search || !search.trim()) return enriched;
    const q = search.trim();
    return enriched.filter((p) => {
      if (p.barcode && p.barcode === q) return true;
      const targetText = `${p.sku} ${p.name} ${p.rubro?.name || ''} ${p.provider?.name || ''} ${p.commercialCategory || ''}`;
      return matchesPhoneticQuery(targetText, q);
    });
  }

  async getProductById(id: number) {
    return prisma.product.findUnique({
      where: { id },
      include: { lots: { orderBy: { expirationDate: 'asc' } }, rubro: true, provider: true },
    });
  }

  async getProductByBarcode(barcode: string) {
    return prisma.product.findUnique({
      where: { barcode: barcode.trim() },
      include: { lots: { orderBy: { expirationDate: 'asc' } }, rubro: true, provider: true },
    });
  }

  async createProduct(data: any, userId?: number) {
    const {
      sku,
      name,
      description,
      barcode,
      costPrice,
      listPrice,
      listPriceB,
      listPriceC,
      profitMargin,
      minStock,
      rubroId,
      providerId,
      isPesable,
      approximateWeight,
      unitsPerBox,
    } = data;

    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing) throw new Error(`El SKU ${sku} ya está en uso.`);

    if (barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode: String(barcode).trim() },
      });
      if (existingBarcode) {
        throw new Error(`El código de barras ${barcode} ya está asignado al producto ${existingBarcode.sku}.`);
      }
    }

    const cost = roundToTwoDecimals(costPrice || 0).toNumber();
    const priceA = roundToIntegerPeso(listPrice || 0).toNumber();
    const priceB = listPriceB ? roundToIntegerPeso(listPriceB).toNumber() : 0;
    const priceC = listPriceC ? roundToIntegerPeso(listPriceC).toNumber() : 0;
    const computedMargin =
      profitMargin !== undefined && profitMargin !== null && profitMargin !== ''
        ? roundToTwoDecimals(profitMargin).toNumber()
        : cost > 0
          ? Math.min(999.99, calculateRealMarginPct(cost, priceA).toNumber())
          : null;

    const product = await prisma.product.create({
      data: {
        sku,
        name,
        description,
        barcode: barcode ? String(barcode).trim() : null,
        costPrice: cost,
        listPrice: priceA,
        listPriceB: priceB,
        listPriceC: priceC,
        profitMargin: computedMargin,
        stock: 0,
        minStock: minStock ? Number(minStock) : 0,
        isPesable: Boolean(isPesable),
        unitsPerBox: unitsPerBox !== undefined ? Number(unitsPerBox) : 1,
        minOrderQuantity: data.minOrderQuantity !== undefined ? Math.max(1, Number(data.minOrderQuantity)) : 1,
        approximateWeight: approximateWeight ? Number(approximateWeight) : null,
        commercialCategory: data.commercialCategory ? String(data.commercialCategory).trim() : null,
        rubroId: rubroId ? Number(rubroId) : null,
        providerId: providerId ? Number(providerId) : null,
      },
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'CREATE_PRODUCT',
        entityType: 'Product',
        entityId: product.id,
        newValues: product,
      });
    }
    return product;
  }

  async updateProduct(id: number, data: any, userId?: number) {
    const original = await prisma.product.findUnique({ where: { id } });
    if (!original) throw new Error('Producto no encontrado.');

    if (data.barcode && data.barcode !== original.barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode: String(data.barcode).trim() },
      });
      if (existingBarcode) {
        throw new Error(`El código de barras ${data.barcode} ya está asignado al producto ${existingBarcode.sku}.`);
      }
    }

    const nextCost = data.costPrice !== undefined ? roundToTwoDecimals(data.costPrice).toNumber() : Number(original.costPrice);
    const nextListPrice = data.listPrice !== undefined ? roundToIntegerPeso(data.listPrice).toNumber() : Number(original.listPrice);
    const priceChanged = data.costPrice !== undefined || data.listPrice !== undefined;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        barcode: data.barcode !== undefined ? (data.barcode ? String(data.barcode).trim() : null) : undefined,
        costPrice: data.costPrice !== undefined ? nextCost : undefined,
        listPrice: data.listPrice !== undefined ? nextListPrice : undefined,
        listPriceB: data.listPriceB !== undefined ? roundToIntegerPeso(data.listPriceB).toNumber() : undefined,
        listPriceC: data.listPriceC !== undefined ? roundToIntegerPeso(data.listPriceC).toNumber() : undefined,
        profitMargin:
          data.profitMargin !== undefined
            ? data.profitMargin ? roundToTwoDecimals(data.profitMargin).toNumber() : null
            : priceChanged && nextCost > 0
              ? Math.min(999.99, calculateRealMarginPct(nextCost, nextListPrice).toNumber())
              : undefined,
        ...(priceChanged
          ? { previousCostPrice: original.costPrice, previousListPrice: original.listPrice, lastPriceUpdateAt: new Date() }
          : {}),
        minStock: data.minStock !== undefined ? Number(data.minStock) : undefined,
        isPesable: data.isPesable !== undefined ? Boolean(data.isPesable) : undefined,
        unitsPerBox: data.unitsPerBox !== undefined ? Number(data.unitsPerBox) : undefined,
        minOrderQuantity: data.minOrderQuantity !== undefined ? Math.max(1, Number(data.minOrderQuantity)) : undefined,
        approximateWeight: data.approximateWeight !== undefined ? (data.approximateWeight ? Number(data.approximateWeight) : null) : undefined,
        commercialCategory: data.commercialCategory !== undefined ? (data.commercialCategory ? String(data.commercialCategory).trim() : null) : undefined,
        rubro: data.rubroId !== undefined ? (data.rubroId ? { connect: { id: Number(data.rubroId) } } : { disconnect: true }) : undefined,
        provider: data.providerId !== undefined ? (data.providerId ? { connect: { id: Number(data.providerId) } } : { disconnect: true }) : undefined,
        defaultLocation: data.defaultLocation !== undefined ? (data.defaultLocation ? String(data.defaultLocation).trim() : null) : undefined,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
      },
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'UPDATE_PRODUCT',
        entityType: 'Product',
        entityId: updated.id,
        oldValues: original,
        newValues: updated,
      });
    }
    return updated;
  }

  // Delegación a Submódulos Especializados (< 250 líneas cada uno)
  calculateSupplierCost = (input: SupplierCostCalculationInput) => productPricingSubService.calculateSupplierCost(input);
  importPrices = (rows: any[], userId?: number) => productPricingSubService.importPrices(rows, userId);
  bulkUpdatePrices = (data: any, userId?: number) => productPricingSubService.bulkUpdatePrices(data, userId);
  revertPrices = (userId?: number) => productPricingSubService.revertPrices(userId);
  adjustStock = (id: number, data: any, userId: number) => productStockSubService.adjustStock(id, data, userId);
  getProductMovements = (productId: number) => productStockSubService.getProductMovements(productId);
  getGlobalStockMovements = () => productStockSubService.getGlobalStockMovements();
  getExpiringLots = () => productStockSubService.getExpiringLots();
  reconcileStockAudit = () => productReconciliationSubService.reconcileStockAudit();
  executeStockReconciliation = (userId: number) => productReconciliationSubService.executeStockReconciliation(userId);
  clearWmsLocation = (locationCode: string, userId: number) => productWmsSubService.clearWmsLocation(locationCode, userId);
  assignWmsLocation = (data: any, userId: number) => productWmsSubService.assignWmsLocation(data, userId);
  uploadSingleProductImage = (productId: number, file: Express.Multer.File, userId?: number) => productImageSubService.uploadSingleProductImage(productId, file, userId);
  importProductImagesFromZip = (fileBuffer: Buffer, userId?: number) => productImageSubService.importProductImagesFromZip(fileBuffer, userId);
}

export const productService = new ProductService();
