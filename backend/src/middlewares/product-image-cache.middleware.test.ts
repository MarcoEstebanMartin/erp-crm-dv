import { describe, it, expect } from 'vitest';
import {
  createConcurrencyLimiter,
  resolveProductImageCacheHeader,
} from './product-image-cache.middleware';

describe('product-image-cache.middleware', () => {
  describe('createConcurrencyLimiter', () => {
    it('nunca supera el limite maximo de tareas concurrentes y respeta orden FIFO', async () => {
      const limit = createConcurrencyLimiter(4);
      let active = 0;
      let maxActiveSeen = 0;
      const startedOrder: number[] = [];

      const tasks = Array.from({ length: 12 }, (_, idx) =>
        limit(async () => {
          startedOrder.push(idx);
          active += 1;
          if (active > maxActiveSeen) maxActiveSeen = active;
          await new Promise((resolve) => setTimeout(resolve, 10));
          active -= 1;
          return idx * 2;
        }),
      );

      const results = await Promise.all(tasks);
      expect(maxActiveSeen).toBe(4);
      expect(active).toBe(0);
      expect(startedOrder).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(results).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
    });

    it('libera el cupo correctamente si una tarea falla con error', async () => {
      const limit = createConcurrencyLimiter(1);

      await expect(
        limit(async () => {
          throw new Error('fallo simulado');
        }),
      ).rejects.toThrow('fallo simulado');

      const nextResult = await limit(async () => 'ok');
      expect(nextResult).toBe('ok');
    });
  });

  describe('resolveProductImageCacheHeader', () => {
    it('aplica cache de 7 dias para archivos versionados y 1 hora para legados', () => {
      expect(resolveProductImageCacheHeader('0001_1794259632.png')).toContain('max-age=604800');
      expect(resolveProductImageCacheHeader('0001.jpg')).toContain('max-age=3600');
    });
  });
});
