import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MessageList from '../MessageList.vue'

describe('MessageList', () => {
  it('renders messages', async () => {
    const wrapper = await mountSuspended(MessageList, {
      props: {
        messages: [
          { id: '1', role: 'user', content: 'Hello' },
          { id: '2', role: 'assistant', content: 'Hi' },
        ],
      },
    })
    expect(wrapper.text()).toContain('Hello')
    expect(wrapper.text()).toContain('Hi')
  })

  it('renders empty state when no messages', async () => {
    const wrapper = await mountSuspended(MessageList, {
      props: { messages: [] },
    })
    expect(wrapper.find('.flex-col').exists()).toBe(true)
  })
})
