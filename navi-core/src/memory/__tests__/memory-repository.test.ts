import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { MemoryRepository } from "../memory-repository.js"
import { MemoryStore } from "../memory-store.js"
import { createTestDb } from "../../test/setup.js"
import type { TestDb } from "../../test/setup.js"
import type { DB } from "../../db/client.js"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("MemoryRepository", () => {
  let db: DB
  let testDb: TestDb
  let store: MemoryStore
  let repo: MemoryRepository
  let memDir: string

  beforeEach(() => {
    testDb = createTestDb()
    db = testDb.db
    memDir = mkdtempSync(join(tmpdir(), "navi-mem-repo-"))
    store = new MemoryStore(memDir)
    repo = new MemoryRepository(db, store)
  })

  afterEach(() => {
    testDb.destroy()
    rmSync(memDir, { recursive: true, force: true })
  })

  it("saves a memory and retrieves it by id", async () => {
    const saved = await repo.save({
      title: "Test Memory",
      category: "general",
      content: "This is a test memory",
      tags: ["test"],
    })

    expect(saved.id).toBeDefined()
    expect(saved.title).toBe("Test Memory")

    const found = await repo.getById(saved.id)
    expect(found).toBeDefined()
    expect(found!.content).toBe("This is a test memory")
  })

  it("lists memories", async () => {
    await repo.save({ title: "A", category: "cat1", content: "a" })
    await repo.save({ title: "B", category: "cat2", content: "b" })

    const all = await repo.list()
    expect(all).toHaveLength(2)
  })

  it("lists memories filtered by category", async () => {
    await repo.save({ title: "A", category: "cat1", content: "a" })
    await repo.save({ title: "B", category: "cat2", content: "b" })

    const filtered = await repo.list("cat1")
    expect(filtered).toHaveLength(1)
    expect(filtered[0].title).toBe("A")
  })

  it("searches memories by text", async () => {
    await repo.save({ title: "Proxmox Config", category: "homelab", content: "Mi servidor Proxmox tiene 64 GB" })
    await repo.save({ title: "Docker Setup", category: "homelab", content: "Uso Docker para servicios" })

    const results = await repo.search("Proxmox")
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].title).toContain("Proxmox")
  })

  it("updates memory content", async () => {
    const saved = await repo.save({
      title: "Update Test",
      category: "general",
      content: "Old content",
    })

    const updated = await repo.update(saved.filePath, "New content")
    expect(updated).toBeDefined()
    expect(updated!.content).toBe("New content")

    const refetched = await repo.getById(saved.id)
    expect(refetched!.content).toBe("New content")
  })

  it("deletes a memory", async () => {
    const saved = await repo.save({
      title: "Delete Me",
      category: "general",
      content: "bye",
    })

    await repo.delete(saved.filePath)
    const found = await repo.getById(saved.id)
    expect(found).toBeUndefined()
  })

  it("reindexAll populates the DB from the file store", async () => {
    // First save directly to the store (simulating an external edit)
    await store.save({
      title: "External Edit",
      category: "general",
      content: "Added from outside",
    })

    await repo.reindexAll()

    const memories = await repo.list()
    expect(memories.length).toBeGreaterThanOrEqual(1)
    expect(memories.some((m) => m.title === "External Edit")).toBe(true)
  })
})
