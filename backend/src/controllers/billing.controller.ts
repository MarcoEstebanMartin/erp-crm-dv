import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { logAudit } from '../utils/audit';

/**
 * Obtener comprobantes de venta (Pedidos facturados y entregados)
 */
export async function getSalesInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { startDate, endDate, query } = req.query;

  try {
    const whereClause: any = {
      status: 'DELIVERED',
      invoiceNumber: { not: null },
    };

    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(String(startDate)),
        lte: new Date(String(endDate)),
      };
    }

    if (query) {
      whereClause.OR = [
        { invoiceNumber: { contains: String(query), mode: 'insensitive' } },
        { persona: { name: { contains: String(query), mode: 'insensitive' } } },
        { persona: { cuit: { contains: String(query) } } },
      ];
    }

    const invoices = await prisma.order.findMany({
      where: whereClause,
      include: {
        persona: true,
        seller: true,
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: { invoices },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener los comprobantes de venta.',
    });
  }
}

/**
 * Obtener comprobantes de compra (Facturas de proveedores)
 */
export async function getSupplierInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { startDate, endDate, query } = req.query;

  try {
    const whereClause: any = {};

    if (startDate && endDate) {
      whereClause.issueDate = {
        gte: new Date(String(startDate)),
        lte: new Date(String(endDate)),
      };
    }

    if (query) {
      whereClause.OR = [
        { invoiceNumber: { contains: String(query), mode: 'insensitive' } },
        { persona: { name: { contains: String(query), mode: 'insensitive' } } },
        { persona: { cuit: { contains: String(query) } } },
      ];
    }

    const invoices = await prisma.supplierInvoice.findMany({
      where: whereClause,
      include: {
        persona: true,
      },
      orderBy: { issueDate: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: { invoices },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener los comprobantes de compra.',
    });
  }
}

/**
 * Registrar un nuevo comprobante de compra (Factura de Proveedor)
 */
export async function createSupplierInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { personaId, invoiceNumber, invoiceType, issueDate, dueDate, netAmount, taxAmount, percepcionAmount, percepcionPampa, percepcionBsAs, percepcionIva, impuestosInternos, totalAmount, billingType } = req.body;
  const userId = req.user?.id;

  if (!personaId || !invoiceNumber || !invoiceType || !issueDate || netAmount === undefined || taxAmount === undefined || totalAmount === undefined) {
    res.status(400).json({
      status: 'error',
      message: 'Todos los campos básicos son obligatorios.',
    });
    return;
  }

  try {
    // 1. Verificar si el número de factura ya existe para este proveedor (evitar duplicados)
    const existingInvoice = await prisma.supplierInvoice.findFirst({
      where: {
        personaId: Number(personaId),
        invoiceNumber,
      },
    });

    if (existingInvoice) {
      res.status(400).json({
        status: 'error',
        message: `La factura Nro ${invoiceNumber} ya se encuentra registrada para este proveedor.`,
      });
      return;
    }

    const resolvedDueDate = dueDate ? new Date(dueDate) : new Date(new Date(issueDate).getTime() + 30 * 24 * 3600 * 1000);

    const pampa = Number(percepcionPampa || 0);
    const bsas = Number(percepcionBsAs || 0);
    const ivaVal = Number(percepcionIva || 0);
    const internos = Number(impuestosInternos || 0);

    // Suma de IIBB es La Pampa + Bs As (o cae a percepcionAmount genérica)
    const finalIIBB = (pampa > 0 || bsas > 0) ? (pampa + bsas) : Number(percepcionAmount || 0);

    const invoice = await prisma.$transaction(async (tx) => {
      // 2. Crear la factura de compra
      const inv = await tx.supplierInvoice.create({
        data: {
          personaId: Number(personaId),
          invoiceNumber,
          invoiceType,
          issueDate: new Date(issueDate),
          dueDate: resolvedDueDate,
          status: 'PENDING',
          paidAmount: 0.00,
          netAmount: Number(netAmount),
          taxAmount: Number(taxAmount),
          percepcionAmount: finalIIBB,
          percepcionIvaAmount: ivaVal,
          impuestosInternos: internos,
          totalAmount: Number(totalAmount),
          billingType: billingType || 'OFFICIAL',
        },
      });

      // 3. Incrementar saldo a pagar en Cuenta Corriente del Proveedor (saldo neto negativo)
      await tx.persona.update({
        where: { id: Number(personaId) },
        data: {
          outstandingBalance: {
            decrement: Number(totalAmount),
          },
        },
      });

      // 4. Registrar certificaciones de retenciones/percepciones específicas si existen
      // La Pampa IIBB
      if (pampa > 0) {
        await tx.taxWithholding.create({
          data: {
            type: 'PERCEPCION_SUFRIDA',
            taxType: 'IIBB',
            personaId: Number(personaId),
            number: invoiceNumber,
            date: new Date(issueDate),
            amount: pampa,
            jurisdiction: 'AR-L',
          },
        });
      }

      // Bs As IIBB
      if (bsas > 0) {
        await tx.taxWithholding.create({
          data: {
            type: 'PERCEPCION_SUFRIDA',
            taxType: 'IIBB',
            personaId: Number(personaId),
            number: invoiceNumber,
            date: new Date(issueDate),
            amount: bsas,
            jurisdiction: 'AR-B',
          },
        });
      }

      // Genérica IIBB si no se enviaron separadas pero existe percepcionAmount
      if (pampa === 0 && bsas === 0 && finalIIBB > 0) {
        await tx.taxWithholding.create({
          data: {
            type: 'PERCEPCION_SUFRIDA',
            taxType: 'IIBB',
            personaId: Number(personaId),
            number: invoiceNumber,
            date: new Date(issueDate),
            amount: finalIIBB,
            jurisdiction: 'AR-B',
          },
        });
      }

      // IVA Percepcion RG 5329
      if (ivaVal > 0) {
        await tx.taxWithholding.create({
          data: {
            type: 'PERCEPCION_SUFRIDA',
            taxType: 'IVA',
            personaId: Number(personaId),
            number: invoiceNumber,
            date: new Date(issueDate),
            amount: ivaVal,
            jurisdiction: null,
          },
        });
      }

      return inv;
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'CREATE_SUPPLIER_INVOICE',
        entityType: 'SupplierInvoice',
        entityId: invoice.id,
        newValues: invoice,
      });
    }

    res.status(201).json({
      status: 'success',
      data: { invoice },
    });
  } catch (error: any) {
    console.error('Error al crear factura de compra:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al guardar el comprobante de compra.',
    });
  }
}

/**
 * Obtener percepciones y retenciones (TaxWithholding)
 */
export async function getTaxWithholdings(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { type, taxType, startDate, endDate } = req.query;

  try {
    const whereClause: any = {};

    if (type) whereClause.type = String(type);
    if (taxType) whereClause.taxType = String(taxType);

    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(String(startDate)),
        lte: new Date(String(endDate)),
      };
    }

    const withholdings = await prisma.taxWithholding.findMany({
      where: whereClause,
      include: {
        persona: true,
      },
      orderBy: { date: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: { withholdings },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener registros impositivos.',
    });
  }
}

/**
 * Registrar una nueva percepción o retención manual
 */
export async function createTaxWithholding(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { type, taxType, personaId, number, date, amount, jurisdiction } = req.body;
  const userId = req.user?.id;

  if (!type || !taxType || !personaId || !number || !date || amount === undefined) {
    res.status(400).json({
      status: 'error',
      message: 'Todos los campos son requeridos.',
    });
    return;
  }

  try {
    const withholding = await prisma.$transaction(async (tx) => {
      const record = await tx.taxWithholding.create({
        data: {
          type,
          taxType,
          personaId: Number(personaId),
          number,
          date: new Date(date),
          amount: Number(amount),
          jurisdiction: jurisdiction || null,
        },
      });

      // Modificar cuenta corriente si es una retención sufrida del cliente
      if (type === 'RETENCION_SUFRIDA') {
        // Un cliente nos pagó reteniendo impuestos. Es equivalente a recibir un cobro.
        // Resta al saldo deudor (outstandingBalance decrece)
        await tx.persona.update({
          where: { id: Number(personaId) },
          data: {
            outstandingBalance: {
              decrement: Number(amount),
            },
          },
        });
      } else if (type === 'RETENCION_PRACTICADA') {
        // Nosotros le retuvimos al proveedor al pagarle. Cuenta como pago emitido.
        // Aumenta el saldo deudor del proveedor ( outstandingBalance incrementa hacia 0 )
        await tx.persona.update({
          where: { id: Number(personaId) },
          data: {
            outstandingBalance: {
              increment: Number(amount),
            },
          },
        });
      }

      return record;
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'CREATE_TAX_WITHHOLDING',
        entityType: 'TaxWithholding',
        entityId: withholding.id,
        newValues: withholding,
      });
    }

    res.status(201).json({
      status: 'success',
      data: { withholding },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al registrar el movimiento impositivo.',
    });
  }
}

/**
 * Eliminar / Anular una factura de compra y revertir su impacto
 */
export async function deleteSupplierInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;

  try {
    const invoiceId = Number(id);
    
    // 1. Obtener la factura
    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id: invoiceId },
      include: { persona: true }
    });

    if (!invoice) {
      res.status(404).json({
        status: 'error',
        message: 'Factura de compra no encontrada.',
      });
      return;
    }

    // 2. Si ya tiene pagos aplicados (no está PENDING o paidAmount > 0), bloquear
    if (invoice.status !== 'PENDING' || Number(invoice.paidAmount) > 0) {
      res.status(400).json({
        status: 'error',
        message: 'No se puede eliminar una factura que ya ha sido saldada o pagada parcialmente. Anule los pagos asociados primero.',
      });
      return;
    }

    // 3. Ejecutar transacción de eliminación
    await prisma.$transaction(async (tx) => {
      // Revertir Cuenta Corriente del Proveedor
      // Sumamos al balance del proveedor (restando la deuda que le habíamos restado)
      await tx.persona.update({
        where: { id: invoice.personaId },
        data: {
          outstandingBalance: {
            increment: Number(invoice.totalAmount)
          }
        }
      });

      // Revertir Movimientos de Stock y Lotes si existen
      const refId = `INV-${invoiceId}`;
      const stockMovements = await tx.stockMovement.findMany({
        where: { referenceId: refId }
      });

      for (const movement of stockMovements) {
        // Restar del stock general del producto
        await tx.product.update({
          where: { id: movement.productId },
          data: {
            stock: {
              decrement: movement.quantity
            }
          }
        });

        // Restar del lote correspondiente (el nro de lote coincide con el nro de factura)
        const lot = await tx.productLot.findFirst({
          where: {
            productId: movement.productId,
            lotNumber: invoice.invoiceNumber
          }
        });

        if (lot) {
          await tx.productLot.update({
            where: { id: lot.id },
            data: {
              stock: {
                decrement: movement.quantity
              }
            }
          });
        }

        // Eliminar movimiento de stock
        await tx.stockMovement.delete({
          where: { id: movement.id }
        });
      }

      // Borrar las retenciones/percepciones fiscales asociadas al comprobante y proveedor
      await tx.taxWithholding.deleteMany({
        where: {
          personaId: invoice.personaId,
          number: invoice.invoiceNumber,
          type: 'PERCEPCION_SUFRIDA'
        }
      });

      // Borrar la factura de compra de la base de datos
      await tx.supplierInvoice.delete({
        where: { id: invoiceId }
      });
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'DELETE_SUPPLIER_INVOICE',
        entityType: 'SupplierInvoice',
        entityId: invoiceId,
        oldValues: invoice,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Factura de compra eliminada/anulada con éxito. El saldo de cuenta corriente y retenciones fueron revertidos.'
    });
  } catch (error: any) {
    console.error('Error al eliminar factura de compra:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al eliminar el comprobante de compra.'
    });
  }
}
