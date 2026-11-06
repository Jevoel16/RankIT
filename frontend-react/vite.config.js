import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// `vite preview` serves the production headers from vercel.json so CSP issues show up locally.
const vercelHeaders = Object.fromEntries(
  JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')).headers[0].headers.map(({ key, value }) => [key, value])
);
delete vercelHeaders['Strict-Transport-Security'];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:5000';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      strictPort: true,
      host: true,
      // Same-origin /api in development keeps the session cookie first-party.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true }
      }
    },
    preview: {
      port: 3000,
      headers: vercelHeaders,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true }
      }
    },
    build: {
      outDir: 'build',
      emptyOutDir: true
    },
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
    },
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.[jt]sx?$/,
      exclude: []
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx'
        }
      }
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/setupTests.js'
    }
  };
});
