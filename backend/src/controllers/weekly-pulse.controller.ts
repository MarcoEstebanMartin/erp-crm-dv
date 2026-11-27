import { NextFunction, Request, Response } from 'express';
import { adminWeeklyPulseService } from '../services/admin/admin-weekly-pulse.service';
import type { SaveWeeklyPulseBody } from '../validators/weekly-pulse.validator';

export async function getWeeklyPulse(req: Request, res: Response, next: NextFunction) {
  try {
    const weekStart = typeof req.query.weekStart === 'string' ? req.query.weekStart : undefined;
    const pulse = await adminWeeklyPulseService.getWeeklyPulse(weekStart);
    res.json({ status: 'success', pulse });
  } catch (error) {
    next(error);
  }
}

export async function saveWeeklyPulse(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body as SaveWeeklyPulseBody;
    const pulse = await adminWeeklyPulseService.saveWeeklyPulse(payload);
    res.json({ status: 'success', pulse });
  } catch (error) {
    next(error);
  }
}
