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
} from '../controllers/order.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';
import { validateRequest } from '../middlewares/validateRequest';
import { createOrderSchema, updateOrderStatusSchema, invoiceOrderSchema } from '../validators/order.validator';

const router = Router();

// Rutas accesibles por cualquier usuario autenticado para ver su flujo
router.get('/', authenticateJWT, getOrders);
router.get('/:id', authenticateJWT, getOrderById);

// Crear, facturar y cobrar un pedido directo (ADMIN y FACTURACION)
router.post('/direct', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), createDirectInvoice);

// Carga de pedidos (Solo ADMIN y VENDEDOR)
router.post('/', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), validateRequest(createOrderSchema), createOrder);

// Editar pedido PENDING (Solo ADMIN y VENDEDOR)
router.put('/:id', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), validateRequest(createOrderSchema), updateOrder);

// Actualización de estado del pedido (Picking - ADMIN y DEPOSITO)
router.put('/:id/status', authenticateJWT, requireRole([Role.ADMIN, Role.DEPOSITO]), validateRequest(updateOrderStatusSchema), updateOrderStatus);

// Facturar y cobrar pedido preparado (ADMIN y FACTURACION)
router.post('/:id/invoice', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), validateRequest(invoiceOrderSchema), invoiceOrder);

// Actualizar pesos de productos pesables (ADMIN, FACTURACION, DEPOSITO)
router.put('/:id/weights', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO]), updateOrderWeights);

export default router;
