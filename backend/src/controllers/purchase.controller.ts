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
      const nroInvoice = invoiceNumber || `COMP-${order.id.toString().padStart(8, '0')}`;

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

    // Intentar matchear productos con mapeos previos, SKU/código de barras o descripción
    const enrichedItems = await Promise.all(extractedData.items.map(async (item) => {
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
          matchedProduct = mapping.product;
          matchMethod = 'PREVIOUS_MAPPING';
        }
      }

      // 2. Intentar matchear por SKU o Barcode exacto usando el código extraído
      if (!matchedProduct && item.code) {
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
          matchMethod = 'CODE_MATCH';
        }
      }

      // 3. Intentar matchear por coincidencia en descripción
      if (!matchedProduct && item.description) {
        const words = item.description.split(/\s+/).filter(w => w.length > 2);
        
        matchedProduct = await prisma.product.findFirst({
          where: {
            name: { contains: item.description, mode: 'insensitive' }
          }
        });
        
        if (matchedProduct) {
          matchMethod = 'DESCRIPTION_EXACT';
        } else if (words.length > 0) {
          const queryWords = words.slice(0, 2).join(' ');
          matchedProduct = await prisma.product.findFirst({
            where: {
              name: { contains: queryWords, mode: 'insensitive' }
            }
          });
          if (matchedProduct) {
            matchMethod = 'DESCRIPTION_PARTIAL';
          }
        }
      }

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
  const { providerId, documentType, documentNumber, issueDate, items, netAmount, taxAmount, percepcionAmount, totalAmount, billingType } = req.body;
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
        // Crear SupplierInvoice
        const invoiceDate = new Date(issueDate || Date.now());
        const invoice = await tx.supplierInvoice.create({
          data: {
            personaId: providerId,
            invoiceNumber: documentNumber || `AI-${Date.now()}`,
            invoiceType: documentType,
            issueDate: invoiceDate,
            dueDate: new Date(invoiceDate.getTime() + 30 * 24 * 3600 * 1000), // 30 días de plazo por defecto
            netAmount: Number(netAmount || 0),
            taxAmount: Number(taxAmount || 0),
            percepcionAmount: Number(percepcionAmount || 0),
            totalAmount: Number(totalAmount || 0),
            status: 'PENDING',
            paidAmount: 0.00,
            billingType: billingType || 'INTERNAL',
          }
        });
        createdId = invoice.id;
        refId = `INV-${invoice.id}`;

        // Crear TaxWithholding para las percepciones si existen
        if (percepcionAmount > 0) {
          await tx.taxWithholding.create({
            data: {
              type: 'PERCEPCION_SUFRIDA',
              taxType: 'IIBB', // Por defecto, se podría ajustar en el front
              personaId: providerId,
              number: documentNumber,
              date: new Date(issueDate || Date.now()),
              amount: Number(percepcionAmount),
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
        if (!item.productId) continue; // Si no lo vincularon, ignorar

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

/**
 * Listar archivos locales de la carpeta ARCHIVOS
 */
export async function listLocalFiles(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const dirPath = path.join('c:', 'Users', 'Usuario', 'Desktop', 'ERP-CRM DV', 'ARCHIVOS');
    if (!fs.existsSync(dirPath)) {
      res.status(200).json({ status: 'success', files: [] });
      return;
    }

    const files = fs.readdirSync(dirPath);
    const documentFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.pdf', '.png', '.jpg', '.jpeg'].includes(ext);
    });

    const fileDetails = documentFiles.map(file => {
      const stats = fs.statSync(path.join(dirPath, file));
      return {
        name: file,
        size: stats.size,
        createdAt: stats.birthtime,
      };
    });

    res.status(200).json({
      status: 'success',
      files: fileDetails
    });
  } catch (error: any) {
    console.error('Error in listLocalFiles:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
}

/**
 * Procesar un archivo local de la carpeta ARCHIVOS usando Gemini
 */
export async function processLocalFile(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { filename } = req.body;
  if (!filename) {
    res.status(400).json({ status: 'error', message: 'No se especificó ningún nombre de archivo.' });
    return;
  }

  try {
    const filePath = path.join('c:', 'Users', 'Usuario', 'Desktop', 'ERP-CRM DV', 'ARCHIVOS', filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ status: 'error', message: `El archivo ${filename} no existe en la carpeta ARCHIVOS.` });
      return;
    }

    const ext = path.extname(filename).toLowerCase();
    let mimeType = 'application/pdf';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';

    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');

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

    // Intentar matchear productos con mapeos previos, SKU/código de barras o descripción
    const enrichedItems = await Promise.all(extractedData.items.map(async (item) => {
      let matchedProduct = null;
      let matchMethod = 'NONE';

      if (providerId && item.code) {
        const mapping = await prisma.providerProductMapping.findFirst({
          where: {
            providerId,
            providerCode: String(item.code)
          },
          include: { product: true }
        });
        if (mapping) {
          matchedProduct = mapping.product;
          matchMethod = 'PREVIOUS_MAPPING';
        }
      }

      if (!matchedProduct && item.code) {
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
          matchMethod = 'CODE_MATCH';
        }
      }

      if (!matchedProduct && item.description) {
        const words = item.description.split(/\s+/).filter(w => w.length > 2);
        
        matchedProduct = await prisma.product.findFirst({
          where: {
            name: { contains: item.description, mode: 'insensitive' }
          }
        });
        
        if (matchedProduct) {
          matchMethod = 'DESCRIPTION_EXACT';
        } else if (words.length > 0) {
          const queryWords = words.slice(0, 2).join(' ');
          matchedProduct = await prisma.product.findFirst({
            where: {
              name: { contains: queryWords, mode: 'insensitive' }
            }
          });
          if (matchedProduct) {
            matchMethod = 'DESCRIPTION_PARTIAL';
          }
        }
      }

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
    console.error('Error in processLocalFile:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
}
