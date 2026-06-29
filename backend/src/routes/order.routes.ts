import { Router } from 'express';
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  invoiceOrder,
  updateOrder,
  createDirectInvoice,
} from '../controllers/order.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Rutas accesibles por cualquier usuario autenticado para ver su flujo
router.get('/', authenticateJWT, getOrders);
router.get('/:id', authenticateJWT, getOrderById);

// Crear, facturar y cobrar un pedido directo (ADMIN y FACTURACION)
router.post('/direct', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), createDirectInvoice);

// Carga de pedidos (Solo ADMIN y VENDEDOR)
router.post('/', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), createOrder);

// Editar pedido PENDING (Solo ADMIN y VENDEDOR)
router.put('/:id', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), updateOrder);

// Actualización de estado del pedido (Picking - ADMIN y DEPOSITO)
router.put('/:id/status', authenticateJWT, requireRole([Role.ADMIN, Role.DEPOSITO]), updateOrderStatus);

// Facturar y cobrar pedido preparado (ADMIN y FACTURACION)
router.post('/:id/invoice', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), invoiceOrder);

export default router;
