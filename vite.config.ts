import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Unterpfad für GitHub Pages (Projektseite). Im Dev-Modus bleibt die App unter "/".
const BASE = '/sticker_gif_studio/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? BASE : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sticker & GIF Studio by Jorge',
        short_name: 'Sticker Studio',
        description:
          'WhatsApp-Sticker, Memes und Profilbilder direkt auf dem Gerät erstellen – ohne Konto, ohne Upload.',
        lang: 'de',
        // start_url/scope müssen unter dem GitHub-Pages-Unterpfad liegen
        start_url: command === 'build' ? BASE : '/',
        scope: command === 'build' ? BASE : '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0d1117',
        theme_color: '#10b981',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
}));
