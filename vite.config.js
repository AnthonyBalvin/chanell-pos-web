import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Chanell Tecnología POS',
        short_name: 'Chanell POS',
        description: 'Punto de Venta y Gestión para Chanell Tecnología',
        theme_color: '#0B1F3B',
        background_color: '#0B1F3B',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      // BLINDAJE DOBLE: Forzamos el límite de 5MB en cualquier estrategia de compilación
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000
      },
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5000000
      }
    })
  ],
  build: {
    cssMinify: 'esbuild'
  }
})