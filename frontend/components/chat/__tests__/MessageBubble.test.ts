import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import MessageBubble from '../MessageBubble.vue'

const mockGetFile = vi.fn()

vi.mock('~/composables/useNaviApi', () => ({
  useNaviApi: () => ({
    baseURL: 'http://localhost:3000/api/v1',
    getFile: mockGetFile,
  }),
}))

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

describe('MessageBubble', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGetFile.mockReset()
    mockGetFile.mockResolvedValue(new Blob(['img'], { type: 'image/png' }))
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:mock-url'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: originalCreateObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: originalRevokeObjectURL,
    })
  })
  it('renders user message content', async () => {
    const wrapper = await mountSuspended(MessageBubble, {
      props: {
        message: { id: '1', role: 'user', content: 'Hello!' },
      },
    })
    expect(wrapper.text()).toContain('Hello!')
  })

  it('renders assistant message content', async () => {
    const wrapper = await mountSuspended(MessageBubble, {
      props: {
        message: { id: '2', role: 'assistant', content: 'Hi there!' },
      },
    })
    expect(wrapper.text()).toContain('Hi there!')
  })

  it('renders tool-summary with call count and expandable details', async () => {
    const wrapper = await mountSuspended(MessageBubble, {
      props: {
        message: {
          id: '6',
          role: 'tool-summary',
          content: '2 tools llamadas',
          meta: {
            calls: [
              { toolName: 'tool_a', input: { x: 1 } },
              { toolName: 'tool_b', input: { y: 2 } },
            ],
          },
        },
      },
    })
    expect(wrapper.text()).toContain('2 tools llamadas')

    const trigger = wrapper.find('button')
    expect(trigger.exists()).toBe(true)
    await trigger.trigger('click')

    expect(wrapper.text()).toContain('tool_a')
    expect(wrapper.text()).toContain('tool_b')
  })

  it('shows timestamp when createdAt is provided', async () => {
    const wrapper = await mountSuspended(MessageBubble, {
      props: {
        message: {
          id: '1',
          role: 'user',
          content: 'Hi',
          createdAt: '2026-07-13T12:00:00.000Z',
        },
      },
    })
    expect(wrapper.text()).toContain(':')
  })

  it('renders assistant images from message.images', async () => {
    const wrapper = await mountSuspended(MessageBubble, {
      props: {
        message: {
          id: '2',
          role: 'assistant',
          content: 'Aquí tienes la imagen',
          images: [
            {
              id: 'file-1',
              mediaType: 'image/png',
              url: 'http://localhost:3000/api/v1/files/file-1',
            },
          ],
        },
      },
    })
    await flushPromises()

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('blob:mock-url')
  })
})
