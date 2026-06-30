import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'seguridad-erp-distribuidora-2026-key-local-development';

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
    // Buscar usuario en la base de datos
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

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas.',
      });
      return;
    }

    // Generar JWT (válido por 12 horas)
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.status(200).json({
      status: 'success',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        config: {
          ignoreStock: process.env.IGNORE_STOCK_CHECK === 'true',
          afipProduction: process.env.AFIP_PRODUCTION === 'true'
        }
      },
    });
  } catch (error: any) {
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

    if (!user || !user.isActive) {
      res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado o inactivo.',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: { 
        user,
        config: {
          ignoreStock: process.env.IGNORE_STOCK_CHECK === 'true',
          afipProduction: process.env.AFIP_PRODUCTION === 'true'
        }
      },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener datos del usuario.',
    });
  }
}
