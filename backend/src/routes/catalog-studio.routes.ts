import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  downloadMagazinePdf,
  downloadResumenPdf,
  getCatalogStudio,
  patchCatalogProduct,
  saveCatalogStudioState,
} from '../controllers/catalog-studio.controller';
import {
  patchCatalogProductSchema,
  updateCatalogStudioStateSchema,
} from '../validators/catalog-studio.validator';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole([Role.ADMIN, Role.FACTURACION]));

router.get('/', getCatalogStudio);
router.put('/state', validateRequest(updateCatalogStudioStateSchema), saveCatalogStudioState);
router.patch('/products/:id', validateRequest(patchCatalogProductSchema), patchCatalogProduct);
router.get('/pdf/magazine', downloadMagazinePdf);
router.get('/pdf/resumen', downloadResumenPdf);

export default router;
