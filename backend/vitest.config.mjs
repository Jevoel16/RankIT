import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 120000,
    // Each file boots its own in-memory MongoDB and app instance.
    pool: 'forks'
  }
});
