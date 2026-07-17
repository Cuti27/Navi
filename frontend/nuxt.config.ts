import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devServer: {
    port: 3001,
  },
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  experimental: {
    appManifest: false,
  },
  modules: [
    '@pinia/nuxt',
    '@nuxtjs/google-fonts',
    'shadcn-nuxt',
    '@vite-pwa/nuxt',
  ],
  css: ['~/assets/css/tailwind.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3000/api/v1',
    },
  },
  googleFonts: {
    families: {
      Inter: [400, 500, 600, 700],
      'JetBrains+Mono': [400, 500],
    },
    display: 'swap',
  },
  shadcn: {
    prefix: '',
    componentDir: './components/ui',
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Navi',
      short_name: 'Navi',
      description: 'Agente de IA privado para Homelab',
      theme_color: '#99462a',
      background_color: '#fff8f6',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      icons: [
        {
          src: '/icon.png',
          sizes: '1024x1024',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'gstatic-fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
      ],
    },
    client: {
      installPrompt: true,
      periodicSyncForUpdates: 20,
    },
    devOptions: {
      enabled: true,
      type: 'module',
    },
  },
  app: {
    head: {
      meta: [
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Navi' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'theme-color', content: '#99462a' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
      ],
      link: [
        { rel: 'apple-touch-icon', href: '/icon.png' },
      ],
    },
  },
})
