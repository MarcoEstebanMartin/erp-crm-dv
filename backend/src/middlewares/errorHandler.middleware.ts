import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import AppError from '../utils/AppError';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 1. Manejo de AppError personalizado
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // 2. Manejo de errores de validación de Zod
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return res.status(400).json({
      status: 'error',
      message: 'Error de validación en los datos enviados',
      errors: formattedErrors,
    });
  }

  // 3. Manejo de errores conocidos de Prisma ORM
  if (err?.code === 'P2002') {
    const fields = err.meta?.target ? (err.meta.target as string[]).join(', ') : 'campo único';
    return res.status(409).json({
      status: 'error',
      message: `Ya existe un registro con el mismo valor en: ${fields}`,
    });
  }

  if (err?.code === 'P2025') {
    return res.status(404).json({
      status: 'error',
      message: 'El registro solicitado no fue encontrado en la base de datos',
    });
  }

  // 4. Fallback de error 500 no capturado
  console.error('⚠️ [Unhandled Server Error]:', err);
  
  return res.status(500).json({
    status: 'error',
    message: err.message || 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err : undefined,
  });
}

export default errorHandler;
