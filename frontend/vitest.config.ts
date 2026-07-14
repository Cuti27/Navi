import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    globals: false,
    exclude: ['node_modules', 'test/e2e/**'],
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'composables/**',
        'stores/**',
        'lib/**',
      ],
      exclude: ['components/ui/**'],
    },
  },
})
