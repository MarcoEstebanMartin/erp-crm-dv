import { Router } from 'express';
import {
  getPersonas,
  getPersonaById,
  createPersona,
  updatePersona,
  recordPersonaPayment,
  getPersonaLedger,
  getAfipData,
  getPersonaPendingInvoices,
  getDebtorsReport,
  getSellers,
  getSellerProfileStats,
  recordVisit,
  deletePersona,
} from '../controllers/persona.controller';
import {
  getPersonaNotes,
  createPersonaNote,
  togglePinPersonaNote,
  deletePersonaNote,
  updatePersonaTrustTags,
} from '../controllers/persona-notes.controller';
import { authenticateJWT, requireRole, requireRoleOrPermission } from '../middlewares/auth';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { Role } from '@prisma/client';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createPersonaSchema,
  updatePersonaSchema,
  recordPersonaPaymentSchema,
  recordVisitSchema,
  updateTrustTagsSchema,
  createPersonaNoteSchema,
  personaNoteParamsSchema,
} from '../validators/persona.validator';

const router = Router();

// Rutas accesibles por cualquier usuario autenticado (Vendedor, Depósito, Admin)
router.get('/', authenticateJWT, getPersonas);
router.get(
  '/debtors-report',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR]),
  getDebtorsReport,
);
router.get('/sellers', authenticateJWT, getSellers);
router.get('/sellers/:id/profile', authenticateJWT, getSellerProfileStats);
router.get('/afip/:cuit', authenticateJWT, getAfipData);
router.get('/:id', authenticateJWT, getPersonaById);
router.get('/:id/ledger', authenticateJWT, requireRoleOrPermission([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR], 'canDeliver'), getPersonaLedger);
router.get('/:id/pending-invoices', authenticateJWT, requireRoleOrPermission([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR], 'canDeliver'), getPersonaPendingInvoices);


// Rutas de creación, edición y cobros (ADMIN, FACTURACION y VENDEDOR)
router.post('/', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR]), validateRequest(createPersonaSchema), createPersona);
router.put('/:id', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR]), validateRequest(updatePersonaSchema), updatePersona);
router.post('/:id/payments', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR]), validateRequest(recordPersonaPaymentSchema), idempotencyGuard, recordPersonaPayment);
router.post('/:id/visit', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), validateRequest(recordVisitSchema), recordVisit);
router.delete('/:id', authenticateJWT, requireRole([Role.ADMIN]), deletePersona);

// Etiquetas fijas de confianza y bitácora interna (exclusivo ADMIN y FACTURACION)
router.patch(
  '/:id/trust-tags',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(updateTrustTagsSchema),
  updatePersonaTrustTags,
);
router.get(
  '/:id/notes',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  getPersonaNotes,
);
router.post(
  '/:id/notes',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(createPersonaNoteSchema),
  createPersonaNote,
);
router.patch(
  '/:id/notes/:noteId/pin',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(personaNoteParamsSchema),
  togglePinPersonaNote,
);
router.delete(
  '/:id/notes/:noteId',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(personaNoteParamsSchema),
  deletePersonaNote,
);

export default router;
