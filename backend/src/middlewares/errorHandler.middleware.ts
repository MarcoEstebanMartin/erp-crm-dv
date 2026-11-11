import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import AppError from '../utils/AppError';
import { env } from '../config/env.config';

export function isInternalTechnicalError(err: any): boolean {
  if (!err) return true;
  const name = String(err.name || '');
  if (name.includes('Prisma') || name === 'TypeError' || name === 'ReferenceError' || name === 'SyntaxError') {
    return true;
  }
  if (typeof err.code === 'string' && /^(P\d{4}|ECONN|ETIMEDOUT|ENOTFOUND|23\d{3}|42\d{3})/.test(err.code)) {
    return true;
  }
  const msg = String(err.message || '');
  return /prisma|postgres|invocation|database|econnrefused|relation\s+"|column\s+"|syntax error at/i.test(
    msg,
  );
}

export function sanitizeServerErrorMessage(err: any, nodeEnv: string = env.NODE_ENV): string {
  const rawMessage = typeof err?.message === 'string' ? err.message.trim() : '';
  if (!rawMessage) return 'Error interno del servidor';
  if (nodeEnv === 'production' && isInternalTechnicalError(err)) {
    return 'Error interno del servidor al procesar la operación.';
  }
  return rawMessage;
}

export function errorHandler(
  err: Error | AppError | ZodError | any,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return res.status(400).json({
      status: 'error',
      message: 'Error de validación en los datos enviados',
      errors: formattedErrors,
    });
  }

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

  console.error('⚠️ [Unhandled Server Error]:', err);

  return res.status(500).json({
    status: 'error',
    message: sanitizeServerErrorMessage(err, env.NODE_ENV),
    error: env.NODE_ENV === 'development' ? err : undefined,
  });
}

export default errorHandler;
