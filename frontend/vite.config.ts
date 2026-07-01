import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        // Do NOT set changeOrigin — keeping Host: localhost:5173 lets Django's
        // CSRF middleware match it against the browser's Origin header.
      },
    },
  },
})
