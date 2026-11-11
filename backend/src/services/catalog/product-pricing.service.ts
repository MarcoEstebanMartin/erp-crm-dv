import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';
import { appCache } from '../../utils/cache';
import {
  roundToIntegerPeso,
  roundToTwoDecimals,
  toDecimal,
  calculateListPriceFromMargin,
} from '../../core/money';
import {
  calculateRealMarginPct,
  calculateNetSupplierCost,
  type SupplierCostCalculationInput,
} from '../../engines/pricing.engine';
import { productionOutboundBridgeService } from './production-outbound-bridge.service';

export class ProductPricingSubService {
  calculateSupplierCost(input: SupplierCostCalculationInput) {
    const res = calculateNetSupplierCost(input);
    return {
      rawSupplierPrice: res.rawSupplierPrice.toNumber(),
      discountPct: res.discountPct.toNumber(),
      priceAfterDiscount: res.priceAfterDiscount.toNumber(),
      ivaRatePct: res.ivaRatePct.toNumber(),
      netCostPrice: res.netCostPrice.toNumber(),
    };
  }

  /**
   * Importar precios masivamente aplicando Decimal.js, Pesos Enteros en Origen y Puente Vivo Web.
   */
  async importPrices(rows: any[], userId?: number) {
    const updatedItems: any[] = [];
    const createdItems: any[] = [];
    const failedItems: { sku: string; error: string }[] = [];

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const { sku, name, costPrice, listPrice, listPriceB, listPriceC, profitMargin, barcode } = row;
        const existing = await tx.product.findUnique({ where: { sku } });

        if (existing) {
          const updateData: any = {
            previousCostPrice: existing.costPrice,
            previousListPrice: existing.listPrice,
            lastPriceUpdateAt: new Date(),
          };
          if (name !== undefined) updateData.name = name;
          if (barcode !== undefined) updateData.barcode = barcode ? String(barcode).trim() : null;

          let targetProfitMargin =
            profitMargin !== undefined
              ? profitMargin
                ? roundToTwoDecimals(profitMargin).toNumber()
                : null
              : undefined;

          if (costPrice !== undefined) {
            updateData.costPrice = roundToTwoDecimals(costPrice).toNumber();
          }

          if (listPrice !== undefined) {
            updateData.listPrice = roundToIntegerPeso(listPrice).toNumber();
            if (listPriceB !== undefined) updateData.listPriceB = roundToIntegerPeso(listPriceB).toNumber();
            if (listPriceC !== undefined) updateData.listPriceC = roundToIntegerPeso(listPriceC).toNumber();

            const finalCost =
              costPrice !== undefined ? roundToTwoDecimals(costPrice).toNumber() : Number(existing.costPrice);
            if (targetProfitMargin === undefined) {
              targetProfitMargin =
                finalCost > 0
                  ? Math.max(-999.99, Math.min(999.99, calculateRealMarginPct(finalCost, updateData.listPrice).toNumber()))
                  : null;
            }
          } else if (costPrice !== undefined) {
            const existingMargin = existing.profitMargin ? Number(existing.profitMargin) : 25;
            const marginPct =
              targetProfitMargin !== undefined && targetProfitMargin !== null
                ? targetProfitMargin > 5
                  ? targetProfitMargin
                  : (targetProfitMargin - 1) * 100
                : existingMargin > 5
                  ? existingMargin
                  : (existingMargin - 1) * 100;

            updateData.listPrice = calculateListPriceFromMargin(costPrice, marginPct).toNumber();

            if (listPriceB !== undefined) {
              updateData.listPriceB = roundToIntegerPeso(listPriceB).toNumber();
            } else if (Number(existing.listPriceB) > 0 && Number(existing.listPrice) > 0) {
              const ratioB = toDecimal(existing.listPriceB).dividedBy(toDecimal(existing.listPrice));
              updateData.listPriceB = roundToIntegerPeso(
                toDecimal(updateData.listPrice).times(ratioB),
              ).toNumber();
            }

            if (listPriceC !== undefined) {
              updateData.listPriceC = roundToIntegerPeso(listPriceC).toNumber();
            } else if (Number(existing.listPriceC) > 0 && Number(existing.listPrice) > 0) {
              const ratioC = toDecimal(existing.listPriceC).dividedBy(toDecimal(existing.listPrice));
              updateData.listPriceC = roundToIntegerPeso(
                toDecimal(updateData.listPrice).times(ratioC),
              ).toNumber();
            }
          }

          if (targetProfitMargin !== undefined) {
            updateData.profitMargin = targetProfitMargin;
          }

          const updated = await tx.product.update({ where: { sku }, data: updateData });
          updatedItems.push(updated);
        } else {
          if (!name || costPrice === undefined || listPrice === undefined) {
            failedItems.push({
              sku,
              error: 'Para crear un producto nuevo se requiere SKU, Nombre, Costo y Lista A.',
            });
            continue;
          }

          if (barcode) {
            const existingBarcode = await tx.product.findUnique({
              where: { barcode: String(barcode).trim() },
            });
            if (existingBarcode) {
              failedItems.push({
                sku,
                error: `El código de barras ${barcode} ya está asignado al producto ${existingBarcode.sku}.`,
              });
              continue;
            }
          }

          const cost = roundToTwoDecimals(costPrice).toNumber();
          const finalPrice = roundToIntegerPeso(listPrice).toNumber();
          const margin =
            profitMargin !== undefined && profitMargin
              ? roundToTwoDecimals(profitMargin).toNumber()
              : cost > 0
                ? Math.max(-999.99, Math.min(999.99, calculateRealMarginPct(cost, finalPrice).toNumber()))
                : null;

          const created = await tx.product.create({
            data: {
              sku,
              name,
              costPrice: cost,
              listPrice: finalPrice,
              listPriceB: listPriceB !== undefined ? roundToIntegerPeso(listPriceB).toNumber() : 0,
              listPriceC: listPriceC !== undefined ? roundToIntegerPeso(listPriceC).toNumber() : 0,
              profitMargin: margin,
              barcode: barcode ? String(barcode).trim() : null,
              stock: 0,
              minStock: 0,
            },
          });
          createdItems.push(created);
        }
      }
    });

    if (userId && (updatedItems.length > 0 || createdItems.length > 0)) {
      await logAudit({
        userId,
        action: 'IMPORT_PRODUCTS_CSV',
        entityType: 'Product',
        entityId: 0,
        newValues: {
          updatedCount: updatedItems.length,
          createdCount: createdItems.length,
          failedCount: failedItems.length,
        },
      });
    }

    const syncedIds = [...updatedItems.map((p) => p.id), ...createdItems.map((p) => p.id)];
    productionOutboundBridgeService.enqueueBatchProductsSyncByIds(syncedIds);

    return { updatedItems, createdItems, failedItems };
  }

  /**
   * Actualizar precios masivamente por Rubro y/o Proveedor replicando Lista A a Producción.
   */
  async bulkUpdatePrices(data: any, userId?: number) {
    const { rubroId, providerId, type, basis, value, priceList } = data;
    const filterWhere: any = {};
    if (rubroId) filterWhere.rubroId = Number(rubroId);
    if (providerId) filterWhere.providerId = Number(providerId);

    const products = await prisma.product.findMany({ where: filterWhere });
    if (products.length === 0) return { updatedCount: 0 };

    const valDec = toDecimal(value || 0);
    let updatedCount = 0;
    const touchedIds: number[] = [];

    const chunkSize = 50;
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      await prisma.$transaction(async (tx) => {
        for (const p of chunk) {
          const updateData: any = {
            previousCostPrice: p.costPrice,
            previousListPrice: p.listPrice,
            lastPriceUpdateAt: new Date(),
          };
          const listsToUpdate =
            priceList === 'all' ? ['listPrice', 'listPriceB', 'listPriceC'] : [priceList];

          for (const listField of listsToUpdate) {
            const costDec = toDecimal(p.costPrice.toString());
            const currentPriceDec = toDecimal(String((p as any)[listField] || 0));
            let newPriceDec = currentPriceDec;

            if (type === 'margin') {
              newPriceDec = calculateListPriceFromMargin(costDec, valDec);
            } else if (type === 'percentage') {
              const baseDec = basis === 'cost' ? costDec : currentPriceDec;
              newPriceDec = calculateListPriceFromMargin(baseDec, valDec);
              if (basis === 'cost' && listField === 'listPrice') {
                updateData.costPrice = roundToTwoDecimals(
                  costDec.times(toDecimal(1).plus(valDec.dividedBy(100))),
                ).toNumber();
              }
            } else if (type === 'fixed') {
              newPriceDec = roundToIntegerPeso(currentPriceDec.plus(valDec));
            }

            updateData[listField] = Math.max(0, roundToIntegerPeso(newPriceDec).toNumber());
          }

          await tx.product.update({ where: { id: p.id }, data: updateData });
          touchedIds.push(p.id);
          updatedCount++;
        }
      });
    }

    if (userId) {
      await logAudit({
        userId,
        action: 'BULK_UPDATE_PRICES',
        entityType: 'Product',
        entityId: 0,
        newValues: { rubroId, providerId, type, basis, value: valDec.toNumber(), priceList, updatedCount },
      });
    }

    appCache.invalidateProductCatalog();
    if (priceList === 'all' || priceList === 'listPrice') {
      productionOutboundBridgeService.enqueueBatchProductsSyncByIds(touchedIds);
    }
    return { updatedCount };
  }

  /**
   * Revertir precios al estado previo (Undo) sincronizando también hacia Producción.
   */
  async revertPrices(userId?: number) {
    const productsWithHistory = await prisma.product.findMany({
      where: { previousListPrice: { not: null } },
    });

    if (productsWithHistory.length === 0) {
      return { message: 'No hay precios anteriores para restaurar.', count: 0 };
    }

    let revertedCount = 0;
    const revertedIds: number[] = [];
    await prisma.$transaction(async (tx) => {
      for (const p of productsWithHistory) {
        if (p.previousListPrice !== null) {
          await tx.product.update({
            where: { id: p.id },
            data: {
              ...(p.previousCostPrice !== null ? { costPrice: p.previousCostPrice } : {}),
              listPrice: p.previousListPrice,
              previousCostPrice: null,
              previousListPrice: null,
              lastPriceUpdateAt: new Date(),
            },
          });
          revertedIds.push(p.id);
          revertedCount++;
        }
      }
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'REVERT_PRICES_UNDO',
        entityType: 'Product',
        entityId: 0,
        newValues: { revertedCount },
      });
    }

    appCache.invalidateProductCatalog();
    productionOutboundBridgeService.enqueueBatchProductsSyncByIds(revertedIds);
    return {
      message: `Se restauraron ${revertedCount} productos a sus precios anteriores.`,
      count: revertedCount,
    };
  }
}

export const productPricingSubService = new ProductPricingSubService();
