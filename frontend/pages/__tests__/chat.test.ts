import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { useAgentStore } from '~/stores/agent'

vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBase: 'http://localhost:3000/api/v1' },
}))

vi.stubGlobal('useRoute', () => ({ params: { id: 'session-1' } }))
vi.stubGlobal('useRouter', () => ({ push: vi.fn() }))

vi.mock('../../composables/useNaviApi', () => ({
  useNaviApi: () => ({
    getSession: vi.fn().mockResolvedValue({
      session: { id: 'session-1', title: 'Chat Test' },
      messages: [],
    }),
    getPendingApprovals: vi.fn().mockResolvedValue([]),
  }),
}))

vi.mock('../../composables/useSseChat', () => ({
  useSseChat: () => ({
    messages: ref([]),
    isStreaming: ref(false),
    error: ref(''),
    pendingApprovals: ref([]),
    sendMessage: vi.fn(),
    submitApproval: vi.fn(),
    loadHistory: vi.fn(),
    loadPendingApprovals: vi.fn(),
    resetMessages: vi.fn(),
    cancel: vi.fn(),
  }),
}))

describe('chat page', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders large Navi column on desktop and hides mobile Navi strip', async () => {
    const agent = useAgentStore()
    agent.state = 'idle'

    const { default: ChatPage } = await import('../../pages/chat/[id].vue')

    const wrapper = await mountSuspended(ChatPage)
    await flushPromises()

    const naviColumn = wrapper.find('[data-testid="chat-navi-column"]')
    const mobileNavi = wrapper.find('[data-testid="chat-mobile-navi"]')
    const contentColumn = wrapper.find('[data-testid="chat-content-column"]')

    expect(naviColumn.exists()).toBe(true)
    expect(contentColumn.exists()).toBe(true)

    expect(naviColumn.classes()).toContain('md:w-1/2')
    expect(naviColumn.classes()).toContain('md:max-w-[520px]')
    expect(mobileNavi.classes()).toContain('md:hidden')

    expect(wrapper.find('h1').text()).toBe('Chat Test')
  })
})
