import { describe, it, expect, vi } from "vitest"
import { createMemoryTools, MEMORY_READ_ONLY_TOOLS } from "../memory-tools.js"
import type { MemoryRepository } from "../memory-repository.js"

function createMockRepository(): any {
  return {
    search: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue({ id: "1", filePath: "test.md", title: "Test", category: "general" }),
    getById: vi.fn(),
    update: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
  }
}

describe("createMemoryTools", () => {
  it("creates four tools", () => {
    const repo = createMockRepository()
    const tools = createMemoryTools(repo)
    expect(Object.keys(tools)).toHaveLength(4)
    expect(tools.memory_search).toBeDefined()
    expect(tools.memory_save).toBeDefined()
    expect(tools.memory_update).toBeDefined()
    expect(tools.memory_list).toBeDefined()
  })

  it("memory_search has a valid input schema", async () => {
    const repo = createMockRepository()
    const tools = createMemoryTools(repo)
    const schema = tools.memory_search.inputSchema! as any as any
    const parsed = schema.safeParse({ query: "test", limit: 3 })
    expect(parsed.success).toBe(true)
  })

  it("memory_search validates limit max", () => {
    const repo = createMockRepository()
    const tools = createMemoryTools(repo)
    const schema = tools.memory_search.inputSchema! as any
    const parsed = schema.safeParse({ query: "test", limit: 20 })
    expect(parsed.success).toBe(false)
  })

  it("memory_save has a valid input schema", () => {
    const repo = createMockRepository()
    const tools = createMemoryTools(repo)
    const schema = tools.memory_save.inputSchema! as any
    const parsed = schema.safeParse({
      title: "Mi setup",
      content: "Tengo Proxmox",
      tags: ["homelab"],
    })
    expect(parsed.success).toBe(true)
  })

  it("memory_update has a valid input schema", () => {
    const repo = createMockRepository()
    const tools = createMemoryTools(repo)
    const schema = tools.memory_update.inputSchema! as any
    const parsed = schema.safeParse({ id: "abc", content: "Updated content" })
    expect(parsed.success).toBe(true)
  })

  it("memory_list has a valid input schema", () => {
    const repo = createMockRepository()
    const tools = createMemoryTools(repo)
    const schema = tools.memory_list.inputSchema! as any
    const parsed = schema.safeParse({ category: "homelab" })
    expect(parsed.success).toBe(true)
  })

  it("MEMORY_READ_ONLY_TOOLS contains search and list", () => {
    expect(MEMORY_READ_ONLY_TOOLS.has("memory_search")).toBe(true)
    expect(MEMORY_READ_ONLY_TOOLS.has("memory_list")).toBe(true)
    expect(MEMORY_READ_ONLY_TOOLS.has("memory_save")).toBe(false)
    expect(MEMORY_READ_ONLY_TOOLS.has("memory_update")).toBe(false)
  })

  it("memory_search execute returns results from repository", async () => {
    const repo = createMockRepository()
    repo.search.mockResolvedValue([
      { id: "1", title: "Test", category: "general", content: "hello", tags: [], excerpt: "hello" },
    ])
    const tools = createMemoryTools(repo)
    const result = await (tools.memory_search.execute as (args: unknown) => unknown)({
      query: "hello",
      limit: 5,
    })
    const typed = result as { count: number; results: Array<{ title: string }> }
    expect(typed.count).toBe(1)
    expect(typed.results[0].title).toBe("Test")
  })

  it("memory_save execute saves through repository", async () => {
    const repo = createMockRepository()
    repo.save.mockResolvedValue({ id: "1", filePath: "test.md", title: "Test", category: "general" })
    const tools = createMemoryTools(repo)
    const result = await (tools.memory_save.execute as (args: unknown) => unknown)({
      title: "Test",
      content: "Content",
      tags: ["tag1"],
    })
    const typed = result as { id: string; filePath: string }
    expect(typed.id).toBe("1")
    expect(typed.filePath).toBe("test.md")
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Test", content: "Content" }),
    )
  })

  it("memory_update execute updates through repository", async () => {
    const repo = createMockRepository()
    repo.getById.mockResolvedValue({ id: "1", filePath: "test.md", title: "Old", category: "general" } as never)
    repo.update.mockResolvedValue({ id: "1", filePath: "test.md", title: "Updated", category: "general" } as never)
    const tools = createMemoryTools(repo)
    const result = await (tools.memory_update.execute as (args: unknown) => unknown)({
      id: "1",
      content: "Updated content",
    })
    const typed = result as { id: string; title: string }
    expect(typed.id).toBe("1")
    expect(repo.update).toHaveBeenCalledWith("test.md", "Updated content")
  })

  it("memory_update execute returns error for missing memory", async () => {
    const repo = createMockRepository()
    repo.getById.mockResolvedValue(undefined)
    const tools = createMemoryTools(repo)
    const result = await (tools.memory_update.execute as (args: unknown) => unknown)({
      id: "nonexistent",
      content: "New content",
    })
    const typed = result as { error: string }
    expect(typed.error).toContain("not found")
  })

  it("memory_list execute lists through repository", async () => {
    const repo = createMockRepository()
    repo.list.mockResolvedValue([
      { id: "1", title: "Test", category: "general", filePath: "test.md", tags: [], updatedAt: new Date() } as never,
    ])
    const tools = createMemoryTools(repo)
    const result = await (tools.memory_list.execute as (args: unknown) => unknown)({
      category: "homelab",
      limit: 10,
    })
    const typed = result as { count: number; results: Array<{ title: string }> }
    expect(typed.count).toBe(1)
    expect(typed.results[0].title).toBe("Test")
    expect(repo.list).toHaveBeenCalledWith("homelab", 10)
  })
})
