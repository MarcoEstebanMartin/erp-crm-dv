import { Request, Response } from 'express';
import AppError from '../utils/AppError';
import { CatalogStudioService } from '../services/catalog/catalog-studio.service';

function handleCatalogStudioError(res: Response, error: unknown, fallbackMessage: string): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error(fallbackMessage, error);
  res.status(500).json({ error: fallbackMessage });
}

export const getCatalogStudio = async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await CatalogStudioService.getStudioData();
    res.json({ status: 'success', data });
  } catch (error) {
    handleCatalogStudioError(res, error, 'Error al cargar Catalog Studio');
  }
};

export const saveCatalogStudioState = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id as number | undefined;
    const state = await CatalogStudioService.saveStudioState(req.body, userId);
    res.json({ status: 'success', data: { state } });
  } catch (error) {
    handleCatalogStudioError(res, error, 'Error al guardar la configuración del catálogo');
  }
};

export const patchCatalogProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await CatalogStudioService.updateProductCatalogFields(
      Number(req.params.id),
      req.body,
    );
    res.json({ status: 'success', data: { product } });
  } catch (error) {
    handleCatalogStudioError(res, error, 'Error al actualizar el producto en el catálogo');
  }
};

export const downloadMagazinePdf = async (_req: Request, res: Response): Promise<void> => {
  try {
    const { buffer, filename } = await CatalogStudioService.generateMagazinePdf();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (error) {
    handleCatalogStudioError(res, error, 'Error al generar el PDF del catálogo');
  }
};

export const downloadResumenPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const onlyOferton = String(req.query.onlyOferton || '').toLowerCase() === 'true';
    const { buffer, filename } = await CatalogStudioService.generateResumenPdf(onlyOferton);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (error) {
    handleCatalogStudioError(res, error, 'Error al generar el PDF resumen de ofertas');
  }
};
