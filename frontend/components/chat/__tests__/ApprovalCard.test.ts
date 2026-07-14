import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ApprovalCard from '../ApprovalCard.vue'

describe('ApprovalCard', () => {
  const defaultPayload = {
    approvalId: 'a1',
    toolCallId: 'c1',
    toolName: 'test_tool',
    description: 'Navi quiere ejecutar test_tool',
    input: { arg: 'value' },
  }

  it('renders tool name and description', async () => {
    const wrapper = await mountSuspended(ApprovalCard, {
      props: { payload: defaultPayload },
    })
    expect(wrapper.text()).toContain('test_tool')
    expect(wrapper.text()).toContain('Navi quiere ejecutar test_tool')
  })

  it('renders cancel and authorize buttons', async () => {
    const wrapper = await mountSuspended(ApprovalCard, {
      props: { payload: defaultPayload },
    })
    expect(wrapper.text()).toContain('Cancelar')
    expect(wrapper.text()).toContain('Autorizar')
  })

  it('emits approve on authorize click', async () => {
    const wrapper = await mountSuspended(ApprovalCard, {
      props: { payload: defaultPayload },
    })
    const buttons = wrapper.findAll('button')
    const authButton = buttons[buttons.length - 1]
    await authButton.trigger('click')
    expect(wrapper.emitted('approve')).toHaveLength(1)
  })

  it('emits deny on cancel click', async () => {
    const wrapper = await mountSuspended(ApprovalCard, {
      props: { payload: defaultPayload },
    })
    const buttons = wrapper.findAll('button')
    // The cancel button is the one with variant outline / border-destructive
    const cancelButton = buttons.find((b) => b.text().includes('Cancelar'))
    expect(cancelButton).toBeDefined()
    await cancelButton!.trigger('click')
    expect(wrapper.emitted('deny')).toHaveLength(1)
  })

  it('shows input in collapsible details', async () => {
    const wrapper = await mountSuspended(ApprovalCard, {
      props: { payload: defaultPayload },
    })
    expect(wrapper.text()).toContain('Detalles técnicos')
  })
})
