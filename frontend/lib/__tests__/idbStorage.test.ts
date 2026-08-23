import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { idbGetItem, idbSetItem, idbRemoveItem } from '../idbStorage'

interface FakeRequest<T = unknown> {
  result: T
  error: Error | null
  onsuccess: ((ev: unknown) => void) | null
  onerror: ((ev: unknown) => void) | null
}

function createFakeIndexedDB() {
  const data = new Map<string, string>()
  const opRequests: FakeRequest[] = []
  let openRequest: FakeRequest = null as unknown as FakeRequest

  function makeRequest<T>(result: T): FakeRequest<T> {
    return {
      result,
      error: null,
      onsuccess: null,
      onerror: null,
    }
  }

  const db = {
    objectStoreNames: { contains: () => true },
    transaction: () => ({
      objectStore: () => ({
        get: (key: string) => {
          const req = makeRequest<unknown>(data.get(key))
          opRequests.push(req)
          return req
        },
        put: (value: string, key: string) => {
          const req = makeRequest<unknown>(undefined)
          data.set(key, value)
          opRequests.push(req)
          return req
        },
        delete: (key: string) => {
          const req = makeRequest<unknown>(undefined)
          data.delete(key)
          opRequests.push(req)
          return req
        },
      }),
    }),
  }

  openRequest = makeRequest<unknown>(db)

  return {
    data,
    opRequests,
    get openRequest() { return openRequest },
    indexedDB: {
      open: vi.fn(() => openRequest),
    },
    async flush() {
      openRequest.onsuccess?.({})
      await Promise.resolve()
      await Promise.resolve()
      for (const r of opRequests) r.onsuccess?.({})
      await Promise.resolve()
      await Promise.resolve()
    },
  }
}

describe('idbStorage', () => {
  let fake: ReturnType<typeof createFakeIndexedDB>

  beforeEach(() => {
    fake = createFakeIndexedDB()
    Object.defineProperty(window, 'indexedDB', {
      writable: true,
      configurable: true,
      value: fake.indexedDB,
    })
  })

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).indexedDB
    vi.restoreAllMocks()
  })

  it('setItem stores a value and getItem retrieves it', async () => {
    const setPromise = idbSetItem('token', 'abc')
    await fake.flush()
    await setPromise
    expect(fake.data.get('token')).toBe('abc')

    const getPromise = idbGetItem('token')
    await fake.flush()
    await expect(getPromise).resolves.toBe('abc')
  })

  it('getItem returns null for a missing key', async () => {
    const promise = idbGetItem('missing')
    await fake.flush()
    await expect(promise).resolves.toBeNull()
  })

  it('getItem returns null when indexedDB is unavailable', async () => {
    delete (window as unknown as Record<string, unknown>).indexedDB
    await expect(idbGetItem('token')).resolves.toBeNull()
  })

  it('getItem returns null when the operation fails', async () => {
    const promise = idbGetItem('token')
    // Let openDB resolve, then reject the operation request.
    fake.openRequest.onsuccess?.({})
    await Promise.resolve()
    await Promise.resolve()
    fake.opRequests[0].error = new Error('boom')
    fake.opRequests[0].onerror?.({})
    await expect(promise).resolves.toBeNull()
  })

  it('removeItem deletes the stored value', async () => {
    fake.data.set('token', 'abc')
    const promise = idbRemoveItem('token')
    await fake.flush()
    await promise
    expect(fake.data.has('token')).toBe(false)
  })

  it('setItem rejects when the operation fails', async () => {
    const promise = idbSetItem('token', 'abc')
    fake.openRequest.onsuccess?.({})
    await Promise.resolve()
    await Promise.resolve()
    fake.opRequests[0].error = new Error('boom')
    fake.opRequests[0].onerror?.({})
    await expect(promise).rejects.toThrow('boom')
  })
})
