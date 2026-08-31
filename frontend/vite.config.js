import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          if (id.includes('recharts')) {
            return 'vendor-recharts';
          }

          if (id.includes('framer-motion')) {
            return 'vendor-framer-motion';
          }

          if (id.includes('react-router') || id.includes('react-router-dom')) {
            return 'vendor-router';
          }

          if (id.includes('axios')) {
            return 'vendor-axios';
          }

          if (
            id.includes('/react-dom/') ||
            id.includes('/react/') ||
            id.includes('scheduler')
          ) {
            return 'vendor-react';
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api/auth': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
      '/api/users': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
      '/api/expenses': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        secure: false,
      },
      '/api/budgets': {
        target: 'http://localhost:8083',
        changeOrigin: true,
        secure: false,
      },
      '/api/notifications': {
        target: 'http://localhost:8084',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
