import { Router } from 'express';
import multer from 'multer';
import { getPurchaseOrders, createPurchaseOrder, receivePurchaseOrder, uploadDocument, confirmDocument, listLocalFiles, processLocalFile } from '../controllers/purchase.controller';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Todas las rutas requieren token activo
router.use(authenticateJWT);

router.get('/', getPurchaseOrders);
router.post('/', createPurchaseOrder);
router.post('/:id/receive', receivePurchaseOrder);

// IA OCR endpoints
router.get('/local-files', listLocalFiles);
router.post('/process-local-file', processLocalFile);
router.post('/upload-document', upload.single('file'), uploadDocument);
router.post('/confirm-document', confirmDocument);

export default router;
