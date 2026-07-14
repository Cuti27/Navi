import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '~/stores/auth'

const apiBase = 'http://localhost:3000/api/v1'

vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBase },
}))

describe('useNaviApi', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.setToken('test-token')
  })

  it('getSessions returns sessions', async () => {
    const mockFetch = vi.fn().mockResolvedValue([{ id: '1', title: 'Chat 1' }])
    vi.stubGlobal('$fetch', mockFetch)

    const { useNaviApi } = await import('../useNaviApi')
    const api = useNaviApi()
    const sessions = await api.getSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].title).toBe('Chat 1')
  })

  it('createSession creates a session', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ id: 'new-id', title: 'New Chat' })
    vi.stubGlobal('$fetch', mockFetch)

    const { useNaviApi } = await import('../useNaviApi')
    const api = useNaviApi()
    const session = await api.createSession('New Chat')
    expect(session.id).toBe('new-id')
  })

  it('deleteSession returns void on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('$fetch', mockFetch)

    const { useNaviApi } = await import('../useNaviApi')
    const api = useNaviApi()
    await expect(api.deleteSession('some-id')).resolves.toBeUndefined()
  })

  it('getPendingApprovals returns approvals', async () => {
    const mockFetch = vi.fn().mockResolvedValue([])
    vi.stubGlobal('$fetch', mockFetch)

    const { useNaviApi } = await import('../useNaviApi')
    const api = useNaviApi()
    const approvals = await api.getPendingApprovals('s1')
    expect(approvals).toEqual([])
  })
})
