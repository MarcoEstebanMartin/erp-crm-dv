import { Router } from 'express';
import {
  getOrders,
  getOrdersSummary,
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
import {
  getWebOrderSyncStatusHandler,
  triggerWebOrderSyncHandler,
} from '../controllers/web-order-sync.controller';
import {
  bulkUpdateOrdersDeliveryHandler,
  updateOrderDeliveryHandler,
} from '../controllers/order-delivery.controller';
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
  updateOrderDeliverySchema,
  bulkUpdateOrdersDeliverySchema,
} from '../validators/order.validator';

const router = Router();

// Puente unificado Web/WhatsApp (chatbot-dv -> erp-dv) — debe declararse antes de '/:id'
router.get(
  '/sync-web/status',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR, Role.DEPOSITO]),
  getWebOrderSyncStatusHandler,
);
router.post(
  '/sync-web',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR, Role.DEPOSITO]),
  idempotencyGuard,
  triggerWebOrderSyncHandler,
);

// Rutas accesibles por cualquier usuario autenticado para ver su flujo
router.get('/summary', authenticateJWT, getOrdersSummary);
router.post(
  '/bulk-delivery',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO]),
  validateRequest(bulkUpdateOrdersDeliverySchema),
  idempotencyGuard,
  bulkUpdateOrdersDeliveryHandler,
);
router.get('/', authenticateJWT, getOrders);
router.get('/:id', authenticateJWT, getOrderById);

// Crear, facturar y cobrar un pedido directo (ADMIN y FACTURACION)
router.post('/direct', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), validateRequest(createDirectInvoiceSchema), idempotencyGuard, createDirectInvoice);

// Carga de pedidos (ADMIN, FACTURACION y VENDEDOR)
router.post('/', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR]), validateRequest(createOrderSchema), idempotencyGuard, createOrder);

// Editar pedido PENDING (ADMIN, FACTURACION y VENDEDOR)
router.put('/:id', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR]), validateRequest(updateOrderSchema), updateOrder);

// Actualización de estado del pedido (Picking - ADMIN, FACTURACION y DEPOSITO)
router.put('/:id/status', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO]), validateRequest(updateOrderStatusSchema), updateOrderStatus);

// Designación de entrega (Viaje específico o Retiro en local)
router.patch(
  '/:id/delivery',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO, Role.VENDEDOR]),
  validateRequest(updateOrderDeliverySchema),
  idempotencyGuard,
  updateOrderDeliveryHandler,
);

// Facturar y cobrar pedido preparado (ADMIN y FACTURACION)
router.post('/:id/invoice', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), validateRequest(invoiceOrderSchema), idempotencyGuard, invoiceOrder);

// Solicitar CAE a AFIP para pre-factura oficial
router.post('/:id/request-cae', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), idempotencyGuard, requestCaeForOrder);

// Actualizar pesos de productos pesables (ADMIN, FACTURACION, DEPOSITO)
router.put('/:id/weights', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO]), validateRequest(updateOrderWeightsSchema), updateOrderWeights);

// Confirmación rápida de armado (Data Entry de Alta Eficiencia)
router.post('/:id/confirm-armado', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO]), validateRequest(confirmArmadoSchema), idempotencyGuard, confirmArmado);

export default router;
