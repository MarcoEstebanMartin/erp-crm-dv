import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

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

dotenv.config();

const app: Application = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Montar Rutas
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
app.use('/api/crm', crmRoutes);
app.use('/api/rubros', rubroRoutes);
app.use('/api/iva', ivaRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/perceptions', perceptionRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/sale-routes', saleRouteRoutes);
app.use('/api/fleet', fleetRoutes);

// Ruta de comprobación de estado (Healthcheck)
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'ERP-CRM Backend is running smoothly',
    timestamp: new Date().toISOString()
  });
});

// Manejador global de errores
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('⚠️ Unhandled Error:', err.message || err);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : undefined
  });
});

export default app;
