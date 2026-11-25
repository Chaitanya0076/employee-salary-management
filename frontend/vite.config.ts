import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The API is always reached as same-origin /api: proxied to the Express server
// in development, rewritten by Vercel in production (see vercel.json). No CORS.
const API_TARGET = process.env['API_PROXY_TARGET'] ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: API_TARGET, changeOrigin: false } },
  },
  preview: {
    proxy: { '/api': { target: API_TARGET, changeOrigin: false } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    css: false,
    // Above Testing Library's 5s async timeout (src/test/setup.ts), so failures report the real error.
    testTimeout: 15_000,
  },
});
