import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error ESM shared server module
import { handleApiRequest } from './server/launcherBackend.mjs';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

function launcherApiPlugin(): Plugin {
  return {
    name: 'aether-launcher-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handleApiRequest(req, res, ROOT_DIR)) {
          next();
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handleApiRequest(req, res, ROOT_DIR)) {
          next();
        }
      });
    },
  };
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), launcherApiPlugin()],
  build: {
    rollupOptions: {
      output: isSsrBuild
        ? undefined
        : {
            manualChunks: {
              'vendor-react': ['react', 'react-dom', 'zustand'],
              'vendor-motion': ['framer-motion'],
              'vendor-ui': [
                '@radix-ui/react-dialog',
                '@radix-ui/react-slider',
                '@radix-ui/react-switch',
                '@radix-ui/react-tooltip',
                'lucide-react',
              ],
            },
          },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    cors: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    cors: true,
  },
}));
