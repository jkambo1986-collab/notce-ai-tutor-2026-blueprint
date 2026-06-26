/**
 * @file vite.config.ts
 * @description Vite build/dev configuration for the React + TypeScript frontend.
 * Sets up the dev server (with an /api proxy to the Django backend),
 * the React plugin, compile-time env injection, and path aliases.
 */

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// `mode` is the active Vite mode (e.g., 'development' | 'production').
export default defineConfig(({ mode }) => {
    // Load env vars from .env files for this mode. The empty prefix ('') means
    // ALL vars are loaded, not just those prefixed with VITE_.
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
        // Lets the dev server resolve same-origin '/api' calls to the Django
        // backend, matching how the production (Django-served) build behaves.
        proxy: {
          '/api': {
            target: 'http://localhost:8000',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      // `define` statically replaces these identifiers in the bundle at build
      // time. Both keys are mapped to the same Gemini API key from the env so
      // client code can read either `process.env.API_KEY` or
      // `process.env.GEMINI_API_KEY`. JSON.stringify wraps the value in quotes.
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // '@' resolves to the project root for cleaner absolute imports.
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
