import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { useAuthStore } from '~/stores/auth'

vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBase: 'http://localhost:3000/api/v1' },
}))

vi.stubGlobal('definePageMeta', () => {})

describe('login page', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders token input and submit button', async () => {
    const { default: LoginPage } = await import('../../pages/login.vue')
    const wrapper = mount(LoginPage, {
      global: {
        stubs: {
          Card: false,
          CardHeader: false,
          CardTitle: false,
          CardDescription: false,
          CardContent: false,
          CardFooter: false,
          Label: false,
          Input: false,
          Button: false,
        },
      },
    })
    expect(wrapper.find('input#token').exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(true)
  })
})
