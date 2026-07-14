import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMemoryRoute } from "../memory.route.js"
import { randomUUID } from "node:crypto"
import type { MemoryRepository } from "../../../memory/memory-repository.js"

function createMockMemoryRepo(): MemoryRepository {
  return {
    list: vi.fn(),
    search: vi.fn(),
    getById: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getByFilePath: vi.fn(),
    reindexAll: vi.fn(),
  } as unknown as MemoryRepository
}

describe("createMemoryRoute", () => {
  let repo: MemoryRepository
  let app: ReturnType<typeof createMemoryRoute>

  beforeEach(() => {
    repo = createMockMemoryRepo()
    app = createMemoryRoute(repo)
  })

  it("GET /memory lists memories", async () => {
    vi.mocked(repo.list).mockResolvedValue([])
    const res = await app.request("/memory")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it("GET /memory passes category and limit", async () => {
    vi.mocked(repo.list).mockResolvedValue([])
    await app.request("/memory?category=homelab&limit=10")
    expect(repo.list).toHaveBeenCalledWith("homelab", 10)
  })

  it("GET /memory/search searches memories", async () => {
    vi.mocked(repo.search).mockResolvedValue([])
    const res = await app.request("/memory/search?q=proxmox")
    expect(res.status).toBe(200)
    expect(repo.search).toHaveBeenCalledWith("proxmox", undefined)
  })

  it("POST /memory/reindex triggers reindex", async () => {
    const res = await app.request("/memory/reindex", { method: "POST" })
    expect(res.status).toBe(200)
    expect(repo.reindexAll).toHaveBeenCalled()
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it("DELETE /memory/:id deletes a memory", async () => {
    const id = randomUUID()
    vi.mocked(repo.getById).mockResolvedValue({
      id,
      filePath: "general/test.md",
      title: "Test",
      category: "general",
      content: "hello",
      tags: [],
      contentHash: "abc",
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await app.request(`/memory/${id}`, { method: "DELETE" })
    expect(res.status).toBe(204)
    expect(repo.delete).toHaveBeenCalledWith("general/test.md")
  })

  it("DELETE /memory/:id returns 404 for missing memory", async () => {
    vi.mocked(repo.getById).mockResolvedValue(undefined)
    const res = await app.request(`/memory/${randomUUID()}`, { method: "DELETE" })
    expect(res.status).toBe(404)
  })
})
