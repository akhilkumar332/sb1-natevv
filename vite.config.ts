// vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs-extra';

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Determine if we're in production
  const isProd = mode === 'production';
  
  // Use environment variables for API URLs
  const API_CONFIG = {
    LOCAL_API_URL: env.VITE_LOCAL_API_URL || 'http://localhost:5180/api/v1',
    PROD_API_URL: env.VITE_PROD_API_URL || 'https://api.bloodhubindia.com/api/v1'
  };

  return {
    plugins: [
      react(),
      {
        name: 'copy-redirects',
        writeBundle: async () => {
          await fs.copy(
            resolve(__dirname, '_redirects'),
            resolve(__dirname, 'dist', '_redirects')
          );
        }
      }
    ],
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
        isProd ? API_CONFIG.PROD_API_URL : API_CONFIG.LOCAL_API_URL
      ),
      ...Object.keys(env).reduce((acc, key) => {
        acc[`import.meta.env.${key}`] = JSON.stringify(env[key]);
        return acc;
      }, {}),
    },
    base: '/',
    build: {
      outDir: 'dist',
      sourcemap: !isProd,
    },
    server: {
      port: 5180,
      proxy: {
        '^/api/.*': {
          target: 'http://localhost:5001',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request to:', proxyReq.path);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response from:', req.url);
            });
          },
        }
      }
    }
  };
});