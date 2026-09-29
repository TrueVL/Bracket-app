import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Fail loudly instead of silently moving to another port.
    strictPort: true,
    // Open the site in the browser on desktop machines (not on servers / containers).
    open: process.platform === 'win32' || process.platform === 'darwin' || Boolean(process.env.DISPLAY),
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
