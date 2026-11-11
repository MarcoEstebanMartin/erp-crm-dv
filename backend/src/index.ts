import app from './app';
import { startNightlyBackupSchedulerIfEnabled } from './services/resilience/database-backup.service';
import { startWebOrderPollerIfEnabled } from './services/orders/web-order-poller.service';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
  console.log(`👉 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=============================================`);
  startNightlyBackupSchedulerIfEnabled();
  startWebOrderPollerIfEnabled();
});
