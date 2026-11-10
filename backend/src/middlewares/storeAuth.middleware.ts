import { Request, Response, NextFunction } from 'express';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env.config';
import prisma from '../utils/prisma';

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
      const clientDb = await prisma.persona.findUnique({
        where: { id: Number(decoded.personaId) },
        select: { id: true, isActive: true, isClient: true, priceList: true },
      });

      if (!clientDb || !clientDb.isActive || !clientDb.isClient) {
        res.status(401).json({
          status: 'error',
          message: 'La cuenta de cliente se encuentra inactiva o deshabilitada.',
          code: 'CLIENT_INACTIVE',
        });
        return;
      }

      const requestedPersonaId =
        req.params?.personaId !== undefined
          ? Number(req.params.personaId)
          : req.body?.personaId !== undefined
            ? Number(req.body.personaId)
            : clientDb.id;

      if (requestedPersonaId !== clientDb.id) {
        res.status(403).json({
          status: 'error',
          message: 'Acceso denegado. No tenés permiso para consultar u operar la cuenta de otro cliente.',
          code: 'STORE_IDOR_BLOCKED',
        });
        return;
      }

      req.storeClient = {
        personaId: clientDb.id,
        priceList: clientDb.priceList || 'A',
      };
      next();
      return;
    }

    // Caso 2: Personal interno autorizado (ADMIN o FACTURACION)
    if (decoded.id) {
      const staffDb = await prisma.user.findUnique({
        where: { id: Number(decoded.id) },
        select: { id: true, isActive: true, role: true },
      });

      if (
        staffDb &&
        staffDb.isActive &&
        (staffDb.role === Role.ADMIN || staffDb.role === Role.FACTURACION)
      ) {
        req.staffUser = { id: staffDb.id, role: staffDb.role };
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
