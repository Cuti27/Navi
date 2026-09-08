import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => {
  const play = vi.fn((animation: string) => ({ ok: true }))
  const destroy = vi.fn()
  return {
    play,
    destroy,
    createAvatar: vi.fn(
      (target: HTMLElement, options: { defaultAnimation: string; size: number | string }) => ({
        play,
        destroy,
      }),
    ),
  }
})

vi.mock('@bible-strong/avatar-web', () => ({
  createAvatar: mocks.createAvatar,
}))

import NaviFaceV2 from '../NaviFaceV2.vue'

describe('NaviFaceV2', () => {
  beforeEach(() => {
    mocks.play.mockClear()
    mocks.destroy.mockClear()
    mocks.createAvatar.mockClear()
  })

  it('mounts the avatar with the default animation for the initial state', async () => {
    await mountSuspended(NaviFaceV2, { props: { state: 'thinking' } })
    expect(mocks.createAvatar).toHaveBeenCalledTimes(1)
    const [target, options] = mocks.createAvatar.mock.calls[0]
    expect(target).toBeTruthy()
    expect(options.defaultAnimation).toBe('thinking')
  })

  it('plays a different animation when the state changes', async () => {
    const wrapper = await mountSuspended(NaviFaceV2, { props: { state: 'idle' } })
    await wrapper.setProps({ state: 'awaiting-approval' })
    await nextTick()
    expect(mocks.play).toHaveBeenCalledWith('awaiting-approval')
  })

  it('maps every NaviFace state to an animation key', async () => {
    const states = ['thinking', 'tool-calling', 'awaiting-approval', 'error', 'compacting'] as const
    const wrapper = await mountSuspended(NaviFaceV2, { props: { state: 'idle' } })
    for (const s of states) {
      await wrapper.setProps({ state: s })
      await nextTick()
    }
    const played = mocks.play.mock.calls.map((c) => c[0])
    for (const s of states) {
      expect(played).toContain(s)
    }
  })

  it('destroys the avatar on unmount', async () => {
    const wrapper = await mountSuspended(NaviFaceV2, { props: { state: 'idle' } })
    wrapper.unmount()
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
  })

  it('renders the avatar definition as valid', async () => {
    const definition = (await import('../v2/navi.avatar.json')).default as { body: unknown; colors: unknown }
    expect(definition).toMatchObject({ schema: 'bible-strong/avatar-definition', schemaVersion: 1 })
    expect(definition.body).toBeTruthy()
    expect(definition.colors).toBeTruthy()
  })

  it('sets the decorative ring color for the state', async () => {
    const wrapper = await mountSuspended(NaviFaceV2, { props: { state: 'awaiting-approval' } })
    expect(wrapper.element.style.getPropertyValue('--navi-ring')).toBe('#3b82f6')
  })

  it('does not apply decorative ring when decorations is disabled', async () => {
    const wrapper = await mountSuspended(NaviFaceV2, {
      props: { state: 'error', decorations: false },
    })
    expect(wrapper.classes()).not.toContain('navi-face-v2--decorations')
  })
})