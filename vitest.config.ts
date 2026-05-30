import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Run tests in Node environment (server code, no browser APIs needed)
    environment: 'node',
    // Test file patterns
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    // setupFiles run inside each test worker BEFORE any module is imported.
    // This ensures SESSION_SECRET is visible when session.ts's module-level
    // IIFE runs (globalSetup runs in a separate worker and cannot set env vars
    // that are visible to module-level initialization code).
    setupFiles: ['./tests/setup.ts'],
    // Coverage provider
    coverage: {
      provider: 'v8',
      include: ['server/lib/**', 'server/utils/validation.ts', 'server/utils/rateLimit.ts'],
      reporter: ['text', 'lcov'],
    },
  },
})
