import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import MessageImage from '../MessageImage.vue'

const mockGetFile = vi.fn()

vi.mock('~/composables/useNaviApi', () => ({
  useNaviApi: () => ({
    baseURL: 'http://localhost:3000/api/v1',
    getFile: mockGetFile,
  }),
}))

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

describe('MessageImage', () => {
  const image = {
    id: 'file-1',
    mediaType: 'image/png',
    url: 'http://localhost:3000/api/v1/files/file-1',
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    mockGetFile.mockReset()
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
    vi.clearAllMocks()
  })

  it('fetches the blob and renders an img with the objectURL', async () => {
    mockGetFile.mockResolvedValue(new Blob(['fake'], { type: 'image/png' }))

    const wrapper = await mountSuspended(MessageImage, { props: { image } })
    await flushPromises()

    expect(mockGetFile).toHaveBeenCalledWith('file-1')
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('blob:mock-url')
    expect(img.attributes('alt')).toBe('file-1')
  })

  it('shows a placeholder when the blob fails to load', async () => {
    mockGetFile.mockRejectedValue(new Error('network error'))

    const wrapper = await mountSuspended(MessageImage, { props: { image } })
    await flushPromises()

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('No se pudo cargar la imagen')
  })

  it('shows a loading placeholder before the blob resolves', async () => {
    let resolveBlob: (b: Blob) => void = () => {}
    mockGetFile.mockImplementation(
      () => new Promise<Blob>((resolve) => { resolveBlob = resolve }),
    )

    const wrapper = await mountSuspended(MessageImage, { props: { image } })
    await flushPromises()

    expect(wrapper.text()).toContain('Cargando imagen…')

    resolveBlob(new Blob(['fake'], { type: 'image/png' }))
    await flushPromises()
    expect(wrapper.find('img').exists()).toBe(true)
  })
})
