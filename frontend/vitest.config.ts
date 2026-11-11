import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    isolate: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
