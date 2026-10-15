import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Relative Basis: die App läuft so unter jedem Unterpfad (z. B. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'PDF Studio by Jorge',
        short_name: 'PDF Studio',
        description:
          'PDFs zusammenfügen, sortieren, komprimieren, umwandeln, ausfüllen und unterschreiben – ohne Upload.',
        lang: 'de',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0d1117',
        theme_color: '#e11d48',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Der pdf.js-Worker ist eine .mjs-Datei und muss für Offline-Nutzung mit in den Cache
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
