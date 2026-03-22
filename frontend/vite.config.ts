import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'VidyaSathi — AI Tutor',
        short_name: 'VidyaSathi',
        description: 'Offline-first AI tutor for every student in India',
        theme_color: '#4F46E5',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/content-pack/download/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'content-packs',
              expiration: { maxEntries: 20, maxAgeSeconds: 604800 }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/quiz/') || url.pathname.startsWith('/notebook/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 5
            }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
