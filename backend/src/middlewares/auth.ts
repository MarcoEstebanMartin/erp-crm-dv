import { Response, NextFunction } from 'express';
import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { AuthenticatedRequest, UserPayload } from '../types';
import { env } from '../config/env.config';

/**
 * Middleware para autenticar requests mediante JWT en el header Authorization.
 */
export function authenticateJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      status: 'error',
      message: 'Acceso denegado. Token no provisto o con formato inválido.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as UserPayload;
    req.user = decoded;
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
