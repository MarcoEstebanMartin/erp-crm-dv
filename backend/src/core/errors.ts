import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = 'BUSINESS_RULE_VIOLATION') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const issues = err.issues ?? [];
    res.status(400).json({
      success: false,
      ok: false,
      code: 'VALIDATION_ERROR',
      error: 'Datos de entrada inválidos',
      message: 'Datos de entrada inválidos',
      details: issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      ok: false,
      code: err.code,
      error: err.message,
      message: err.message,
    });
    return;
  }

  console.error('[UNHANDLED_ERROR]', err);
  res.status(500).json({
    success: false,
    ok: false,
    code: 'INTERNAL_SERVER_ERROR',
    error: 'Error interno del servidor',
    message: 'Error interno del servidor',
  });
}
