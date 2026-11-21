import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { env } from '../config/env.config';
import {
  computePasswordVersion,
  isSystemUsername,
  normalizeUserPermissions,
  sessionCache,
} from '../utils/session-cache.util';
import { getSystemConfigSnapshot } from '../services/admin/system-config.service';
import {
  clearStaffSessionCookie,
  extractStaffToken,
  setStaffSessionCookie,
} from '../utils/cookie-auth.util';
import { logAudit } from '../utils/audit';

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;
  const cleanUsername = typeof username === 'string' ? username.trim() : '';

  if (!cleanUsername || !password) {
    res.status(400).json({
      status: 'error',
      message: 'Usuario y contraseña son requeridos.',
    });
    return;
  }

  if (isSystemUsername(cleanUsername)) {
    res.status(401).json({
      status: 'error',
      message: 'Credenciales inválidas.',
    });
    return;
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        username: { equals: cleanUsername, mode: 'insensitive' },
      },
    });

    if (!user || !user.isActive || isSystemUsername(user.username)) {
      if (user && !isSystemUsername(user.username)) {
        void logAudit({
          userId: user.id,
          action: 'LOGIN_FAILED',
          entityType: 'User',
          entityId: user.id,
          status: 'WARNING',
          errorMessage: 'Intento de ingreso con cuenta desactivada',
          ipAddress: req.ip || null,
          newValues: { username: user.username },
        });
      }
      res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas.',
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      void logAudit({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        status: 'WARNING',
        errorMessage: 'Contraseña incorrecta',
        ipAddress: req.ip || null,
        newValues: { username: user.username },
      });
      res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas.',
      });
      return;
    }

    const pwdVer = computePasswordVersion(user.passwordHash);

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        pwdVer,
        scope: 'staff',
      },
      env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const normalizedPermissions = normalizeUserPermissions(user.permissions);

    sessionCache.setStaffSession(user.id, {
      id: user.id,
      role: user.role,
      permissions: normalizedPermissions,
      isActive: true,
      pwdVer,
    });
    setStaffSessionCookie(req, res, token);
    void logAudit({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      status: 'SUCCESS',
      ipAddress: req.ip || null,
      newValues: { username: user.username, role: user.role },
    });
    const systemConfig = await getSystemConfigSnapshot();

    res.status(200).json({
      status: 'success',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: normalizedPermissions,
        },
        config: systemConfig,
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

    if (!user || !user.isActive || isSystemUsername(user.username)) {
      res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado o inactivo.',
      });
      return;
    }

    const systemConfig = await getSystemConfigSnapshot();

    res.status(200).json({
      status: 'success',
      data: {
        user,
        config: systemConfig,
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

export async function changeOwnPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  if (req.user.role !== Role.ADMIN) {
    res.status(403).json({
      status: 'error',
      message: 'Solo los administradores pueden cambiar su propia contraseña.',
    });
    return;
  }

  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };
  const cleanNewPassword = String(newPassword || '').trim();

  if (cleanNewPassword.length < 4) {
    res.status(400).json({
      status: 'error',
      message: 'La nueva contraseña debe tener al menos 4 caracteres.',
    });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.isActive || isSystemUsername(user.username)) {
      res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado o inactivo.',
      });
      return;
    }

    const matches = await bcrypt.compare(String(currentPassword || ''), user.passwordHash);
    if (!matches) {
      res.status(401).json({
        status: 'error',
        message: 'La contraseña actual es incorrecta.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(cleanNewPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    const pwdVer = computePasswordVersion(passwordHash);
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        pwdVer,
        scope: 'staff',
      },
      env.JWT_SECRET,
      { expiresIn: '30d' },
    );

    sessionCache.setStaffSession(user.id, {
      id: user.id,
      role: user.role,
      isActive: true,
      pwdVer,
    });
    setStaffSessionCookie(req, res, token);

    void logAudit({
      userId: user.id,
      action: 'CHANGE_OWN_PASSWORD',
      entityType: 'User',
      entityId: user.id,
      status: 'SUCCESS',
      ipAddress: req.ip || null,
      newValues: { username: user.username },
    });

    res.status(200).json({
      status: 'success',
      message: 'Contraseña actualizada correctamente. Las sesiones en otros dispositivos fueron cerradas.',
    });
  } catch (error: unknown) {
    console.error('Error al cambiar contraseña propia:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno al actualizar la contraseña.',
    });
  }
}
