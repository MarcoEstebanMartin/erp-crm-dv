import app from './app';
import prisma from './utils/prisma';
import { stopDbKeepAlive } from './utils/dbKeepAlive';
import {
  startNightlyBackupSchedulerIfEnabled,
  stopNightlyBackupScheduler,
} from './services/resilience/database-backup.service';
import {
  startWebOrderPollerIfEnabled,
  stopWebOrderPoller,
} from './services/orders/web-order-poller.service';
import {
  startDeferredCaeRecoveryIfEnabled,
  stopDeferredCaeRecovery,
} from './services/resilience/external-integrations-retry.service';
import { OrderBillingService } from './services/orders/order-billing.service';
import { setServerShuttingDown } from './utils/health-check.util';
import {
  createGracefulShutdown,
  registerGracefulShutdownSignals,
} from './utils/graceful-shutdown.util';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
  console.log(`👉 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=============================================`);
  startNightlyBackupSchedulerIfEnabled();
  startWebOrderPollerIfEnabled();
  startDeferredCaeRecoveryIfEnabled((orderId) => OrderBillingService.requestCaeForOrder(orderId));
});

// Evita 502 Bad Gateway por cierre prematuro de keep-alive frente al proxy de Railway (default Node: 5s)
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

const gracefulShutdown = createGracefulShutdown({
  server,
  disconnectDb: () => prisma.$disconnect(),
  onShuttingDown: () => setServerShuttingDown(true),
  stopBackgroundJobs: () => {
    stopWebOrderPoller();
    stopDeferredCaeRecovery();
    stopNightlyBackupScheduler();
    stopDbKeepAlive();
  },
});

registerGracefulShutdownSignals(gracefulShutdown);
