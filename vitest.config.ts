import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    testTimeout: 120_000,
    hookTimeout: 120_000,
    teardownTimeout: 120_000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
      // Cloud-sync conflict copies of real test files.
      // The parens must be bracketed: picomatch reads a bare `(1)` as an
      // extglob group, so the obvious '**/* (1)*' silently matches nothing and
      // the stale duplicates keep running.
      '**/*[(]1[)]*',
      '**/*[(]2[)]*',
      // Rules tests need the Firestore emulator; run via `npm run test:rules`.
      '**/*.emulator.test.*',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/',
        'e2e/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      services: resolve(__dirname, './src/services'),
    },
  },
});
