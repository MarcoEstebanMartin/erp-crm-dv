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
  const { personaId, invoiceNumber, invoiceType, issueDate, dueDate, netAmount, taxAmount, percepcionAmount, totalAmount } = req.body;
  const userId = req.user?.id;

  if (!personaId || !invoiceNumber || !invoiceType || !issueDate || netAmount === undefined || taxAmount === undefined || totalAmount === undefined) {
    res.status(400).json({
      status: 'error',
      message: 'Todos los campos básicos son obligatorios.',
    });
    return;
  }

  try {
    const resolvedDueDate = dueDate ? new Date(dueDate) : new Date(new Date(issueDate).getTime() + 30 * 24 * 3600 * 1000);

    const invoice = await prisma.$transaction(async (tx) => {
      // 1. Crear la factura de compra
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
          percepcionAmount: Number(percepcionAmount || 0),
          totalAmount: Number(totalAmount),
        },
      });

      // 2. Incrementar saldo a pagar en Cuenta Corriente del Proveedor (saldo neto negativo)
      // En nuestro modelo: saldo negativo es a favor del proveedor (deuda nuestra con ellos)
      // Al comprar, debemos restarle al saldo (ej: si era 0, pasa a -totalAmount)
      await tx.persona.update({
        where: { id: Number(personaId) },
        data: {
          outstandingBalance: {
            decrement: Number(totalAmount),
          },
        },
      });

      // 3. Si tiene percepciones de IIBB/IVA cargadas, registrarlas en TaxWithholding
      if (Number(percepcionAmount) > 0) {
        const prov = await tx.persona.findUnique({ where: { id: Number(personaId) } });
        await tx.taxWithholding.create({
          data: {
            type: 'PERCEPCION_SUFRIDA',
            taxType: 'IIBB',
            personaId: Number(personaId),
            number: invoiceNumber,
            date: new Date(issueDate),
            amount: Number(percepcionAmount),
            jurisdiction: prov?.address?.includes('CABA') ? 'AR-C' : 'AR-B', // Inferir jurisdicción
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
