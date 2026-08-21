import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Forward /api/* to the .NET backend — avoids CORS during local dev
      '/api': {
        target: 'http://localhost:5253',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
