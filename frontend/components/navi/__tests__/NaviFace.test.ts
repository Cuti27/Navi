import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NaviFace from '../NaviFace.vue'

describe('NaviFace', () => {
  it('renders an SVG element', async () => {
    const wrapper = await mountSuspended(NaviFace)
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('renders with default idle state', async () => {
    const wrapper = await mountSuspended(NaviFace)
    expect(wrapper.classes()).toContain('navi-face')
    expect(wrapper.classes()).toContain('is-idle')
  })

  it('applies state class for thinking', async () => {
    const wrapper = await mountSuspended(NaviFace, {
      props: { state: 'thinking' },
    })
    expect(wrapper.classes()).toContain('is-thinking')
  })

  it('applies state class for awaiting-approval', async () => {
    const wrapper = await mountSuspended(NaviFace, {
      props: { state: 'awaiting-approval' },
    })
    expect(wrapper.classes()).toContain('is-awaiting-approval')
  })

  it('applies state class for error', async () => {
    const wrapper = await mountSuspended(NaviFace, {
      props: { state: 'error' },
    })
    expect(wrapper.classes()).toContain('is-error')
  })

  it('renders core circle', async () => {
    const wrapper = await mountSuspended(NaviFace)
    const circles = wrapper.findAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(1)
  })

  it('renders with background rect when withBackground is true', async () => {
    const wrapper = await mountSuspended(NaviFace, {
      props: { withBackground: true },
    })
    const rects = wrapper.findAll('rect')
    expect(rects.length).toBeGreaterThanOrEqual(1)
  })

  it('does not render background rect when withBackground is false', async () => {
    const wrapper = await mountSuspended(NaviFace, {
      props: { withBackground: false },
    })
    // The background is controlled by v-if="withBackground" on the rect
    // Other rects exist for eyes and stubs, so we can't just check for any rect
    // without checking size/position. The rect with v-if is the first rect element
    const rects = wrapper.findAll('rect')
    const bgRects = rects.filter((r) => r.attributes('width') === '512')
    expect(bgRects).toHaveLength(0)
  })
})
