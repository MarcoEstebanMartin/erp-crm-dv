import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.config';

/**
 * Middleware de endurecimiento de cabeceras HTTP (Defensa en Profundidad).
 * Protege contra Clickjacking, MIME sniffing, inyección en respuestas API y fugas de referrer,
 * preservando permisos propios de cámara y GPS para escaneo y preventa en ruta.
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self), payment=()');

  // Respuestas JSON de la API no deben ejecutar scripts ni cargarse en marcos
  if (req.path.startsWith('/api')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
  } else {
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  }

  if (env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}
