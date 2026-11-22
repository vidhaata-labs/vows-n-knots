/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// The API runs on port 8000 in development (uvicorn vows_n_knots.api:app).
// /api requests are forwarded there, so the browser sees one origin.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // Test code, the test setup, and the entry point that mounts the app are not measured.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
      reporter: ['text', 'json-summary'],
      // Floors set just below the current level, so a change that leaves code untested fails `npm run test:coverage`.
      thresholds: {
        statements: 99,
        branches: 98,
        functions: 99,
        lines: 99,
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        // When the browser goes away, close the upstream request too. Without this the API
        // keeps streaming (and a plan build keeps running) after the tab has closed.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            const stop = () => {
              if (!res.writableEnded) proxyReq.destroy()
            }
            // Node keeps a half-closed socket open until the response ends, so the browser's
            // closing shows first as the socket's 'end' event.
            req.socket.on('end', stop)
            res.on('close', stop)
          })
        },
      },
    },
  },
})
