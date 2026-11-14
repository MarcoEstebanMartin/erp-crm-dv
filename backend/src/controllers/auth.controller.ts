import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { env } from '../config/env.config';
import {
  computePasswordVersion,
  isSystemUsername,
  sessionCache,
} from '../utils/session-cache.util';
import { getSystemConfigSnapshot } from '../services/admin/system-config.service';
import {
  clearStaffSessionCookie,
  extractStaffToken,
  setStaffSessionCookie,
} from '../utils/cookie-auth.util';

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

    const pwdVer = computePasswordVersion(user.passwordHash);

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        pwdVer,
      },
      env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    sessionCache.setStaffSession(user.id, {
      id: user.id,
      role: user.role,
      isActive: true,
      pwdVer,
    });
    setStaffSessionCookie(req, res, token);
    const systemConfig = await getSystemConfigSnapshot();

    res.status(200).json({
      status: 'success',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
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
