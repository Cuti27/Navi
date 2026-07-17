import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { MemoryStore } from "../memory-store.js"

describe("MemoryStore", () => {
  let store: MemoryStore
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "navi-mem-test-"))
    store = new MemoryStore(dir)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("saves and reads a memory file", async () => {
    const saved = await store.save({
      title: "Mi setup",
      category: "homelab",
      content: "Tengo Proxmox",
      tags: ["server"],
    })
    expect(saved.title).toBe("Mi setup")
    expect(saved.filePath).toContain("homelab/mi-setup.md")

    const read = await store.read(saved.filePath)
    expect(read).toBeDefined()
    expect(read!.content).toBe("Tengo Proxmox")
    expect(read!.tags).toEqual(["server"])
  })

  it("returns undefined when reading non-existent file", async () => {
    const result = await store.read("nonexistent.md")
    expect(result).toBeUndefined()
  })

  it("updates content of an existing memory", async () => {
    const saved = await store.save({
      title: "Test",
      category: "general",
      content: "Original content",
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    const updated = await store.update(saved.filePath, "Updated content")
    expect(updated).toBeDefined()
    expect(updated!.content).toBe("Updated content")
    expect(updated!.updatedAt).not.toBe(saved.updatedAt)

    const read = await store.read(saved.filePath)
    expect(read!.content).toBe("Updated content")
  })

  it("returns undefined when updating non-existent file", async () => {
    const result = await store.update("nonexistent.md", "new content")
    expect(result).toBeUndefined()
  })

  it("deletes a memory file", async () => {
    const saved = await store.save({
      title: "To delete",
      category: "general",
      content: "bye",
    })
    await store.delete(saved.filePath)

    const read = await store.read(saved.filePath)
    expect(read).toBeUndefined()
  })

  it("lists all memories", async () => {
    await store.save({ title: "A", category: "cat1", content: "a" })
    await store.save({ title: "B", category: "cat2", content: "b" })

    const all = await store.list()
    expect(all).toHaveLength(2)
  })

  it("lists memories filtered by category", async () => {
    await store.save({ title: "A", category: "cat1", content: "a" })
    await store.save({ title: "B", category: "cat2", content: "b" })

    const filtered = await store.list("cat1")
    expect(filtered).toHaveLength(1)
    expect(filtered[0].title).toBe("A")
  })

  it("preserves frontmatter id when reading a saved file", async () => {
    const saved = await store.save({
      id: "custom-id",
      title: "Custom",
      category: "general",
      content: "body",
    })
    expect(saved.id).toBe("custom-id")

    const read = await store.read(saved.filePath)
    expect(read!.id).toBe("custom-id")
  })

  it("rejects path traversal when reading", async () => {
    await expect(store.read("../outside.md")).rejects.toThrow("Invalid memory path")
  })

  it("rejects absolute paths", async () => {
    await expect(store.read("/etc/passwd")).rejects.toThrow("Invalid memory path")
  })

})
