const DB_NAME = 'navi-pwa'
const DB_VERSION = 1
const STORE_NAME = 'secure'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = operation(store)

    request.onerror = () => reject(request.error ?? new Error('IndexedDB operation failed'))
    request.onsuccess = () => resolve(request.result)
  })
}

export async function idbGetItem(key: string): Promise<string | null> {
  try {
    const value = await withStore('readonly', (store) => store.get(key))
    if (value === undefined) return null
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

export async function idbSetItem(key: string, value: string): Promise<void> {
  await withStore('readwrite', (store) => store.put(value, key))
}

export async function idbRemoveItem(key: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(key))
}
