import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import {
  getWebOrderPollerStatus,
  runWebOrderSyncExclusive,
} from '../services/orders/web-order-poller.service';

const manualSyncBodySchema = z
  .object({
    dryRun: z.boolean().optional(),
    includeHistoricalTests: z.boolean().optional(),
  })
  .optional();

export async function getWebOrderSyncStatusHandler(
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  res.status(200).json({
    status: 'success',
    data: getWebOrderPollerStatus(),
  });
}

export async function triggerWebOrderSyncHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const parsed = manualSyncBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: 'error',
      message: 'Parámetros inválidos para sincronización web.',
    });
    return;
  }

  try {
    const report = await runWebOrderSyncExclusive({
      dryRun: Boolean(parsed.data?.dryRun),
      includeHistoricalTests: Boolean(parsed.data?.includeHistoricalTests),
    });

    res.status(200).json({
      status: 'success',
      data: report,
    });
  } catch (err: any) {
    res.status(502).json({
      status: 'error',
      message: err?.message || 'Error al sincronizar pedidos Web/WhatsApp.',
    });
  }
}
