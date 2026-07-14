export interface SecureStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

function createCookieStorage(): SecureStorage {
  const tokenCookie = useCookie<string | null>('navi-token', {
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  return {
    async getItem() {
      return tokenCookie.value ?? null
    },
    async setItem(_key, value) {
      tokenCookie.value = value
    },
    async removeItem() {
      tokenCookie.value = null
    },
  }
}

function createTauriStorage(): SecureStorage {
  let store: Awaited<ReturnType<typeof import('@tauri-apps/plugin-store').load>> | null = null

  async function ensure() {
    if (store) return
    const { load } = await import('@tauri-apps/plugin-store')
    store = await load('auth.dat', { defaults: {}, autoSave: true })
  }

  return {
    async getItem(key: string) {
      await ensure()
      return (await store!.get<string>(key)) ?? null
    },
    async setItem(key: string, value: string) {
      await ensure()
      await store!.set(key, value)
    },
    async removeItem(key: string) {
      await ensure()
      await store!.delete(key)
    },
  }
}

export function useSecureStorage(): SecureStorage {
  const isTauriClient =
    import.meta.client &&
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in window

  if (isTauriClient) {
    return createTauriStorage()
  }

  return createCookieStorage()
}
