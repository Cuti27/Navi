import { idbGetItem, idbRemoveItem, idbSetItem } from './idbStorage.js'

export interface SecureStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

function isClient(): boolean {
  return import.meta.client && typeof window !== 'undefined'
}

function createWebStorage(): SecureStorage {
  async function getItem(key: string): Promise<string | null> {
    if (!isClient()) return null
    try {
      const value = await idbGetItem(key)
      if (value !== null) return value
    } catch {
      // Fall through to localStorage
    }
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }

  async function setItem(key: string, value: string): Promise<void> {
    if (!isClient()) return
    try {
      await idbSetItem(key, value)
      return
    } catch {
      // Fall through to localStorage
    }
    try {
      localStorage.setItem(key, value)
    } catch {
      // Storage may be disabled or full; ignore silently.
    }
  }

  async function removeItem(key: string): Promise<void> {
    if (!isClient()) return
    try {
      await idbRemoveItem(key)
    } catch {
      // Ignore IndexedDB errors
    }
    try {
      localStorage.removeItem(key)
    } catch {
      // Ignore localStorage errors
    }
  }

  return { getItem, setItem, removeItem }
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

  return createWebStorage()
}
