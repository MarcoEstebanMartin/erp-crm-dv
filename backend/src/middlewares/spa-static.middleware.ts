import fs from 'fs';
import path from 'path';
import express, { Application, Request, Response, NextFunction } from 'express';

const NO_CACHE_HEADER = 'no-store, no-cache, must-revalidate';
const IMMUTABLE_CACHE_HEADER = 'public, max-age=31536000, immutable';

function shouldBypassCache(filePath: string): boolean {
  const lower = path.basename(filePath).toLowerCase();
  return (
    lower.endsWith('.html') ||
    lower === 'sw.js' ||
    lower === 'manifest.webmanifest' ||
    lower === 'registerpwa.js'
  );
}

/**
 * Monta el cierre limpio de rutas API no encontradas y, cuando existe el build compilado
 * (`frontend/dist`), sirve el Frontend SPA unificado desde el mismo servicio Express.
 */
export function mountSpaFrontend(app: Application, customDistDir?: string): void {
  const distDir = customDistDir || path.resolve(__dirname, '../../../frontend/dist');
  const indexHtmlPath = path.join(distDir, 'index.html');

  // Cualquier subruta inexistente bajo /api devuelve 404 JSON limpio (nunca HTML)
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({
      status: 'error',
      message: 'Endpoint API no encontrado',
    });
  });

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
