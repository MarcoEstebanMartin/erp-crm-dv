export interface RetryPolicyOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  isRetryable?: (err: unknown) => boolean;
  onRetry?: (attempt: number, delayMs: number, err: unknown) => void;
}

export interface QueuedRetryTask {
  key: string;
  label: string;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (err: unknown) => boolean;
  run: (attempt: number) => Promise<void>;
  onPermanentFailure?: (err: unknown, attempts: number) => Promise<void> | void;
}

interface InternalTaskState extends Required<
  Pick<QueuedRetryTask, 'key' | 'label' | 'maxAttempts' | 'baseDelayMs' | 'maxDelayMs' | 'run'>
> {
  attempts: number;
  nextRunAt: number;
  inFlight: boolean;
  lastError: string | null;
  isRetryable: (err: unknown) => boolean;
  onPermanentFailure?: (err: unknown, attempts: number) => Promise<void> | void;
}

export function computeExponentialBackoffMs(
  attempt: number,
  baseDelayMs = 1_000,
  maxDelayMs = 60_000,
  jitterRatio = 0.15,
): number {
  const safeAttempt = Math.max(1, attempt);
  const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, safeAttempt - 1));
  if (jitterRatio <= 0) return Math.round(exp);
  const delta = exp * jitterRatio;
  const jittered = exp - delta + Math.random() * (delta * 2);
  return Math.max(1, Math.min(maxDelayMs, Math.round(jittered)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (typeof t.unref === 'function') t.unref();
  });
}

/**
 * Ejecuta una operación inmediata con reintentos exponenciales acotados
 * (ideal para microcortes de 1-3s en AFIP WSFE o APIs externas).
 */
export async function executeWithResilientRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryPolicyOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 600;
  const maxDelayMs = options.maxDelayMs ?? 5_000;
  const jitterRatio = options.jitterRatio ?? 0.15;
  const isRetryable = options.isRetryable ?? (() => true);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts || !isRetryable(err)) {
        throw err;
      }
      const delayMs = computeExponentialBackoffMs(attempt, baseDelayMs, maxDelayMs, jitterRatio);
      options.onRetry?.(attempt, delayMs, err);
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

/**
 * Cola asíncrona en memoria deduplicada con concurrencia controlada y exponential backoff
 * para contingencias prolongadas (caída de ARCA/AFIP o throttling 429/5xx de Meta Cloud API).
 */
export class ResilientAsyncQueue {
  private readonly tasks = new Map<string, InternalTaskState>();
  private activeWorkers = 0;
  private timer: NodeJS.Timeout | null = null;
  private completedCount = 0;
  private failedCount = 0;

  constructor(
    private readonly maxConcurrency = 2,
    private readonly jitterRatio = 0.1,
  ) {}

  enqueue(task: QueuedRetryTask, initialDelayMs = 0): boolean {
    if (this.tasks.has(task.key)) {
      return false; // Deduplicación estricta por clave de negocio
    }

    this.tasks.set(task.key, {
      key: task.key,
      label: task.label,
      maxAttempts: Math.max(1, task.maxAttempts ?? 5),
      baseDelayMs: task.baseDelayMs ?? 2_000,
      maxDelayMs: task.maxDelayMs ?? 300_000,
      run: task.run,
      isRetryable: task.isRetryable ?? (() => true),
      onPermanentFailure: task.onPermanentFailure,
      attempts: 0,
      nextRunAt: Date.now() + Math.max(0, initialDelayMs),
      inFlight: false,
      lastError: null,
    });

    this.scheduleTick();
    return true;
  }

  getStats() {
    return {
      pending: this.tasks.size,
      inFlight: this.activeWorkers,
      completed: this.completedCount,
      failedPermanently: this.failedCount,
      keys: Array.from(this.tasks.keys()),
    };
  }

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.tasks.clear();
  }

  private scheduleTick(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.tasks.size === 0) return;

    const now = Date.now();
    let earliest = Infinity;
    for (const t of this.tasks.values()) {
      if (!t.inFlight && t.nextRunAt < earliest) {
        earliest = t.nextRunAt;
      }
    }
    if (!Number.isFinite(earliest)) return;

    const waitMs = Math.max(0, earliest - now);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.pump();
    }, waitMs);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  async pump(): Promise<void> {
    const now = Date.now();
    for (const state of this.tasks.values()) {
      if (this.activeWorkers >= this.maxConcurrency) break;
      if (state.inFlight || state.nextRunAt > now) continue;

      state.inFlight = true;
      this.activeWorkers++;
      void this.runSingleTask(state);
    }
    this.scheduleTick();
  }

  private async runSingleTask(state: InternalTaskState): Promise<void> {
    state.attempts += 1;
    try {
      await state.run(state.attempts);
      this.tasks.delete(state.key);
      this.completedCount += 1;
    } catch (err: any) {
      state.lastError = err?.message || String(err);
      const canRetry = state.attempts < state.maxAttempts && state.isRetryable(err);

      if (canRetry) {
        const delay = computeExponentialBackoffMs(
          state.attempts,
          state.baseDelayMs,
          state.maxDelayMs,
          this.jitterRatio,
        );
        state.nextRunAt = Date.now() + delay;
        state.inFlight = false;
      } else {
        this.tasks.delete(state.key);
        this.failedCount += 1;
        try {
          await state.onPermanentFailure?.(err, state.attempts);
        } catch {
          // Proteger loop de errores en callback de fallo final
        }
      }
    } finally {
      this.activeWorkers = Math.max(0, this.activeWorkers - 1);
      void this.pump();
    }
  }
}
