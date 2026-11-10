import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getCreditNotes,
  createCreditNote,
  getCreditNoteById,
  approveCreditNote,
  rejectCreditNote,
} from '../controllers/creditNote.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createCreditNoteSchema,
  creditNoteIdParamSchema,
} from '../validators/creditNote.validator';

const router = Router();

router.use(authenticateJWT);

router.get('/:id', validateRequest(creditNoteIdParamSchema), getCreditNoteById);
router.post(
  '/:id/approve',
  requireRole([Role.ADMIN]),
  validateRequest(creditNoteIdParamSchema),
  idempotencyGuard,
  approveCreditNote,
);
router.post(
  '/:id/reject',
  requireRole([Role.ADMIN]),
  validateRequest(creditNoteIdParamSchema),
  idempotencyGuard,
  rejectCreditNote,
);

router.get('/', requireRole([Role.ADMIN, Role.FACTURACION]), getCreditNotes);
router.post(
  '/',
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(createCreditNoteSchema),
  idempotencyGuard,
  createCreditNote,
);

export default router;
