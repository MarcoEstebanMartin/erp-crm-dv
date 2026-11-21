import { Response, NextFunction } from 'express';
import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { AuthenticatedRequest, UserPayload, UserPermissions } from '../types';
import { env } from '../config/env.config';
import prisma from '../utils/prisma';
import {
  computePasswordVersion,
  isSystemUsername,
  normalizeUserPermissions,
  sessionCache,
} from '../utils/session-cache.util';
import {
  clearStaffSessionCookie,
  extractStaffToken,
  isCrossSiteCookieMutationBlocked,
} from '../utils/cookie-auth.util';

const VALID_STAFF_ROLES = new Set<string>(Object.values(Role));

interface RawJwtPayload {
  id?: unknown;
  username?: unknown;
  role?: unknown;
  pwdVer?: unknown;
  scope?: unknown;
  type?: unknown;
  personaId?: unknown;
}

/**
 * Valida que el payload decodificado corresponda estrictamente a una sesión de personal interno (staff)
 * y nunca a un token de cliente de tienda (`CLIENTE`) ni a un enlace mágico (`magic_login`).
 */
export function isValidStaffJwtPayload(decoded: unknown): decoded is UserPayload {
  if (!decoded || typeof decoded !== 'object') return false;
  const payload = decoded as RawJwtPayload;

  if (payload.type === 'magic_login') return false;
  if (payload.personaId !== undefined) return false;
  if (payload.scope !== undefined && payload.scope !== 'staff') return false;

  const numericId = Number(payload.id);
  if (!Number.isInteger(numericId) || numericId <= 0) return false;
  if (typeof payload.role !== 'string' || !VALID_STAFF_ROLES.has(payload.role)) return false;

  return true;
}

/**
 * Verifica firma y estructura de un token JWT de staff sin disparar efectos secundarios HTTP.
 */
export function verifyStaffJwtToken(token: string): UserPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (!isValidStaffJwtPayload(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

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
    const decodedRaw = jwt.verify(token, env.JWT_SECRET);

    if (!isValidStaffJwtPayload(decodedRaw)) {
      clearStaffSessionCookie(req, res);
      res.status(401).json({
        status: 'error',
        message: 'Token inválido para acceso al sistema interno.',
        code: 'TOKEN_INVALID',
      });
      return;
    }

    const decoded: UserPayload = decodedRaw;
    req.user = decoded;

    const userId = Number(decoded.id);
    const cachedStaff = sessionCache.getStaffSession(userId);

    if (cachedStaff) {
      if (cachedStaff.pwdVer && decoded.pwdVer !== cachedStaff.pwdVer) {
        clearStaffSessionCookie(req, res);
        res.status(401).json({
          status: 'error',
          message: 'Tu contraseña o sesión fue actualizada. Iniciá sesión nuevamente.',
          code: 'SESSION_REVOKED',
        });
        return;
      }
      req.user.role = cachedStaff.role;
      req.user.permissions = cachedStaff.permissions ?? null;
    } else {
      const userDb = await prisma.user.findUnique({
        where: { id: userId },
        select: { isActive: true, role: true, permissions: true, passwordHash: true, username: true },
      });
      if (!userDb || !userDb.isActive || (userDb.username && isSystemUsername(userDb.username))) {
        sessionCache.invalidateStaffSession(userId);
        clearStaffSessionCookie(req, res);
        res.status(401).json({
          status: 'error',
          message: 'Cuenta desactivada o inactiva.',
          code: 'USER_INACTIVE',
        });
        return;
      }
      const expectedPwdVer = userDb.passwordHash
        ? computePasswordVersion(userDb.passwordHash)
        : undefined;
      if (expectedPwdVer && decoded.pwdVer !== expectedPwdVer) {
        clearStaffSessionCookie(req, res);
        res.status(401).json({
          status: 'error',
          message: 'Tu contraseña o sesión fue actualizada. Iniciá sesión nuevamente.',
          code: 'SESSION_REVOKED',
        });
        return;
      }
      const normalizedPermissions = normalizeUserPermissions(userDb.permissions);
      sessionCache.setStaffSession(userId, {
        id: userId,
        role: userDb.role,
        permissions: normalizedPermissions,
        isActive: true,
        pwdVer: expectedPwdVer,
      });
      req.user.role = userDb.role;
      req.user.permissions = normalizedPermissions;
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

/**
 * Middleware para exigir que el usuario autenticado posea ciertos roles (RBAC)
 * o un permiso granular específico activo (ej. `canDeliver` para vendedores que también reparten).
 */
export function requireRoleOrPermission(
  allowedRoles: Role[],
  permissionKey: keyof UserPermissions,
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        message: 'No autenticado.',
      });
      return;
    }

    const hasAllowedRole = allowedRoles.includes(req.user.role);
    const hasGranularPermission = Boolean(req.user.permissions?.[permissionKey]);

    if (!hasAllowedRole && !hasGranularPermission) {
      res.status(403).json({
        status: 'error',
        message: 'Acceso denegado. Permisos insuficientes para esta operación.',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware opcional: si el request trae una sesión JWT válida de staff,
 * la adjunta en `req.user`; si no, continúa como visitante público sin rechazar.
 */
export function optionalAuthenticateJWT(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  const extracted = extractStaffToken(req);
  if (!extracted) {
    next();
    return;
  }

  const decoded = verifyStaffJwtToken(extracted.token);
  if (decoded) {
    req.user = decoded;
  }

  next();
}
