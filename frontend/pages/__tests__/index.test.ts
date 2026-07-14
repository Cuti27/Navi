import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { useAgentStore } from '~/stores/agent'

vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBase: 'http://localhost:3000/api/v1' },
}))

vi.stubGlobal('useRouter', () => ({ push: vi.fn() }))

vi.mock('../../composables/useNaviApi', () => ({
  useNaviApi: () => ({
    getSessions: vi.fn().mockResolvedValue([]),
    createSession: vi.fn().mockResolvedValue({ id: 'new-id', title: 'New Chat' }),
    deleteSession: vi.fn().mockResolvedValue(undefined),
  }),
}))

describe('index page', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders Navi and sessions columns with responsive classes', async () => {
    const agent = useAgentStore()
    agent.state = 'idle'

    const { default: IndexPage } = await import('../../pages/index.vue')

    const wrapper = await mountSuspended(IndexPage)
    await flushPromises()

    const naviColumn = wrapper.find('[data-testid="home-navi-column"]')
    const sessionsColumn = wrapper.find('[data-testid="home-sessions-column"]')

    expect(naviColumn.exists()).toBe(true)
    expect(sessionsColumn.exists()).toBe(true)

    expect(naviColumn.classes()).toContain('md:w-1/2')
    expect(naviColumn.classes()).toContain('md:max-w-[520px]')
    expect(sessionsColumn.classes()).toContain('md:h-full')

    expect(wrapper.find('h1').text()).toContain('Conversaciones')
  })
})
