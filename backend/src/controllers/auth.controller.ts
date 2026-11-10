import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { AuthenticatedRequest, UserPermissions } from '../types';
import { env } from '../config/env.config';
import { sessionCache } from '../utils/session-cache.util';
import {
  clearStaffSessionCookie,
  extractStaffToken,
  setStaffSessionCookie,
} from '../utils/cookie-auth.util';

export function getDefaultPermissions(role: string): UserPermissions {
  if (role === 'ADMIN' || role === 'FACTURACION') {
    return { canSell: true, canPick: true, canDeliver: true, canCollect: true, canManageStock: true };
  }
  if (role === 'VENDEDOR') {
    return { canSell: true, canPick: false, canDeliver: true, canCollect: true, canManageStock: false };
  }
  if (role === 'DEPOSITO') {
    return { canSell: false, canPick: true, canDeliver: true, canCollect: false, canManageStock: true };
  }
  return { canSell: true, canPick: false, canDeliver: true, canCollect: true, canManageStock: false };
}

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({
      status: 'error',
      message: 'Usuario y contraseña son requeridos.',
    });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas.',
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas.',
      });
      return;
    }

    const effectivePermissions: UserPermissions =
      (user.permissions as unknown as UserPermissions) || getDefaultPermissions(user.role);

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: effectivePermissions,
      },
      env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    setStaffSessionCookie(req, res, token);

    res.status(200).json({
      status: 'success',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: effectivePermissions,
        },
        config: {
          ignoreStock: env.IGNORE_STOCK_CHECK,
          afipProduction: env.AFIP_PRODUCTION,
        },
      },
    });
  } catch (error: unknown) {
    console.error('Error en Login:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al iniciar sesión.',
    });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      status: 'error',
      message: 'No autenticado.',
    });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user || !user.isActive) {
      res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado o inactivo.',
      });
      return;
    }

    const effectivePermissions: UserPermissions =
      (user.permissions as unknown as UserPermissions) || getDefaultPermissions(user.role);

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          ...user,
          permissions: effectivePermissions,
        },
        config: {
          ignoreStock: env.IGNORE_STOCK_CHECK,
          afipProduction: env.AFIP_PRODUCTION,
        },
      },
    });
  } catch (error: unknown) {
    console.error('Error en getMe:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener datos del usuario.',
    });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const extracted = extractStaffToken(req);
  if (extracted) {
    try {
      const decoded = jwt.verify(extracted.token, env.JWT_SECRET) as { id?: number };
      if (decoded?.id) {
        sessionCache.invalidateStaffSession(Number(decoded.id));
      }
    } catch {
      // Token ya expirado o inválido; igualmente limpiamos la cookie
    }
  }
  clearStaffSessionCookie(req, res);
  res.status(200).json({
    status: 'success',
    message: 'Sesión cerrada correctamente.',
  });
}
