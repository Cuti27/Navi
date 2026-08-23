import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomUUID } from "node:crypto"
import { createFileRoute } from "../file.route.js"
import { FileStore } from "../../../files/file-store.js"
import type { FileRepository } from "../../../db/repositories/file.repository.js"

describe("createFileRoute", () => {
  let fileRepo: FileRepository
  let dir: string
  let store: FileStore
  let app: ReturnType<typeof createFileRoute>

  beforeEach(() => {
    fileRepo = {
      create: vi.fn(),
      getById: vi.fn(),
    }
    dir = mkdtempSync(join(tmpdir(), "navi-route-files-"))
    store = new FileStore(dir)
    app = createFileRoute(store, fileRepo)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("GET /files/:id returns file bytes with content-type and cache headers", async () => {
    const id = randomUUID()
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d])
    await store.writeFile("session-1", id, bytes)

    vi.mocked(fileRepo.getById).mockResolvedValue({
      id,
      sessionId: "session-1",
      mediaType: "image/png",
      fileName: null,
      size: bytes.byteLength,
      createdAt: new Date(),
    })

    const res = await app.request(`/files/${id}`)
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("image/png")
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable")

    const body = await res.arrayBuffer()
    expect(Buffer.from(body)).toEqual(bytes)
  })

  it("GET /files/:id returns 404 for unknown file", async () => {
    vi.mocked(fileRepo.getById).mockResolvedValue(undefined)
    const res = await app.request(`/files/${randomUUID()}`)
    expect(res.status).toBe(404)
  })

  it("GET /files/:id returns 404 when blob is missing from disk", async () => {
    const id = randomUUID()
    vi.mocked(fileRepo.getById).mockResolvedValue({
      id,
      sessionId: "session-1",
      mediaType: "image/png",
      fileName: null,
      size: 10,
      createdAt: new Date(),
    })

    const res = await app.request(`/files/${id}`)
    expect(res.status).toBe(404)
  })

  it("GET /files/:id rejects non-uuid ids", async () => {
    const res = await app.request("/files/not-a-uuid")
    expect(res.status).toBe(400)
  })
})
