import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { BillingType } from '@prisma/client';
import { appCache } from '../utils/cache';

/**
 * Obtiene todas las reglas de precios y configs de split.
 */
export async function getPricingRules(req: Request, res: Response): Promise<void> {
  try {
    const discountRules = await prisma.discountRule.findMany({
      include: {
        persona: { select: { id: true, name: true } },
        rubro: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const splitConfigs = await prisma.splitBillingConfig.findMany({
      include: {
        persona: { select: { id: true, name: true } },
        rubro: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      status: 'success',
      data: { discountRules, splitConfigs }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener las reglas de precios.'
    });
  }
}

/**
 * Crea una nueva regla de descuento.
 */
export async function createDiscountRule(req: Request, res: Response): Promise<void> {
  const { name, personaId, priceList, rubroId, productId, billingType, discount } = req.body;

  if (discount === undefined || isNaN(Number(discount)) || Number(discount) < 0 || Number(discount) > 100) {
    res.status(400).json({ status: 'error', message: 'El descuento debe ser un porcentaje válido entre 0 y 100.' });
    return;
  }

  try {
    const newRule = await prisma.discountRule.create({
      data: {
        name,
        personaId: personaId ? Number(personaId) : null,
        priceList: priceList || null,
        rubroId: rubroId ? Number(rubroId) : null,
        productId: productId ? Number(productId) : null,
        billingType: billingType ? (billingType as BillingType) : null,
        discount: Number(discount)
      }
    });

    appCache.invalidateProductCatalog();

    res.status(201).json({
      status: 'success',
      data: { rule: newRule }
    });
  } catch (error: any) {
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al crear la regla de descuento.'
    });
  }
}

/**
 * Elimina una regla de descuento.
 */
export async function deleteDiscountRule(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    await prisma.discountRule.delete({
      where: { id: Number(id) }
    });

    appCache.invalidateProductCatalog();

    res.status(200).json({
      status: 'success',
      message: 'Regla de descuento eliminada con éxito.'
    });
  } catch (error: any) {
    res.status(400).json({
      status: 'error',
      message: 'Error al eliminar la regla de descuento.'
    });
  }
}

/**
 * Crea una nueva configuración de división de facturación.
 */
export async function createSplitBillingConfig(req: Request, res: Response): Promise<void> {
  const { personaId, rubroId, percentageOfficial, percentageInternal } = req.body;

  if (!personaId || !rubroId) {
    res.status(400).json({ status: 'error', message: 'El cliente y el rubro son requeridos.' });
    return;
  }

  try {
    const config = await prisma.splitBillingConfig.create({
      data: {
        personaId: Number(personaId),
        rubroId: Number(rubroId),
        percentageOfficial: percentageOfficial !== undefined ? Number(percentageOfficial) : 50.00,
        percentageInternal: percentageInternal !== undefined ? Number(percentageInternal) : 50.00
      }
    });

    res.status(201).json({
      status: 'success',
      data: { config }
    });
  } catch (error: any) {
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al crear la configuración de división de facturación.'
    });
  }
}

/**
 * Elimina una configuración de división de facturación.
 */
export async function deleteSplitBillingConfig(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    await prisma.splitBillingConfig.delete({
      where: { id: Number(id) }
    });

    res.status(200).json({
      status: 'success',
      message: 'Configuración de división eliminada con éxito.'
    });
  } catch (error: any) {
    res.status(400).json({
      status: 'error',
      message: 'Error al eliminar la configuración de división.'
    });
  }
}
