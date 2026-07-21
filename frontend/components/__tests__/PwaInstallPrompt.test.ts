import { describe, it, expect, vi, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PwaInstallPrompt from '../PwaInstallPrompt.vue'

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('PwaInstallPrompt', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not show when standalone via CSS display-mode', async () => {
    stubMatchMedia(true)
    const wrapper = await mountSuspended(PwaInstallPrompt)
    expect(wrapper.find('.fixed').exists()).toBe(false)
  })

  it('does not show when standalone via navigator.standalone (iOS PWA)', async () => {
    stubMatchMedia(false)
    Object.defineProperty(navigator, 'standalone', {
      get: () => true,
      configurable: true,
    })
    Object.defineProperty(navigator, 'userAgent', {
      get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    })
    const wrapper = await mountSuspended(PwaInstallPrompt)
    expect(wrapper.find('.fixed').exists()).toBe(false)
  })

  it('shows iOS instructions when iOS Safari not installed as PWA', async () => {
    stubMatchMedia(false)
    Object.defineProperty(navigator, 'standalone', {
      get: () => false,
      configurable: true,
    })
    Object.defineProperty(navigator, 'userAgent', {
      get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    })
    const wrapper = await mountSuspended(PwaInstallPrompt)
    expect(wrapper.text()).toContain('Compartir')
  })

  it('does not show on desktop Chrome (no beforeinstallprompt event received)', async () => {
    stubMatchMedia(false)
    Object.defineProperty(navigator, 'standalone', {
      get: () => undefined,
      configurable: true,
    })
    Object.defineProperty(navigator, 'userAgent', {
      get: () => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      configurable: true,
    })
    const wrapper = await mountSuspended(PwaInstallPrompt)
    expect(wrapper.find('.fixed').exists()).toBe(false)
  })
})
