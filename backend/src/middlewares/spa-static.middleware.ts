import fs from 'fs';
import path from 'path';
import express, { Application, Request, Response, NextFunction } from 'express';

const NO_CACHE_HEADER = 'no-store, no-cache, must-revalidate';
const IMMUTABLE_CACHE_HEADER = 'public, max-age=31536000, immutable';
const DEFAULT_VITE_DEV_PORT = 5174;

function shouldBypassCache(filePath: string): boolean {
  const lower = path.basename(filePath).toLowerCase();
  return (
    lower.endsWith('.html') ||
    lower === 'sw.js' ||
    lower === 'manifest.webmanifest' ||
    lower === 'registerpwa.js'
  );
}

function resolveDevRedirectUrl(req: Request): string {
  const rawHost = (req.hostname || '').trim();
  const safeHost = /^[a-zA-Z0-9.-]+$/.test(rawHost) ? rawHost : 'localhost';
  const parsedPort = Number(process.env.VITE_DEV_PORT || DEFAULT_VITE_DEV_PORT);
  const devPort =
    Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
      ? parsedPort
      : DEFAULT_VITE_DEV_PORT;
  const safePath =
    req.originalUrl && req.originalUrl.startsWith('/') && !req.originalUrl.startsWith('//')
      ? req.originalUrl
      : '/';
  return `http://${safeHost}:${devPort}${safePath}`;
}

/**
 * Monta el cierre limpio de rutas API no encontradas.
 * - En `production` (o cuando `customDistDir` se inyecta en tests), sirve `frontend/dist` unificado.
 * - En `development`, redirige (`302`) cualquier navegación GET/HEAD fuera de `/api` y `/uploads`
 *   al servidor en vivo de Vite (`:5174`) para evitar servir un `frontend/dist` viejo por accidente.
 */
export function mountSpaFrontend(app: Application, customDistDir?: string): void {
  // Cualquier subruta inexistente bajo /api devuelve 404 JSON limpio (nunca HTML)
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({
      status: 'error',
      message: 'Endpoint API no encontrado',
    });
  });

  const shouldServeStaticDist = Boolean(customDistDir) || process.env.NODE_ENV === 'production';

  if (!shouldServeStaticDist) {
    const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      app.use((req: Request, res: Response, next: NextFunction) => {
        const method = (req.method || 'GET').toUpperCase();
        if (method !== 'GET' && method !== 'HEAD') {
          next();
          return;
        }
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
          next();
          return;
        }
        res.setHeader('Cache-Control', NO_CACHE_HEADER);
        res.redirect(302, resolveDevRedirectUrl(req));
      });
    }
    return;
  }

  const distDir = customDistDir || path.resolve(__dirname, '../../../frontend/dist');
  const indexHtmlPath = path.join(distDir, 'index.html');

  if (!fs.existsSync(indexHtmlPath)) {
    return;
  }

  const assetsDir = path.join(distDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    app.use(
      '/assets',
      express.static(assetsDir, {
        maxAge: '365d',
        immutable: true,
        fallthrough: false,
        setHeaders: (res) => {
          res.setHeader('Cache-Control', IMMUTABLE_CACHE_HEADER);
        },
      }),
    );
  }

  app.use(
    express.static(distDir, {
      index: false,
      setHeaders: (res, servedPath) => {
        if (shouldBypassCache(servedPath)) {
          res.setHeader('Cache-Control', NO_CACHE_HEADER);
        }
      },
    }),
  );

  // Fallback SPA (React Router): cualquier navegación GET/HEAD fuera de /api y /uploads entrega index.html
  app.use((req: Request, res: Response, next: NextFunction) => {
    const method = (req.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      next();
      return;
    }
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      next();
      return;
    }
    res.setHeader('Cache-Control', NO_CACHE_HEADER);
    res.sendFile(indexHtmlPath);
  });
}
