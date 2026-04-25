import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/ViefPiano/',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'apple-touch-icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'ViefPiano',
        short_name: 'ViefPiano',
        description: 'Kies random een pianonummer uit je oefenlijst.',
        lang: 'nl',
        theme_color: '#1f1f1f',
        background_color: '#121212',
        display: 'standalone',
        scope: '/ViefPiano/',
        start_url: '/ViefPiano/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Netwerk-first voor HTML zodat updates landen; cache-first voor assets.
        navigateFallback: '/ViefPiano/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'viefpiano-html',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
    }),
  ],
});
