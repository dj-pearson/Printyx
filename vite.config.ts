import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath, URL } from 'node:url';
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' && process.env.REPL_ID !== undefined
      ? [await import('@replit/vite-plugin-cartographer').then((m) => m.cartographer())]
      : []),
    ...(process.env.ANALYZE === 'true'
      ? [
          (await import('rollup-plugin-visualizer')).visualizer({
            open: true,
            filename: 'dist/bundle-report.html',
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
          }),
        ]
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
        manualChunks(id) {
          // Core React libraries (rarely change - long cache)
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/wouter/')
          ) {
            return 'vendor-react';
          }

          // UI component library: ALL @radix-ui/* into ONE chunk.
          // Previously split into vendor-ui-core / vendor-ui-extra, but Radix
          // components share internal helpers (react-primitive, react-slot,
          // react-compose-refs, react-use-layout-effect, etc.) that Rollup
          // extracted into one of the two chunks based on first consumer.
          // Components in the OTHER chunk then referenced minified symbols
          // that had not been initialized yet, producing runtime errors like
          // "qn is not a function" at vendor-ui-extra-*.js load time.
          if (id.includes('@radix-ui/')) {
            return 'vendor-ui';
          }

          // Data fetching & state management
          if (id.includes('@tanstack/react-query')) {
            return 'vendor-query';
          }

          // Form handling
          if (
            id.includes('react-hook-form') ||
            id.includes('@hookform/') ||
            id.includes('node_modules/zod')
          ) {
            return 'vendor-form';
          }

          // Icons (large - separate chunk)
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('react-icons')) {
            return 'vendor-icons-extra';
          }

          // Date handling
          if (id.includes('date-fns') || id.includes('react-day-picker')) {
            return 'vendor-date';
          }

          // Charts & visualization: intentionally NOT manualChunked.
          // The previous rule `id.includes('recharts') || id.includes('d3-') ||
          // id.includes('victory')` failed to include transitive deps like
          // internmap, victory-vendor, react-smooth, and recharts-scale, which
          // Rollup then placed in a separate chunk that evaluated out of order.
          // This produced the runtime TDZ error: "Cannot access 'P' before
          // initialization" at vendor-charts-*.js:9. Including SOME transitive
          // deps (e.g. eventemitter3, tiny-invariant) would break non-chart
          // pages that share those utilities. The safe choice is to let
          // Vite/Rollup handle chart code placement automatically — recharts
          // will co-locate into the lazy-loaded dashboard chunks that use it.

          // Animation library
          if (id.includes('framer-motion')) {
            return 'vendor-animation';
          }

          // Shared schema - separate chunk for the large schema file
          if (id.includes('/shared/') && (id.includes('schema') || id.includes('-schema'))) {
            return 'shared-schema';
          }

          // Supabase client
          if (id.includes('@supabase/')) {
            return 'vendor-supabase';
          }

          // Utilities (small, frequently used)
          if (
            id.includes('clsx') ||
            id.includes('tailwind-merge') ||
            id.includes('class-variance-authority')
          ) {
            return 'vendor-utils';
          }
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
