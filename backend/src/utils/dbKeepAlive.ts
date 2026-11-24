import prisma from './prisma';

let keepAliveTimer: NodeJS.Timeout | null = null;

/**
 * Servicio Keep-Alive para prevenir que Supabase pause el proyecto
 * por inactividad durante períodos sin tráfico de usuarios.
 */
export function startDbKeepAlive(intervalMinutes = 360) {
  if (keepAliveTimer) return;

  const ping = async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`[Keep-Alive DB] 🟢 Ping a Supabase exitoso (${new Date().toLocaleString()})`);
    } catch (err: any) {
      console.error(`[Keep-Alive DB] 🔴 Error en Ping a Supabase:`, err?.message || err);
    }
  };

  // Ping inicial al arrancar el servidor
  ping();

  // Ping periódico (por defecto cada 6 horas)
  const intervalMs = intervalMinutes * 60 * 1000;
  keepAliveTimer = setInterval(ping, intervalMs);
  keepAliveTimer.unref(); // Permite que el proceso de Node finalice limpiamente si es necesario
}

export function stopDbKeepAlive(): void {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}
