export type LogLevel = 'info' | 'warn' | 'error';

export type ExternalErrorReporter = (
  error: unknown,
  context: Record<string, unknown>,
) => void;

const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'secret',
  'authorization',
  'cookie',
  'webpin',
  'apikey',
]);

let externalErrorReporter: ExternalErrorReporter | null = null;

/**
 * Permite conectar un reporter externo (ej. Sentry o webhook de alertas) en un solo punto.
 */
export function registerExternalErrorReporter(reporter: ExternalErrorReporter | null): void {
  externalErrorReporter = reporter;
}

export function redactSensitiveFields(input: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      safe[key] = '[REDACTED]';
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * Emite una línea JSON estructurada (compatible con Railway Logs / Datadog / BetterStack).
 */
export function structuredLog(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
  sink?: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void },
): string {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...redactSensitiveFields(fields),
  };
  const line = JSON.stringify(payload);
  const out = sink || console;
  if (level === 'error') {
    out.error(line);
  } else if (level === 'warn') {
    out.warn(line);
  } else {
    out.info(line);
  }
  return line;
}

export function reportUnhandledError(
  err: unknown,
  context: Record<string, unknown>,
  sink?: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void },
): void {
  const anyErr = err as any;
  const errorFields = {
    ...context,
    errorName: anyErr?.name || 'Error',
    errorCode: anyErr?.code || undefined,
    errorMessage: anyErr?.message || String(err),
  };

  structuredLog('error', 'http.unhandled_error', errorFields, sink);

  if (externalErrorReporter) {
    try {
      externalErrorReporter(err, errorFields);
    } catch {
      // Nunca dejar que un reporter externo rompa la respuesta HTTP
    }
  }
}
