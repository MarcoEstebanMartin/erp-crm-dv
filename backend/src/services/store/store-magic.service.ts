import jwt from 'jsonwebtoken';
import prisma from '../../utils/prisma';
import { env } from '../../config/env.config';
import { roundToTwoDecimals } from '../../core/money';
import { signStoreClientSessionToken } from './store-auth.service';

export class StoreMagicLoginService {
  static async exchangeMagicToken(rawToken?: string, draftIdQuery?: unknown) {
    if (!rawToken || typeof rawToken !== 'string') {
      return {
        httpStatus: 400,
        payload: { status: 'error', message: 'Token mágico de acceso no proporcionado.' },
      };
    }

    let decoded: any;
    try {
      decoded = jwt.verify(rawToken, env.JWT_SECRET);
    } catch {
      return {
        httpStatus: 401,
        payload: { status: 'error', message: 'El enlace de acceso ha expirado o no es válido.' },
      };
    }

    if (!decoded || decoded.type !== 'magic_login' || !decoded.personaId) {
      return {
        httpStatus: 401,
        payload: { status: 'error', message: 'Token de acceso inválido.' },
      };
    }

    const client = await prisma.persona.findUnique({
      where: { id: Number(decoded.personaId) },
      select: {
        id: true,
        name: true,
        cuit: true,
        address: true,
        city: true,
        priceList: true,
        discount: true,
        outstandingBalance: true,
        creditLimit: true,
        paymentTermDays: true,
        isActive: true,
        isClient: true,
      },
    });

    if (!client || !client.isActive || !client.isClient) {
      return {
        httpStatus: 404,
        payload: { status: 'error', message: 'El cliente asociado al enlace no fue encontrado o está inactivo.' },
      };
    }

    const effectiveDraftId = draftIdQuery ? Number(draftIdQuery) : decoded.draftId;
    let draftData: any = null;

    if (effectiveDraftId) {
      const draft = await prisma.crmOrderDraft.findUnique({
        where: { id: Number(effectiveDraftId) },
      });

      // Solo entregar el borrador si pertenece al mismo cliente del token mágico
      if (draft && (!draft.personaId || draft.personaId === client.id)) {
        let parsedItems: any[] = [];
        try {
          parsedItems = JSON.parse(draft.itemsJson);
        } catch {
          parsedItems = [];
        }

        draftData = {
          id: draft.id,
          rawText: draft.rawText,
          status: draft.status,
          totalEstimated: roundToTwoDecimals(draft.totalEstimated).toNumber(),
          items: parsedItems,
        };
      }
    }

    const storeToken = signStoreClientSessionToken(client);

    return {
      httpStatus: 200,
      payload: {
        status: 'success',
        data: {
          token: storeToken,
          client: {
            id: client.id,
            name: client.name,
            cuit: client.cuit,
            address: client.address,
            city: client.city,
            priceList: client.priceList || 'A',
            discount: roundToTwoDecimals(client.discount || 0).toNumber(),
            outstandingBalance: roundToTwoDecimals(client.outstandingBalance || 0).toNumber(),
            creditLimit: roundToTwoDecimals(client.creditLimit || 0).toNumber(),
            paymentTermDays: client.paymentTermDays || 30,
          },
          draft: draftData,
        },
      },
    };
  }
}
