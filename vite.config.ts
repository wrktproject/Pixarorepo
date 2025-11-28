import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { compression } from 'vite-plugin-compression2'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  
  return {
    plugins: [
      react(),
      // Bundle analyzer - generates stats.html after build
      visualizer({
        filename: './dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
      // Gzip compression for production
      isProduction && compression({
        include: /\.(js|css|html|svg|json)$/,
        threshold: 1024, // Only compress files larger than 1KB
        deleteOriginalAssets: false,
      }),
      // Brotli compression for production (better compression than gzip)
      isProduction && compression({
        include: /\.(js|css|html|svg|json)$/,
        algorithms: ['brotliCompress'],
        threshold: 1024,
        deleteOriginalAssets: false,
      }),
    ].filter(Boolean),
    build: {
      target: 'es2020',
      // Enable minification
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProduction, // Remove console.log in production only
          drop_debugger: true,
          pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
          passes: 2, // Run compression twice for better results
        },
        mangle: {
          safari10: true, // Fix Safari 10+ issues
        },
        format: {
          comments: false, // Remove all comments
        },
      },
      // Optimize chunk size
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          // Simplified chunking - let Rollup handle it automatically
          // Manual chunking was causing initialization order issues with React 19
          manualChunks: undefined,
          // Optimize asset file names with content hashing
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name?.split('.') || [];
            const ext = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `assets/images/[name]-[hash][extname]`;
            } else if (/woff2?|ttf|otf|eot/i.test(ext)) {
              return `assets/fonts/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
        },
      },
      // Source maps for debugging
      // 'hidden' generates source maps but doesn't reference them in the bundle
      // This allows debugging in production without exposing source maps to users
      sourcemap: isProduction ? 'hidden' : true,
      // Report compressed size (slower but useful for optimization)
      reportCompressedSize: true,
      // CSS code splitting
      cssCodeSplit: true,
      // Asset inlining threshold (files smaller than this will be inlined as base64)
      assetsInlineLimit: 4096, // 4KB
    },
    worker: {
      format: 'es',
      rollupOptions: {
        output: {
          // Separate worker files with content hashing
          entryFileNames: 'assets/workers/[name]-[hash].js',
        },
      },
    },
    // Optimize dependencies
    optimizeDeps: {
      include: [
        'react', 
        'react-dom', 
        'react-redux', 
        '@reduxjs/toolkit', 
        'exif-js',
        'long', // Include long to handle CommonJS properly
      ],
      exclude: ['@tensorflow/tfjs'], // Lazy load TensorFlow
      esbuildOptions: {
        // Define global for CommonJS modules
        define: {
          global: 'globalThis',
        },
      },
    },
    // Define global for browser environment
    define: {
      'global': 'globalThis',
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    resolve: {
      alias: {
        // Ensure proper resolution of CommonJS modules
        'long': 'long',
      },
    },
    // Server configuration for development
    server: {
      port: 5173,
      strictPort: false,
      open: false,
    },
    // Preview server configuration
    preview: {
      port: 4173,
      strictPort: false,
      open: false,
    },
  }
})
