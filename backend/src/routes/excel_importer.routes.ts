import { Router } from 'express';
import { previewExcel, commitExcel } from '../controllers/excel_importer.controller';
import { uploadExcelFile } from '../middlewares/upload';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

// Endpoint de pre-inspección ("Dry-Run") de Excel
router.post('/preview', authenticateJWT, uploadExcelFile, previewExcel);

// Endpoint de confirmación e importación transaccional
router.post('/commit', authenticateJWT, commitExcel);


export default router;
