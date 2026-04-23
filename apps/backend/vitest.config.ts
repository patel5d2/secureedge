import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/db/seed.ts',
        'src/db/migrate.ts',
        'src/index.ts',
        'src/types.ts',
        'src/types/**',
      ],
      thresholds: {
        statements: 88,
        branches: 75,
        functions: 85,
        lines: 92,
      },
    },
    // Timeout per test
    testTimeout: 10_000,
  },
});

