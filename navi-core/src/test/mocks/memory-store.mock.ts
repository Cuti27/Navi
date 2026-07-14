import { randomUUID } from "node:crypto"
import type { MemoryFile, MemoryFileInput } from "../../memory/memory-store.js"

export function createMockMemoryStore() {
  const store = new Map<string, MemoryFile>()

  return {
    save: async (input: MemoryFileInput): Promise<MemoryFile> => {
      const file: MemoryFile = {
        id: input.id || randomUUID(),
        filePath: `${input.category}/${input.title}.md`,
        title: input.title,
        category: input.category || "general",
        content: input.content,
        tags: input.tags ?? [],
        createdAt: input.createdAt || new Date().toISOString(),
        updatedAt: input.updatedAt || new Date().toISOString(),
      }
      store.set(file.filePath, file)
      return file
    },

    read: async (filePath: string): Promise<MemoryFile | undefined> => {
      return store.get(filePath)
    },

    update: async (
      filePath: string,
      content: string,
    ): Promise<MemoryFile | undefined> => {
      const existing = store.get(filePath)
      if (!existing) return undefined
      const updated: MemoryFile = {
        ...existing,
        content,
        updatedAt: new Date().toISOString(),
      }
      store.set(filePath, updated)
      return updated
    },

    delete: async (filePath: string): Promise<void> => {
      store.delete(filePath)
    },

    list: async (_category?: string): Promise<MemoryFile[]> => {
      return Array.from(store.values())
    },
  }
}
