import { Request, Response } from 'express';
import { ivaExportService } from '../services/ivaExport.service';

export const ivaExportController = {
  async getExportData(req: Request, res: Response) {
    try {
      const { month, year } = req.query;
      if (!month || !year) {
        return res.status(400).json({ status: 'error', message: 'Month and year are required' });
      }

      const m = parseInt(month as string, 10);
      const y = parseInt(year as string, 10);

      const data = await ivaExportService.generateAFIPTxt(m, y);

      return res.status(200).json({
        status: 'success',
        data
      });
    } catch (error: any) {
      console.error('Error in iva export:', error);
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }
};
