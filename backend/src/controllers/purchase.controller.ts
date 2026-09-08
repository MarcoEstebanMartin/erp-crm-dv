import { Response, Request } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { logAudit } from '../utils/audit';
import { geminiService } from '../services/gemini.service';
import fs from 'fs';
import path from 'path';

/**
 * Obtener órdenes de compra
 */
export async function getPurchaseOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { startDate, endDate, status } = req.query;

  try {
    const whereClause: any = {};

    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(String(startDate)),
        lte: new Date(String(endDate)),
      };
    }

    if (status) {
      whereClause.status = String(status);
    }

    const orders = await prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        persona: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: { orders },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener las órdenes de compra.',
    });
  }
}

/**
 * Crear una nueva orden de compra
 */
export async function createPurchaseOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { personaId, items } = req.body;
  const userId = req.user?.id;

  if (!personaId || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({
      status: 'error',
      message: 'Proveedor y al menos un artículo son requeridos.',
    });
    return;
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      let totalSum = 0;
      
      // Validar ítems y calcular total
      const parsedItems = items.map((item: any) => {
        const costPrice = Math.round(Number(item.costPrice));
        const subtotal = Math.round(Number(item.quantity) * costPrice);
        totalSum += subtotal;
        return {
          productId: Number(item.productId),
          productIdRef: Number(item.productId),
          quantity: Number(item.quantity),
          costPrice,
          subtotal,
        };
      });

      // Crear la orden de compra
      const newOrder = await tx.purchaseOrder.create({
        data: {
          personaId: Number(personaId),
          status: 'PENDING',
          totalAmount: Math.round(totalSum),
          items: {
            create: parsedItems,
          },
        },
        include: {
          items: true,
        },
      });

      return newOrder;
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'CREATE_PURCHASE_ORDER',
        entityType: 'PurchaseOrder',
        entityId: order.id,
        newValues: order,
      });
    }

    res.status(201).json({
      status: 'success',
      data: { order },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al registrar la orden de compra.',
    });
  }
}

/**
 * Recibir mercadería de una orden de compra
 */
export async function receivePurchaseOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { invoiceNumber, lotAssignments, billingType } = req.body; // lotAssignments: { productId: { lotNumber, expirationDate } }
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado' });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Obtener la orden de compra
      const order = await tx.purchaseOrder.findUnique({
        where: { id: Number(id) },
        include: { items: true },
      });

      if (!order) throw new Error('Orden de compra no encontrada.');
      if (order.status !== 'PENDING') throw new Error('Esta orden de compra ya fue procesada o cancelada.');

      // 2. Marcar como RECEIVED
      const updatedOrder = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: 'RECEIVED' },
      });

      // 3. Procesar cada artículo
      for (const item of order.items) {
        const qty = Number(item.quantity);
        const cost = Number(item.costPrice);

        // a. Actualizar stock y costo del producto
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          await tx.product.update({
            where: { id: product.id },
            data: {
              stock: { increment: qty },
              costPrice: cost, // Actualización automática del precio costo
            },
          });
        }

        // b. Manejar asignación a lote
        let createdLotId: number | null = null;
        const assignment = lotAssignments ? lotAssignments[item.productId] : null;
        const lotNumber = (assignment && assignment.lotNumber) ? String(assignment.lotNumber) : 'S/L';
        const expirationDate = (assignment && assignment.expirationDate) 
          ? new Date(assignment.expirationDate) 
          : new Date('2036-12-31T00:00:00Z');
        const location = (assignment && assignment.location) ? String(assignment.location) : 'S/U';

        // Buscar si el lote existe para el producto
        let lot = await tx.productLot.findUnique({
          where: {
            productId_lotNumber: {
              productId: item.productId,
              lotNumber: lotNumber,
            },
          },
        });

        if (lot) {
          lot = await tx.productLot.update({
            where: { id: lot.id },
            data: {
              stock: { increment: qty },
              location: location !== 'S/U' ? location : lot.location, // Conservar existente si no se provee nueva ubicación
            },
          });
        } else {
          lot = await tx.productLot.create({
            data: {
              productId: item.productId,
              lotNumber: lotNumber,
              expirationDate: expirationDate,
              stock: qty,
              location: location,
            },
          });
        }
        createdLotId = lot.id;

        // c. Registrar movimiento de stock
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: qty,
            type: 'IN',
            purchaseOrderId: order.id,
            referenceId: `PO-${order.id}`,
            userId,
            reason: 'Recepción de Orden de Compra',
            productLotId: createdLotId,
          },
        });
      }

      // 4. Auto-generar SupplierInvoice y actualizar cuenta corriente
      const total = Math.round(Number(order.totalAmount));
      const neto = Math.round(total / 1.21);
      const iva = total - neto;
      const nroInvoice = invoiceNumber || `COMP-${order.id.toString().padStart(5, '0')}`;

      // Crear factura de proveedor
      await tx.supplierInvoice.create({
        data: {
          personaId: order.personaId,
          invoiceNumber: nroInvoice,
          invoiceType: 'FACTURA_A',
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000), // 30 días de plazo por defecto
          status: 'PENDING',
          paidAmount: 0.00,
          netAmount: neto,
          taxAmount: iva,
          percepcionAmount: 0.00,
          totalAmount: total,
          billingType: billingType || 'OFFICIAL',
        },
      });

      // Actualizar cuenta corriente del proveedor (decrementando saldo deudor, aumenta lo que le debemos)
      await tx.persona.update({
        where: { id: order.personaId },
        data: {
          outstandingBalance: {
            decrement: total,
          },
        },
      });

      return updatedOrder;
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'RECEIVE_PURCHASE_ORDER',
        entityType: 'PurchaseOrder',
        entityId: result.id,
        newValues: result,
      });
    }

    res.status(200).json({
      status: 'success',
      data: { order: result },
    });
  } catch (error: any) {
    console.error('Error al recibir orden de compra:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al procesar la recepción de la orden de compra.',
    });
  }
}


/**
 * Retorna las variaciones de búsqueda para palabras clave comunes y sus abreviaturas en base de datos
 */
function getSearchVariations(word: string): string[] {
  const upper = word.toUpperCase();
  const variations = [upper];
  
  if (upper === 'QUESO') {
    variations.push('Q.', 'Q ', 'Q-');
  } else if (upper === 'DULCE' || upper === 'LECHE') {
    variations.push('DDL', 'D.L.');
  } else if (upper === 'MANTECA') {
    variations.push('MANTEC');
  } else if (upper === 'YOGUR') {
    variations.push('YOG', 'YOGT');
  } else if (upper === 'CLASICO') {
    variations.push('CLAS', 'CLASSIC');
  }
  
  return variations;
}

/**
 * Normaliza textos eliminando acentos y expandiendo abreviaturas comunes de alimentos/bebidas (Q., D.L., etc.)
 */
function normalizeText(text: string): string {
  if (!text) return '';
  return text.toUpperCase()
    .normalize('NFD') // Eliminar tildes
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bQ\./g, 'QUESO ')
    .replace(/\bQ\b/g, 'QUESO')
    .replace(/\bD\.L\./g, 'DULCE DE LECHE ')
    .replace(/\bD\.L\b/g, 'DULCE DE LECHE')
    .replace(/\bDDL\b/g, 'DULCE DE LECHE')
    .replace(/\bMANTEC\b/g, 'MANTECA')
    .replace(/\bYOG\b|\bYOGT\b/g, 'YOGUR')
    .replace(/\bCLAS\b|\bCLASSIC\b/g, 'CLASICO')
    .replace(/[^A-Z0-9\s]/g, ' ') // Quitar símbolos y puntuación restante
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Función auxiliar para realizar una vinculación inteligente de productos del proveedor con el catálogo local
 */
async function findMatchedProduct(
  providerId: number | null, 
  item: { code: string | null; description: string },
  providerName: string | null
): Promise<{ matchedProduct: any; matchMethod: string }> {
  let matchedProduct = null;
  let matchMethod = 'NONE';

  // 1. Intentar matchear por código de mapeo previo si tenemos el proveedor
  if (providerId && item.code) {
    const mapping = await prisma.providerProductMapping.findFirst({
      where: {
        providerId,
        providerCode: String(item.code)
      },
      include: { product: true }
    });
    if (mapping) {
      return { matchedProduct: mapping.product, matchMethod: 'PREVIOUS_MAPPING' };
    }
  }

  // 2. Intentar matchear por SKU o Barcode exacto usando el código extraído
  if (item.code) {
    const cleanCode = String(item.code).trim();
    matchedProduct = await prisma.product.findFirst({
      where: {
        OR: [
          { sku: cleanCode },
          { barcode: cleanCode }
        ]
      }
    });
    if (matchedProduct) {
      return { matchedProduct, matchMethod: 'CODE_MATCH' };
    }
  }

  // 3. Intentar matchear por coincidencia en descripción
  if (item.description) {
    // 3a. Coincidencia exacta de la descripción
    matchedProduct = await prisma.product.findFirst({
      where: {
        name: { contains: item.description, mode: 'insensitive' }
      }
    });
    if (matchedProduct) {
      return { matchedProduct, matchMethod: 'DESCRIPTION_EXACT' };
    }

    const normItemDesc = normalizeText(item.description);
    
    // Limpiar palabras comunes y unidades para buscar por palabras clave
    const words = normItemDesc
      .split(/\s+/)
      .filter(w => w.length > 2 && !['CON', 'DEL', 'POR', 'CONTRAS', 'PARA', 'GRS', 'KGS', 'LTS', 'X250', 'X500', 'X400', 'X1KG', '250GR', '500GR', '1KG'].includes(w));

    // Si tenemos proveedor, primero priorizamos productos que pertenecen a este proveedor
    if (providerId && words.length > 0) {
      const providerProducts = await prisma.product.findMany({
        where: { providerId },
      });

      // Buscar el producto que tenga más coincidencia de palabras del ítem (comparando nombres normalizados)
      let bestMatch = null;
      let maxMatchesCount = 0;
      for (const prod of providerProducts) {
        let matchesCount = 0;
        const normProdName = normalizeText(prod.name);
        for (const word of words) {
          if (normProdName.includes(word)) {
            matchesCount++;
          }
        }
        if (matchesCount > maxMatchesCount) {
          maxMatchesCount = matchesCount;
          bestMatch = prod;
        }
      }
      
      const minRequired = Math.min(2, words.length);
      if (bestMatch && maxMatchesCount >= minRequired) {
        return { matchedProduct: bestMatch, matchMethod: 'DESCRIPTION_PARTIAL' };
      }
    }

    // 3b. Búsqueda por palabras clave del proveedor en la descripción del producto general
    let cleanProvName = '';
    if (providerName) {
      cleanProvName = providerName
        .split(/\s+/)
        .map(w => w.replace(/[^a-zA-Z]/g, '').toUpperCase())
        .filter(w => w.length > 2 && w !== 'SRL' && w !== 'SA' && w !== 'SH' && w !== 'LTDA')[0] || '';
    }

    if (words.length > 0) {
      const queryWords = words.slice(0, 3);
      
      // Consultamos los candidatos en base de datos soportando variaciones de abreviaturas
      const partialQuery = queryWords.slice(0, 2);
      const candidateProducts = await prisma.product.findMany({
        where: {
          AND: partialQuery.map(word => ({
            OR: getSearchVariations(word).map(variation => ({
              name: { contains: variation, mode: 'insensitive' }
            }))
          }))
        }
      });

      if (candidateProducts.length > 0) {
        let bestMatch = null;
        let maxMatchesCount = 0;
        for (const prod of candidateProducts) {
          let matchesCount = 0;
          const normProdName = normalizeText(prod.name);
          for (const word of words) {
            if (normProdName.includes(word)) {
              matchesCount++;
            }
          }
          
          if (cleanProvName && normProdName.includes(cleanProvName)) {
            matchesCount += 2;
          }

          if (matchesCount > maxMatchesCount) {
            maxMatchesCount = matchesCount;
            bestMatch = prod;
          }
        }

        const minRequired = Math.min(2, words.length);
        if (bestMatch && maxMatchesCount >= minRequired) {
          return { matchedProduct: bestMatch, matchMethod: 'DESCRIPTION_PARTIAL' };
        }
      }
    }
  }

  return { matchedProduct: null, matchMethod: 'NONE' };
}

/**
 * Endpoint para subir un documento (imagen/pdf) y procesarlo con IA
 */
export async function uploadDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ status: 'error', message: 'No se recibió ningún archivo.' });
      return;
    }

    const base64Data = file.buffer.toString('base64');
    const mimeType = file.mimetype;

    const extractedData = await geminiService.extractInvoiceData(mimeType, base64Data);

    // Intentar matchear proveedor con CUIT normalizado
    let matchedProvider = null;
    let cuitClean = '';
    if (extractedData.cuit) {
      cuitClean = extractedData.cuit.replace(/\D/g, '');
      let formattedCuit = cuitClean;
      if (cuitClean.length === 11) {
        formattedCuit = `${cuitClean.substring(0, 2)}-${cuitClean.substring(2, 10)}-${cuitClean.substring(10)}`;
      }
      matchedProvider = await prisma.persona.findFirst({
        where: {
          OR: [
            { cuit: cuitClean },
            { cuit: formattedCuit },
            { cuit: { contains: cuitClean } }
          ],
          isProvider: true
        }
      });
    }
    if (!matchedProvider && extractedData.supplierName) {
      matchedProvider = await prisma.persona.findFirst({
        where: { name: { contains: extractedData.supplierName, mode: 'insensitive' }, isProvider: true }
      });
    }

    // Auto-determinar Sucursal (A = OFFICIAL, X = INTERNAL)
    const companyCuitClean = '20163165059';
    const receiverCuitClean = extractedData.receiverCuit ? extractedData.receiverCuit.replace(/\D/g, '') : '';
    
    let defaultBillingType: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL';
    
    const isOfficialInvoice = ['FACTURA_A', 'FACTURA_B', 'FACTURA_C'].includes(extractedData.documentType);
    const matchesCompanyCuit = receiverCuitClean === companyCuitClean;
    const matchesCompanyName = extractedData.receiverName && 
      (extractedData.receiverName.toUpperCase().includes('MARTIN PABLO') || 
       extractedData.receiverName.toUpperCase().includes('DON VENANCIO'));

    if (isOfficialInvoice && (matchesCompanyCuit || matchesCompanyName)) {
      defaultBillingType = 'OFFICIAL';
    }

    const providerId = matchedProvider ? matchedProvider.id : null;

    // Intentar matchear productos con mapeos previos, SKU/código de barras o descripción inteligente
    const enrichedItems = await Promise.all(extractedData.items.map(async (item) => {
      const { matchedProduct, matchMethod } = await findMatchedProduct(
        providerId,
        item,
        matchedProvider ? matchedProvider.name : null
      );

      return {
        ...item,
        matchedProductId: matchedProduct ? matchedProduct.id : null,
        matchedProductName: matchedProduct ? matchedProduct.name : null,
        matchMethod,
      };
    }));

    res.status(200).json({
      status: 'success',
      data: {
        extracted: { 
          ...extractedData, 
          items: enrichedItems,
          billingType: defaultBillingType
        },
        matchedProvider,
      }
    });
  } catch (error: any) {
    console.error('Error in uploadDocument:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
}

/**
 * Confirmar el documento procesado e inyectar stock
 */
export async function confirmDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { providerId, documentType, documentNumber, issueDate, items, netAmount, taxAmount, percepcionAmount, percepcionIvaAmount, percepcionJurisdiction, totalAmount, billingType } = req.body;
  const userId = req.user?.id;

  if (!providerId || !items || items.length === 0) {
    res.status(400).json({ status: 'error', message: 'Faltan datos obligatorios para confirmar.' });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let createdId = 0;
      let refId = '';

      if (documentType.startsWith('FACTURA')) {
        // Verificar si la factura ya existe para este proveedor (evitar duplicados)
        const existingInvoice = await tx.supplierInvoice.findFirst({
          where: {
            personaId: Number(providerId),
            invoiceNumber: documentNumber || '',
          },
        });
        if (existingInvoice) {
          throw new Error(`La factura Nro ${documentNumber} ya se encuentra registrada para este proveedor.`);
        }

        // Crear SupplierInvoice
        const invoiceDate = new Date(issueDate || Date.now());
        
        // Obtener el plazo de pago del proveedor para calcular el vencimiento real
        const provider = await tx.persona.findUnique({
          where: { id: Number(providerId) }
        });
        const termDays = provider?.paymentTermDays ?? 30;
        
        // Si se envían por separado La Pampa y Bs As:
        const pampa = Number(req.body.percepcionPampa || 0);
        const bsas = Number(req.body.percepcionBsAs || 0);
        const ivarg3337 = Number(req.body.percepcionIva || req.body.percepcionIvaAmount || 0);
        const ivarg5329 = Number(req.body.percepcionIva5329 || 0);
        const totalPercIva = ivarg3337 + ivarg5329;
        const impInternos = Number(req.body.impuestosInternos || 0);

        // La percepción total de IIBB es la suma de La Pampa y Bs As (o cae en el valor directo anterior)
        const finalIIBB = (pampa > 0 || bsas > 0) ? (pampa + bsas) : Number(percepcionAmount || 0);

        const invoice = await tx.supplierInvoice.create({
          data: {
            personaId: providerId,
            invoiceNumber: documentNumber || `AI-${Date.now()}`,
            invoiceType: documentType,
            issueDate: invoiceDate,
            dueDate: new Date(invoiceDate.getTime() + termDays * 24 * 3600 * 1000),
            netAmount: Number(netAmount || 0),
            taxAmount: Number(taxAmount || 0),
            percepcionAmount: finalIIBB,
            percepcionIvaAmount: totalPercIva,
            impuestosInternos: impInternos,
            totalAmount: Number(totalAmount || 0),
            status: 'PENDING',
            paidAmount: 0.00,
            billingType: billingType || 'INTERNAL',
          }
        });
        createdId = invoice.id;
        refId = `INV-${invoice.id}`;

        // Crear TaxWithholding para La Pampa
        if (pampa > 0) {
          await tx.taxWithholding.create({
            data: {
              type: 'PERCEPCION_SUFRIDA',
              taxType: 'IIBB',
              personaId: providerId,
              number: documentNumber || `INV-${invoice.id}`,
              date: invoiceDate,
              amount: pampa,
              jurisdiction: 'AR-L', // La Pampa
            }
          });
        }

        // Crear TaxWithholding para Bs As
        if (bsas > 0) {
          await tx.taxWithholding.create({
            data: {
              type: 'PERCEPCION_SUFRIDA',
              taxType: 'IIBB',
              personaId: providerId,
              number: documentNumber || `INV-${invoice.id}`,
              date: invoiceDate,
              amount: bsas,
              jurisdiction: 'AR-B', // Buenos Aires
            }
          });
        }

        // Si no se enviaron por separado pero se envió percepcionAmount genérica:
        if (pampa === 0 && bsas === 0 && Number(percepcionAmount || 0) > 0) {
          await tx.taxWithholding.create({
            data: {
              type: 'PERCEPCION_SUFRIDA',
              taxType: 'IIBB',
              personaId: providerId,
              number: documentNumber || `INV-${invoice.id}`,
              date: invoiceDate,
              amount: Number(percepcionAmount),
              jurisdiction: percepcionJurisdiction || null,
            }
          });
        }

        // Crear TaxWithholding para percepciones de IVA RG 3337 si existen
        if (ivarg3337 > 0) {
          await tx.taxWithholding.create({
            data: {
              type: 'PERCEPCION_SUFRIDA',
              taxType: 'IVA',
              personaId: providerId,
              number: documentNumber || `INV-${invoice.id}`,
              date: invoiceDate,
              amount: ivarg3337,
              jurisdiction: 'RG3337',
            }
          });
        }

        // Crear TaxWithholding para percepciones de IVA RG 5329 si existen
        if (ivarg5329 > 0) {
          await tx.taxWithholding.create({
            data: {
              type: 'PERCEPCION_SUFRIDA',
              taxType: 'IVA',
              personaId: providerId,
              number: documentNumber || `INV-${invoice.id}`,
              date: invoiceDate,
              amount: ivarg5329,
              jurisdiction: 'RG5329',
            }
          });
        }
      } else {
        // REMITO -> Crear PurchaseOrder completada
        const po = await tx.purchaseOrder.create({
          data: {
            personaId: providerId,
            status: 'RECEIVED',
            totalAmount: Number(totalAmount || netAmount || 0),
            items: {
              create: items.map((item: any) => ({
                productId: item.productId,
                quantity: Number(item.quantity || 0),
                costPrice: Number(item.unitPrice || 0),
                subtotal: Number(item.subtotal || 0)
              }))
            }
          }
        });
        createdId = po.id;
        refId = `PO-${po.id}`;
      }

      // Actualizar Stock, Costos, Lotes y Mapeos de Productos
      for (const item of items) {
        if (!item.productId || item.isNonStock) continue; // Si es gasto o no tiene producto vinculado, omitir stock y lotes

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: Number(item.quantity) },
            costPrice: item.unitPrice > 0 ? Number(item.unitPrice) : undefined, // Actualizar costo solo si hay
          }
        });

        // Crear/Actualizar Lote de Producto
        const lotNumber = documentNumber || `LOT-${Date.now()}`;
        const expirationDate = new Date(Date.now() + 365 * 24 * 3600 * 1000); // 1 año por defecto
        
        const lot = await tx.productLot.findFirst({
          where: {
            productId: item.productId,
            lotNumber: lotNumber
          }
        });

        if (lot) {
          await tx.productLot.update({
            where: { id: lot.id },
            data: {
              stock: { increment: Number(item.quantity) }
            }
          });
        } else {
          await tx.productLot.create({
            data: {
              productId: item.productId,
              lotNumber: lotNumber,
              expirationDate: expirationDate,
              stock: Number(item.quantity),
              location: 'S/U'
            }
          });
        }

        // Registrar / actualizar el mapeo del código de proveedor con el producto local
        if (item.code) {
          await tx.providerProductMapping.upsert({
            where: {
              providerId_providerCode: {
                providerId: Number(providerId),
                providerCode: String(item.code)
              }
            },
            update: {
              productId: Number(item.productId),
              providerName: item.description || ''
            },
            create: {
              providerId: Number(providerId),
              providerCode: String(item.code),
              productId: Number(item.productId),
              providerName: item.description || ''
            }
          });
        }

        // Crear Movimiento de Stock
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: Number(item.quantity),
            type: 'IN',
            referenceId: refId,
            userId: userId!,
            reason: `Ingreso por ${documentType}`,
          }
        });
      }

      // Actualizar cuenta corriente del proveedor (decrementando saldo deudor, aumenta lo que le debemos)
      await tx.persona.update({
        where: { id: Number(providerId) },
        data: {
          outstandingBalance: {
            decrement: Number(totalAmount || 0),
          },
        },
      });

      return { createdId, refId };
    });

    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    console.error('Error confirming document:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
}

