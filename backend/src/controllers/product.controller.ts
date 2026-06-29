import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { logAudit } from '../utils/audit';

/**
 * Obtener todos los productos (Buscador inteligente por SKU o Nombre).
 */
export async function getProducts(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { search } = req.query;

  try {
    const products = await prisma.product.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: String(search), mode: 'insensitive' } },
              { sku: { contains: String(search), mode: 'insensitive' } },
              { barcode: { equals: String(search) } },
            ],
          }
        : {},
      include: {
        lots: {
          orderBy: { expirationDate: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      data: { products },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener los productos.',
    });
  }
}

/**
 * Obtener un producto por ID.
 */
export async function getProductById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(id) },
      include: {
        lots: {
          orderBy: { expirationDate: 'asc' },
        },
      },
    });

    if (!product) {
      res.status(404).json({
        status: 'error',
        message: 'Producto no encontrado.',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: { product },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener el producto.',
    });
  }
}

/**
 * Crear un nuevo producto (Solo ADMIN).
 */
export async function createProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { sku, name, description, barcode, costPrice, listPrice, minStock } = req.body;
  const userId = req.user?.id;

  if (!sku || !name || costPrice === undefined || listPrice === undefined) {
    res.status(400).json({
      status: 'error',
      message: 'SKU, nombre, precio de costo y precio de lista son requeridos.',
    });
    return;
  }

  try {
    // Validar SKU único
    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing) {
      res.status(400).json({
        status: 'error',
        message: `El SKU ${sku} ya está en uso.`,
      });
      return;
    }

    // Validar código de barras único si se provee
    if (barcode) {
      const existingBarcode = await prisma.product.findUnique({ where: { barcode: String(barcode).trim() } });
      if (existingBarcode) {
        res.status(400).json({
          status: 'error',
          message: `El código de barras ${barcode} ya está asignado al producto ${existingBarcode.sku}.`,
        });
        return;
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
        stock: 0, // Se inicializa en 0. Para cargar stock se usa un movimiento.
        minStock: minStock ? Number(minStock) : 0,
      },
    });

    // Auditoría
    if (userId) {
      await logAudit({
        userId,
        action: 'CREATE_PRODUCT',
        entityType: 'Product',
        entityId: product.id,
        newValues: product,
      });
    }

    res.status(201).json({
      status: 'success',
      data: { product },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al crear el producto.',
    });
  }
}

/**
 * Actualizar datos de producto (Solo ADMIN).
 * Registra los valores viejos y nuevos en los logs de auditoría.
 */
export async function updateProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, description, barcode, costPrice, listPrice, minStock } = req.body;
  const userId = req.user?.id;

  try {
    const original = await prisma.product.findUnique({
      where: { id: Number(id) },
    });

    if (!original) {
      res.status(404).json({
        status: 'error',
        message: 'Producto no encontrado.',
      });
      return;
    }

    // Validar código de barras único si cambia
    if (barcode && barcode !== original.barcode) {
      const existingBarcode = await prisma.product.findUnique({ where: { barcode: String(barcode).trim() } });
      if (existingBarcode) {
        res.status(400).json({
          status: 'error',
          message: `El código de barras ${barcode} ya está asignado al producto ${existingBarcode.sku}.`,
        });
        return;
      }
    }

    const updated = await prisma.product.update({
      where: { id: Number(id) },
      data: {
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
        barcode: barcode !== undefined ? (barcode ? String(barcode).trim() : null) : undefined,
        costPrice: costPrice !== undefined ? Number(costPrice) : undefined,
        listPrice: listPrice !== undefined ? Number(listPrice) : undefined,
        minStock: minStock !== undefined ? Number(minStock) : undefined,
      },
    });

    // Auditoría
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

    res.status(200).json({
      status: 'success',
      data: { product: updated },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar el producto.',
    });
  }
}

/**
 * Ajustar stock físicamente (ADMIN y DEPOSITO).
 * Utiliza una transacción atómica para garantizar que no haya inconsistencias.
 */
export async function adjustStock(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { quantityChange, reason, lotNumber, expirationDate } = req.body;
  const userId = req.user?.id;

  if (quantityChange === undefined || Number(quantityChange) === 0) {
    res.status(400).json({
      status: 'error',
      message: 'El cambio de cantidad es requerido y debe ser diferente de cero.',
    });
    return;
  }

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  try {
    const change = Number(quantityChange);

    // Transacción atómica
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: Number(id) },
      });

      if (!product) {
        throw new Error('Producto no encontrado.');
      }

      const newStock = product.stock + change;
      if (newStock < 0) {
        throw new Error(`Ajuste inválido. El stock general no puede ser negativo (Stock actual: ${product.stock}, Cambio solicitado: ${change}).`);
      }

      let lotId: number | null = null;

      if (lotNumber) {
        const trimmedLot = lotNumber.trim();
        if (trimmedLot) {
          let lot = await tx.productLot.findUnique({
            where: {
              productId_lotNumber: {
                productId: product.id,
                lotNumber: trimmedLot,
              },
            },
          });

          if (change > 0) {
            if (!lot) {
              if (!expirationDate) {
                throw new Error('La fecha de vencimiento es requerida para crear un lote nuevo.');
              }
              lot = await tx.productLot.create({
                data: {
                  productId: product.id,
                  lotNumber: trimmedLot,
                  expirationDate: new Date(expirationDate),
                  stock: 0,
                },
              });
            }
          } else {
            // Egresos requieren que el lote exista
            if (!lot) {
              throw new Error(`El lote "${trimmedLot}" no existe para este producto.`);
            }
            if (lot.stock + change < 0) {
              throw new Error(`Stock insuficiente en el lote "${trimmedLot}" (Disponible: ${lot.stock}, Solicitado: ${change}).`);
            }
          }

          // Actualizar stock del lote
          const updatedLot = await tx.productLot.update({
            where: { id: lot.id },
            data: { stock: lot.stock + change },
          });
          lotId = updatedLot.id;
        }
      }

      // Actualizar stock general del producto
      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: { stock: newStock },
      });

      // Crear movimiento de stock
      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          quantity: change,
          type: change > 0 ? 'IN' : 'OUT',
          reason: reason || 'Ajuste de stock manual',
          userId: userId,
          productLotId: lotId,
        },
      });

      return { updatedProduct, movement, originalProduct: product };
    });

    // Auditoría
    await logAudit({
      userId,
      action: 'ADJUST_STOCK',
      entityType: 'Product',
      entityId: Number(id),
      oldValues: { stock: result.originalProduct.stock },
      newValues: { stock: result.updatedProduct.stock, movementId: result.movement.id, lotNumber },
    });

    // Volver a buscar el producto con sus lotes
    const freshProduct = await prisma.product.findUnique({
      where: { id: Number(id) },
      include: {
        lots: {
          orderBy: { expirationDate: 'asc' },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        product: freshProduct,
        movement: result.movement,
      },
    });
  } catch (error: any) {
    console.error('Error ajustando stock:', error);
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al ajustar el stock del producto.',
    });
  }
}

/**
 * Obtener un producto por código de barras.
 */
export async function getProductByBarcode(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { barcode } = req.params;

  try {
    const product = await prisma.product.findUnique({
      where: { barcode: String(barcode).trim() },
      include: {
        lots: {
          orderBy: { expirationDate: 'asc' },
        },
      },
    });

    if (!product) {
      res.status(404).json({
        status: 'error',
        message: 'Producto no encontrado por código de barras.',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: { product },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener el producto por código de barras.',
    });
  }
}

/**
 * Importar precios masivamente desde un listado (CSV/JSON parseado).
 * Si el SKU existe, actualiza costo y listas.
 * Si no existe, lo crea siempre que tenga nombre y precios mínimos.
 */
export async function importPrices(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { products: rows } = req.body;
  const userId = req.user?.id;

  if (!Array.isArray(rows)) {
    res.status(400).json({
      status: 'error',
      message: 'El cuerpo de la solicitud debe contener un arreglo de productos.',
    });
    return;
  }

  const updatedItems: any[] = [];
  const createdItems: any[] = [];
  const failedItems: { sku: string; error: string }[] = [];

  try {
    // Procesar en una transacción atómica para asegurar consistencia
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const { sku, name, costPrice, listPrice, listPriceB, listPriceC, barcode } = row;
        
        if (!sku) {
          failedItems.push({ sku: 'S/D', error: 'El SKU es requerido.' });
          continue;
        }

        const existing = await tx.product.findUnique({ where: { sku } });

        if (existing) {
          // Actualización de producto existente
          const updateData: any = {};
          if (name !== undefined) updateData.name = name;
          if (costPrice !== undefined) updateData.costPrice = Number(costPrice);
          if (listPrice !== undefined) updateData.listPrice = Number(listPrice);
          if (listPriceB !== undefined) updateData.listPriceB = Number(listPriceB);
          if (listPriceC !== undefined) updateData.listPriceC = Number(listPriceC);
          if (barcode !== undefined) updateData.barcode = barcode ? String(barcode).trim() : null;

          const updated = await tx.product.update({
            where: { sku },
            data: updateData,
          });
          updatedItems.push(updated);
        } else {
          // Creación de producto nuevo (debe contar con datos mínimos)
          if (!name || costPrice === undefined || listPrice === undefined) {
            failedItems.push({ 
              sku, 
              error: 'Para crear un producto nuevo se requiere SKU, Nombre, Costo y Lista A.' 
            });
            continue;
          }

          // Validar código de barras único si se provee
          if (barcode) {
            const existingBarcode = await tx.product.findUnique({ where: { barcode: String(barcode).trim() } });
            if (existingBarcode) {
              failedItems.push({
                sku,
                error: `El código de barras ${barcode} ya está asignado al producto ${existingBarcode.sku}.`
              });
              continue;
            }
          }

          const created = await tx.product.create({
            data: {
              sku,
              name,
              costPrice: Number(costPrice),
              listPrice: Number(listPrice),
              listPriceB: listPriceB !== undefined ? Number(listPriceB) : 0.00,
              listPriceC: listPriceC !== undefined ? Number(listPriceC) : 0.00,
              barcode: barcode ? String(barcode).trim() : null,
              stock: 0,
              minStock: 0,
            },
          });
          createdItems.push(created);
        }
      }
    });

    // Registrar auditoría si hubo cambios
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

    res.status(200).json({
      status: 'success',
      data: {
        updatedCount: updatedItems.length,
        createdCount: createdItems.length,
        failedItems,
      },
    });
  } catch (error: any) {
    console.error('Error importando productos:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al procesar la importación masiva.',
    });
  }
}
