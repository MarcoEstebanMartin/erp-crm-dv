import { Router } from 'express';
import {
  loginClient,
  magicLoginClient,
  getStoreCatalog,
  getClientAccount,
  createStoreOrder,
  getClientOrders
} from '../controllers/store.controller';

const router = Router();

// Autenticación / Búsqueda de Cliente
router.post('/login', loginClient);

// Autenticación Mágica sin Contraseña desde WhatsApp
router.get('/magic-login', magicLoginClient);
router.post('/magic-login', magicLoginClient);

// Catálogo interactivo de productos y ofertas
router.get('/catalog', getStoreCatalog);

// Resumen de Cuenta Corriente del cliente
router.get('/account/:personaId', getClientAccount);

// Envío de Pedido desde la Tienda Online
router.post('/orders', createStoreOrder);

// Historial de pedidos del cliente
router.get('/orders/:personaId', getClientOrders);

export default router;
