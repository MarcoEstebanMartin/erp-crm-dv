import { Router } from 'express';
import { Role } from '@prisma/client';
import { ivaExportController } from '../controllers/ivaExport.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();

// Exportación fiscal de Libro IVA restringida estrictamente a Administración y Facturación
router.get(
  '/export',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  ivaExportController.getExportData,
);

export default router;
