import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { productionCatalogSyncService } from '../services/catalog/production-catalog-sync.service';
import { productionOutboundBridgeService } from '../services/catalog/production-outbound-bridge.service';

/**
 * Estado operativo en vivo del Puente Unificado ERP <-> Producción (donvenancio.com.ar).
 */
export async function getCatalogBridgeStatus(
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  res.status(200).json({
    status: 'success',
    data: productionOutboundBridgeService.getBridgeStats(),
  });
}

/**
 * Dispara bajo demanda (Solo ADMIN) una nivelación desde Producción hacia el ERP.
 */
export async function pullCatalogFromProduction(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const dryRun = Boolean(req.body?.dryRun);
    const report = await productionCatalogSyncService.syncFromProduction({
      dryRun,
      userId: req.user?.id,
    });
    res.status(200).json({ status: 'success', data: { report } });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error?.message || 'Error al sincronizar el catálogo desde Producción.',
    });
  }
}
