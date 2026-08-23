import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSecureStorage } from '../secureStorage'

const mockIdbGetItem = vi.fn()
const mockIdbSetItem = vi.fn()
const mockIdbRemoveItem = vi.fn()

vi.mock('../idbStorage', () => ({
  idbGetItem: (...args: unknown[]) => mockIdbGetItem(...args),
  idbSetItem: (...args: unknown[]) => mockIdbSetItem(...args),
  idbRemoveItem: (...args: unknown[]) => mockIdbRemoveItem(...args),
}))

function stubLocalStorage() {
  const storage = new Map<string, string>()
  const fake = {
    getItem: vi.fn((k: string) => storage.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => { storage.set(k, v) }),
    removeItem: vi.fn((k: string) => { storage.delete(k) }),
    clear: vi.fn(() => { storage.clear() }),
    key: vi.fn(),
    get length() { return storage.size },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    writable: true,
    configurable: true,
    value: fake,
  })
  Object.defineProperty(window, 'localStorage', {
    writable: true,
    configurable: true,
    value: fake,
  })
  return { fake, storage }
}

describe('useSecureStorage (web storage)', () => {
  let fakeLs: ReturnType<typeof stubLocalStorage>

  beforeEach(() => {
    mockIdbGetItem.mockReset()
    mockIdbSetItem.mockReset()
    mockIdbRemoveItem.mockReset()
    fakeLs = stubLocalStorage()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns web storage in a non-tauri client', () => {
    const storage = useSecureStorage()
    expect(storage.getItem).toBeTypeOf('function')
    expect(storage.setItem).toBeTypeOf('function')
    expect(storage.removeItem).toBeTypeOf('function')
  })

  it('getItem reads from IndexedDB first', async () => {
    mockIdbGetItem.mockResolvedValue('idb-value')
    const storage = useSecureStorage()
    await expect(storage.getItem('token')).resolves.toBe('idb-value')
    expect(fakeLs.fake.getItem('token')).toBeNull()
  })

  it('getItem falls back to localStorage when IndexedDB returns null', async () => {
    mockIdbGetItem.mockResolvedValue(null)
    fakeLs.storage.set('token', 'ls-value')
    const storage = useSecureStorage()
    await expect(storage.getItem('token')).resolves.toBe('ls-value')
  })

  it('getItem falls back to localStorage when IndexedDB throws', async () => {
    mockIdbGetItem.mockRejectedValue(new Error('idb down'))
    fakeLs.storage.set('token', 'ls-value')
    const storage = useSecureStorage()
    await expect(storage.getItem('token')).resolves.toBe('ls-value')
  })

  it('getItem returns null when both backends fail', async () => {
    mockIdbGetItem.mockRejectedValue(new Error('idb down'))
    fakeLs.fake.getItem.mockImplementation(() => {
      throw new Error('ls down')
    })
    const storage = useSecureStorage()
    await expect(storage.getItem('token')).resolves.toBeNull()
  })

  it('setItem writes through to IndexedDB', async () => {
    mockIdbSetItem.mockResolvedValue(undefined)
    const storage = useSecureStorage()
    await storage.setItem('token', 'abc')
    expect(mockIdbSetItem).toHaveBeenCalledWith('token', 'abc')
    expect(fakeLs.storage.has('token')).toBe(false)
  })

  it('setItem falls back to localStorage when IndexedDB throws', async () => {
    mockIdbSetItem.mockRejectedValue(new Error('idb down'))
    const storage = useSecureStorage()
    await storage.setItem('token', 'abc')
    expect(fakeLs.storage.get('token')).toBe('abc')
  })

  it('setItem ignores errors when both backends fail', async () => {
    mockIdbSetItem.mockRejectedValue(new Error('idb down'))
    fakeLs.fake.setItem.mockImplementation(() => {
      throw new Error('ls down')
    })
    const storage = useSecureStorage()
    await expect(storage.setItem('token', 'abc')).resolves.toBeUndefined()
  })

  it('removeItem clears from IndexedDB and localStorage', async () => {
    mockIdbRemoveItem.mockResolvedValue(undefined)
    fakeLs.storage.set('token', 'abc')
    const storage = useSecureStorage()
    await storage.removeItem('token')
    expect(mockIdbRemoveItem).toHaveBeenCalledWith('token')
    expect(fakeLs.storage.has('token')).toBe(false)
  })

  it('removeItem ignores IndexedDB errors but still clears localStorage', async () => {
    mockIdbRemoveItem.mockRejectedValue(new Error('idb down'))
    fakeLs.storage.set('token', 'abc')
    const storage = useSecureStorage()
    await storage.removeItem('token')
    expect(fakeLs.storage.has('token')).toBe(false)
  })
})
