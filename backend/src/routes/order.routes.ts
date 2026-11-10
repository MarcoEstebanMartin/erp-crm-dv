import { Router } from 'express';
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  invoiceOrder,
  updateOrder,
  createDirectInvoice,
  updateOrderWeights,
  confirmArmado,
  requestCaeForOrder,
} from '../controllers/order.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { Role } from '@prisma/client';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createOrderSchema,
  updateOrderStatusSchema,
  invoiceOrderSchema,
  updateOrderSchema,
  createDirectInvoiceSchema,
  updateOrderWeightsSchema,
  confirmArmadoSchema,
} from '../validators/order.validator';

const router = Router();

// Rutas accesibles por cualquier usuario autenticado para ver su flujo
router.get('/', authenticateJWT, getOrders);
router.get('/:id', authenticateJWT, getOrderById);

// Crear, facturar y cobrar un pedido directo (ADMIN y FACTURACION)
router.post('/direct', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), validateRequest(createDirectInvoiceSchema), idempotencyGuard, createDirectInvoice);

// Carga de pedidos (Solo ADMIN y VENDEDOR)
router.post('/', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), validateRequest(createOrderSchema), idempotencyGuard, createOrder);

// Editar pedido PENDING (Solo ADMIN y VENDEDOR)
router.put('/:id', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), validateRequest(updateOrderSchema), updateOrder);

// Actualización de estado del pedido (Picking - ADMIN y DEPOSITO)
router.put('/:id/status', authenticateJWT, requireRole([Role.ADMIN, Role.DEPOSITO]), validateRequest(updateOrderStatusSchema), updateOrderStatus);

// Facturar y cobrar pedido preparado (ADMIN y FACTURACION)
router.post('/:id/invoice', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), validateRequest(invoiceOrderSchema), idempotencyGuard, invoiceOrder);

// Solicitar CAE a AFIP para pre-factura oficial
router.post('/:id/request-cae', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), idempotencyGuard, requestCaeForOrder);

// Actualizar pesos de productos pesables (ADMIN, FACTURACION, DEPOSITO)
router.put('/:id/weights', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO]), validateRequest(updateOrderWeightsSchema), updateOrderWeights);

// Confirmación rápida de armado (Data Entry de Alta Eficiencia)
router.post('/:id/confirm-armado', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO]), validateRequest(confirmArmadoSchema), idempotencyGuard, confirmArmado);

export default router;
