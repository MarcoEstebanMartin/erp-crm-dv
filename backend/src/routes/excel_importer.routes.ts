import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  previewExcel,
  commitExcel,
  downloadStockInicialTemplate,
} from '../controllers/excel_importer.controller';
import { uploadExcelFile } from '../middlewares/upload';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole([Role.ADMIN]));

// Descarga de plantilla Excel con hoja de Slots WMS válidos
router.get('/template/stock-inicial', downloadStockInicialTemplate);

// Endpoint de pre-inspección ("Dry-Run") de Excel
router.post('/preview', uploadExcelFile, previewExcel);

// Endpoint de confirmación e importación transaccional
router.post('/commit', idempotencyGuard, commitExcel);

export default router;
