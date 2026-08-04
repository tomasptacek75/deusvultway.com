import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../php-forpsi/public',
    emptyOutDir: false,
    // scripts/clean-stale-assets.js potřebuje kompletní seznam emitovaných souborů (včetně
    // lazy-loadovaných chunků z React.lazy(), na které nikde v index.html není přímý odkaz —
    // ty se řeší až za běhu z JS) — bez manifestu by regexem přes index.html omylem smazalo
    // i aktuální, právě vyrobené chunky.
    manifest: true,
  },
  server: {
    host: true,
    port: 5310,
    proxy: {
      '/api': 'http://localhost:8310',
    },
  },
})
