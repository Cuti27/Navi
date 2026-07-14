import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devServer: {
    port: 3001,
  },
  devtools: { enabled: true },
  experimental: {
    appManifest: false,
  },
  modules: [
    '@pinia/nuxt',
    '@nuxtjs/google-fonts',
    'shadcn-nuxt',
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
})
