import { Request, Response, NextFunction } from 'express';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env.config';
import prisma from '../utils/prisma';
import { sessionCache } from '../utils/session-cache.util';

export interface StoreClientSession {
  personaId: number;
  priceList: string;
}

export interface StoreAuthenticatedRequest extends Request {
  storeClient?: StoreClientSession;
  staffUser?: {
    id: number;
    role: Role;
  };
}

interface RawTokenPayload {
  personaId?: number;
  id?: number;
  role?: string;
  type?: string;
}

/**
 * Middleware exclusivo para endpoints privados de la Tienda Mayorista (/api/store/*).
 * - Exige JWT firmado con env.JWT_SECRET (sin secretos hardcodeados).
 * - Bloquea ataques IDOR: un cliente autenticado jamás puede leer ni crear pedidos a nombre de otro personaId.
 * - Permite también tokens de personal interno ADMIN o FACTURACION para soporte/auditoría.
 */
export async function authenticateStoreClientJWT(
  req: StoreAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      status: 'error',
      message: 'Sesión de tienda requerida. Por favor ingresá nuevamente con tu PIN.',
      code: 'STORE_TOKEN_MISSING',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as RawTokenPayload;

    // Rechazar tokens de un solo uso (magic_login sin canjear) como token de sesión directa
    if (decoded.type === 'magic_login') {
      res.status(401).json({
        status: 'error',
        message: 'El enlace mágico debe canjearse antes de operar.',
        code: 'INVALID_TOKEN_TYPE',
      });
      return;
    }

    // Caso 1: Token de Cliente de Tienda Online
    if (decoded.personaId && (decoded.role === 'CLIENTE' || decoded.role === 'CLIENT')) {
      const personaId = Number(decoded.personaId);
      let activeClient = sessionCache.getStoreClientSession(personaId);

      if (!activeClient) {
        const clientDb = await prisma.persona.findUnique({
          where: { id: personaId },
          select: { id: true, isActive: true, isClient: true, priceList: true },
        });

        if (!clientDb || !clientDb.isActive || !clientDb.isClient) {
          sessionCache.invalidateStoreClientSession(personaId);
          res.status(401).json({
            status: 'error',
            message: 'La cuenta de cliente se encuentra inactiva o deshabilitada.',
            code: 'CLIENT_INACTIVE',
          });
          return;
        }

        activeClient = {
          id: clientDb.id,
          isActive: true,
          isClient: true,
          priceList: clientDb.priceList || 'A',
        };
        sessionCache.setStoreClientSession(personaId, activeClient);
      }

      const requestedPersonaId =
        req.params?.personaId !== undefined
          ? Number(req.params.personaId)
          : req.body?.personaId !== undefined
            ? Number(req.body.personaId)
            : activeClient.id;

      if (requestedPersonaId !== activeClient.id) {
        res.status(403).json({
          status: 'error',
          message: 'Acceso denegado. No tenés permiso para consultar u operar la cuenta de otro cliente.',
          code: 'STORE_IDOR_BLOCKED',
        });
        return;
      }

      req.storeClient = {
        personaId: activeClient.id,
        priceList: activeClient.priceList,
      };
      next();
      return;
    }

    // Caso 2: Personal interno autorizado (ADMIN o FACTURACION)
    if (decoded.id) {
      const staffId = Number(decoded.id);
      let activeStaff = sessionCache.getStaffSession(staffId);

      if (!activeStaff) {
        const staffDb = await prisma.user.findUnique({
          where: { id: staffId },
          select: { id: true, isActive: true, role: true },
        });

        if (staffDb && staffDb.isActive) {
          activeStaff = { id: staffDb.id, role: staffDb.role, isActive: true };
          sessionCache.setStaffSession(staffId, activeStaff);
        }
      }

      if (
        activeStaff &&
        (activeStaff.role === Role.ADMIN || activeStaff.role === Role.FACTURACION)
      ) {
        req.staffUser = { id: activeStaff.id, role: activeStaff.role };
        next();
        return;
      }
    }

    res.status(403).json({
      status: 'error',
      message: 'Permisos insuficientes para operar en la tienda mayorista.',
    });
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      res.status(401).json({
        status: 'error',
        message: 'Tu sesión en la tienda expiró. Volvé a ingresar tu PIN.',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    if (error instanceof JsonWebTokenError) {
      res.status(401).json({
        status: 'error',
        message: 'Token de tienda inválido.',
        code: 'TOKEN_INVALID',
      });
      return;
    }

    res.status(403).json({
      status: 'error',
      message: 'No fue posible verificar la sesión de tienda.',
    });
  }
}
