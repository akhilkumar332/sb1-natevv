import { defineConfig } from 'vitest/config';

/**
 * Firestore security-rules tests.
 *
 * Separate from `vitest.config.ts` because these need the Firestore emulator and
 * a node environment rather than jsdom. Run with `npm run test:rules`, which
 * wraps this in `firebase emulators:exec` so the emulator is started and torn
 * down around the suite. The default `npm run test:run` excludes these files so
 * CI does not need an emulator.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.emulator.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Rules tests share one emulator project and call clearFirestore() between
    // tests, so they must not run in parallel with each other.
    fileParallelism: false,
  },
});
