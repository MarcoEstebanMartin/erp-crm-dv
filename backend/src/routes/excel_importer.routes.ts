import { Router } from 'express';
import { Role } from '@prisma/client';
import { previewExcel, commitExcel } from '../controllers/excel_importer.controller';
import { uploadExcelFile } from '../middlewares/upload';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole([Role.ADMIN]));

// Endpoint de pre-inspección ("Dry-Run") de Excel
router.post('/preview', uploadExcelFile, previewExcel);

// Endpoint de confirmación e importación transaccional
router.post('/commit', commitExcel);

export default router;
