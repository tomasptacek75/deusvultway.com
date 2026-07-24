import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../php-forpsi/public',
    emptyOutDir: false,
  },
  server: {
    host: true,
    port: 5310,
    proxy: {
      '/api': 'http://localhost:8310',
    },
  },
})
