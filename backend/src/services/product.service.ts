import prisma from '../utils/prisma';
import { logAudit } from '../utils/audit';
import { appCache } from '../utils/cache';

export class ProductService {
  /**
   * Obtener todos los productos (Buscador inteligente por SKU o Nombre).
   */
  async getProducts(search?: string, includeInactive: boolean = false) {
    const whereClause: any = {};
    if (!includeInactive) {
      whereClause.isActive = true;
    }
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { equals: search } },
      ];
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        lots: {
          orderBy: { expirationDate: 'asc' },
        },
        rubro: true,
        provider: true,
      },
      orderBy: { sku: 'asc' },
    });

    return products;
  }

  /**
   * Obtener un producto por ID.
   */
  async getProductById(id: number) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        lots: {
          orderBy: { expirationDate: 'asc' },
        },
        rubro: true,
        provider: true,
      },
    });
  }

  /**
   * Obtener un producto por código de barras.
   */
  async getProductByBarcode(barcode: string) {
    return prisma.product.findUnique({
      where: { barcode: barcode.trim() },
      include: {
        lots: {
          orderBy: { expirationDate: 'asc' },
        },
        rubro: true,
        provider: true,
      },
    });
  }

  /**
   * Crear un nuevo producto.
   */
  async createProduct(data: any, userId?: number) {
    const { sku, name, description, barcode, costPrice, listPrice, listPriceB, listPriceC, profitMargin, minStock, rubroId, providerId, isPesable, approximateWeight, unitsPerBox } = data;

    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing) {
      throw new Error(`El SKU ${sku} ya está en uso.`);
    }

    if (barcode) {
      const existingBarcode = await prisma.product.findUnique({ where: { barcode: String(barcode).trim() } });
      if (existingBarcode) {
        throw new Error(`El código de barras ${barcode} ya está asignado al producto ${existingBarcode.sku}.`);
      }
    }

    const product = await prisma.product.create({
      data: {
        sku,
        name,
        description,
        barcode: barcode ? String(barcode).trim() : null,
        costPrice: Number(costPrice),
        listPrice: Number(listPrice),
        listPriceB: listPriceB ? Number(listPriceB) : 0.00,
        listPriceC: listPriceC ? Number(listPriceC) : 0.00,
        profitMargin: profitMargin !== undefined ? (profitMargin ? Number(profitMargin) : null) : null,
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

  /**
   * Actualizar datos de producto.
   */
  async updateProduct(id: number, data: any, userId?: number) {
    const original = await prisma.product.findUnique({ where: { id } });
    if (!original) throw new Error('Producto no encontrado.');

    if (data.barcode && data.barcode !== original.barcode) {
      const existingBarcode = await prisma.product.findUnique({ where: { barcode: String(data.barcode).trim() } });
      if (existingBarcode) {
        throw new Error(`El código de barras ${data.barcode} ya está asignado al producto ${existingBarcode.sku}.`);
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        barcode: data.barcode !== undefined ? (data.barcode ? String(data.barcode).trim() : null) : undefined,
        costPrice: data.costPrice !== undefined ? Number(data.costPrice) : undefined,
        listPrice: data.listPrice !== undefined ? Number(data.listPrice) : undefined,
        listPriceB: data.listPriceB !== undefined ? Number(data.listPriceB) : undefined,
        listPriceC: data.listPriceC !== undefined ? Number(data.listPriceC) : undefined,
        profitMargin: data.profitMargin !== undefined ? (data.profitMargin ? Number(data.profitMargin) : null) : undefined,
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

  /**
   * Ajustar stock físicamente (Transacción atómica).
   */
  async adjustStock(id: number, data: any, userId: number) {
    const { quantityChange, reason, lotNumber, expirationDate, location, lotId: inputLotId } = data;
    const change = Number(quantityChange);
    const cleanLoc = (location && typeof location === 'string' && location.trim()) ? location.trim().toUpperCase() : 'S/U';

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product) throw new Error('Producto no encontrado.');

      const newStock = Math.max(0, product.stock + change);

      let lot: any = null;

      // 1. Si viene lotId explicito, buscar directamente por ID primario
      if (inputLotId) {
        lot = await tx.productLot.findUnique({
          where: { id: Number(inputLotId) }
        });
      }

      // 2. Si no se especificó o no se encontró por ID, determinar número de lote adecuado
      let rawLotNum = (lotNumber && typeof lotNumber === 'string' && lotNumber.trim()) ? lotNumber.trim() : '';

      if (!lot) {
        if (!rawLotNum || rawLotNum.toUpperCase() === 'S/L') {
          // Generar clave de lote vinculada a la ubicación si no viene un número de lote explícito
          rawLotNum = cleanLoc !== 'S/U' ? `S/L-${cleanLoc}` : 'S/L';
        }

        // Buscar lote existente por combinación productId + lotNumber
        lot = await tx.productLot.findUnique({
          where: {
            productId_lotNumber: { productId: product.id, lotNumber: rawLotNum },
          },
        });
      }

      // 3. Si el lote existe pero su ubicación es DIFERENTE a la actual y estamos agregando stock,
      // evitar mover el lote del estante anterior creando un lote específico para esta nueva ubicación.
      if (lot && lot.location && cleanLoc !== 'S/U' && lot.location.toUpperCase().trim() !== cleanLoc && change > 0) {
        const locLotNum = `${rawLotNum}-${cleanLoc}`;
        const existingLocLot = await tx.productLot.findUnique({
          where: {
            productId_lotNumber: { productId: product.id, lotNumber: locLotNum },
          },
        });
        if (existingLocLot) {
          lot = existingLocLot;
        } else {
          lot = null;
          rawLotNum = locLotNum;
        }
      }

      // 4. Buscar por ubicación si aún no se encontró el lote
      if (!lot && cleanLoc !== 'S/U') {
        lot = await tx.productLot.findFirst({
          where: {
            productId: product.id,
            OR: [
              { location: cleanLoc },
              { location: { startsWith: `${cleanLoc}-` } },
              { location: { contains: cleanLoc } }
            ]
          }
        });
      }

      // 4b. Si es salida (change < 0) y no se especificó lote, buscar cualquier lote activo del producto en esta ubicación o con stock
      if (!lot && change < 0) {
        lot = await tx.productLot.findFirst({
          where: {
            productId: product.id,
            stock: { gt: 0 }
          }
        });
      }

      // 5. Creación de lote si no se encontró y es entrada
      const finalTargetLotNum = rawLotNum || (cleanLoc !== 'S/U' ? `S/L-${cleanLoc}` : 'S/L');
      let finalExpDate = new Date('2036-12-31T00:00:00Z');
      if (expirationDate && typeof expirationDate === 'string' && expirationDate.trim()) {
        const parsedDate = new Date(expirationDate);
        if (!isNaN(parsedDate.getTime())) {
          finalExpDate = parsedDate;
        }
      }

      if (!lot) {
        lot = await tx.productLot.create({
          data: {
            productId: product.id,
            lotNumber: finalTargetLotNum,
            expirationDate: finalExpDate,
            stock: change > 0 ? 0 : Math.abs(change),
            location: cleanLoc,
          },
        });
      }

      // Determinar la cantidad exacta a sustraer si es una operación de vaciado/eliminación
      const isVacateAction = change < 0 && reason && (reason.includes('Vaciam') || reason.includes('Elimina') || reason.includes('Retiro'));
      const effectiveSubQty = isVacateAction ? lot.stock : Math.min(lot.stock, Math.abs(change));
      const actualChange = change < 0 ? -effectiveSubQty : change;

      const updatedProductStock = Math.max(0, product.stock + actualChange);
      const updatedLotStock = change < 0 ? Math.max(0, lot.stock - effectiveSubQty) : lot.stock + change;

      if (updatedLotStock <= 0) {
        try {
          await tx.productLot.delete({
            where: { id: lot.id }
          });
        } catch (delErr: any) {
          // Si el lote posee relaciones con pedidos u órdenes previas (FK P2003), vaciar stock a 0 y mover a Sin Ubicación (S/U)
          await tx.productLot.update({
            where: { id: lot.id },
            data: {
              stock: 0,
              location: 'S/U',
            },
          });
        }
      } else {
        await tx.productLot.update({
          where: { id: lot.id },
          data: { 
            stock: updatedLotStock,
            location: cleanLoc !== 'S/U' ? cleanLoc : lot.location,
          },
        });
      }


      let clearDefaultLoc = false;
      if ((updatedLotStock <= 0 || change < 0) && product.defaultLocation) {
        const cleanLocUpper = cleanLoc.toUpperCase();
        const lotLocUpper = (lot && lot.location) ? lot.location.trim().toUpperCase() : '';
        const defLocUpper = product.defaultLocation.trim().toUpperCase();

        if (
          (cleanLocUpper !== 'S/U' && (
            defLocUpper === cleanLocUpper ||
            defLocUpper.startsWith(cleanLocUpper) ||
            cleanLocUpper.startsWith(defLocUpper) ||
            defLocUpper.includes(cleanLocUpper) ||
            cleanLocUpper.includes(defLocUpper)
          )) ||
          (lotLocUpper !== '' && lotLocUpper !== 'S/U' && (
            defLocUpper === lotLocUpper ||
            defLocUpper.startsWith(lotLocUpper) ||
            lotLocUpper.startsWith(defLocUpper)
          ))
        ) {
          clearDefaultLoc = true;
        }
      }


      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: { 
          stock: updatedProductStock,
          ...(clearDefaultLoc ? { defaultLocation: null } : {})
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          quantity: change,
          type: change > 0 ? 'IN' : 'OUT',
          reason: reason || 'Ajuste de stock manual',
          userId: userId,
          productLotId: updatedLotStock <= 0 ? null : (lot ? lot.id : null),
        },
      });

      return { updatedProduct, movement, originalProduct: product };
    });

    await logAudit({
      userId,
      action: 'ADJUST_STOCK',
      entityType: 'Product',
      entityId: id,
      oldValues: { stock: result.originalProduct.stock },
      newValues: { stock: result.updatedProduct.stock, movementId: result.movement.id, lotNumber },
    });

    const freshProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        lots: { orderBy: { expirationDate: 'asc' } },
      },
    });

    return { product: freshProduct, movement: result.movement };
  }

  /**
   * Importar precios masivamente.
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
          const updateData: any = {};
          if (name !== undefined) updateData.name = name;
          if (barcode !== undefined) updateData.barcode = barcode ? String(barcode).trim() : null;

          let targetProfitMargin = profitMargin !== undefined ? (profitMargin ? Number(profitMargin) : null) : undefined;

          if (costPrice !== undefined) {
            updateData.costPrice = Number(costPrice);
          }

          if (listPrice !== undefined) {
            updateData.listPrice = Number(listPrice);
            if (listPriceB !== undefined) updateData.listPriceB = Number(listPriceB);
            if (listPriceC !== undefined) updateData.listPriceC = Number(listPriceC);

            // Si se actualizan costo y precio final, recalculamos el margen
            const finalCost = costPrice !== undefined ? Number(costPrice) : Number(existing.costPrice);
            if (targetProfitMargin === undefined) {
              targetProfitMargin = finalCost > 0 ? (Number(listPrice) / finalCost) : null;
            }
          } else if (costPrice !== undefined) {
            // Solo se actualizó el costo. Recalculamos el precio usando la rentabilidad del producto o del rubro.
            const finalMargin = targetProfitMargin !== undefined
              ? (targetProfitMargin || 1.25)
              : (existing.profitMargin ? Number(existing.profitMargin) : (existing.rubroId ? (await tx.rubro.findUnique({ where: { id: existing.rubroId } }))?.profitMargin || 1.25 : 1.25));

            const finalPrice = Number(costPrice) * Number(finalMargin);
            updateData.listPrice = Math.max(0, Math.round(finalPrice * 100) / 100);

            // Mantener proporciones para B y C
            if (listPriceB !== undefined) {
              updateData.listPriceB = Number(listPriceB);
            } else if (Number(existing.listPriceB) > 0) {
              const ratioB = Number(existing.listPrice) > 0 ? Number(existing.listPriceB) / Number(existing.listPrice) : 0.95;
              updateData.listPriceB = Math.max(0, Math.round(updateData.listPrice * ratioB * 100) / 100);
            }

            if (listPriceC !== undefined) {
              updateData.listPriceC = Number(listPriceC);
            } else if (Number(existing.listPriceC) > 0) {
              const ratioC = Number(existing.listPrice) > 0 ? Number(existing.listPriceC) / Number(existing.listPrice) : 0.90;
              updateData.listPriceC = Math.max(0, Math.round(updateData.listPrice * ratioC * 100) / 100);
            }
          }

          if (targetProfitMargin !== undefined) {
            updateData.profitMargin = targetProfitMargin;
          }

          const updated = await tx.product.update({
            where: { sku },
            data: updateData,
          });
          updatedItems.push(updated);
        } else {
          if (!name || costPrice === undefined || listPrice === undefined) {
            failedItems.push({ sku, error: 'Para crear un producto nuevo se requiere SKU, Nombre, Costo y Lista A.' });
            continue;
          }

          if (barcode) {
            const existingBarcode = await tx.product.findUnique({ where: { barcode: String(barcode).trim() } });
            if (existingBarcode) {
              failedItems.push({ sku, error: `El código de barras ${barcode} ya está asignado al producto ${existingBarcode.sku}.` });
              continue;
            }
          }

          const cost = Number(costPrice);
          const finalPrice = Number(listPrice);
          const margin = profitMargin !== undefined 
            ? (profitMargin ? Number(profitMargin) : null) 
            : (cost > 0 ? (finalPrice / cost) : null);

          const created = await tx.product.create({
            data: {
              sku,
              name,
              costPrice: cost,
              listPrice: finalPrice,
              listPriceB: listPriceB !== undefined ? Number(listPriceB) : 0.00,
              listPriceC: listPriceC !== undefined ? Number(listPriceC) : 0.00,
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

    return { updatedItems, createdItems, failedItems };
  }

  /**
   * Actualizar precios masivamente por Rubro y/o Proveedor.
   */
  async bulkUpdatePrices(data: any, userId?: number) {
    const { rubroId, providerId, type, basis, value, priceList } = data;
    const filterWhere: any = {};
    if (rubroId) filterWhere.rubroId = Number(rubroId);
    if (providerId) filterWhere.providerId = Number(providerId);

    const products = await prisma.product.findMany({ where: filterWhere });
    if (products.length === 0) return { updatedCount: 0 };

    const val = Number(value);
    let updatedCount = 0;

    const chunkSize = 50;
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      await prisma.$transaction(async (tx) => {
        for (const p of chunk) {
          const updateData: any = {};
          const listsToUpdate = priceList === 'all' ? ['listPrice', 'listPriceB', 'listPriceC'] : [priceList];

          for (const listField of listsToUpdate) {
            const cost = Number(p.costPrice);
            const currentPrice = Number((p as any)[listField] || 0);
            let newPrice = currentPrice;

            if (type === 'margin') {
              newPrice = cost * (1 + val / 100);
            } else if (type === 'percentage') {
              const base = basis === 'cost' ? cost : currentPrice;
              newPrice = base * (1 + val / 100);
            } else if (type === 'fixed') {
              newPrice = currentPrice + val;
            }

            updateData[listField] = Math.max(0, Math.round(newPrice * 100) / 100);
          }

          await tx.product.update({ where: { id: p.id }, data: updateData });
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
        newValues: { rubroId, providerId, type, basis, value: val, priceList, updatedCount },
      });
    }

    return { updatedCount };
  }

  /**
   * Obtener movimientos de stock para un producto específico.
   */
  async getProductMovements(productId: number) {
    return prisma.stockMovement.findMany({
      where: { productId },
      include: {
        user: {
          select: { id: true, username: true, role: true }
        },
        productLot: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Obtener los últimos 50 movimientos de stock globales.
   */
  async getGlobalStockMovements() {
    return prisma.stockMovement.findMany({
      take: 50,
      include: {
        product: {
          select: { id: true, sku: true, name: true }
        },
        user: {
          select: { id: true, username: true, role: true }
        },
        productLot: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Obtener lotes próximos a vencer (vencimiento <= hoy + 30 días) que tengan stock.
   */
  async getExpiringLots() {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);

    return prisma.productLot.findMany({
      where: {
        stock: { gt: 0 },
        expirationDate: {
          lte: targetDate
        }
      },
      include: {
        product: {
          select: { id: true, sku: true, name: true, barcode: true }
        }
      },
      orderBy: { expirationDate: 'asc' }
    });
  }

  /**
   * Escanear consistencia de inventario y calcular discrepancias.
   */
  async reconcileStockAudit() {
    const products = await prisma.product.findMany({
      include: {
        lots: true
      },
      orderBy: { sku: 'asc' }
    });

    const reservations = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          status: { in: ['PENDING', 'PREPARING'] }
        }
      },
      _sum: {
        quantity: true
      }
    });

    const reservationMap = new Map<number, number>();
    for (const res of reservations) {
      reservationMap.set(res.productId, res._sum.quantity || 0);
    }

    const driftProducts = [];

    for (const product of products) {
      const sumLotsStock = product.lots.reduce((sum, lot) => sum + lot.stock, 0);
      const reservedQty = reservationMap.get(product.id) || 0;
      const theoreticalStock = sumLotsStock - reservedQty;
      const drift = product.stock - theoreticalStock;

      if (drift !== 0) {
        driftProducts.push({
          id: product.id,
          sku: product.sku,
          name: product.name,
          stockActual: product.stock,
          stockLotes: sumLotsStock,
          reservas: reservedQty,
          stockTeorico: theoreticalStock,
          discrepancia: drift
        });
      }
    }

    return driftProducts;
  }

  /**
   * Corregir discrepancias de stock de forma atómica reajustando el lote 'S/L'.
   */
  async executeStockReconciliation(userId: number) {
    const driftProducts = await this.reconcileStockAudit();
    if (driftProducts.length === 0) {
      return { message: 'No se detectaron descalces de stock. Inventario consistente.', count: 0 };
    }

    const reconciledList = await prisma.$transaction(async (tx) => {
      const list = [];

      for (const item of driftProducts) {
        let defaultLot = await tx.productLot.findUnique({
          where: {
            productId_lotNumber: { productId: item.id, lotNumber: 'S/L' }
          }
        });

        if (!defaultLot) {
          defaultLot = await tx.productLot.create({
            data: {
              productId: item.id,
              lotNumber: 'S/L',
              expirationDate: new Date('2036-12-31T00:00:00Z'),
              stock: 0,
              location: 'S/U'
            }
          });
        }

        const newLotStock = defaultLot.stock + item.discrepancia;

        await tx.productLot.update({
          where: { id: defaultLot.id },
          data: { stock: newLotStock }
        });

        await tx.stockMovement.create({
          data: {
            productId: item.id,
            quantity: item.discrepancia,
            type: 'ADJUSTMENT',
            reason: `Conciliación automática de inventario (Desvío corregido: ${item.discrepancia} u.)`,
            userId,
            productLotId: defaultLot.id
          }
        });

        list.push({
          sku: item.sku,
          name: item.name,
          discrepancia: item.discrepancia,
          loteModificado: 'S/L',
          nuevoStockLote: newLotStock
        });
      }

      return list;
    });

    await logAudit({
      userId,
      action: 'RECONCILE_STOCK_DRIFT',
      entityType: 'Product',
      entityId: 0,
      newValues: reconciledList,
    });

    return {
      message: `Conciliación de inventario completada con éxito.`,
      count: reconciledList.length,
      details: reconciledList
    };
  }

  /**
   * Vaciar limpiamente una posición WMS liberando todos los lotes y referencias
   */
  async clearWmsLocation(locationCode: string, userId: number) {
    if (!locationCode || typeof locationCode !== 'string' || !locationCode.trim()) {
      throw new Error('El código de ubicación es obligatorio.');
    }
    const cleanLoc = locationCode.trim().toUpperCase();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Buscar todos los lotes asignados a esta ubicación o a sus sub-niveles
      const matchingLots = await tx.productLot.findMany({
        where: {
          OR: [
            { location: cleanLoc },
            { location: { startsWith: `${cleanLoc}-` } },
            { location: { contains: cleanLoc } }
          ]
        },
        include: { product: true }
      });

      // 2. Liberar ubicaciones en ProductLot
      for (const lot of matchingLots) {
        await tx.productLot.update({
          where: { id: lot.id },
          data: {
            location: 'S/U',
            stock: 0
          }
        });

        // Registrar movimiento de stock
        await tx.stockMovement.create({
          data: {
            productId: lot.productId,
            quantity: -lot.stock,
            type: 'ADJUSTMENT',
            reason: `Vaciado definitivo de ubicación ${cleanLoc} desde Mapa WMS`,
            userId,
            productLotId: lot.id
          }
        });
      }

      // 3. Limpiar defaultLocation en productos
      const matchingProducts = await tx.product.findMany({
        where: {
          OR: [
            { defaultLocation: cleanLoc },
            { defaultLocation: { startsWith: `${cleanLoc}-` } },
            { defaultLocation: { contains: cleanLoc } }
          ]
        }
      });

      for (const prod of matchingProducts) {
        await tx.product.update({
          where: { id: prod.id },
          data: { defaultLocation: null }
        });
      }

      return {
        clearedLotsCount: matchingLots.length,
        clearedProductsCount: matchingProducts.length
      };
    });

    await logAudit({
      userId,
      action: 'CLEAR_WMS_LOCATION',
      entityType: 'ProductLot',
      entityId: 0,
      newValues: { locationCode: cleanLoc, result },
    });

    return {
      message: `Posición ${cleanLoc} liberada y vaciada con éxito.`,
      result
    };
  }

  /**
   * Asignar de forma limpia un producto/lote a una posición WMS
   */
  async assignWmsLocation(data: { productId: number; locationCode: string; quantity: number; lotNumber?: string; expirationDate?: string }, userId: number) {
    const { productId, locationCode, quantity, lotNumber, expirationDate } = data;
    if (!productId || !locationCode) {
      throw new Error('Producto y código de ubicación son obligatorios.');
    }

    const cleanLoc = locationCode.trim().toUpperCase();
    const qty = Math.max(0, Number(quantity) || 0);

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: Number(productId) } });
      if (!product) throw new Error('Producto no encontrado.');

      // 1. Actualizar defaultLocation en el producto
      await tx.product.update({
        where: { id: product.id },
        data: { defaultLocation: cleanLoc }
      });

      // 2. Determinar número de lote
      const rawLotNum = (lotNumber && typeof lotNumber === 'string' && lotNumber.trim()) ? lotNumber.trim() : `S/L-${cleanLoc}`;
      
      let expDate = new Date('2036-12-31T00:00:00Z');
      if (expirationDate && typeof expirationDate === 'string' && expirationDate.trim()) {
        const parsed = new Date(expirationDate);
        if (!isNaN(parsed.getTime())) expDate = parsed;
      }

      // Buscar o crear lote
      let lot = await tx.productLot.findUnique({
        where: { productId_lotNumber: { productId: product.id, lotNumber: rawLotNum } }
      });

      if (lot) {
        lot = await tx.productLot.update({
          where: { id: lot.id },
          data: {
            location: cleanLoc,
            stock: qty > 0 ? qty : lot.stock
          }
        });
      } else {
        lot = await tx.productLot.create({
          data: {
            productId: product.id,
            lotNumber: rawLotNum,
            expirationDate: expDate,
            stock: qty,
            location: cleanLoc
          }
        });
      }

      // Ajustar stock general del producto si la asignación agrega nueva cantidad
      if (qty > 0) {
        await tx.product.update({
          where: { id: product.id },
          data: { stock: Math.max(product.stock, qty) }
        });
      }

      // Movimiento de auditoría
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          quantity: qty,
          type: 'ADJUSTMENT',
          reason: `Asignación directa a ubicación ${cleanLoc} desde Mapa WMS`,
          userId,
          productLotId: lot.id
        }
      });

      return { product, lot };
    });

    await logAudit({
      userId,
      action: 'ASSIGN_WMS_LOCATION',
      entityType: 'Product',
      entityId: Number(productId),
      newValues: { locationCode: cleanLoc, quantity: qty },
    });

    return {
      message: `Producto asignado a la posición ${cleanLoc} correctamente.`,
      result
    };
  }

  /**
   * Revertir precios al estado previo (Undo de sincronización)
   */
  async revertPrices(userId?: number) {
    const productsWithHistory = await prisma.product.findMany({
      where: {
        previousCostPrice: { not: null },
        previousListPrice: { not: null }
      }
    });

    if (productsWithHistory.length === 0) {
      return { message: 'No hay precios anteriores para restaurar.', count: 0 };
    }

    let revertedCount = 0;
    await prisma.$transaction(async (tx) => {
      for (const p of productsWithHistory) {
        if (p.previousCostPrice !== null && p.previousListPrice !== null) {
          await tx.product.update({
            where: { id: p.id },
            data: {
              costPrice: p.previousCostPrice,
              listPrice: p.previousListPrice,
              previousCostPrice: null,
              previousListPrice: null,
              lastPriceUpdateAt: new Date()
            }
          });
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
    return { message: `Se restauraron ${revertedCount} productos a sus precios anteriores.`, count: revertedCount };
  }
}

export const productService = new ProductService();

