import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import AppError from '../utils/AppError';
import { supplierInvoiceService } from '../services/billing/supplier-invoice.service';
import { taxWithholdingService } from '../services/billing/tax-withholding.service';

function handleBillingError(res: Response, error: unknown, fallbackMessage: string): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ status: 'error', message: error.message });
    return;
  }
  console.error(fallbackMessage, error);
  res.status(500).json({ status: 'error', message: fallbackMessage });
}

export async function getSalesInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const invoices = await supplierInvoiceService.getSalesInvoices(
      req.query as Record<string, string>,
    );
    res.status(200).json({ status: 'success', data: { invoices } });
  } catch (error) {
    handleBillingError(res, error, 'Error al obtener los comprobantes de venta.');
  }
}

export async function getSupplierInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const invoices = await supplierInvoiceService.getSupplierInvoices(
      req.query as Record<string, string>,
    );
    res.status(200).json({ status: 'success', data: { invoices } });
  } catch (error) {
    handleBillingError(res, error, 'Error al obtener los comprobantes de compra.');
  }
}

export async function createSupplierInvoice(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const invoice = await supplierInvoiceService.createSupplierInvoice({
      userId: req.user?.id,
      personaId: Number(req.body.personaId),
      invoiceNumber: req.body.invoiceNumber,
      invoiceType: req.body.invoiceType,
      issueDate: req.body.issueDate,
      dueDate: req.body.dueDate,
      netAmount: Number(req.body.netAmount),
      taxAmount: Number(req.body.taxAmount),
      percepcionAmount: req.body.percepcionAmount,
      percepcionPampa: req.body.percepcionPampa,
      percepcionBsAs: req.body.percepcionBsAs,
      percepcionIva: req.body.percepcionIva,
      percepcionIva5329: req.body.percepcionIva5329,
      impuestosInternos: req.body.impuestosInternos,
      totalAmount: Number(req.body.totalAmount),
      billingType: req.body.billingType,
    });
    res.status(201).json({ status: 'success', data: { invoice } });
  } catch (error) {
    handleBillingError(res, error, 'Error al guardar el comprobante de compra.');
  }
}

export async function deleteSupplierInvoice(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    await supplierInvoiceService.deleteSupplierInvoice({
      userId: req.user?.id,
      invoiceId: Number(req.params.id),
    });
    res.status(200).json({
      status: 'success',
      message:
        'Factura de compra eliminada/anulada con éxito. El saldo de cuenta corriente y retenciones fueron revertidos.',
    });
  } catch (error) {
    handleBillingError(res, error, 'Error al eliminar el comprobante de compra.');
  }
}

export async function getTaxWithholdings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const withholdings = await taxWithholdingService.getTaxWithholdings(
      req.query as Record<string, string>,
    );
    res.status(200).json({ status: 'success', data: { withholdings } });
  } catch (error) {
    handleBillingError(res, error, 'Error al obtener registros impositivos.');
  }
}

export async function createTaxWithholding(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const withholding = await taxWithholdingService.createTaxWithholding({
      userId: req.user?.id,
      type: req.body.type,
      taxType: req.body.taxType,
      personaId: Number(req.body.personaId),
      number: req.body.number,
      date: req.body.date,
      amount: Number(req.body.amount),
      jurisdiction: req.body.jurisdiction,
    });
    res.status(201).json({ status: 'success', data: { withholding } });
  } catch (error) {
    handleBillingError(res, error, 'Error al registrar el movimiento impositivo.');
  }
}
