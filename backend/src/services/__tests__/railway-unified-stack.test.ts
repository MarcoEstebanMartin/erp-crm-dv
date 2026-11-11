import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import express from 'express';
import { describe, it, expect, afterEach } from 'vitest';
import { validateEnvConfig } from '../../config/env.config';
import { mountSpaFrontend } from '../../middlewares/spa-static.middleware';

describe('Stack Unificado Railway (Frontend SPA + Backend API + Seguridad de Entorno)', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('Configura automáticamente TRUST_PROXY=1 y origen HTTPS propio cuando corre en Railway', () => {
    const cfg = validateEnvConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'railway_test_secret_1234567890',
      RAILWAY_ENVIRONMENT: 'production',
      RAILWAY_PUBLIC_DOMAIN: 'erp-dv-production.up.railway.app',
    });

    expect(cfg.TRUST_PROXY).toBe(1);
    expect(cfg.CORS_ORIGIN).toBe('https://erp-dv-production.up.railway.app');
  });

  it('Respeta CORS_ORIGIN personalizado en Railway cuando se define dominio propio', () => {
    const cfg = validateEnvConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'railway_test_secret_1234567890',
      RAILWAY_ENVIRONMENT: 'production',
      RAILWAY_PUBLIC_DOMAIN: 'erp-dv-production.up.railway.app',
      CORS_ORIGIN: 'https://sistema.donvenancio.com.ar',
    });

    expect(cfg.CORS_ORIGIN).toBe('https://sistema.donvenancio.com.ar');
    expect(cfg.TRUST_PROXY).toBe(1);
  });

  it('Sirve SPA compilada con cabeceras de caché óptimas y devuelve 404 JSON en subrutas /api inexistentes', async () => {
    const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-spa-test-'));
    tempDirs.push(tmpDist);
    const assetsDir = path.join(tmpDist, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDist, 'index.html'), '<!doctype html><html><body>DV ERP SPA</body></html>');
    fs.writeFileSync(path.join(tmpDist, 'sw.js'), 'self.addEventListener("install", () => {});');
    fs.writeFileSync(path.join(assetsDir, 'app-hash123.js'), 'console.log("dv");');

    const testApp = express();
    testApp.get('/api/health', (_req, res) => {
      res.json({ status: 'success' });
    });
    mountSpaFrontend(testApp, tmpDist);
    testApp.use((_req, res) => {
      res.status(404).send('UPLOAD_NOT_FOUND');
    });

    const server = testApp.listen(0);
    try {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const base = `http://127.0.0.1:${port}`;

      // 1. Navegación profunda de React Router recibe index.html sin cachear
      const navRes = await fetch(`${base}/ventas/preventa`);
      expect(navRes.status).toBe(200);
      expect(navRes.headers.get('cache-control')).toContain('no-cache');
      expect(await navRes.text()).toContain('DV ERP SPA');

      // 2. Service Worker PWA tampoco se cachea en navegador
      const swRes = await fetch(`${base}/sw.js`);
      expect(swRes.status).toBe(200);
      expect(swRes.headers.get('cache-control')).toContain('no-cache');

      // 3. Bundles con hash en /assets se cachean de forma inmutable por 1 año
      const assetRes = await fetch(`${base}/assets/app-hash123.js`);
      expect(assetRes.status).toBe(200);
      expect(assetRes.headers.get('cache-control')).toContain('immutable');

      // 4. Subruta /api inexistente devuelve 404 JSON limpio (jamás HTML)
      const api404Res = await fetch(`${base}/api/no-existe`);
      expect(api404Res.status).toBe(404);
      const api404Json: any = await api404Res.json();
      expect(api404Json.status).toBe('error');

      // 5. Una foto faltante en /uploads no es reemplazada por index.html
      const missingUploadRes = await fetch(`${base}/uploads/products/9999.jpg`);
      expect(missingUploadRes.status).toBe(404);
      expect(await missingUploadRes.text()).toBe('UPLOAD_NOT_FOUND');
    } finally {
      server.close();
    }
  });

  it('En development jamás sirve frontend/dist viejo y redirige (302) navegaciones GET al puerto 5174 preservando host y ruta', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const devApp = express();
    mountSpaFrontend(devApp);
    devApp.use((_req, res) => {
      res.status(404).send('UPLOAD_NOT_FOUND');
    });

    const server = devApp.listen(0);
    try {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const base = `http://127.0.0.1:${port}`;

      // 1. Navegación local redirige a Vite (:5174) con el mismo host y query string
      const redirectRes = await fetch(`${base}/ventas/preventa?tab=activos`, {
        redirect: 'manual',
      });
      expect(redirectRes.status).toBe(302);
      expect(redirectRes.headers.get('location')).toBe(
        'http://127.0.0.1:5174/ventas/preventa?tab=activos',
      );
      expect(redirectRes.headers.get('cache-control')).toContain('no-store');

      // 2. Navegación desde IP WiFi LAN conserva la IP LAN hacia :5174 (apto celulares)
      const lanHeaders = await new Promise<{ statusCode?: number; location?: string }>(
        (resolve, reject) => {
          const req = http.get(
            {
              hostname: '127.0.0.1',
              port,
              path: '/clientes',
              headers: { Host: '192.168.68.101:3001' },
            },
            (res) => {
              res.resume();
              resolve({ statusCode: res.statusCode, location: res.headers.location });
            },
          );
          req.on('error', reject);
        },
      );
      expect(lanHeaders.statusCode).toBe(302);
      expect(lanHeaders.location).toBe('http://192.168.68.101:5174/clientes');

      // 3. /api y /uploads en :3001 nunca redirigen a :5174
      const api404Res = await fetch(`${base}/api/no-existe`, { redirect: 'manual' });
      expect(api404Res.status).toBe(404);
      const uploadRes = await fetch(`${base}/uploads/products/no-existe.jpg`, {
        redirect: 'manual',
      });
      expect(uploadRes.status).toBe(404);
      expect(await uploadRes.text()).toBe('UPLOAD_NOT_FOUND');
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      server.close();
    }
  });
});
