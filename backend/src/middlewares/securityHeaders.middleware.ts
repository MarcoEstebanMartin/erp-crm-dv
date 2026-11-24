import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.config';

export function buildFrontendCsp(isProduction: boolean = env.NODE_ENV === 'production'): string {
  const connectSources = [
    "'self'",
    'https://maps.googleapis.com',
    'https://maps.gstatic.com',
    'https://nominatim.openstreetmap.org',
    'https://*.supabase.co',
    ...(isProduction ? [] : ['ws:', 'wss:']),
  ].join(' ');

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSources}`,
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ];

  return directives.join('; ');
}

/**
 * Middleware de endurecimiento de cabeceras HTTP (Defensa en Profundidad).
 * Protege contra Clickjacking, MIME sniffing, inyección en respuestas API/SPA y fugas de referrer,
 * preservando permisos propios de cámara, GPS, Google Maps, PWA e impresión PDF.
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
    res.setHeader('Content-Security-Policy', buildFrontendCsp(env.NODE_ENV === 'production'));
  }

  if (env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}
