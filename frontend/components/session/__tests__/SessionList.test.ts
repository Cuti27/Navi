import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SessionList from '../SessionList.vue'

describe('SessionList', () => {
  it('renders sessions grouped by date', () => {
    const sessions = [
      {
        id: '1',
        title: 'Today',
        contextSummary: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    const wrapper = mount(SessionList, {
      props: { sessions },
    })
    expect(wrapper.text()).toContain('Today')
    expect(wrapper.text()).toContain('Hoy')
  })

  it('shows empty message when no sessions', () => {
    const wrapper = mount(SessionList, {
      props: { sessions: [] },
    })
    expect(wrapper.text()).toContain('No hay conversaciones')
  })

  it('emits select from child SessionItem', async () => {
    const sessions = [
      {
        id: '1',
        title: 'Test',
        contextSummary: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    const wrapper = mount(SessionList, {
      props: { sessions },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('select')).toBeDefined()
  })
})
