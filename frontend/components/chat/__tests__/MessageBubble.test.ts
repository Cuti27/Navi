import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MessageBubble from '../MessageBubble.vue'

describe('MessageBubble', () => {
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
})
