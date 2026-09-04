import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config/env.config';
import { ensureDirectoriesExist, syncMasterProductImages } from './utils/fileSync.util';
import { errorHandler } from './middlewares/errorHandler.middleware';
import { authenticateJWT } from './middlewares/auth';

// Importación de Rutas
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import personaRoutes from './routes/persona.routes';
import orderRoutes from './routes/order.routes';
import adminRoutes from './routes/admin.routes';
import financeRoutes from './routes/finance.routes';
import billingRoutes from './routes/billing.routes';
import logisticsRoutes from './routes/logistics.routes';
import purchaseRoutes from './routes/purchase.routes';
import crmRoutes from './routes/crm.routes';
import creditNoteRoutes from './routes/creditNote.routes';
import rubroRoutes from './routes/rubro.routes';
import ivaRoutes from './routes/iva.routes';
import collectionRoutes from './routes/collection.routes';
import perceptionRoutes from './routes/perception.routes';
import pricingRoutes from './routes/pricing.routes';
import saleRouteRoutes from './routes/saleRoute.routes';
import fleetRoutes from './routes/fleet.routes';
import expenseRoutes from './routes/expense.routes';
import offerRoutes from './routes/offers';
import hrRoutes from './routes/hr.routes';
import storeRoutes from './routes/store.routes';
import crmWhatsappRoutes from './routes/crm_whatsapp.routes';
import weeklyScheduleRoutes from './routes/weeklySchedule.routes';
import webChatRoutes from './routes/webChat.routes';

const app: Application = express();

// 1. Headers de Seguridad Nativos & CORS
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

// 2. Middleware de Rendimiento (X-Response-Time Seguro)
app.use((_req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const originalWriteHead = res.writeHead;
  res.writeHead = function (...args: any[]) {
    if (!res.headersSent) {
      const duration = Date.now() - start;
      res.setHeader('X-Response-Time', `${duration}ms`);
    }
    return originalWriteHead.apply(this, args as any);
  };
  next();
});

// 3. Inicialización Asincrónica de Directorios y Archivos Maestros
const uploadsDir = path.join(__dirname, '../uploads');
const productsUploadsDir = path.join(uploadsDir, 'products');
const archivosDir = path.resolve(__dirname, env.ARCHIVOS_PATH);
const masterProductosFotosDir = path.join(archivosDir, 'fotos/Productos');

import { appCache } from './utils/cache';
import { startDbKeepAlive } from './utils/dbKeepAlive';

(async () => {
  try {
    await ensureDirectoriesExist([uploadsDir, productsUploadsDir]);
    await syncMasterProductImages(masterProductosFotosDir, productsUploadsDir);
    appCache.invalidateProductCatalog();
    startDbKeepAlive();
  } catch (err) {
    console.error('⚠️ Error durante la inicialización de archivos/directorio en el inicio:', err);
  }
})();

// 4. Servidor de Archivos Estáticos (con fallback automático a carpeta maestra)
app.use('/uploads/products', express.static(productsUploadsDir, { maxAge: 0, etag: true, lastModified: true }));
app.use('/uploads/products', express.static(masterProductosFotosDir, { maxAge: 0, etag: true, lastModified: true }));
app.use('/uploads', express.static(uploadsDir, { maxAge: 0, etag: true, lastModified: true }));
app.use('/api/purchases/files', authenticateJWT, express.static(archivosDir));

// 5. Montar Rutas del API
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/personas', personaRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/billing/credit-notes', creditNoteRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/crm/whatsapp', crmWhatsappRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/rubros', rubroRoutes);
app.use('/api/iva', ivaRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/perceptions', perceptionRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/sale-routes', saleRouteRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/weekly-schedule', weeklyScheduleRoutes);
app.use('/api/web-chat', webChatRoutes);

// 6. Endpoint de Healthcheck
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'ERP-CRM Backend is running smoothly',
    timestamp: new Date().toISOString(),
  });
});

// 7. Manejador Global de Errores
app.use(errorHandler);

export default app;
