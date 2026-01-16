import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath, URL } from 'node:url';
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' && process.env.REPL_ID !== undefined
      ? [await import('@replit/vite-plugin-cartographer').then((m) => m.cartographer())]
      : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./client/src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '@assets': fileURLToPath(new URL('./attached_assets', import.meta.url)),
    },
  },
  root: path.resolve(import.meta.dirname, 'client'),
  publicDir: path.resolve(import.meta.dirname, 'client/public'),
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Enable source maps for production debugging (can be disabled for smaller bundles)
    sourcemap: false,
    // Increase chunk size warning limit to 1000kb (we have proper code splitting)
    chunkSizeWarningLimit: 1000,
    // Enable minification
    minify: 'esbuild',
    // Optimize dependencies
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: {
          // Core React libraries (rarely change - long cache)
          'vendor-react': ['react', 'react-dom', 'wouter'],

          // UI component library - Core (Radix UI - stable, rarely updated)
          'vendor-ui-core': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
            '@radix-ui/react-tooltip',
          ],
          'vendor-ui-extra': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-switch',
            '@radix-ui/react-slider',
            '@radix-ui/react-label',
            '@radix-ui/react-separator',
          ],

          // Data fetching & state management
          'vendor-query': ['@tanstack/react-query'],

          // Form handling (used across many pages)
          'vendor-form': ['react-hook-form', '@hookform/resolvers', 'zod', 'zod-validation-error'],

          // Icons & UI utilities (large but frequently used)
          'vendor-icons': ['lucide-react', 'react-icons'],

          // Date handling
          'vendor-date': ['date-fns', 'react-day-picker'],

          // Charts & visualization (large, lazy loaded on dashboard pages)
          'vendor-charts': ['recharts'],

          // Utilities (small, frequently used)
          'vendor-utils': ['clsx', 'tailwind-merge', 'class-variance-authority'],

          // Animation library (used sparingly)
          'vendor-animation': ['framer-motion'],
        },
        // Optimize chunk file naming for better caching
        chunkFileNames: (chunkInfo) => {
          // Vendor chunks get a stable name for long-term caching
          if (chunkInfo.name.startsWith('vendor-')) {
            return 'assets/[name]-[hash].js';
          }
          // App chunks get a hash-based name
          return 'assets/[name]-[hash].js';
        },
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Target modern browsers for smaller bundles
    target: 'es2020',
  },
  server: {
    fs: {
      strict: true,
      deny: ['**/.*'],
    },
    proxy: {
      // Proxy /api/* requests to Edge Functions
      '/api': {
        target: 'http://localhost:8000', // Supabase Edge Functions local server
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''), // Strip /api prefix
      },
    },
  },
});
