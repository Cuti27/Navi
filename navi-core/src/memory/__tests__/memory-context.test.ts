import { describe, it, expect, vi, beforeEach } from "vitest"
import { MemoryContextBuilder } from "../memory-context.js"
import type { MemoryRepository } from "../memory-repository.js"

function createMockRepository(results: Array<{
  id: string
  title: string
  category: string
  content: string
  excerpt?: string
  score: number
}>) {
  return {
    search: vi.fn().mockResolvedValue(results),
  } as unknown as MemoryRepository
}

describe("MemoryContextBuilder", () => {
  it("returns empty string when no memories match", async () => {
    const repo = createMockRepository([])
    const builder = new MemoryContextBuilder({ repository: repo })
    const result = await builder.build("hello world")
    expect(result).toBe("")
    expect(repo.search).toHaveBeenCalledWith("hello world", 5)
  })

  it("formats memory results into a system-prompt snippet", async () => {
    const repo = createMockRepository([
      {
        id: "1",
        title: "Mi setup",
        category: "homelab",
        content: "Tengo un servidor Proxmox con 64 GB de RAM",
        score: 0.95,
      },
    ])
    const builder = new MemoryContextBuilder({ repository: repo })
    const result = await builder.build("¿qué servidor tengo?")
    expect(result).toContain("Recuerdos relevantes")
    expect(result).toContain("Mi setup")
    expect(result).toContain("homelab")
    expect(result).toContain("Proxmox")
  })

  it("uses excerpt when available", async () => {
    const repo = createMockRepository([
      {
        id: "1",
        title: "Preferencia",
        category: "general",
        content: "Contenido muy largo que no debería aparecer entero en el excerpt",
        excerpt: "Fragmento recortado",
        score: 0.8,
      },
    ])
    const builder = new MemoryContextBuilder({ repository: repo })
    const result = await builder.build("preferencia")
    expect(result).toContain("Fragmento recortado")
    expect(result).not.toContain("Contenido muy largo")
  })

  it("truncates long content beyond maxExcerptLength", async () => {
    const longContent = "A".repeat(500)
    const repo = createMockRepository([
      {
        id: "1",
        title: "Largo",
        category: "general",
        content: longContent,
        score: 0.5,
      },
    ])
    const builder = new MemoryContextBuilder({
      repository: repo,
      maxExcerptLength: 100,
    })
    const result = await builder.build("largo")
    const line = result.split("\n").find((l) => l.includes("Largo"))
    expect(line).toBeDefined()
    expect(line!.length).toBeLessThan(200)
  })

  it("respects custom limit option", async () => {
    const repo = createMockRepository([
      { id: "1", title: "A", category: "cat", content: "a", score: 0.9 },
      { id: "2", title: "B", category: "cat", content: "b", score: 0.8 },
    ])
    const builder = new MemoryContextBuilder({ repository: repo, limit: 3 })
    await builder.build("test")
    expect(repo.search).toHaveBeenCalledWith("test", 3)
  })
})
