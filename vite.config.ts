import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  // Pre-bundle the libraries at startup so the first page load doesn't have
  // to wait for (and reload after) Vite discovering them.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'],
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
