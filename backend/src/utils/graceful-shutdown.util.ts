export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 15_000;

export interface ClosableHttpServer {
  close: (callback?: (err?: Error) => void) => unknown;
}

export interface GracefulShutdownLogger {
  info: (msg: string) => void;
  error: (msg: string, err?: unknown) => void;
}

export interface GracefulShutdownDependencies {
  server: ClosableHttpServer;
  disconnectDb: () => Promise<void>;
  stopBackgroundJobs?: () => void;
  onShuttingDown?: () => void;
  timeoutMs?: number;
  exit?: (code: number) => void;
  logger?: GracefulShutdownLogger;
}

const defaultLogger: GracefulShutdownLogger = {
  info: (msg) => console.log(msg),
  error: (msg, err) => console.error(msg, err ?? ''),
};

/**
 * Orquesta un cierre limpio del servidor HTTP y conexiones Prisma ante SIGTERM/SIGINT.
 * Evita cortar transacciones en vuelo (pedidos, cobros, CAE) durante deploys en Railway.
 */
export function createGracefulShutdown(deps: GracefulShutdownDependencies) {
  const {
    server,
    disconnectDb,
    stopBackgroundJobs,
    onShuttingDown,
    timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
    exit = (code: number) => process.exit(code),
    logger = defaultLogger,
  } = deps;

  let shutdownPromise: Promise<void> | null = null;

  return function shutdown(signal: string): Promise<void> {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = new Promise<void>((resolve) => {
      let finished = false;

      const finish = (code: number) => {
        if (finished) return;
        finished = true;
        if (forceExitTimer) {
          clearTimeout(forceExitTimer);
        }
        exit(code);
        resolve();
      };

      logger.info(`🛑 [Shutdown] Señal ${signal} recibida. Cerrando servidor de forma segura...`);

      try {
        onShuttingDown?.();
        stopBackgroundJobs?.();
      } catch (err) {
        logger.error('⚠️ [Shutdown] Error deteniendo tareas en segundo plano:', err);
      }

      const forceExitTimer = setTimeout(async () => {
        logger.error(
          `⏱️ [Shutdown] Tiempo límite (${timeoutMs}ms) excedido esperando requests en vuelo. Forzando salida.`,
        );
        try {
          await disconnectDb();
        } catch {
          // Ignorar errores secundarios en cierre forzado
        }
        finish(1);
      }, timeoutMs);
      forceExitTimer.unref?.();

      server.close(async (closeErr) => {
        if (closeErr) {
          logger.error('❌ [Shutdown] Error cerrando servidor HTTP:', closeErr);
        } else {
          logger.info('✅ [Shutdown] Servidor HTTP cerrado sin requests pendientes.');
        }

        try {
          await disconnectDb();
          logger.info('✅ [Shutdown] Conexión Prisma cerrada correctamente.');
          finish(closeErr ? 1 : 0);
        } catch (dbErr) {
          logger.error('❌ [Shutdown] Error desconectando Prisma:', dbErr);
          finish(1);
        }
      });
    });

    return shutdownPromise;
  };
}

export function registerGracefulShutdownSignals(
  shutdownFn: (signal: string) => Promise<void>,
): void {
  process.once('SIGTERM', () => {
    void shutdownFn('SIGTERM');
  });
  process.once('SIGINT', () => {
    void shutdownFn('SIGINT');
  });
}
