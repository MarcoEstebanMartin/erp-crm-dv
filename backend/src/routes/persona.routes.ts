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
  recordVisit,
  deletePersona,
} from '../controllers/persona.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createPersonaSchema,
  updatePersonaSchema,
  recordPersonaPaymentSchema,
  recordVisitSchema,
} from '../validators/persona.validator';

const router = Router();

// Rutas accesibles por cualquier usuario autenticado (Vendedor, Depósito, Admin)
router.get('/', authenticateJWT, getPersonas);
router.get('/debtors-report', authenticateJWT, getDebtorsReport);
router.get('/sellers', authenticateJWT, getSellers);
router.get('/afip/:cuit', authenticateJWT, getAfipData);
router.get('/:id', authenticateJWT, getPersonaById);
router.get('/:id/ledger', authenticateJWT, getPersonaLedger);
router.get('/:id/pending-invoices', authenticateJWT, getPersonaPendingInvoices);


// Rutas de creación, edición y cobros (Solo ADMIN y VENDEDOR)
router.post('/', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), validateRequest(createPersonaSchema), createPersona);
router.put('/:id', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), validateRequest(updatePersonaSchema), updatePersona);
router.post('/:id/payments', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), validateRequest(recordPersonaPaymentSchema), recordPersonaPayment);
router.post('/:id/visit', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), validateRequest(recordVisitSchema), recordVisit);
router.delete('/:id', authenticateJWT, requireRole([Role.ADMIN]), deletePersona);

export default router;
