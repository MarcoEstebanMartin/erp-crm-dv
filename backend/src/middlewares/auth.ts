import { Response, NextFunction } from 'express';
import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { AuthenticatedRequest, UserPayload } from '../types';
import { env } from '../config/env.config';
import prisma from '../utils/prisma';
import { sessionCache } from '../utils/session-cache.util';
import {
  clearStaffSessionCookie,
  extractStaffToken,
  isCrossSiteCookieMutationBlocked,
} from '../utils/cookie-auth.util';

/**
 * Middleware para autenticar requests mediante Cookie HttpOnly segura (o Bearer para clientes API).
 */
export async function authenticateJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const extracted = extractStaffToken(req);

  if (!extracted) {
    res.status(401).json({
      status: 'error',
      message: 'Acceso denegado. Sesión no iniciada o token no provisto.',
    });
    return;
  }

  if (isCrossSiteCookieMutationBlocked(req, extracted.source)) {
    res.status(403).json({
      status: 'error',
      message: 'Solicitud cross-site bloqueada por protección CSRF.',
      code: 'CSRF_BLOCKED',
    });
    return;
  }

  const token = extracted.token;

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as UserPayload;
    req.user = decoded;

    if (decoded.id) {
      const userId = Number(decoded.id);
      const cachedStaff = sessionCache.getStaffSession(userId);

      if (cachedStaff) {
        req.user.role = cachedStaff.role;
      } else {
        const userDb = await prisma.user.findUnique({
          where: { id: userId },
          select: { isActive: true, role: true },
        });
        if (!userDb || !userDb.isActive) {
          sessionCache.invalidateStaffSession(userId);
          clearStaffSessionCookie(req, res);
          res.status(401).json({
            status: 'error',
            message: 'Cuenta desactivada o inactiva.',
            code: 'USER_INACTIVE',
          });
          return;
        }
        sessionCache.setStaffSession(userId, {
          id: userId,
          role: userDb.role,
          isActive: true,
        });
        req.user.role = userDb.role;
      }
    }

    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      res.status(401).json({
        status: 'error',
        message: 'Sesión expirada. Por favor, inicie sesión nuevamente.',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    if (error instanceof JsonWebTokenError) {
      res.status(401).json({
        status: 'error',
        message: 'Token inválido o firma no reconocida.',
        code: 'TOKEN_INVALID',
      });
      return;
    }

    res.status(403).json({
      status: 'error',
      message: 'No fue posible validar la autenticación.',
    });
  }
}

/**
 * Middleware para exigir que el usuario autenticado posea ciertos roles (RBAC).
 */
export function requireRole(allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        message: 'No autenticado.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        status: 'error',
        message: 'Acceso denegado. Permisos insuficientes para esta operación.',
      });
      return;
    }

    next();
  };
}
