import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with empty token and not authenticated', () => {
    const store = useAuthStore()
    expect(store.token).toBe('')
    expect(store.isAuthenticated).toBe(false)
    expect(store.hydrated).toBe(false)
  })

  it('setToken updates token and isAuthenticated', () => {
    const store = useAuthStore()
    store.setToken('test-token')
    expect(store.token).toBe('test-token')
    expect(store.isAuthenticated).toBe(true)
    expect(store.hydrated).toBe(true)
  })

  it('clearToken resets token', () => {
    const store = useAuthStore()
    store.setToken('test-token')
    store.clearToken()
    expect(store.token).toBe('')
    expect(store.isAuthenticated).toBe(false)
  })
})
