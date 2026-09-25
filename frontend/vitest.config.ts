import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'services/**/*.test.ts', 'components/**/*.test.tsx'],
    environmentMatchGlobs: [['components/**/*.test.tsx', 'jsdom']],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
