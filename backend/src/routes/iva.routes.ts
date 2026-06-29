import { Router } from 'express';
import { ivaExportController } from '../controllers/ivaExport.controller';

const router = Router();

// GET /api/iva/export
router.get('/export', ivaExportController.getExportData);

export default router;
