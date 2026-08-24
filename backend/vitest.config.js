import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.{test,spec}.js'],
    alias: {
      // Resuelve imports relativos al root del backend
    }
  },
  resolve: {
    alias: {
      // Para que Vitest pueda resolver imports que salen del módulo
      // por ejemplo: ../../../../shared/errors/AppErrors.js
    }
  }
});
