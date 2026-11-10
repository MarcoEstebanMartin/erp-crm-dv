import { Request, Response } from 'express';
import { StoreAuthenticatedRequest } from '../middlewares/storeAuth.middleware';
import { StoreAuthService, generateMagicToken } from '../services/store/store-auth.service';
import { StoreMagicLoginService } from '../services/store/store-magic.service';
import { StoreCatalogService } from '../services/store/store-catalog.service';
import { StoreOrderService } from '../services/store/store-order.service';

export { generateMagicToken };

export async function loginClient(req: Request, res: Response): Promise<void> {
  try {
    const result = await StoreAuthService.authenticateClient(req.body || {});
    res.status(result.httpStatus).json(result.payload);
  } catch (error) {
    console.error('⚠️ Error en loginClient:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al iniciar sesión de cliente en la tienda.',
    });
  }
}

export async function magicLoginClient(req: Request, res: Response): Promise<void> {
  try {
    const rawToken = (req.query.token ||
      req.body?.token ||
      req.query.magicToken ||
      req.body?.magicToken) as string | undefined;
    const draftId = req.query.draftId || req.body?.draftId;
    const result = await StoreMagicLoginService.exchangeMagicToken(rawToken, draftId);
    res.status(result.httpStatus).json(result.payload);
  } catch (error) {
    console.error('⚠️ Error en magicLoginClient:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno al autenticar por enlace directo.',
    });
  }
}

export async function getStoreCatalog(req: Request, res: Response): Promise<void> {
  try {
    const payload = await StoreCatalogService.buildCatalog({
      priceList: req.query.priceList ? String(req.query.priceList) : 'A',
      rubroId: req.query.rubroId ? Number(req.query.rubroId) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
    });
    res.status(200).json(payload);
  } catch (error) {
    console.error('⚠️ Error en getStoreCatalog:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener catálogo de productos.',
    });
  }
}

export async function getClientAccount(
  req: StoreAuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const personaId = req.storeClient?.personaId ?? Number(req.params.personaId);
    if (!personaId) {
      res.status(400).json({ status: 'error', message: 'Se requiere personaId.' });
      return;
    }

    const account = await StoreOrderService.getClientAccountSummary(personaId);
    if (!account) {
      res.status(404).json({ status: 'error', message: 'Cliente no encontrado.' });
      return;
    }

    res.status(200).json({ status: 'success', data: account });
  } catch (error) {
    console.error('⚠️ Error en getClientAccount:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener estado de cuenta del cliente.',
    });
  }
}

export async function createStoreOrder(
  req: StoreAuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const personaId = req.storeClient?.personaId ?? Number(req.body.personaId);
    const newOrder = await StoreOrderService.createStoreOrder({
      personaId,
      items: req.body.items,
      notes: req.body.notes,
    });

    res.status(201).json({
      status: 'success',
      message: '¡Pedido enviado con éxito! Un representante procesará tu solicitud.',
      data: newOrder,
    });
  } catch (error: any) {
    console.error('⚠️ Error en createStoreOrder:', error);
    const statusCode = error?.statusCode || 400;
    res.status(statusCode).json({
      status: 'error',
      message: error?.message || 'Error al procesar el pedido de la tienda online.',
    });
  }
}

export async function getClientOrders(
  req: StoreAuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const personaId = req.storeClient?.personaId ?? Number(req.params.personaId);
    if (!personaId) {
      res.status(400).json({ status: 'error', message: 'Se requiere personaId.' });
      return;
    }

    const orders = await StoreOrderService.getClientOrdersHistory(personaId);
    res.status(200).json({ status: 'success', data: { orders } });
  } catch (error) {
    console.error('⚠️ Error en getClientOrders:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener historial de pedidos.',
    });
  }
}
