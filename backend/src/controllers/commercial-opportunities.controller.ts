import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { getCommercialOpportunitiesReport } from '../services/admin/commercial-opportunities.service';

export async function getCommercialOpportunities(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { stagnantDays, expiringDays } = req.query;
  try {
    const report = await getCommercialOpportunitiesReport({
      stagnantDays:
        typeof stagnantDays === 'string' && stagnantDays.trim()
          ? Number(stagnantDays)
          : undefined,
      expiringDays:
        typeof expiringDays === 'string' && expiringDays.trim()
          ? Number(expiringDays)
          : undefined,
    });
    res.status(200).json({ status: 'success', data: { report } });
  } catch (error: any) {
    console.error('Error al calcular oportunidades comerciales:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al calcular las oportunidades comerciales.',
    });
  }
}
